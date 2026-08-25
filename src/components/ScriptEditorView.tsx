import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Save, Clipboard, Copy, Trash2, Code2, Play } from 'lucide-react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useStore } from '../store/useStore';
import { useAssetStore } from '../store/useAssetStore';
import { toast } from '../store/useToastStore';
import { executeRobloxLuaScript } from '../utils/robloxLuaEngine';

interface Props {
  assetId: string;
}

export default function ScriptEditorView({ assetId }: Props) {
  const updateAsset = useAssetStore((s) => s.updateAsset);
  const asset = useAssetStore((s) => s.assets.find((a) => a.id === assetId));
  const objects = useStore((s) => s.objects);
  const updateObject = useStore((s) => s.updateObject);
  const objectNode = objects.find((o) => o.id === assetId);

  const name = asset ? asset.name : (objectNode?.name ?? assetId);
  const initialStoreCode = asset
    ? (asset.content ?? '-- New Script\nfunction update(self, delta)\n    -- Add code here\nend\n')
    : (objectNode?.scriptCode ?? '-- New Script\nfunction update(self, delta)\n    -- Add code here\nend\n');

  const [code, setCode] = useState(initialStoreCode);
  const codeRef = useRef(initialStoreCode);
  codeRef.current = code;

  // Detect default language (Lua vs JavaScript)
  const isLuaByDefault = name.toLowerCase().endsWith('.lua') || initialStoreCode.includes('end') || initialStoreCode.includes('local ');
  const [language, setLanguage] = useState<string>(isLuaByDefault ? 'lua' : 'javascript');

  const editorRef = useRef<any>(null);
  const providerRef = useRef<any>(null);
  const syncTimeoutRef = useRef<any>(null);
  const lastLoadedAssetIdRef = useRef<string>(assetId);

  // Synchronously flush current code to Zustand store
  const flushToStore = useCallback((valToSync?: string) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    const val = valToSync ?? (editorRef.current ? editorRef.current.getValue() : codeRef.current);
    if (asset) {
      updateAsset(assetId, { content: val });
    } else if (objectNode) {
      updateObject(assetId, { scriptCode: val });
    }
  }, [asset, assetId, objectNode, updateAsset, updateObject]);

  // Debounced store update (500ms delay) to prevent typing lag and main tree re-renders
  const debouncedSyncToStore = useCallback((newCode: string) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      flushToStore(newCode);
    }, 500);
  }, [flushToStore]);

  // Sync local code state ONLY when switching to a different script asset
  useEffect(() => {
    if (lastLoadedAssetIdRef.current !== assetId) {
      // Flush previous script changes before loading new one
      flushToStore();

      const currentCode = asset
        ? (asset.content ?? '-- New Script\n')
        : (objectNode?.scriptCode ?? '-- New Script\n');
      setCode(currentCode);
      codeRef.current = currentCode;
      lastLoadedAssetIdRef.current = assetId;

      const isLua = name.toLowerCase().endsWith('.lua') || currentCode.includes('end') || currentCode.includes('local ');
      setLanguage(isLua ? 'lua' : 'javascript');
    }
  }, [assetId, asset, objectNode, name, flushToStore]);

  // Flush on unmount and dispose provider
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (providerRef.current) {
        providerRef.current.dispose();
      }
    };
  }, []);

  const handleSave = (currentVal?: string) => {
    const valToSave = currentVal ?? (editorRef.current ? editorRef.current.getValue() : code);
    flushToStore(valToSave);
    toast.success('Script Saved', `Saved ${name}`);
  };

  const handleRunScript = () => {
    const scriptVal = editorRef.current ? editorRef.current.getValue() : code;
    handleSave(scriptVal);
    const result = executeRobloxLuaScript(scriptVal);
    if (result.success && result.partsCreated > 0) {
      setTimeout(() => {
        useStore.getState().setActiveScript(null);
      }, 400);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.error('Clipboard Empty', 'No text found in clipboard.');
        return;
      }

      if (editorRef.current) {
        const selection = editorRef.current.getSelection();
        editorRef.current.executeEdits('clipboard-paste', [
          {
            range: selection,
            text: text,
            forceMoveMarkers: true,
          },
        ]);
        const newContent = editorRef.current.getValue();
        setCode(newContent);
        handleSave(newContent);
      } else {
        setCode(text);
        handleSave(text);
      }
      toast.success('Pasted Code', 'Script updated from clipboard.');
    } catch (err) {
      console.warn('Clipboard read failed:', err);
      toast.error('Paste Failed', 'Could not read clipboard. Use Ctrl+V inside editor.');
    }
  };

  const handleCopyAll = () => {
    const val = editorRef.current ? editorRef.current.getValue() : code;
    navigator.clipboard.writeText(val);
    toast.success('Copied', 'Script copied to clipboard.');
  };

  const handleClear = () => {
    if (editorRef.current) {
      editorRef.current.setValue('');
    }
    setCode('');
    handleSave('');
    toast.info('Script Cleared', 'Editor content cleared.');
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Flush to store on blur (loss of focus)
    editor.onDidBlurEditorText(() => {
      flushToStore();
    });

    // Ctrl+S / Cmd+S shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    if (providerRef.current) {
      providerRef.current.dispose();
    }

    // Register Lua & JS completions
    const registerCompletions = (lang: string) => {
      return monaco.languages.registerCompletionItemProvider(lang, {
        triggerCharacters: ['.'],
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const lineText = model.getLineContent(position.lineNumber);
          const textBeforeCursor = lineText.substring(0, position.column - 1);

          if (textBeforeCursor.endsWith('self.')) {
            return {
              suggestions: [
                { label: 'id', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Object ID.', insertText: 'id', range },
                { label: 'name', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Object name.', insertText: 'name', range },
                { label: 'position', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Vector3 position.', insertText: 'position', range },
                { label: 'rotation', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Vector3 rotation.', insertText: 'rotation', range },
                { label: 'scale', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Vector3 scale.', insertText: 'scale', range },
                { label: 'health', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Object health.', insertText: 'health', range },
              ],
            };
          }

          return {
            suggestions: [
              { label: 'self', kind: monaco.languages.CompletionItemKind.Variable, documentation: 'Self reference.', insertText: 'self', range },
              { label: 'delta', kind: monaco.languages.CompletionItemKind.Variable, documentation: 'Delta time.', insertText: 'delta', range },
              {
                label: 'function update',
                kind: monaco.languages.CompletionItemKind.Snippet,
                documentation: 'Lua/JS update lifecycle function.',
                insertText: lang === 'lua' ? 'function update(self, delta)\n\t$0\nend' : 'function update(self, delta) {\n\t$0\n}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
              },
              {
                label: 'function init',
                kind: monaco.languages.CompletionItemKind.Snippet,
                documentation: 'Init lifecycle function.',
                insertText: lang === 'lua' ? 'function init(self)\n\t$0\nend' : 'function init(self) {\n\t$0\n}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
              },
            ],
          };
        },
      });
    };

    providerRef.current = registerCompletions('lua');
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] select-none">
      {/* Toolbar Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c] shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-cyan-400" />
          <span className="text-xs text-text-primary font-mono font-semibold">{name}</span>

          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-[#1e1e1e] border border-[#3c3c3c] text-text-secondary hover:text-text-primary text-[10px] font-mono px-2 py-0.5 rounded outline-none cursor-pointer"
          >
            <option value="lua">Lua (.lua)</option>
            <option value="javascript">JavaScript (.js)</option>
            <option value="typescript">TypeScript (.ts)</option>
            <option value="python">Python (.py)</option>
            <option value="json">JSON (.json)</option>
            <option value="plaintext">Plain Text</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            title="Paste Code from Clipboard"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded transition-all cursor-pointer"
          >
            <Clipboard size={12} />
            <span>Paste from Clipboard</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAll}
            title="Copy All Script Content"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-bg-surface hover:bg-bg-highlight border border-border text-text-secondary hover:text-text-primary rounded transition-all cursor-pointer"
          >
            <Copy size={12} />
            <span>Copy All</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            title="Clear Script Content"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded transition-all cursor-pointer"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>

          <div className="h-4 w-px bg-border/40 mx-1" />

          <button
            type="button"
            onClick={() => handleSave()}
            title="Save Script (Ctrl+S)"
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-bg-surface hover:bg-bg-highlight border border-border text-text-secondary hover:text-text-primary rounded transition-all cursor-pointer"
          >
            <Save size={12} />
            <span>Save</span>
          </button>

          <button
            type="button"
            onClick={handleRunScript}
            title="Run Script & Instantiate Voxels/Models in 3D Scene"
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 rounded transition-all cursor-pointer shadow-sm"
          >
            <Play size={12} className="fill-current text-emerald-400" />
            <span>Run Script (Instantiate)</span>
          </button>
        </div>
      </div>

      {/* Monaco Code Editor Container */}
      <div className="flex-1 overflow-hidden relative">
        <Editor
          key={assetId}
          height="100%"
          language={language}
          value={code}
          theme="vs-dark"
          onMount={handleEditorMount}
          onChange={(value) => {
            if (value !== undefined) {
              setCode(value);
              debouncedSyncToStore(value);
            }
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
            readOnly: false,
            domReadOnly: false,
            contextmenu: true,
            pasteAs: { enabled: true },
            formatOnPaste: true,
            formatOnType: true,
            autoClosingBrackets: 'always',
          }}
        />
      </div>
    </div>
  );
}
