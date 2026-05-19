import React from 'react';
import { Cuboid, Code2, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAssetStore } from '../store/useAssetStore';

export default function ViewportTabBar() {
  const openScripts = useStore((s) => s.openScripts);
  const activeScriptId = useStore((s) => s.activeScriptId);
  const closeScript = useStore((s) => s.closeScript);
  const setActiveScript = useStore((s) => s.setActiveScript);
  const assets = useAssetStore((s) => s.assets);



  return (
    <div
      className="flex items-center gap-px bg-[#1a1a1f] border-b border-[#2e2e35] shrink-0 overflow-x-auto"
      style={{ height: 34 }}
    >
      {/* Permanent "Scene" tab */}
      <button
        onClick={() => setActiveScript(null)}
        className={`flex items-center gap-1.5 px-3 h-full text-[11px] border-r border-[#2e2e35] transition-colors shrink-0 ${
          activeScriptId === null
            ? 'bg-[#111116] text-white border-t-2 border-t-accent'
            : 'text-[#888] hover:text-white hover:bg-[#22222a]'
        }`}
      >
        <Cuboid size={12} />
        Scene
      </button>

      {/* Dynamic script tabs */}
      {openScripts.map((id) => {
        const asset = assets.find((a) => a.id === id);
        const isActive = id === activeScriptId;
        return (
          <button
            key={id}
            onClick={() => setActiveScript(id)}
            className={`flex items-center gap-1.5 px-3 h-full text-[11px] border-r border-[#2e2e35] transition-colors shrink-0 group ${
              isActive
                ? 'bg-[#111116] text-white border-t-2 border-t-accent'
                : 'text-[#888] hover:text-white hover:bg-[#22222a]'
            }`}
          >
            <Code2 size={12} className="text-yellow-400 shrink-0" />
            <span className="max-w-[120px] truncate">{asset?.name ?? id}</span>
            <span
              role="button"
              aria-label={`Close ${asset?.name}`}
              onClick={(e) => {
                e.stopPropagation();
                closeScript(id);
              }}
              className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[#444] transition-all"
            >
              <X size={10} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
