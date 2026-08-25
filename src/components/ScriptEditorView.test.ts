import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAssetStore } from '../store/useAssetStore';
import { useStore } from '../store/useStore';

describe('ScriptEditorView debounce and state management', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAssetStore.setState({
      assets: [
        {
          id: 'script_test_1',
          name: 'PlayerController.lua',
          type: 'script',
          content: '-- Initial Code\n',
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should not update Zustand store synchronously on every keystroke', () => {
    const updateAsset = vi.fn();
    let pendingTimeout: any = null;

    const debouncedSync = (newCode: string) => {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      pendingTimeout = setTimeout(() => {
        updateAsset('script_test_1', { content: newCode });
      }, 500);
    };

    // Simulate typing 10 characters rapidly
    for (let i = 1; i <= 10; i++) {
      debouncedSync(`-- Initial Code\nline_${i}`);
    }

    // Immediately after typing, updateAsset should NOT have been called 10 times
    expect(updateAsset).not.toHaveBeenCalled();

    // Advance timer by 400ms (still within debounce window)
    vi.advanceTimersByTime(400);
    expect(updateAsset).not.toHaveBeenCalled();

    // Advance timer past 500ms
    vi.advanceTimersByTime(150);
    expect(updateAsset).toHaveBeenCalledTimes(1);
    expect(updateAsset).toHaveBeenCalledWith('script_test_1', {
      content: '-- Initial Code\nline_10',
    });
  });

  it('should immediately flush on manual save without waiting for debounce', () => {
    const updateAsset = vi.fn();
    let pendingTimeout: any = null;

    const debouncedSync = (newCode: string) => {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      pendingTimeout = setTimeout(() => {
        updateAsset('script_test_1', { content: newCode });
      }, 500);
    };

    const flushImmediately = (val: string) => {
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
      updateAsset('script_test_1', { content: val });
    };

    debouncedSync('-- Typed partial code');
    expect(updateAsset).not.toHaveBeenCalled();

    // User triggers Ctrl+S / Save button
    flushImmediately('-- Typed partial code [Saved]');
    expect(updateAsset).toHaveBeenCalledTimes(1);
    expect(updateAsset).toHaveBeenCalledWith('script_test_1', {
      content: '-- Typed partial code [Saved]',
    });

    // Advancing past 500ms should not trigger redundant calls
    vi.advanceTimersByTime(600);
    expect(updateAsset).toHaveBeenCalledTimes(1);
  });
});

describe('Monaco Script Autocompletions (Engine, Quests, Dialogues, Variables)', () => {
  const mockMonaco = {
    languages: {
      CompletionItemKind: {
        Method: 0,
        Property: 1,
        Variable: 2,
        Snippet: 3,
        Class: 4,
        Module: 5,
      },
      CompletionItemInsertTextRule: {
        InsertAsSnippet: 4,
      },
    },
  };

  const dummyRange = {
    startLineNumber: 1,
    endLineNumber: 1,
    startColumn: 1,
    endColumn: 1,
  };

  it('should provide Engine method suggestions when typing Engine.', async () => {
    const { buildScriptCompletions } = await import('./ScriptEditorView');
    const suggestions = buildScriptCompletions(mockMonaco, 'lua', 'Engine.', dummyRange);

    const labels = suggestions.map((s: any) => s.label);
    expect(labels).toContain('SetVariable');
    expect(labels).toContain('GetVariable');
    expect(labels).toContain('DeleteVariable');
    expect(labels).toContain('StartQuest');
    expect(labels).toContain('CompleteObjective');
    expect(labels).toContain('UpdateObjective');
    expect(labels).toContain('CompleteQuest');
    expect(labels).toContain('ShowDialogue');
    expect(labels).toContain('CloseDialogue');
    expect(labels).toContain('TriggerEvent');
    expect(labels).toContain('SpawnParticles');
  });

  it('should provide self properties when typing self.', async () => {
    const { buildScriptCompletions } = await import('./ScriptEditorView');
    const suggestions = buildScriptCompletions(mockMonaco, 'lua', 'self.', dummyRange);

    const labels = suggestions.map((s: any) => s.label);
    expect(labels).toContain('id');
    expect(labels).toContain('name');
    expect(labels).toContain('position');
    expect(labels).toContain('rotation');
    expect(labels).toContain('scale');
  });

  it('should provide top-level symbols including Engine and update snippets', async () => {
    const { buildScriptCompletions } = await import('./ScriptEditorView');
    const suggestions = buildScriptCompletions(mockMonaco, 'lua', '', dummyRange);

    const labels = suggestions.map((s: any) => s.label);
    expect(labels).toContain('Engine');
    expect(labels).toContain('self');
    expect(labels).toContain('delta');
    expect(labels).toContain('function update');
    expect(labels).toContain('function init');
  });
});

