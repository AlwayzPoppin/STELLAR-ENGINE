import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollisionEventBroker, CollisionEvent } from './CollisionEventBroker';
import { SpatialAudioManager } from '../utils/SpatialAudioManager';
import { useStore } from '../store/useStore';
import * as THREE from 'three';

describe('CollisionEventBroker', () => {
  beforeEach(() => {
    CollisionEventBroker.clear();
    vi.restoreAllMocks();
  });

  it('should dispatch and receive global collision events', () => {
    const listener = vi.fn();
    const unsubscribe = CollisionEventBroker.subscribe(listener);

    const event: CollisionEvent = {
      type: 'collision_enter',
      targetId: 'cube_1',
      otherId: 'cube_2',
      force: 20,
      timestamp: Date.now(),
    };

    CollisionEventBroker.dispatch(event);
    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();
    CollisionEventBroker.dispatch(event);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should filter events by event type', () => {
    const enterListener = vi.fn();
    const exitListener = vi.fn();

    CollisionEventBroker.on('collision_enter', enterListener);
    CollisionEventBroker.on('collision_exit', exitListener);

    CollisionEventBroker.dispatch({
      type: 'collision_enter',
      targetId: 'objA',
      otherId: 'objB',
      force: 10,
      timestamp: Date.now(),
    });

    expect(enterListener).toHaveBeenCalledTimes(1);
    expect(exitListener).not.toHaveBeenCalled();

    CollisionEventBroker.dispatch({
      type: 'collision_exit',
      targetId: 'objA',
      otherId: 'objB',
      force: 0,
      timestamp: Date.now(),
    });

    expect(exitListener).toHaveBeenCalledTimes(1);
  });

  it('should filter events by object ID (as target or other)', () => {
    const listenerA = vi.fn();
    const listenerC = vi.fn();

    CollisionEventBroker.onObjectCollision('objA', listenerA);
    CollisionEventBroker.onObjectCollision('objC', listenerC);

    CollisionEventBroker.dispatch({
      type: 'collision_enter',
      targetId: 'objA',
      otherId: 'objB',
      force: 15,
      timestamp: Date.now(),
    });

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerC).not.toHaveBeenCalled();

    // Now objA is the otherId in collision
    CollisionEventBroker.dispatch({
      type: 'collision_enter',
      targetId: 'objD',
      otherId: 'objA',
      force: 8,
      timestamp: Date.now(),
    });

    expect(listenerA).toHaveBeenCalledTimes(2);
    expect(listenerC).not.toHaveBeenCalled();
  });

  it('should filter collisions between a specific object pair', () => {
    const pairListener = vi.fn();
    CollisionEventBroker.onPairCollision('player', 'hazard_spike', pairListener);

    // Collision between player and hazard
    CollisionEventBroker.dispatch({
      type: 'collision_enter',
      targetId: 'player',
      otherId: 'hazard_spike',
      force: 30,
      timestamp: Date.now(),
    });

    expect(pairListener).toHaveBeenCalledTimes(1);

    // Inverted pair order (hazard -> player) should also trigger
    CollisionEventBroker.dispatch({
      type: 'collision_enter',
      targetId: 'hazard_spike',
      otherId: 'player',
      force: 12,
      timestamp: Date.now(),
    });

    expect(pairListener).toHaveBeenCalledTimes(2);

    // Collision with another object should not trigger
    CollisionEventBroker.dispatch({
      type: 'collision_enter',
      targetId: 'player',
      otherId: 'coin_pickup',
      force: 2,
      timestamp: Date.now(),
    });

    expect(pairListener).toHaveBeenCalledTimes(2);
  });

  it('should maintain a ring buffer of recent events', () => {
    for (let i = 0; i < 60; i++) {
      CollisionEventBroker.dispatch({
        type: 'collision_enter',
        targetId: `obj_${i}`,
        otherId: `other_${i}`,
        force: i,
        timestamp: Date.now(),
      });
    }

    const history = CollisionEventBroker.getRecentEvents();
    expect(history.length).toBe(50);
    expect(history[history.length - 1].targetId).toBe('obj_59');
  });

  it('should ingest and normalize Rapier collision events with audio trigger', () => {
    const audioSpy = vi.spyOn(SpatialAudioManager, 'playCollisionAudio').mockResolvedValue(undefined as any);

    const dummyNode = new THREE.Object3D();
    const dummyObj: any = {
      id: 'ball_1',
      name: 'Bouncy Ball',
      audioProps: { refDistance: 2, maxDistance: 30, volume: 0.9 },
    };

    const rapierPayload = {
      other: {
        rigidBodyObject: {
          userData: { id: 'floor_1' },
        },
      },
      totalForceMagnitude: 22,
      manifold: {
        normal: () => ({ x: 0, y: 1, z: 0 }),
      },
    };

    const listener = vi.fn();
    CollisionEventBroker.subscribe(listener);

    CollisionEventBroker.handleRapierCollisionEnter('ball_1', rapierPayload, dummyNode, dummyObj);

    expect(listener).toHaveBeenCalledTimes(1);
    const event: CollisionEvent = listener.mock.calls[0][0];
    expect(event.targetId).toBe('ball_1');
    expect(event.otherId).toBe('floor_1');
    expect(event.force).toBe(22);
    expect(event.normal).toEqual([0, 1, 0]);

    expect(audioSpy).toHaveBeenCalledWith(
      dummyNode,
      'ball_1',
      undefined,
      expect.any(Number),
      expect.objectContaining({ volume: 0.9 })
    );
  });

  it('should extract object IDs from nested Rapier structures', () => {
    expect(CollisionEventBroker.extractObjectId({ userData: { id: 'test_1' } })).toBe('test_1');
    expect(CollisionEventBroker.extractObjectId({ rigidBody: { userData: { id: 'test_2' } } })).toBe('test_2');
    expect(CollisionEventBroker.extractObjectId({ rigidBodyObject: { userData: { id: 'test_3' } } })).toBe('test_3');
    expect(CollisionEventBroker.extractObjectId({ colliderObject: { userData: { id: 'test_4' } } })).toBe('test_4');
    expect(CollisionEventBroker.extractObjectId({ name: 'fallback_name' })).toBe('fallback_name');
    expect(CollisionEventBroker.extractObjectId(null)).toBe('');
  });

  it('should trigger scripted events on intersection enter (trigger volume)', () => {
    const triggerSpy = vi.spyOn(useStore.getState(), 'triggerScriptedEvents');

    const rapierPayload = {
      other: {
        rigidBodyObject: {
          userData: { id: 'player_1' },
        },
      },
    };

    CollisionEventBroker.handleRapierIntersectionEnter('trigger_zone_1', rapierPayload);

    expect(triggerSpy).toHaveBeenCalledWith('on_enter_trigger', 'trigger_zone_1');
    expect(triggerSpy).toHaveBeenCalledWith('on_enter_trigger', 'player_1');
  });

  it('should trigger on_enemy_defeated when a high-impact collision hits an enemy', () => {
    const triggerSpy = vi.spyOn(useStore.getState(), 'triggerScriptedEvents');

    const enemyObj: any = {
      id: 'goblin_boss',
      name: 'Goblin Boss Enemy',
    };

    const rapierPayload = {
      other: {
        rigidBodyObject: {
          userData: { id: 'boulder_1' },
        },
      },
      totalForceMagnitude: 45,
    };

    CollisionEventBroker.handleRapierCollisionEnter('goblin_boss', rapierPayload, undefined, enemyObj);

    expect(triggerSpy).toHaveBeenCalledWith('on_enemy_defeated', 'goblin_boss');
  });
});
