import React, { useRef } from 'react';
import { Save } from 'lucide-react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useStore } from '../store/useStore';
import { useAssetStore } from '../store/useAssetStore';

interface Props {
  assetId: string;
}

export default function ScriptEditorView({ assetId }: Props) {
  const updateAsset = useAssetStore((s) => s.updateAsset);
  const asset = useAssetStore((s) => s.assets.find((a) => a.id === assetId));
  const editorRef = useRef<any>(null);

  const handleSave = () => {
    if (!editorRef.current) return;
    const value = editorRef.current.getValue();
    updateAsset(assetId, { content: value });
    console.info(`[Stellar] Saved: ${asset?.name}`);
  };

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    // Ctrl+S / Cmd+S
    editor.addCommand(2097 | 49, handleSave);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
        <span className="text-[11px] text-[#9d9d9d] font-mono">{asset?.name ?? assetId}</span>
        <button
          onClick={handleSave}
          title="Save (Ctrl+S)"
          className="ml-auto flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] text-[#9d9d9d] hover:text-white hover:bg-[#2d2d2d] rounded transition-colors"
        >
          <Save size={12} />
          Save
        </button>
      </div>

      {/* Monaco */}
      <div className="flex-1 overflow-hidden">
        <Editor
          key={assetId}
          height="100%"
          defaultLanguage="javascript"
          value={asset?.content ?? '// New Script\n'}
          theme="vs-dark"
          onMount={handleEditorMount}
          onChange={(value) => {
            if (value !== undefined) updateAsset(assetId, { content: value });
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 20,
            scrollBeyondLastLine: false,
            fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", monospace',
            fontLigatures: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12 },
          }}
        />
      </div>
    </div>
  );
}
