import * as THREE from 'three';

export interface SpatialAudioOptions {
  volume?: number;
  loop?: boolean;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  distanceModel?: 'linear' | 'inverse' | 'exponential';
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
  autoplay?: boolean;
  muted?: boolean;
  sourceType?: 'point' | 'ambient' | 'surface';
}

/**
 * Calculates theoretical spatial gain based on distance according to Web Audio API models.
 * Useful for HUD visualization, unit tests, and procedural soundscape attenuation.
 */
export function calculateSpatialGain(
  distance: number,
  options: {
    refDistance?: number;
    maxDistance?: number;
    rolloffFactor?: number;
    distanceModel?: 'linear' | 'inverse' | 'exponential';
  } = {}
): number {
  const ref = Math.max(0.0001, options.refDistance ?? 1);
  const max = Math.max(ref + 0.0001, options.maxDistance ?? 50);
  const rolloff = Math.max(0, options.rolloffFactor ?? 1);
  const model = options.distanceModel ?? 'inverse';

  const d = Math.max(0, distance);

  if (model === 'linear') {
    if (d <= ref) return 1;
    if (d >= max) return 0;
    const clampedD = Math.min(Math.max(d, ref), max);
    const gain = 1 - rolloff * ((clampedD - ref) / (max - ref));
    return Math.max(0, Math.min(1, gain));
  }

  if (model === 'exponential') {
    if (d <= ref) return 1;
    const clampedD = Math.max(d, ref);
    const gain = Math.pow(clampedD / ref, -rolloff);
    return Math.max(0, Math.min(1, isFinite(gain) ? gain : 0));
  }

  // Default: 'inverse'
  if (d <= ref) return 1;
  const clampedD = Math.max(d, ref);
  const gain = ref / (ref + rolloff * (clampedD - ref));
  return Math.max(0, Math.min(1, isFinite(gain) ? gain : 0));
}

interface ManagedAudioEntry {
  objectId: string;
  url: string;
  sound: THREE.PositionalAudio | THREE.Audio;
  options: SpatialAudioOptions;
  panner?: PannerNode;
}

/**
 * SpatialAudioManagerClass — Centralized Spatial Soundscape & Falloff Manager
 */
class SpatialAudioManagerClass {
  private listener: THREE.AudioListener | null = null;
  private audioLoader: THREE.AudioLoader | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private audioEntries = new Map<string, ManagedAudioEntry>();

  /**
   * Initializes or returns the shared AudioListener
   */
  public getListener(): THREE.AudioListener {
    if (!this.listener) {
      if (typeof window !== 'undefined' && (typeof window.AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined')) {
        this.listener = new THREE.AudioListener();
      } else {
        this.listener = {
          context: {
            sampleRate: 44100,
            createBuffer: (channels: number, length: number, sampleRate: number) => ({
              getChannelData: () => new Float32Array(length),
              duration: length / sampleRate,
              length,
              numberOfChannels: channels,
              sampleRate,
            }),
          },
          gain: { connect: () => {} },
          getInput: () => ({}),
          removeFilter: () => {},
          setFilter: () => {},
          getFilter: () => null,
          getMasterVolume: () => 1,
          setMasterVolume: () => {},
        } as any;
      }
    }
    return this.listener;
  }

  /**
   * Gets or instantiates AudioLoader
   */
  private getLoader(): THREE.AudioLoader {
    if (!this.audioLoader) {
      this.audioLoader = new THREE.AudioLoader();
    }
    return this.audioLoader;
  }

  /**
   * Preloads or retrieves an AudioBuffer
   */
  public async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (!url) return null;
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }

    return new Promise((resolve) => {
      try {
        const loader = this.getLoader();
        loader.load(
          url,
          (buffer) => {
            this.bufferCache.set(url, buffer);
            resolve(buffer);
          },
          undefined,
          (err) => {
            console.warn(`[SpatialAudioManager] Failed to load audio from "${url}":`, err);
            resolve(null);
          }
        );
      } catch (e) {
        console.warn(`[SpatialAudioManager] AudioLoader exception for "${url}":`, e);
        resolve(null);
      }
    });
  }

  /**
   * Attaches and configures spatial or ambient sound on a Three.js Object3D node
   */
  public async attachAudioToObject(
    objectNode: THREE.Object3D,
    objectId: string,
    url: string,
    options: SpatialAudioOptions = {}
  ): Promise<THREE.PositionalAudio | THREE.Audio | null> {
    if (!objectNode || !url) return null;

    const listener = this.getListener();
    const isSpatial = options.sourceType !== 'ambient';

    // Check existing entry
    let entry = this.audioEntries.get(objectId);
    if (entry && entry.url === url && ((isSpatial && entry.sound instanceof THREE.PositionalAudio) || (!isSpatial && !(entry.sound instanceof THREE.PositionalAudio)))) {
      this.applyOptions(entry.sound, options);
      return entry.sound;
    }

    // Remove previous sound if URL or type changed
    if (entry) {
      this.removeAudio(objectId);
    }

    const sound = isSpatial
      ? new THREE.PositionalAudio(listener)
      : new THREE.Audio(listener);

    this.applyOptions(sound, options);
    objectNode.add(sound);

    const newEntry: ManagedAudioEntry = {
      objectId,
      url,
      sound,
      options,
    };
    this.audioEntries.set(objectId, newEntry);

    // Asynchronously load buffer and assign
    const buffer = await this.loadBuffer(url);
    if (buffer && this.audioEntries.get(objectId) === newEntry) {
      sound.setBuffer(buffer);
      if (options.autoplay !== false && !options.muted) {
        try {
          sound.play();
        } catch (e) {
          // AudioContext might require user gesture
        }
      }
    }

    return sound;
  }

  /**
   * Generates or retrieves a cached procedural impact AudioBuffer (synthetic physical thud)
   */
  private proceduralImpactBuffers = new Map<string, AudioBuffer>();
  private lastCollisionTime = new Map<string, number>();

  public getProceduralImpactBuffer(intensity: number = 1.0): AudioBuffer | null {
    try {
      const listener = this.getListener();
      const ctx = listener.context as AudioContext;
      if (!ctx || typeof ctx.createBuffer !== 'function') return null;

      const key = `impact_${Math.round(intensity * 10)}`;
      if (this.proceduralImpactBuffers.has(key)) {
        return this.proceduralImpactBuffers.get(key)!;
      }

      const sampleRate = ctx.sampleRate || 44100;
      const duration = 0.12; // 120ms thud
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, numSamples, sampleRate);
      const data = buffer.getChannelData(0);

      const baseFreq = 80 + Math.min(120, intensity * 40); // 80Hz - 200Hz punch

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const freq = baseFreq * Math.exp(-t * 25);
        const sine = Math.sin(2 * Math.PI * freq * t);
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.3;
        const env = Math.exp(-t * 30);
        data[i] = (sine * 0.7 + noise) * env;
      }

      this.proceduralImpactBuffers.set(key, buffer);
      return buffer;
    } catch (e) {
      return null;
    }
  }

  /**
   * Plays a one-shot positional 3D sound at an Object3D's world position
   */
  public async playOneShot(
    objectNode: THREE.Object3D,
    url?: string,
    options: SpatialAudioOptions & { intensity?: number } = {}
  ): Promise<THREE.PositionalAudio | null> {
    if (!objectNode) return null;

    const listener = this.getListener();
    let sound: THREE.PositionalAudio;
    try {
      sound = new THREE.PositionalAudio(listener);
    } catch (e) {
      return null;
    }

    const intensity = Math.max(0.1, Math.min(2.0, options.intensity ?? 1.0));
    const baseVol = options.volume ?? 0.8;
    const finalVolume = baseVol * Math.min(1.0, intensity);

    sound.setVolume(finalVolume);
    sound.setLoop(false);
    sound.setRefDistance(options.refDistance ?? 1);
    sound.setMaxDistance(options.maxDistance ?? 40);
    sound.setRolloffFactor(options.rolloffFactor ?? 1);

    if (typeof (objectNode as any).add === 'function') {
      objectNode.add(sound);
    } else {
      // Rapier RigidBody or non-Object3D node fallback: position sound directly
      const pos =
        typeof (objectNode as any).translation === 'function'
          ? (objectNode as any).translation()
          : (objectNode as any).position;
      if (pos) {
        sound.position.set(pos.x ?? pos[0] ?? 0, pos.y ?? pos[1] ?? 0, pos.z ?? pos[2] ?? 0);
      }
      if (listener.parent) {
        listener.parent.add(sound);
      } else {
        listener.add(sound);
      }
    }

    // Auto cleanup once playback finishes
    sound.onEnded = () => {
      if (sound.parent) {
        sound.parent.remove(sound);
      }
      try {
        sound.disconnect();
      } catch (e) {}
    };

    if (url) {
      const buffer = await this.loadBuffer(url);
      if (buffer) {
        sound.setBuffer(buffer);
        try {
          sound.play();
        } catch (e) {}
        return sound;
      }
    }

    // Procedural fallback
    const procBuffer = this.getProceduralImpactBuffer(intensity);
    if (procBuffer) {
      sound.setBuffer(procBuffer);
      try {
        sound.play();
      } catch (e) {}
      return sound;
    }

    return sound;
  }

  /**
   * Plays a physics-driven collision audio event with velocity-proportional intensity & cooldown throttling
   */
  public async playCollisionAudio(
    objectNode: THREE.Object3D,
    objectId: string,
    url?: string,
    intensity: number = 1.0,
    options: SpatialAudioOptions = {}
  ): Promise<void> {
    if (!objectNode) return;

    // Cooldown check (50ms between collision sounds on same object)
    const now = performance.now();
    const lastTime = this.lastCollisionTime.get(objectId) ?? 0;
    if (now - lastTime < 50) {
      return;
    }
    this.lastCollisionTime.set(objectId, now);

    await this.playOneShot(objectNode, url, {
      ...options,
      intensity,
      volume: options.volume ?? 0.8,
    });
  }

  /**
   * Applies spatial falloff and volume options to a Three.js sound instance
   */
  public applyOptions(sound: THREE.PositionalAudio | THREE.Audio, options: SpatialAudioOptions): void {
    const vol = options.muted ? 0 : (options.volume ?? 1);
    sound.setVolume(vol);
    sound.setLoop(options.loop ?? true);

    if (sound instanceof THREE.PositionalAudio) {
      const ref = options.refDistance ?? 1;
      const max = options.maxDistance ?? (options as any).distance ?? 50;
      const rolloff = options.rolloffFactor ?? 1;
      const model = options.distanceModel ?? 'inverse';

      sound.setRefDistance(ref);
      sound.setMaxDistance(max);
      sound.setRolloffFactor(rolloff);
      sound.setDistanceModel(model);

      if (
        options.coneInnerAngle !== undefined &&
        options.coneOuterAngle !== undefined &&
        options.coneOuterGain !== undefined
      ) {
        sound.setDirectionalCone(
          options.coneInnerAngle,
          options.coneOuterAngle,
          options.coneOuterGain
        );
      }
    }
  }

  /**
   * Removes and disposes an audio source from an object
   */
  public removeAudio(objectId: string): void {
    const entry = this.audioEntries.get(objectId);
    if (!entry) return;

    if (entry.sound.isPlaying) {
      try {
        entry.sound.stop();
      } catch (e) {}
    }
    if (entry.sound.parent) {
      entry.sound.parent.remove(entry.sound);
    }
    entry.sound.disconnect();
    this.audioEntries.delete(objectId);
  }

  /**
   * Cleans up all audio instances
   */
  public dispose(): void {
    for (const [id] of this.audioEntries) {
      this.removeAudio(id);
    }
    this.bufferCache.clear();
    this.proceduralImpactBuffers.clear();
    this.lastCollisionTime.clear();
  }
}

export const SpatialAudioManager = new SpatialAudioManagerClass();
