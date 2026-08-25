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

export function buildScriptCompletions(
  monaco: any,
  lang: string,
  textBeforeCursor: string,
  range: any
) {
  const normalized = textBeforeCursor.trim();

  // Engine.* autocompletions
  if (normalized.endsWith('Engine.') || normalized.endsWith('engine.')) {
    return [
      {
        label: 'SetVariable',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(key: string, value: any) => void',
        documentation: 'Set a global game variable in Zustand state.\n\nExample:\nEngine.SetVariable("coins", 100)',
        insertText: 'SetVariable("${1:key}", ${2:value})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'GetVariable',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(key: string) => any',
        documentation: 'Get the current value of a global game variable.\n\nExample:\nlocal coins = Engine.GetVariable("coins")',
        insertText: 'GetVariable("${1:key}")',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'DeleteVariable',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(key: string) => void',
        documentation: 'Remove a global game variable from the session.\n\nExample:\nEngine.DeleteVariable("tempFlag")',
        insertText: 'DeleteVariable("${1:key}")',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'GetVariables',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '() => Record<string, any>',
        documentation: 'Get a snapshot of all active global game variables.',
        insertText: 'GetVariables()',
        range,
      },
      {
        label: 'StartQuest',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(questId: string) => void',
        documentation: 'Set a quest status to active.\n\nExample:\nEngine.StartQuest("quest_slay_goblins")',
        insertText: 'StartQuest("${1:questId}")',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'CompleteObjective',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(questId: string, objId: string) => void',
        documentation: 'Complete an objective within a quest. Auto-completes the quest if all objectives are fulfilled.\n\nExample:\nEngine.CompleteObjective("quest_slay_goblins", "obj_defeat_5")',
        insertText: 'CompleteObjective("${1:questId}", "${2:objId}")',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'UpdateObjective',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(questId: string, objId: string, count: number) => void',
        documentation: 'Update the progress count on a quest objective.\n\nExample:\nEngine.UpdateObjective("quest_slay_goblins", "obj_defeat_5", 3)',
        insertText: 'UpdateObjective("${1:questId}", "${2:objId}", ${3:count})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'CompleteQuest',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(questId: string) => void',
        documentation: 'Complete a quest and trigger on_quest_complete scripted events.\n\nExample:\nEngine.CompleteQuest("quest_slay_goblins")',
        insertText: 'CompleteQuest("${1:questId}")',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'GetQuests',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '() => Quest[]',
        documentation: 'Get all configured quests in the project.',
        insertText: 'GetQuests()',
        range,
      },
      {
        label: 'GetQuest',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(questId: string) => Quest | undefined',
        documentation: 'Retrieve a quest by ID or title.\n\nExample:\nlocal q = Engine.GetQuest("quest_slay_goblins")',
        insertText: 'GetQuest("${1:questId}")',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'ShowDialogue',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(text: string, speakerName?: string, speakerId?: string) => void',
        documentation: 'Display an in-game NPC dialogue banner.\n\nExample:\nEngine.ShowDialogue("Welcome to the realm!", "Elder Mage")',
        insertText: 'ShowDialogue("${1:text}", "${2:speakerName}")',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'CloseDialogue',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '() => void',
        documentation: 'Dismiss the currently active dialogue.',
        insertText: 'CloseDialogue()',
        range,
      },
      {
        label: 'TriggerEvent',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(triggerType: string, targetId?: string) => void',
        documentation: 'Trigger a scripted event (on_enter_trigger, on_click, on_enemy_defeated).\n\nExample:\nEngine.TriggerEvent("on_enemy_defeated", "goblin_boss")',
        insertText: 'TriggerEvent("${1:triggerType}", "${2:targetId}")',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'SpawnParticles',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(effectType: string, x: number, y: number, z: number) => void',
        documentation: 'Spawn 3D particle emitter at coordinates.\n\nExample:\nEngine.SpawnParticles("spark", 0, 5, 0)',
        insertText: 'SpawnParticles("${1:spark}", ${2:0}, ${3:5}, ${4:0})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'GetTime',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '() => number',
        documentation: 'Get high-precision elapsed runtime in seconds.',
        insertText: 'GetTime()',
        range,
      },
    ];
  }

  // self.* autocompletions
  if (normalized.endsWith('self.')) {
    return [
      { label: 'id', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Object ID string.', insertText: 'id', range },
      { label: 'name', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Object name.', insertText: 'name', range },
      { label: 'position', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Vector3 position.', insertText: 'position', range },
      { label: 'rotation', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Vector3 rotation.', insertText: 'rotation', range },
      { label: 'scale', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Vector3 scale.', insertText: 'scale', range },
      { label: 'health', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Object health.', insertText: 'health', range },
    ];
  }

  // Instance.* autocompletions
  if (normalized.endsWith('Instance.')) {
    return [
      {
        label: 'new',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(className: string) => Instance',
        documentation: 'Instantiate a new Part, Model, Motor6D, or Light.',
        insertText: 'new("${1:Part}")',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
    ];
  }

  // Vector3.* autocompletions
  if (normalized.endsWith('Vector3.')) {
    return [
      {
        label: 'new',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(x: number, y: number, z: number) => Vector3',
        documentation: 'Create a 3D vector.',
        insertText: 'new(${1:0}, ${2:0}, ${3:0})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      { label: 'zero', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Vector3(0, 0, 0)', insertText: 'zero', range },
      { label: 'one', kind: monaco.languages.CompletionItemKind.Property, documentation: 'Vector3(1, 1, 1)', insertText: 'one', range },
    ];
  }

  // CFrame.* autocompletions
  if (normalized.endsWith('CFrame.')) {
    return [
      {
        label: 'new',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(x: number, y: number, z: number) => CFrame',
        documentation: 'Create a Coordinate Frame.',
        insertText: 'new(${1:0}, ${2:0}, ${3:0})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
      {
        label: 'Angles',
        kind: monaco.languages.CompletionItemKind.Method,
        detail: '(rx: number, ry: number, rz: number) => CFrame',
        documentation: 'Create rotation angles in radians.',
        insertText: 'Angles(${1:0}, ${2:0}, ${3:0})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      },
    ];
  }

  // Top-level global symbols and keywords
  return [
    {
      label: 'Engine',
      kind: monaco.languages.CompletionItemKind.Class,
      detail: 'Stellar Engine Game Systems API',
      documentation: 'Core engine API for game variables, quests, objectives, dialogues, and particle effects.',
      insertText: 'Engine',
      range,
    },
    { label: 'self', kind: monaco.languages.CompletionItemKind.Variable, documentation: 'Reference to current scene object.', insertText: 'self', range },
    { label: 'delta', kind: monaco.languages.CompletionItemKind.Variable, documentation: 'Delta time since last frame in seconds.', insertText: 'delta', range },
    { label: 'Vector3', kind: monaco.languages.CompletionItemKind.Class, documentation: '3D Vector constructor.', insertText: 'Vector3', range },
    { label: 'CFrame', kind: monaco.languages.CompletionItemKind.Class, documentation: 'Coordinate Frame transform.', insertText: 'CFrame', range },
    { label: 'Instance', kind: monaco.languages.CompletionItemKind.Class, documentation: 'Roblox / Stellar Instance constructor.', insertText: 'Instance', range },
    { label: 'Workspace', kind: monaco.languages.CompletionItemKind.Variable, documentation: 'Global scene root workspace.', insertText: 'Workspace', range },
    { label: 'task', kind: monaco.languages.CompletionItemKind.Module, documentation: 'Task scheduler library (task.wait).', insertText: 'task', range },
    {
      label: 'function update',
      kind: monaco.languages.CompletionItemKind.Snippet,
      documentation: 'Frame update lifecycle function.',
      insertText: lang === 'lua' ? 'function update(self, delta)\n\t$0\nend' : 'function update(self, delta) {\n\t$0\n}',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
    {
      label: 'function init',
      kind: monaco.languages.CompletionItemKind.Snippet,
      documentation: 'Initialization lifecycle function.',
      insertText: lang === 'lua' ? 'function init(self)\n\t$0\nend' : 'function init(self) {\n\t$0\n}',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
  ];
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
      if (Array.isArray(providerRef.current)) {
        providerRef.current.forEach((p) => p?.dispose?.());
      } else {
        providerRef.current?.dispose?.();
      }
    }

    // Register Lua, JavaScript, and TypeScript completions
    const disposables: any[] = [];
    ['lua', 'javascript', 'typescript'].forEach((lang) => {
      const d = monaco.languages.registerCompletionItemProvider(lang, {
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
          const suggestions = buildScriptCompletions(monaco, lang, textBeforeCursor, range);

          return { suggestions };
        },
      });
      disposables.push(d);
    });

    providerRef.current = disposables;
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
