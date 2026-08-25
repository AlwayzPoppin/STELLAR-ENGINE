import React, { Suspense } from 'react';
import { useStore } from './store/useStore';
import { useAssetStore } from './store/useAssetStore';
import HierarchyPanel from './components/HierarchyPanel';
import InspectorPanel from './components/InspectorPanel';
import Viewport from './components/Viewport';
import TopBar from './components/TopBar';
import BottomPanel from './components/BottomPanel';
import ContextMenu from './components/ContextMenu';
import ViewportTabBar from './components/ViewportTabBar';
const ScriptEditorView = React.lazy(() => import('./components/ScriptEditorView'));
import RightToolbar from './components/RightToolbar';
import { ErrorBoundary } from './components/ErrorBoundary';
const GameplayLogicEditor = React.lazy(() => import('./components/GameplayLogicEditor'));
import BoneHierarchy from './components/BoneHierarchy';
import TimelinePanel from './components/TimelinePanel';
import AiAssistantPanel from './components/AiAssistantPanel';
import AnimationSidebar from './components/AnimationSidebar';
import VoxelHotbarOverlay from './components/VoxelHotbarOverlay';
import StatusBar from './components/StatusBar';

export default function App() {
  const activeScriptId = useStore((s) => s.activeScriptId);
  const sidebarVisible = useStore((s) => s.sidebarVisible);
  const bottomPanelVisible = useStore((s) => s.bottomPanelVisible);
  const inspectorVisible = useStore((s) => s.inspectorVisible);
  const hasHydrated = useStore((s) => s.hasHydrated);
  const assetsHydrated = useAssetStore((s) => s.hasHydrated);
  const sceneId = useStore((s) => s.sceneId);
  const workspaceMode = useStore((s) => s.workspaceMode);
  const isAnimationMode = workspaceMode === 'animation';
  const isLogicMode = workspaceMode === 'logic';
  const timelineHeight = useStore((s) => s.timelineHeight);

  const [sidebarWidth, setSidebarWidth] = React.useState(250);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = moveEvent.clientX;
      const clampedWidth = Math.max(180, Math.min(450, newWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't run shortcuts if typing in input fields, selects, contenteditable, or Monaco editor
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

      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            useStore.getState().redo();
          } else {
            useStore.getState().undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          useStore.getState().redo();
        }
      } else if (!e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'q') {
          useStore.getState().setTransformMode('select');
        } else if (key === 'w') {
          useStore.getState().setTransformMode('translate');
        } else if (key === 'e') {
          useStore.getState().setTransformMode('rotate');
        } else if (key === 'r') {
          useStore.getState().setTransformMode('scale');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!hasHydrated || !assetsHydrated) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0d0d11] relative select-none">
        {/* Glowing backdrop spheres */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Glass panel card */}
        <div className="bg-bg-panel/40 backdrop-blur-md border border-border/80 p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl relative z-10 animate-pulse">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <h2 className="text-white text-xs font-semibold tracking-widest uppercase mt-2">Hydrating Workspace</h2>
          <p className="text-text-secondary text-[10px] font-mono opacity-80">Loading previous session...</p>
        </div>
      </div>
    );
  }

  // Determine static Tailwind grid layout classes based on visibility permutations
  let gridColsClass = '';
  let bottomSpanClass = '';

  if (sidebarVisible && inspectorVisible) {
    gridColsClass = 'lg:grid-cols-[240px_1fr_300px]';
    bottomSpanClass = 'lg:col-span-3';
  } else if (!sidebarVisible && inspectorVisible) {
    gridColsClass = 'lg:grid-cols-[1fr_300px]';
    bottomSpanClass = 'lg:col-span-2';
  } else if (sidebarVisible && !inspectorVisible) {
    gridColsClass = 'lg:grid-cols-[240px_1fr]';
    bottomSpanClass = 'lg:col-span-2';
  } else {
    gridColsClass = 'lg:grid-cols-[1fr]';
    bottomSpanClass = 'lg:col-span-1';
  }

  const isBottomVisible = bottomPanelVisible || isAnimationMode;
  const rowsStyle = isBottomVisible
    ? `1fr ${timelineHeight}px`
    : '1fr 0px';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg-deep text-text-primary font-sans">
      <TopBar />

      <main
        id="app-main-grid"
        className="flex-1 grid grid-cols-1 gap-px bg-border overflow-hidden lg:grid-cols-[auto_1fr_auto]"
        style={{
          gridTemplateColumns: sidebarVisible
            ? inspectorVisible
              ? `${sidebarWidth}px 1fr 300px`
              : `${sidebarWidth}px 1fr`
            : inspectorVisible
              ? '1fr 300px'
              : '1fr',
          gridTemplateRows: rowsStyle,
          transition: isDragging ? 'none' : 'grid-template-columns 300ms ease'
        }}
      >
        {/* Left Panel - Outliner / Bone Hierarchy */}
        {sidebarVisible && (
          <section
            className="relative bg-bg-surface flex flex-col overflow-hidden hidden lg:flex"
            style={{ width: `${sidebarWidth}px` }}
          >
            {isAnimationMode ? <BoneHierarchy /> : <HierarchyPanel />}
            
            {/* Resizer Handle */}
            <div
              className={`absolute top-0 right-0 w-[6px] h-full cursor-col-resize z-50 transition-colors duration-200 ${
                isDragging ? 'bg-accent' : 'bg-transparent hover:bg-accent/40'
              }`}
              onMouseDown={handleMouseDown}
            />
          </section>
        )}

        {/* Center - Document Host (Viewport + Script Editor) */}
        <section className="flex flex-col overflow-hidden bg-[#111116]">
          {/* Tab bar — only visible when scripts are open */}
          <ViewportTabBar />

          {/* Document area — WebGL stays mounted via CSS hidden to preserve context */}
          <div className="flex-1 relative overflow-hidden">
            <div className={(activeScriptId === null || isAnimationMode) && !isLogicMode ? 'block h-full relative' : 'hidden'}>
              <ErrorBoundary key={sceneId}>
                <Viewport />
              </ErrorBoundary>
              {!isAnimationMode && <RightToolbar />}
            </div>
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground bg-[#1e1e1e]">Loading Editor...</div>}>
              {activeScriptId !== null && !isAnimationMode && !isLogicMode && (
                <ScriptEditorView assetId={activeScriptId} />
              )}
              {isLogicMode && (
                <GameplayLogicEditor />
              )}
            </Suspense>
            {/* AI Assistant Overlay Dock */}
            <AiAssistantPanel />
          </div>
        </section>

        {/* Right Panel - Inspector / Animation Sidebar */}
        {inspectorVisible && (
          <section className="bg-bg-surface flex flex-col overflow-hidden hidden lg:flex">
            {isAnimationMode ? <AnimationSidebar /> : <InspectorPanel />}
          </section>
        )}

        {/* Bottom Panel - Content/Console or Timeline */}
        {isAnimationMode ? (
          <section className={`bg-bg-surface flex flex-col overflow-hidden ${bottomSpanClass}`}>
            <TimelinePanel />
          </section>
        ) : bottomPanelVisible ? (
          <section className={`bg-bg-surface col-span-1 flex flex-col overflow-hidden ${bottomSpanClass}`}>
            <BottomPanel />
          </section>
        ) : null}
      </main>

      <StatusBar />
      <ContextMenu />
      <VoxelHotbarOverlay />
    </div>
  );
}
