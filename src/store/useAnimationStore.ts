import { create } from 'zustand';

/**
 * Phase 5: Animation Store
 *
 * Zustand store that holds the catalog of discovered animation clips
 * and the current playback state.
 */

export interface AnimationClipMeta {
  /** Unique clip identifier */
  id: string;
  /** Human-readable display name (e.g. "Boxing") */
  name: string;
  /** Folder category (e.g. "Combat", "Dancing", "StarWars") */
  category: string;
  /** FBX file URL path relative to public root */
  sourceUrl: string;
  /** Which skeleton naming convention this clip uses */
  skeletonType: 'mixamo' | 'humanik' | 'unreal' | 'native';
  /** Clip duration in seconds (populated lazily on first load) */
  duration: number;
  /** Number of keyframe tracks (populated lazily on first load) */
  trackCount: number;
  /** Custom index of the clip inside a multi-clip GLB file */
  clipIndex?: number;
}

export interface AnimationState {
  /** Full catalog of discovered animation clips */
  clips: AnimationClipMeta[];
  /** ID of the currently active/playing clip (null = nothing playing) */
  activeClipId: string | null;
  /** Whether the animation mixer is currently playing */
  isPlaying: boolean;
  /** Playback speed multiplier (0.25 – 2.0) */
  playbackSpeed: number;
  /** Loop mode for clip playback */
  loopMode: 'once' | 'loop' | 'pingpong';
  /** Current playback time in seconds (for the timeline scrubber) */
  currentTime: number;
  /** Search query for filtering animations */
  searchQuery: string;
  /** Selected category filter (null = show all) */
  selectedCategory: string | null;

  insymmetryEnabled: boolean;
  gaitAsymmetry: number;
  postureBias: number;
  dynamicVariance: number;

  // Actions
  setClips: (clips: AnimationClipMeta[]) => void;
  addClip: (clip: AnimationClipMeta) => void;
  updateClipMeta: (id: string, updates: Partial<AnimationClipMeta>) => void;
  setActiveClip: (id: string | null) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setLoopMode: (mode: 'once' | 'loop' | 'pingpong') => void;
  setCurrentTime: (time: number) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;

  setInsymmetryEnabled: (enabled: boolean) => void;
  setGaitAsymmetry: (factor: number) => void;
  setPostureBias: (factor: number) => void;
  setDynamicVariance: (factor: number) => void;
}

export const useAnimationStore = create<AnimationState>((set) => ({
  clips: [],
  activeClipId: null,
  isPlaying: false,
  playbackSpeed: 1.0,
  loopMode: 'loop',
  currentTime: 0,
  searchQuery: '',
  selectedCategory: null,

  insymmetryEnabled: false,
  gaitAsymmetry: 0.0,
  postureBias: 0.0,
  dynamicVariance: 0.0,

  setClips: (clips) => set({ clips }),
  addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),
  updateClipMeta: (id, updates) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  setActiveClip: (id) => set({ activeClipId: id, currentTime: 0 }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setLoopMode: (mode) => set({ loopMode: mode }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),

  setInsymmetryEnabled: (enabled) => set({ insymmetryEnabled: enabled }),
  setGaitAsymmetry: (factor) => set({ gaitAsymmetry: factor }),
  setPostureBias: (factor) => set({ postureBias: factor }),
  setDynamicVariance: (factor) => set({ dynamicVariance: factor }),
}));

if (typeof window !== 'undefined') {
  (window as any).useAnimationStore = useAnimationStore;
}
