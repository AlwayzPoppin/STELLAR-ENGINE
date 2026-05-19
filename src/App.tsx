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

export default function App() {
  const activeScriptId = useStore((s) => s.activeScriptId);

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

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg-deep text-text-primary font-sans">
      <TopBar />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[240px_1fr_300px] grid-rows-[1fr_200px] gap-px bg-border overflow-hidden">
        {/* Left Panel - Outliner */}
        <section className="bg-bg-surface flex flex-col overflow-hidden hidden lg:flex">
          <HierarchyPanel />
        </section>

        {/* Center - Document Host (Viewport + Script Editor) */}
        <section className="flex flex-col overflow-hidden bg-[#111116]">
          {/* Tab bar — only visible when scripts are open */}
          <ViewportTabBar />

          {/* Document area — WebGL stays mounted via CSS hidden to preserve context */}
          <div className="flex-1 relative overflow-hidden">
            <div className={activeScriptId === null ? 'block h-full' : 'hidden'}>
              <Viewport />
              <RightToolbar />
            </div>
            {activeScriptId !== null && (
              <ScriptEditorView assetId={activeScriptId} />
            )}
          </div>
        </section>

        {/* Right Panel - Inspector */}
        <section className="bg-bg-surface flex flex-col overflow-hidden hidden lg:flex">
          <InspectorPanel />
        </section>

        {/* Bottom Panel - Content/Console */}
        <section className="bg-bg-surface col-span-1 lg:col-span-3 flex flex-col overflow-hidden">
          <BottomPanel />
        </section>
      </main>

      <ContextMenu />
    </div>
  );
}
