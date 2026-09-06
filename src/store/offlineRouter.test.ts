import { describe, it, expect } from 'vitest';
import { routeIntent, resetConversationState } from './offlineRouter';

describe('offlineRouter generic intent routing', () => {
  const dummyCtx = {
    scope: 'GLOBAL' as const,
    selectedObj: null,
    currentEnv: {},
    gameBible: '',
  };

  it('should route generic genre requests to appropriate engine blueprints', () => {
    resetConversationState();
    const res1 = routeIntent('make a side-scroller beat em up game', dummyCtx);
    expect(res1.actionType).toBe('kickstart_blueprint');
    expect(res1.blueprint?.genre).toBe("3D Side-Scroller Beat 'Em Up");

    const res2 = routeIntent('create a top-down isometric rpg', dummyCtx);
    expect(res2.actionType).toBe('kickstart_blueprint');
    expect(res2.blueprint?.genre).toBe('Top-Down RPG');

    const res3 = routeIntent('fps shooter game', dummyCtx);
    expect(res3.actionType).toBe('kickstart_blueprint');
    expect(res3.blueprint?.genre).toBe('First-Person Shooter');
  });

  it('should route environment atmosphere requests cleanly', () => {
    const res = routeIntent('make it spooky with dense fog', dummyCtx);
    expect(res.actionType).toBe('scene_action');
    expect(res.actions?.[0].after.fogEnabled).toBe(true);
  });

  it('should route agentic object spawning and quest generation', () => {
    const res = routeIntent('spawn a red cube', dummyCtx);
    expect(res.actionType).toBe('scene_action');
    expect(res.actions?.[0].params.type).toBe('cube');
    expect(res.actions?.[0].params.color).toBe('#ff0000');
  });

  it('should route scripted event creation and variable assignment', () => {
    const res1 = routeIntent('create level start event', dummyCtx);
    expect(res1.actionType).toBe('scene_action');
    expect(res1.actionLabel).toContain('Scripted Event');
    expect(res1.actions?.[0].cmd).toBe('add_scripted_event');

    const res2 = routeIntent('set game score to 100', dummyCtx);
    expect(res2.actionType).toBe('scene_action');
    expect(res2.actions?.[0].cmd).toBe('set_game_variable');
    expect(res2.actions?.[0].params.key).toBe('score');
  });

  it('should route agentic foliage painting requests and populate foliageInstances', () => {
    const res = routeIntent('paint a dense pine forest with 300 trees', dummyCtx);
    expect(res.actionType).toBe('scene_action');
    expect(res.actionLabel).toContain('Paint Foliage');
    expect(res.actions?.[0].cmd).toBe('paint_foliage');
    expect(res.actions?.[0].params.preset).toBe('procedural:pine_tree');
    expect(res.actions?.[0].params.count).toBe(300);
  });
});
