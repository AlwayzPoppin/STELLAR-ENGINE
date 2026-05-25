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
import PreviewPanel from './components/PreviewPanel';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const activeScriptId = useStore((s) => s.activeScriptId);
  const sidebarVisible = useStore((s) => s.sidebarVisible);
  const bottomPanelVisible = useStore((s) => s.bottomPanelVisible);
  const inspectorVisible = useStore((s) => s.inspectorVisible);

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
              <ErrorBoundary>
                <Viewport />
              </ErrorBoundary>
              <RightToolbar />
              <PreviewPanel />
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
