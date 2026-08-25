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
      this.listener = new THREE.AudioListener();
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
  }
}

export const SpatialAudioManager = new SpatialAudioManagerClass();
