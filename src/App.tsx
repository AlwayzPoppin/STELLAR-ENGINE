import React from 'react';
import { useStore } from './store/useStore';
import HierarchyPanel from './components/HierarchyPanel';
import InspectorPanel from './components/InspectorPanel';
import Viewport from './components/Viewport';
import TopBar from './components/TopBar';
import BottomPanel from './components/BottomPanel';
import ContextMenu from './components/ContextMenu';
import ViewportTabBar from './components/ViewportTabBar';
import ScriptEditorView from './components/ScriptEditorView';
import RightToolbar from './components/RightToolbar';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const activeScriptId = useStore((s) => s.activeScriptId);
  const sidebarVisible = useStore((s) => s.sidebarVisible);
  const bottomPanelVisible = useStore((s) => s.bottomPanelVisible);
  const inspectorVisible = useStore((s) => s.inspectorVisible);
  const hasHydrated = useStore((s) => s.hasHydrated);
  const sceneId = useStore((s) => s.sceneId);

  if (!hasHydrated) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-deep relative select-none">
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

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const temporal = useStore.temporal.getState();
      if (!temporal) return;

      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            temporal.redo();
          } else {
            temporal.undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          temporal.redo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg-deep text-text-primary font-sans">
      <TopBar />

      <main className={`flex-1 grid grid-cols-1 gap-px bg-border overflow-hidden transition-all duration-300 ${gridColsClass} ${
        bottomPanelVisible ? 'grid-rows-[1fr_200px]' : 'grid-rows-[1fr_0px]'
      }`}>
        {/* Left Panel - Outliner */}
        {sidebarVisible && (
          <section className="bg-bg-surface flex flex-col overflow-hidden hidden lg:flex">
            <HierarchyPanel />
          </section>
        )}

        {/* Center - Document Host (Viewport + Script Editor) */}
        <section className="flex flex-col overflow-hidden bg-[#111116]">
          {/* Tab bar — only visible when scripts are open */}
          <ViewportTabBar />

          {/* Document area — WebGL stays mounted via CSS hidden to preserve context */}
          <div className="flex-1 relative overflow-hidden">
            <div className={activeScriptId === null ? 'block h-full relative' : 'hidden'}>
              <ErrorBoundary key={sceneId}>
                <Viewport />
              </ErrorBoundary>
              <RightToolbar />
            </div>
            {activeScriptId !== null && (
              <ScriptEditorView assetId={activeScriptId} />
            )}
          </div>
        </section>

        {/* Right Panel - Inspector */}
        {inspectorVisible && (
          <section className="bg-bg-surface flex flex-col overflow-hidden hidden lg:flex">
            <InspectorPanel />
          </section>
        )}

        {/* Bottom Panel - Content/Console */}
        {bottomPanelVisible && (
          <section className={`bg-bg-surface col-span-1 flex flex-col overflow-hidden ${bottomSpanClass}`}>
            <BottomPanel />
          </section>
        )}
      </main>

      <ContextMenu />
    </div>
  );
}
