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
});
