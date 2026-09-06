import * as React from 'react';
import * as THREE from 'three';
import { Play, Pause, Square, SkipBack, ChevronLeft, ChevronRight, Filter, ListFilter, Trash2, Key, Save, RotateCcw, Repeat } from 'lucide-react';
import { useStore, AnimationTrack } from '../store/useStore';
import { toast } from '../store/useToastStore';
import { usePanelResizer } from '../hooks/usePanelResizer';

function getCleanTrackName(name: string): string {
  if (name.startsWith('expression_')) {
    const key = name.replace('expression_', '');
    switch (key) {
      case 'smileFrown':
        return 'Expression: Smile / Frown';
      case 'mouthOpen':
        return 'Expression: Mouth Open';
      case 'browsRaise':
        return 'Expression: Brows Raise';
      case 'eyesSquint':
        return 'Expression: Eyes Squint';
      default:
        // format camelCase to Title Case
        const formatted = key.replace(/([A-Z])/g, ' $1');
        return 'Expression: ' + formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
  }
  return name;
}

// WeakMap cache for memoizing parsed and sorted keyframe frame numbers from track.keyframes
const keyframeFramesCache = new WeakMap<object, number[]>();

export function getCachedKeyframeFrames(keyframes: Record<number, any> | any[] | undefined, maxFrames?: number): number[] {
  if (!keyframes || typeof keyframes !== 'object') return [];

  let frames = keyframeFramesCache.get(keyframes);
  if (!frames) {
    if (Array.isArray(keyframes)) {
      frames = keyframes
        .map((k: any, idx: number) => {
          if (k && typeof k === 'object' && typeof k.frame === 'number') {
            return k.frame;
          }
          if (k !== undefined) return idx;
          return null;
        })
        .filter((f): f is number => f !== null && f >= 0)
        .sort((a, b) => a - b);
    } else {
      frames = Object.keys(keyframes)
        .map(Number)
        .filter((f) => !isNaN(f) && f >= 0)
        .sort((a, b) => a - b);
    }
    keyframeFramesCache.set(keyframes, frames);
  }

  if (maxFrames !== undefined && frames.length > 0 && frames[frames.length - 1] > maxFrames) {
    return frames.filter((f) => f <= maxFrames);
  }

  return frames;
}

const extractKeyframeValue = (track: any, frame: number) => {
  if (!track || !track.keyframes) return undefined;
  if (Array.isArray(track.keyframes)) {
    const foundObj = track.keyframes.find((k: any) => k && typeof k === 'object' && k.frame === frame);
    if (foundObj) {
      return foundObj.value;
    }
    return track.keyframes[frame];
  }
  return track.keyframes[frame];
};

const hasKeyframeAtFrame = (track: any, frame: number) => {
  if (!track || !track.keyframes) return false;
  if (Array.isArray(track.keyframes)) {
    return track.keyframes.some((k: any) => k && typeof k === 'object' && k.frame === frame) || track.keyframes[frame] !== undefined;
  }
  return track.keyframes[frame] !== undefined;
};

const BoneHeaderRow = React.memo(function BoneHeaderRow({
  boneName,
  isBoneSelected,
  outlinerWidth,
  frameWidth,
  maxFrames,
  setSelectedBoneId,
  setCurrentFrame,
  onContextMenu,
}: {
  boneName: string;
  isBoneSelected: boolean;
  outlinerWidth: number;
  frameWidth: number;
  maxFrames: number;
  setSelectedBoneId: (id: string | null) => void;
  setCurrentFrame: (frame: number) => void;
  onContextMenu: (e: React.MouseEvent, boneName: string, property: any, frame: number) => void;
}) {
  const totalTrackWidth = (maxFrames + 1) * frameWidth;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedFrame = Math.max(0, Math.min(maxFrames, Math.floor(clickX / frameWidth)));
    setCurrentFrame(clickedFrame);
  };

  const handleTrackContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedFrame = Math.max(0, Math.min(maxFrames, Math.floor(clickX / frameWidth)));
    onContextMenu(e, boneName, undefined, clickedFrame);
  };

  return (
    <div className="flex h-7 bg-neutral-900/30 border-b border-border/40 hover:bg-neutral-800/10">
      <div
        style={{ width: `${outlinerWidth}px` }}
        onClick={() => setSelectedBoneId(boneName)}
        className={`sticky left-0 z-20 h-full border-r border-border/40 flex items-center px-3 cursor-pointer select-none truncate text-[11px] font-mono font-bold transition-all ${
          isBoneSelected 
            ? 'bg-purple-900/10 text-purple-300 shadow-[inset_3px_0_0_#a855f7]' 
            : 'bg-[#181824] text-neutral-300 hover:text-white'
        }`}
      >
        <span className="truncate">{getCleanTrackName(boneName)}</span>
      </div>
      <div
        onClick={handleTrackClick}
        onContextMenu={handleTrackContextMenu}
        style={{
          width: `${totalTrackWidth}px`,
          backgroundImage: `repeating-linear-gradient(to right, transparent, transparent ${frameWidth - 1}px, rgba(255, 255, 255, 0.03) ${frameWidth - 1}px, rgba(255, 255, 255, 0.03) ${frameWidth}px)`,
          flexShrink: 0,
        }}
        className="h-full cursor-pointer relative"
      />
    </div>
  );
});

const TimelineTrackRow = React.memo(function TimelineTrackRow({
  boneName,
  track,
  isBoneSelected,
  outlinerWidth,
  frameWidth,
  maxFrames,
  setSelectedBoneId,
  setCurrentFrame,
  onContextMenu,
}: {
  boneName: string;
  track: AnimationTrack;
  isBoneSelected: boolean;
  outlinerWidth: number;
  frameWidth: number;
  maxFrames: number;
  setSelectedBoneId: (id: string | null) => void;
  setCurrentFrame: (frame: number) => void;
  onContextMenu: (e: React.MouseEvent, boneName: string, property: any, frame: number) => void;
}) {
  const totalTrackWidth = (maxFrames + 1) * frameWidth;

  const keyframeEntries = React.useMemo(() => {
    if (!track || !track.keyframes) return [];
    return getCachedKeyframeFrames(track.keyframes, maxFrames);
  }, [track?.keyframes, maxFrames]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedFrame = Math.max(0, Math.min(maxFrames, Math.floor(clickX / frameWidth)));
    setCurrentFrame(clickedFrame);
  };

  const handleTrackContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedFrame = Math.max(0, Math.min(maxFrames, Math.floor(clickX / frameWidth)));
    onContextMenu(e, boneName, track.property, clickedFrame);
  };

  return (
    <div className="flex h-7 border-b border-border/20 hover:bg-neutral-800/20">
      <div
        style={{ width: `${outlinerWidth}px` }}
        onClick={() => setSelectedBoneId(boneName)}
        className={`sticky left-0 z-20 h-full border-r border-border/20 flex items-center pl-6 pr-2 cursor-pointer select-none truncate text-[10px] font-mono transition-all ${
          isBoneSelected 
            ? 'bg-purple-900/5 text-purple-400 shadow-[inset_3px_0_0_#c084fc]' 
            : 'bg-bg-panel text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <span className="truncate opacity-80">{track.property}</span>
      </div>

      <div
        onClick={handleTrackClick}
        onContextMenu={handleTrackContextMenu}
        style={{
          width: `${totalTrackWidth}px`,
          backgroundImage: `repeating-linear-gradient(to right, transparent, transparent ${frameWidth - 1}px, rgba(255, 255, 255, 0.03) ${frameWidth - 1}px, rgba(255, 255, 255, 0.03) ${frameWidth}px)`,
          flexShrink: 0,
        }}
        className="h-full relative cursor-pointer"
      >
        {keyframeEntries.map((f) => (
          <div
            key={f}
            style={{
              position: 'absolute',
              left: `${f * frameWidth}px`,
              width: `${frameWidth}px`,
              top: 0,
              bottom: 0,
            }}
            className="flex items-center justify-center pointer-events-none"
          >
            <div
              className="w-2.5 h-2.5 bg-fuchsia-500 rotate-45 border border-fuchsia-300 rounded-[1px] shadow-[0_0_5px_rgba(217,70,239,0.8)] transition-transform hover:scale-125 pointer-events-auto cursor-pointer"
              title={`Frame ${f} Keyframe`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentFrame(f);
              }}
              onContextMenu={(e) => {
                e.stopPropagation();
                onContextMenu(e, boneName, track.property, f);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

interface ClipboardKeyframe {
  type: 'single' | 'bone_all';
  property?: 'position' | 'rotation' | 'scale' | 'morph' | 'expression';
  value?: any;
  values?: Record<string, any>;
}

// window.__keyframeClipboard is used to store copied keyframes persistently across HMR reloads.

export default function TimelinePanel() {
  const currentFrame = useStore((s) => s.currentFrame);
  const maxFrames = useStore((s) => s.maxFrames);
  const isPlayingAnimation = useStore((s) => s.isPlayingAnimation);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const setIsPlayingAnimation = useStore((s) => s.setIsPlayingAnimation);
  const loopMode = useStore((s) => s.loopMode);
  const setLoopMode = useStore((s) => s.setLoopMode);
  const tracks = useStore((s) => s.tracks);
  const selectedBoneId = useStore((s) => s.selectedBoneId);
  const setSelectedBoneId = useStore((s) => s.setSelectedBoneId);
  const workspaceMode = useStore((s) => s.workspaceMode);
  const bakeAnimationToStore = useStore((s) => s.bakeAnimationToStore);
  const setTimelineHeight = useStore((s) => s.setTimelineHeight);
  const objects = useStore((s) => s.objects);
  const facialFocusMode = useStore((s) => s.facialFocusMode);
  const updateKeyframe = useStore((s) => s.updateKeyframe);
  const deleteKeyframe = useStore((s) => s.deleteKeyframe);
  const keyframeClipboard = useStore((s) => s.keyframeClipboard);
  const setKeyframeClipboard = useStore((s) => s.setKeyframeClipboard);

  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    boneName: string;
    property?: 'position' | 'rotation' | 'scale' | 'morph' | 'expression';
    frame: number;
  } | null>(null);

  const handleContextMenu = React.useCallback((
    e: React.MouseEvent,
    boneName: string,
    property?: 'position' | 'rotation' | 'scale' | 'morph' | 'expression',
    frame?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent viewport cutoffs
    const menuWidth = 260;
    const menuHeight = 360;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let x = clientX;
    if (clientX + menuWidth > windowWidth) {
      x = Math.max(10, clientX - menuWidth);
    }

    let y = clientY;
    if (clientY + menuHeight > windowHeight) {
      y = Math.max(10, clientY - menuHeight);
    }

    setContextMenu({
      x,
      y,
      boneName,
      property,
      frame: frame ?? 0,
    });
  }, []);

  React.useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const [prevHeight, setPrevHeight] = React.useState(240);

  const playheadRef = React.useRef<HTMLDivElement>(null);
  const frameInputRef = React.useRef<HTMLInputElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [visibleFrames, setVisibleFrames] = React.useState<[number, number]>([0, 100]);

  const frameWidth = 24; // Width in px for each frame column
  const outlinerWidth = 224; // Width in px for the bone outliner column

  React.useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollLeft, clientWidth } = scrollContainerRef.current;
        const start = Math.max(0, Math.floor(Math.max(0, scrollLeft - outlinerWidth) / frameWidth) - 10);
        const end = Math.min(maxFrames, Math.ceil((scrollLeft - outlinerWidth + clientWidth) / frameWidth) + 10);
        setVisibleFrames([start, end]);
      }
    };
    handleScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll);
    }
    return () => {
      if (container) container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [frameWidth, outlinerWidth, maxFrames]);

  React.useEffect(() => {
    (window as any).updatePlayheadTransient = (frame: number) => {
      const rounded = Math.round(frame);
      if (playheadRef.current) {
        playheadRef.current.style.left = `${outlinerWidth + frame * frameWidth + frameWidth / 2}px`;
      }
      if (frameInputRef.current) {
        frameInputRef.current.value = rounded.toString();
      }
    };
    return () => {
      delete (window as any).updatePlayheadTransient;
    };
  }, [outlinerWidth, frameWidth]);

  const { handleMouseDown, handleDoubleClick } = usePanelResizer({ defaultHeight: 240, minHeight: 120 });

  const handleAddKeyframe = React.useCallback(() => {
    const state = useStore.getState();
    const targetBoneId = state.selectedBoneId;
    const targetScene = state.activeClonedScene;
    const frame = Math.round(state.currentFrame);
    
    if (!targetBoneId || !targetScene) return;

    let bone: any = null;
    targetScene.traverse((child: any) => {
      if ((child.isBone || child instanceof THREE.Bone) && child.name === targetBoneId) {
        bone = child;
      }
    });

    if (!bone) {
      console.warn(`[TimelinePanel] Bone not found in active cloned scene: ${targetBoneId}`);
      return;
    }

    state.updateKeyframe(targetBoneId, 'position', frame, bone.position.toArray());
    state.updateKeyframe(targetBoneId, 'rotation', frame, bone.quaternion.toArray());
    state.updateKeyframe(targetBoneId, 'scale', frame, bone.scale.toArray());
  }, []);

  const handleDeleteKeyframe = React.useCallback(() => {
    const state = useStore.getState();
    const targetBoneId = state.selectedBoneId;
    const frame = Math.round(state.currentFrame);
    
    if (targetBoneId) {
      state.deleteKeyframe(targetBoneId, 'position', frame);
      state.deleteKeyframe(targetBoneId, 'rotation', frame);
      state.deleteKeyframe(targetBoneId, 'scale', frame);
    } else {
      state.deleteSelectedFrameGlobal();
    }
  }, []);

  const handleResetBone = React.useCallback(() => {
    const state = useStore.getState();
    state.resetSelectedBoneFrameToDefault();
    toast.success(`Reset keyframe for bone "${state.selectedBoneId}" to default position at frame ${Math.round(state.currentFrame)}`);
  }, []);

  const handleResetFrame = React.useCallback(() => {
    const state = useStore.getState();
    state.resetFrameToDefault();
    toast.success(`Reset all bones' keyframes to default positions at frame ${Math.round(state.currentFrame)}`);
  }, []);

  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [saveName, setSaveName] = React.useState('');
  const [selectedOverwriteName, setSelectedOverwriteName] = React.useState('');
  const [saveMode, setSaveMode] = React.useState<'overwrite' | 'new'>('overwrite');

  const animationTargetId = useStore((s) => s.animationTargetId);
  const selectedIds = useStore((s) => s.selectedIds);
  const modelAnimations = useStore((s) => s.modelAnimations);

  const targetObj = React.useMemo(() => {
    if (animationTargetId) {
      const found = objects.find((o) => o.id === animationTargetId);
      if (found) return found;
    }
    if (selectedIds.length === 1) {
      const found = objects.find((o) => o.id === selectedIds[0]);
      if (found) return found;
    }
    return objects.find(
      (o) =>
        ['mesh', 'gltf', 'obj', 'fbx', 'csg', 'group'].includes(o.type) &&
        !o.id.startsWith('obj_sun') &&
        !o.id.startsWith('obj_moon')
    );
  }, [objects, animationTargetId, selectedIds]);

  const availableClips = React.useMemo(() => {
    if (!targetObj) return [];
    const base = targetObj.availableAnimations || modelAnimations[targetObj.id] || [];
    const custom = targetObj.customAnimations ? Object.keys(targetObj.customAnimations) : [];
    const merged = Array.from(new Set([...base, ...custom]));
    return merged.filter(name => name !== 'None');
  }, [targetObj, modelAnimations]);

  const handleSaveAnimationClick = React.useCallback(() => {
    if (!targetObj) {
      toast.error('Save Failed', 'No animation target selected.');
      return;
    }
    const currentActive = targetObj.activeAnimation || '';
    const initialOverwrite = currentActive && currentActive !== 'None' ? currentActive : (availableClips[0] || '');
    setSelectedOverwriteName(initialOverwrite);
    setSaveName('');
    setSaveMode(availableClips.length > 0 ? 'overwrite' : 'new');
    setShowSaveModal(true);
  }, [targetObj, availableClips]);

  const handleConfirmSave = React.useCallback(() => {
    const finalName = saveMode === 'overwrite' ? selectedOverwriteName : saveName.trim();
    if (!finalName) {
      toast.error('Save Failed', 'Please select or enter an animation name.');
      return;
    }

    useStore.getState().bakeAnimationToStore(finalName);
    setShowSaveModal(false);
    toast.success('Animation Saved', `Successfully saved and baked keyframes to "${finalName}".`);
  }, [saveMode, selectedOverwriteName, saveName]);

  React.useEffect(() => {
    if (workspaceMode !== 'animation') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;

      const isInput = (el: HTMLElement | null) => {
        if (!el) return false;
        const tag = el.tagName?.toUpperCase();
        return (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          el.isContentEditable ||
          el.getAttribute('contenteditable') === 'true' ||
          Boolean(el.closest?.('.monaco-editor, [contenteditable="true"], input, textarea, select'))
        );
      };

      if (isInput(target) || isInput(activeEl)) {
        return;
      }

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        handleAddKeyframe();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleDeleteKeyframe();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [workspaceMode, handleAddKeyframe, handleDeleteKeyframe]);

  const [filterSelectedOnly, setFilterSelectedOnly] = React.useState(false);

  const roundedFrame = Math.round(currentFrame);

  const handlePlayPause = () => {
    setIsPlayingAnimation(!isPlayingAnimation);
  };

  const cycleLoopMode = () => {
    if (loopMode === 'repeat') {
      setLoopMode('once');
      toast.info('Loop Mode: Once', 'Animation will play once and stop.');
    } else {
      setLoopMode('repeat');
      toast.info('Loop Mode: Repeat', 'Animation will loop continuously.');
    }
  };

  const handleStop = () => {
    setIsPlayingAnimation(false);
    setCurrentFrame(0);
  };

  const handleFrameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    if (raw === '' || raw === '-') {
      setCurrentFrame(0);
      return;
    }
    const val = parseInt(raw, 10);
    setCurrentFrame(isNaN(val) ? 0 : Math.max(0, Math.min(maxFrames, val)));
  };

  const stepFrame = (amount: number) => {
    setIsPlayingAnimation(false);
    setCurrentFrame(Math.max(0, Math.min(maxFrames, currentFrame + amount)));
  };

  // Filter tracks
  const filteredTracks = React.useMemo(() => {
    if (filterSelectedOnly && selectedBoneId) {
      return tracks.filter((t) => {
        if (t.boneName === selectedBoneId) return true;
        if (facialFocusMode && (t.property === 'expression' || t.boneName.toLowerCase().includes('face') || t.boneName.startsWith('Face_'))) return true;
        return false;
      });
    }
    return tracks;
  }, [tracks, filterSelectedOnly, selectedBoneId, facialFocusMode]);

  // Group tracks by bone
  const tracksByBone = React.useMemo(() => {
    const groups: Record<string, AnimationTrack[]> = {};
    filteredTracks.forEach((track) => {
      if (!groups[track.boneName]) {
        groups[track.boneName] = [];
      }
      groups[track.boneName].push(track);
    });
    return groups;
  }, [filteredTracks]);

  // Frame columns array
  const framesArray = React.useMemo(() => {
    return Array.from({ length: maxFrames + 1 }, (_, i) => i);
  }, [maxFrames]);

  // Set of all frame numbers containing keyframes on any active track
  const keyframesSet = React.useMemo(() => {
    const set = new Set<number>();
    tracks.forEach((track) => {
      if (track.keyframes) {
        const frames = getCachedKeyframeFrames(track.keyframes);
        for (let i = 0; i < frames.length; i++) {
          set.add(frames[i]);
        }
      }
    });
    return set;
  }, [tracks]);


  if (tracks.length === 0) {
    return (
      <div className="relative h-full flex flex-col min-h-0 bg-bg-surface select-none">
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          className="absolute top-0 left-0 right-0 h-3 cursor-row-resize bg-white/0 hover:bg-purple-500/10 hover:border-t hover:border-purple-500/40 transition-all z-[60]"
          title="Drag to resize timeline, double-click to toggle minimized state"
        />
        <div className="h-full bg-bg-surface flex flex-col justify-center items-center select-none" style={{ minHeight: '120px' }}>
          <div className="text-center max-w-sm flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 animate-pulse border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
              <Key size={20} />
            </div>
            <span className="text-white text-xs font-bold tracking-wide uppercase">No Active Animation Tracks</span>
            <p className="text-[10px] text-text-secondary leading-normal px-6">
              Select an animation from the "Available Animations" list at the top of the Left Panel (or expand the Animations folder in the level Explorer) to bake its keyframes and begin editing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col min-h-0 bg-bg-surface select-none">
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className="absolute top-0 left-0 right-0 h-3 cursor-row-resize bg-white/0 hover:bg-purple-500/10 hover:border-t hover:border-purple-500/40 transition-all z-[60]"
        title="Drag to resize timeline, double-click to toggle minimized state"
      />
      <div className="h-full bg-bg-surface flex flex-col select-none overflow-hidden" style={{ minHeight: '120px' }}>
      {/* Timeline Toolbar */}
      <div className="bg-bg-panel border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Animation Timeline</span>
          <div className="h-4 w-px bg-border" />
          {/* Selected Bone Filter */}
          <button
            onClick={() => setFilterSelectedOnly(!filterSelectedOnly)}
            disabled={!selectedBoneId}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer transition-colors ${
              !selectedBoneId
                ? 'opacity-40 border-transparent text-text-secondary cursor-not-allowed'
                : filterSelectedOnly
                ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 shadow-[0_0_6px_rgba(168,85,247,0.2)]'
                : 'bg-neutral-800/50 border-neutral-700 text-text-secondary hover:text-text-primary'
            }`}
            title={selectedBoneId ? 'Filter tracks to only show the selected bone' : 'Select a bone to filter'}
          >
            <Filter size={10} />
            <span>Selected Bone Only</span>
            {selectedBoneId && filterSelectedOnly && (
              <span className="w-1 h-1 rounded-full bg-purple-400" />
            )}
          </button>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => stepFrame(-currentFrame)}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-deep rounded transition-colors cursor-pointer"
            title="Rewind to Start"
          >
            <SkipBack size={13} />
          </button>

          <button
            onClick={() => stepFrame(-1)}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-deep rounded transition-colors cursor-pointer"
            title="Step Back 1 Frame"
          >
            <ChevronLeft size={14} />
          </button>

          <button
            onClick={handlePlayPause}
            className={`flex items-center justify-center p-2 rounded-full cursor-pointer transition-all ${
              isPlayingAnimation
                ? 'bg-fuchsia-500/20 text-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.2)]'
                : 'bg-neutral-800 text-sky-400 hover:bg-neutral-700'
            }`}
            title={isPlayingAnimation ? 'Pause' : 'Play'}
          >
            {isPlayingAnimation ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>

          <button
            onClick={handleStop}
            className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-bg-deep rounded transition-colors cursor-pointer"
            title="Stop & Reset"
          >
            <Square size={13} fill="currentColor" />
          </button>

          <button
            onClick={() => stepFrame(1)}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-deep rounded transition-colors cursor-pointer"
            title="Step Forward 1 Frame"
          >
            <ChevronRight size={14} />
          </button>

          <button
            onClick={cycleLoopMode}
            className={`p-1.5 rounded transition-all cursor-pointer hover:bg-bg-deep flex items-center justify-center ${
              loopMode === 'repeat'
                ? 'text-fuchsia-400 bg-fuchsia-500/10'
                : 'text-neutral-500 hover:text-text-primary'
            }`}
            title={`Loop Mode: ${loopMode.toUpperCase()} (Click to toggle)`}
          >
            <Repeat size={13} />
          </button>
        </div>

        {/* Frame Counter / Manual Input */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-secondary">Frame:</span>
          <div className="flex items-center bg-bg-deep border border-border rounded px-1.5 py-0.5">
            <input
              ref={frameInputRef}
              type="number"
              value={roundedFrame}
              onChange={handleFrameChange}
              className="bg-transparent border-none text-white text-[11px] font-mono w-10 text-center outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              min={0}
              max={maxFrames}
            />
            <span className="text-[10px] text-text-secondary font-mono px-1">/</span>
            <span className="text-[10px] text-text-secondary font-mono">{maxFrames}</span>
          </div>
        </div>
      </div>

      {/* Keyframe Operations Toolbar */}
      <div className="bg-[#181824] border-b border-border/85 px-4 py-1.5 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddKeyframe}
            disabled={!selectedBoneId}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
              selectedBoneId
                ? 'bg-purple-600/10 border-purple-500/20 text-purple-300 hover:bg-purple-600/20 hover:border-purple-500/30'
                : 'opacity-45 border-transparent text-neutral-500 cursor-not-allowed bg-neutral-800/10'
            }`}
            title={selectedBoneId ? `Add keyframes for ${selectedBoneId} at frame ${roundedFrame}` : 'Select a bone to add keyframe'}
          >
            <span className="text-[11px] leading-none font-bold">+</span>
            <span>Add Keyframe</span>
          </button>
          
          <button
            onClick={handleDeleteKeyframe}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-red-500/20 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer"
            title={selectedBoneId ? `Delete keyframes for ${selectedBoneId} at frame ${roundedFrame}` : `Delete all keyframes at frame ${roundedFrame}`}
          >
            <Trash2 size={11} />
            <span>Delete Keyframe</span>
          </button>

          <button
            onClick={handleResetBone}
            disabled={!selectedBoneId}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
              selectedBoneId
                ? 'border-yellow-500/20 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20'
                : 'opacity-45 border-transparent text-neutral-500 cursor-not-allowed bg-neutral-800/10'
            }`}
            title={selectedBoneId ? `Reset keyframes for ${selectedBoneId} to default at frame ${roundedFrame}` : 'Select a bone to reset'}
          >
            <RotateCcw size={11} />
            <span>Reset Bone</span>
          </button>

          <button
            onClick={handleResetFrame}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-orange-500/20 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors cursor-pointer"
            title={`Reset all bones' keyframes to default T-pose transforms at frame ${roundedFrame}`}
          >
            <RotateCcw size={11} />
            <span>Reset Frame</span>
          </button>

          <div className="h-4 w-px bg-border/60 mx-1" />

          <button
            onClick={handleSaveAnimationClick}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors cursor-pointer"
            title="Save and bake animation edits to character state"
          >
            <Save size={11} />
            <span>Save Animation</span>
          </button>
        </div>
        <div className="flex items-center gap-4">
          {selectedBoneId ? (
            <span className="text-[9px] font-mono text-purple-400 font-bold uppercase bg-purple-500/5 px-2 py-0.5 rounded border border-purple-500/10">
              {(() => {
                const matchedObj = objects.find(o => o.id === selectedBoneId);
                if (matchedObj) return `Editing Object: ${matchedObj.name}`;
                if (selectedBoneId.startsWith('expression_')) {
                  return `Editing Expression: ${getCleanTrackName(selectedBoneId).replace('Expression: ', '')}`;
                }
                return `Editing Bone: ${selectedBoneId}`;
              })()}
            </span>
          ) : (
            <span className="text-[9px] font-mono text-neutral-500 uppercase bg-neutral-800/20 px-2 py-0.5 rounded border border-neutral-700/10">
              No Bone Selected (Global Delete mode)
            </span>
          )}
        </div>
      </div>

      {/* Grid Container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-bg-deep border-t border-border relative flex flex-col min-h-0"
      >
        <div className="flex flex-col min-w-max relative flex-1">
          {/* Ruler Row */}
          <div className="flex h-8 bg-neutral-900/60 sticky top-0 z-30 border-b border-border/80 min-w-max">
            {/* Top Left Corner */}
            <div 
              style={{ width: `${outlinerWidth}px` }} 
              className="sticky left-0 z-40 bg-bg-panel border-r border-border/80 h-full flex items-center px-3"
            >
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Track Name</span>
            </div>
            {/* Horizontal Timeline Ruler */}
            <div className="flex h-full relative">
              <div style={{ width: `${visibleFrames[0] * frameWidth}px`, flexShrink: 0 }} />
              {framesArray.slice(visibleFrames[0], visibleFrames[1] + 1).map((f) => {
                const isMajor = f % 5 === 0;
                return (
                  <div
                    key={f}
                    onClick={() => setCurrentFrame(f)}
                    style={{ width: `${frameWidth}px` }}
                    className="h-full border-r border-neutral-800/30 flex flex-col justify-end items-center cursor-pointer hover:bg-neutral-800/20 shrink-0 select-none pb-1 relative"
                  >
                    {isMajor && (
                      <span className="text-[8px] font-mono text-neutral-500 absolute top-1">{f}</span>
                    )}
                    {keyframesSet.has(f) && (
                      <div 
                        className="w-1.5 h-1.5 bg-amber-400 rotate-45 border border-amber-300 rounded-[0.5px] absolute top-[16px] shadow-[0_0_4px_rgba(251,191,36,0.8)] z-10 transition-transform hover:scale-125"
                        title={`Frame ${f} Keyframe`}
                      />
                    )}
                    <div className={`w-px bg-neutral-700/60 ${isMajor ? 'h-2 bg-neutral-500' : 'h-1'}`} />
                  </div>
                );
              })}
              <div style={{ width: `${(maxFrames - visibleFrames[1]) * frameWidth}px`, flexShrink: 0 }} />
            </div>
          </div>

          {/* Grid Rows */}
          <div className="flex-1 min-w-max relative pb-4">
            {/* Playhead line (vertical bar running down the entire height of rows) */}
            <div
              ref={playheadRef}
              style={{
                left: `${outlinerWidth + roundedFrame * frameWidth + frameWidth / 2}px`,
              }}
              className="absolute top-0 bottom-0 w-px bg-fuchsia-500 pointer-events-none z-10 shadow-[0_0_8px_#d946ef]"
            />

            {Object.entries(tracksByBone).map(([boneName, boneTracks]) => {
              const isBoneSelected = selectedBoneId === boneName;

              return (
                <div key={boneName} className="flex flex-col">
                  <BoneHeaderRow
                    boneName={boneName}
                    isBoneSelected={isBoneSelected}
                    outlinerWidth={outlinerWidth}
                    frameWidth={frameWidth}
                    maxFrames={maxFrames}
                    setSelectedBoneId={setSelectedBoneId}
                    setCurrentFrame={setCurrentFrame}
                    onContextMenu={handleContextMenu}
                  />

                  {boneTracks.map((track) => (
                    <TimelineTrackRow
                      key={`${boneName}-${track.property}`}
                      boneName={boneName}
                      track={track}
                      isBoneSelected={isBoneSelected}
                      outlinerWidth={outlinerWidth}
                      frameWidth={frameWidth}
                      maxFrames={maxFrames}
                      setSelectedBoneId={setSelectedBoneId}
                      setCurrentFrame={setCurrentFrame}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-[#2b2d31] rounded-lg shadow-2xl w-[400px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#18191c] border-b border-[#2b2d31]">
              <span className="text-[12px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Save size={13} className="text-emerald-400" />
                Save Animation
              </span>
              <button 
                onClick={() => setShowSaveModal(false)}
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer text-base font-semibold border-none bg-transparent outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex flex-col gap-4 text-left">
              <div className="flex bg-[#1a1b1e] p-0.5 rounded border border-[#2b2d31] text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setSaveMode('overwrite')}
                  disabled={availableClips.length === 0}
                  className={`flex-1 py-1 rounded text-center transition-all cursor-pointer ${
                    saveMode === 'overwrite'
                      ? 'bg-neutral-800 text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  Overwrite Existing
                </button>
                <button
                  type="button"
                  onClick={() => setSaveMode('new')}
                  className={`flex-1 py-1 rounded text-center transition-all cursor-pointer ${
                    saveMode === 'new'
                      ? 'bg-neutral-800 text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Save As New Clip
                </button>
              </div>

              {saveMode === 'overwrite' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-text-secondary font-medium">Select animation clip to overwrite:</label>
                  <select
                    value={selectedOverwriteName}
                    onChange={(e) => setSelectedOverwriteName(e.target.value)}
                    className="w-full bg-[#1a1b1e] border border-[#2b2d31] text-text-primary px-3 py-1.5 rounded text-[11px] focus:border-emerald-500 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="" disabled>-- Select Clip --</option>
                    {availableClips.map((clipName) => (
                      <option key={clipName} value={clipName}>
                        {clipName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-text-secondary font-medium">New Animation Clip Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. walk, run, strike"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="w-full bg-[#1a1b1e] border border-[#2b2d31] text-text-primary px-3 py-1.5 rounded text-[11px] focus:border-emerald-500 focus:outline-none transition-all placeholder:text-text-secondary/35"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[#18191c] border-t border-[#2b2d31]">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border border-[#2b2d31] text-text-secondary hover:text-text-primary hover:bg-[#1a1b1e] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-colors cursor-pointer"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (() => {
        const clipboard = keyframeClipboard;

        return (
          <div
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              zIndex: 1000,
            }}
            className="bg-[#181824]/95 border border-[#2b2d31] shadow-[0_4px_16px_rgba(0,0,0,0.6)] rounded-md py-1.5 min-w-[190px] text-[11px] text-[#e2e8f0] backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.property && (() => {
              const prop = contextMenu.property;
              const track = tracks.find(t => t.boneName === contextMenu.boneName && t.property === prop);
              const hasKeyframe = track && hasKeyframeAtFrame(track, contextMenu.frame);

              return (
                <>
                  <div className="px-3 py-1 text-[9px] font-bold text-neutral-500 uppercase tracking-wider border-b border-[#2b2d31]/50 mb-1">
                    Property: {prop} (F{contextMenu.frame})
                  </div>
                  <button
                    disabled={!hasKeyframe}
                    onClick={() => {
                      const val = extractKeyframeValue(track, contextMenu.frame);
                      if (val === undefined) {
                        console.error(`[Keyframe Copy] Keyframe not found at frame ${contextMenu.frame} for track ${prop}`);
                        toast.error(`Error`, `Keyframe not found at frame ${contextMenu.frame}`);
                        return;
                      }
                      setKeyframeClipboard({
                        type: 'single',
                        property: prop,
                        value: JSON.parse(JSON.stringify(val)),
                      });
                      console.log("[Keyframe Clipboard] Copied:", prop, "value:", val);
                      toast.success(`Copied ${prop} keyframe`);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-200 hover:text-white disabled:opacity-40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Copy Keyframe</span>
                  </button>

                  <button
                    disabled={!clipboard || clipboard.type !== 'single' || clipboard.property !== prop}
                    onClick={() => {
                      if (clipboard && clipboard.type === 'single') {
                        console.log("[Keyframe Clipboard] Pasting to frame:", contextMenu.frame, "value:", clipboard.value);
                        updateKeyframe(contextMenu.boneName, prop, contextMenu.frame, clipboard.value);
                        toast.success(`Pasted ${prop} keyframe to frame ${contextMenu.frame}`);
                        setContextMenu(null);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-200 hover:text-white disabled:opacity-40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Paste Keyframe</span>
                  </button>

                  <button
                    disabled={!clipboard || clipboard.type !== 'single' || clipboard.property !== prop}
                    onClick={() => {
                      if (clipboard && clipboard.type === 'single') {
                        const frameNumbers = getCachedKeyframeFrames(track?.keyframes);
                        console.log("[Keyframe Clipboard] Pasting to all frames:", frameNumbers, "value:", clipboard.value);
                        frameNumbers.forEach((f) => {
                          updateKeyframe(contextMenu.boneName, prop, f, clipboard.value);
                        });
                        toast.success(`Pasted ${prop} keyframe to all frames`);
                        setContextMenu(null);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-200 hover:text-white disabled:opacity-40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Paste Keyframe to All Frames</span>
                  </button>

                  <button
                    disabled={!hasKeyframe}
                    onClick={() => {
                      deleteKeyframe(contextMenu.boneName, prop, contextMenu.frame);
                      toast.success(`Deleted ${prop} keyframe`);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-rose-400 hover:text-rose-350 disabled:opacity-40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Delete Keyframe</span>
                  </button>
                  <div className="h-px bg-[#2b2d31]/40 my-1" />
                </>
              );
            })()}

            <div className="px-3 py-1 text-[9px] font-bold text-neutral-500 uppercase tracking-wider border-b border-[#2b2d31]/50 mb-1">
              Bone: {getCleanTrackName(contextMenu.boneName)}
            </div>
            {(() => {
              const boneTracks = tracks.filter(t => t.boneName === contextMenu.boneName);
              const hasAnyKeyframe = boneTracks.some(t => hasKeyframeAtFrame(t, contextMenu.frame));

              return (
                <>
                  <button
                    disabled={!hasAnyKeyframe}
                    onClick={() => {
                      const values: Record<string, any> = {};
                      let copiedCount = 0;
                      boneTracks.forEach(t => {
                        const val = extractKeyframeValue(t, contextMenu.frame);
                        if (val !== undefined) {
                          values[t.property] = JSON.parse(JSON.stringify(val));
                          copiedCount++;
                        }
                      });
                      if (copiedCount === 0) {
                        console.error(`[Transform Copy] No keyframes found at frame ${contextMenu.frame} for bone ${contextMenu.boneName}`);
                        toast.error(`Error`, `No transform keyframes found at frame ${contextMenu.frame}`);
                        return;
                      }
                      setKeyframeClipboard({
                        type: 'bone_all',
                        values,
                      });
                      console.log("[Keyframe Clipboard] Copied All Bone Transform:", values);
                      toast.success(`Copied all keyframes at frame ${contextMenu.frame}`);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-200 hover:text-white disabled:opacity-40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Copy All Transform Keyframes</span>
                  </button>

                  <button
                    disabled={!clipboard || clipboard.type !== 'bone_all'}
                    onClick={() => {
                      if (clipboard && clipboard.type === 'bone_all') {
                        console.log("[Keyframe Clipboard] Pasting transform to frame:", contextMenu.frame, "values:", clipboard.values);
                        Object.keys(clipboard.values!).forEach((p) => {
                          updateKeyframe(contextMenu.boneName, p as any, contextMenu.frame, clipboard.values![p]);
                        });
                        toast.success(`Pasted transform keyframes to frame ${contextMenu.frame}`);
                        setContextMenu(null);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-200 hover:text-white disabled:opacity-40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Paste Transform Keyframes</span>
                  </button>

                  <button
                    disabled={!clipboard || clipboard.type !== 'bone_all'}
                    onClick={() => {
                      if (clipboard && clipboard.type === 'bone_all') {
                        boneTracks.forEach((t) => {
                          const frameNumbers = Array.isArray(t.keyframes)
                            ? t.keyframes.map((k: any) => k && typeof k === 'object' && 'frame' in k ? k.frame : null).filter((f: any) => f !== null) as number[]
                            : Object.keys(t.keyframes || {}).map(Number);
                          console.log("[Keyframe Clipboard] Pasting transform to all frames of property:", t.property, "frames:", frameNumbers, "value:", clipboard.values![t.property]);
                          frameNumbers.forEach((f) => {
                            if (clipboard.values![t.property] !== undefined) {
                              updateKeyframe(contextMenu.boneName, t.property, f, clipboard.values![t.property]);
                            }
                          });
                        });
                        toast.success(`Pasted transform keyframes to all frames`);
                        setContextMenu(null);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-neutral-200 hover:text-white disabled:opacity-40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Paste Transform to All Frames</span>
                  </button>

                  <button
                    disabled={!hasAnyKeyframe}
                    onClick={() => {
                      boneTracks.forEach(t => {
                        if (t.keyframes[contextMenu.frame] !== undefined) {
                          deleteKeyframe(contextMenu.boneName, t.property, contextMenu.frame);
                        }
                      });
                      toast.success(`Deleted all keyframes at frame ${contextMenu.frame}`);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 text-rose-400 hover:text-rose-350 disabled:opacity-40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Delete Transform Keyframes</span>
                  </button>
                </>
              );
            })()}
          </div>
        );
      })()}
    </div>
  );
}
