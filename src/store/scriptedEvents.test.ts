import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, ScriptedEvent, Quest } from './useStore';
import { executeRobloxLuaScript } from '../utils/robloxLuaEngine';

describe('Scripted Action Triggers & Lua Bridge', () => {
  beforeEach(() => {
    useStore.setState({
      objects: [
        {
          id: 'hero_player',
          name: 'Hero',
          type: 'mesh',
          geometry: 'box',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          visible: true,
        },
        {
          id: 'boss_goblin',
          name: 'Goblin Boss',
          type: 'mesh',
          geometry: 'box',
          position: [10, 0, 10],
          rotation: [0, 0, 0],
          scale: [2, 2, 2],
          visible: true,
        },
      ],
      quests: [
        {
          id: 'quest_defeat_boss',
          title: 'Defeat the Goblin Boss',
          description: 'Slay the boss guarding the gate.',
          objectives: [
            {
              id: 'obj_defeat_boss',
              description: 'Defeat Goblin Boss',
              type: 'defeat_enemy',
              targetName: 'Goblin Boss',
              targetCount: 1,
              currentCount: 0,
              completed: false,
            },
          ],
          rewardXp: 500,
          status: 'active',
        },
      ],
      scriptedEvents: [],
      gameVariables: {},
      isPlaying: false,
    });
  });

  it('should execute teleport, visibility toggle, and variable actions', async () => {
    const event: ScriptedEvent = {
      id: 'event_teleport_hero',
      name: 'Teleport Hero',
      triggerType: 'on_enter_trigger',
      triggerTargetId: 'trigger_zone_1',
      actions: [
        {
          id: 'act_1',
          type: 'teleport',
          params: { targetId: 'hero_player', position: [5, 10, 15] },
        },
        {
          id: 'act_2',
          type: 'toggle_visibility',
          params: { targetId: 'boss_goblin', visible: false },
        },
        {
          id: 'act_3',
          type: 'set_variable',
          params: { key: 'boss_defeated', value: true },
        },
      ],
    };

    useStore.getState().addScriptedEvent(event);

    await useStore.getState().executeScriptedEvent(event);

    const objects = useStore.getState().objects;
    const hero = objects.find((o) => o.id === 'hero_player');
    const boss = objects.find((o) => o.id === 'boss_goblin');
    const vars = useStore.getState().gameVariables;

    expect(hero?.position).toEqual([5, 10, 15]);
    expect(boss?.visible).toBe(false);
    expect(vars['boss_defeated']).toBe(true);
  });

  it('should give items and update quest objectives through complete_objective action', async () => {
    const event: ScriptedEvent = {
      id: 'event_boss_slain',
      name: 'Boss Slain Event',
      triggerType: 'on_enemy_defeated',
      triggerTargetId: 'boss_goblin',
      actions: [
        {
          id: 'act_give_loot',
          type: 'give_item',
          params: { itemName: 'Goblin Crown', amount: 1 },
        },
        {
          id: 'act_complete_quest',
          type: 'complete_objective',
          params: { questId: 'quest_defeat_boss', objectiveIndex: 0 },
        },
      ],
    };

    useStore.getState().addScriptedEvent(event);

    // Trigger via triggerScriptedEvents
    useStore.getState().triggerScriptedEvents('on_enemy_defeated', 'boss_goblin');

    const vars = useStore.getState().gameVariables;
    expect(vars['item_goblin_crown']).toBe(1);

    const quest = useStore.getState().quests.find((q) => q.id === 'quest_defeat_boss');
    expect(quest?.objectives[0].currentCount).toBe(1);
    expect(quest?.objectives[0].completed).toBe(true);
    expect(quest?.status).toBe('completed');
  });

  it('should allow Lua scripts to call Engine.TriggerEvent to execute visual action chains', async () => {
    const event: ScriptedEvent = {
      id: 'event_spawn_portal',
      name: 'Spawn Portal Event',
      triggerType: 'on_click',
      triggerTargetId: 'mystic_altar',
      actions: [
        {
          id: 'act_spawn',
          type: 'spawn_prefab',
          params: { prefabName: 'sphere', position: [0, 2, 0] },
        },
        {
          id: 'act_var',
          type: 'set_variable',
          params: { key: 'portal_opened', value: true },
        },
      ],
    };

    useStore.getState().addScriptedEvent(event);

    const luaScript = `
-- Player clicks mystic altar
Engine.TriggerEvent("on_click", "mystic_altar")
`;

    const result = executeRobloxLuaScript(luaScript);
    expect(result.success).toBe(true);

    const vars = useStore.getState().gameVariables;
    expect(vars['portal_opened']).toBe(true);

    const objects = useStore.getState().objects;
    const portal = objects.find((o) => o.geometry === 'sphere');
    expect(portal).toBeDefined();
    expect(portal?.position).toEqual([0, 2, 0]);
  });
});
