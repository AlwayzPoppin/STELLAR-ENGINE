import * as THREE from 'three';
import { useStore, SceneObject } from '../store/useStore';
import { SpatialAudioManager } from '../utils/SpatialAudioManager';

export type CollisionEventType =
  | 'collision_enter'
  | 'collision_exit'
  | 'trigger_enter'
  | 'trigger_exit';

export interface CollisionEvent {
  type: CollisionEventType;
  targetId: string;
  otherId: string;
  targetObject?: SceneObject;
  otherObject?: SceneObject;
  force: number;
  impactSpeed?: number;
  contactPoint?: [number, number, number];
  normal?: [number, number, number];
  timestamp: number;
  rawEvent?: any;
}

export type CollisionListener = (event: CollisionEvent) => void;

/**
 * CollisionEventBroker — Centralized event broker for physics interactions across
 * Rapier physical rigid bodies, spatial audio impacts, combat damage, and game scripts.
 */
class CollisionEventBrokerClass {
  private globalListeners = new Set<CollisionListener>();
  private typeListeners = new Map<CollisionEventType, Set<CollisionListener>>();
  private objectListeners = new Map<string, Set<CollisionListener>>();
  private pairListeners = new Map<string, Set<CollisionListener>>();

  // Cooldown throttling map to prevent event spam (e.g. 50ms per object pair)
  private lastCollisionTime = new Map<string, number>();

  // Diagnostic history buffer (last 50 events)
  private eventHistory: CollisionEvent[] = [];
  private maxHistoryLength = 50;

  constructor() {
    this.typeListeners.set('collision_enter', new Set());
    this.typeListeners.set('collision_exit', new Set());
    this.typeListeners.set('trigger_enter', new Set());
    this.typeListeners.set('trigger_exit', new Set());
  }

  /**
   * Generates a deterministic pair key for unordered object pairs (e.g. 'objA:objB')
   */
  private getPairKey(idA: string, idB: string): string {
    return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
  }

  /**
   * Subscribes to all physics collision and trigger events
   */
  public subscribe(listener: CollisionListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  /**
   * Subscribes to a specific collision event type
   */
  public on(type: CollisionEventType, listener: CollisionListener): () => void {
    const set = this.typeListeners.get(type);
    if (set) {
      set.add(listener);
    }
    return () => {
      this.typeListeners.get(type)?.delete(listener);
    };
  }

  /**
   * Subscribes to collisions involving a specific scene object (as target or other)
   */
  public onObjectCollision(objectId: string, listener: CollisionListener): () => void {
    let set = this.objectListeners.get(objectId);
    if (!set) {
      set = new Set<CollisionListener>();
      this.objectListeners.set(objectId, set);
    }
    set.add(listener);
    return () => {
      const currentSet = this.objectListeners.get(objectId);
      if (currentSet) {
        currentSet.delete(listener);
        if (currentSet.size === 0) {
          this.objectListeners.delete(objectId);
        }
      }
    };
  }

  /**
   * Subscribes to collisions between two specific objects
   */
  public onPairCollision(idA: string, idB: string, listener: CollisionListener): () => void {
    const pairKey = this.getPairKey(idA, idB);
    let set = this.pairListeners.get(pairKey);
    if (!set) {
      set = new Set<CollisionListener>();
      this.pairListeners.set(pairKey, set);
    }
    set.add(listener);
    return () => {
      const currentSet = this.pairListeners.get(pairKey);
      if (currentSet) {
        currentSet.delete(listener);
        if (currentSet.size === 0) {
          this.pairListeners.delete(pairKey);
        }
      }
    };
  }

  /**
   * Broadcasts a collision event to all matching listeners
   */
  public dispatch(event: CollisionEvent): void {
    // 1. Add to diagnostic ring buffer
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistoryLength) {
      this.eventHistory.shift();
    }

    // 2. Global listeners
    for (const listener of this.globalListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[CollisionEventBroker] Global listener error:', err);
      }
    }

    // 3. Event-type specific listeners
    const typeSet = this.typeListeners.get(event.type);
    if (typeSet) {
      for (const listener of typeSet) {
        try {
          listener(event);
        } catch (err) {
          console.error(`[CollisionEventBroker] Listener error on "${event.type}":`, err);
        }
      }
    }

    // 4. Object-specific listeners (targetId & otherId)
    const targetSet = this.objectListeners.get(event.targetId);
    if (targetSet) {
      for (const listener of targetSet) {
        try {
          listener(event);
        } catch (err) {
          console.error(`[CollisionEventBroker] Object listener error for "${event.targetId}":`, err);
        }
      }
    }

    if (event.otherId && event.otherId !== event.targetId) {
      const otherSet = this.objectListeners.get(event.otherId);
      if (otherSet) {
        for (const listener of otherSet) {
          try {
            listener(event);
          } catch (err) {
            console.error(`[CollisionEventBroker] Object listener error for "${event.otherId}":`, err);
          }
        }
      }
    }

    // 5. Pair-specific listeners
    if (event.targetId && event.otherId) {
      const pairKey = this.getPairKey(event.targetId, event.otherId);
      const pairSet = this.pairListeners.get(pairKey);
      if (pairSet) {
        for (const listener of pairSet) {
          try {
            listener(event);
          } catch (err) {
            console.error(`[CollisionEventBroker] Pair listener error for "${pairKey}":`, err);
          }
        }
      }
    }
  }

  /**
   * Helper to extract object ID from Rapier rigidBody or collider payloads
   */
  public extractObjectId(entity: any): string {
    if (!entity) return '';
    return (
      entity?.userData?.id ||
      entity?.rigidBody?.userData?.id ||
      entity?.rigidBodyObject?.userData?.id ||
      entity?.colliderObject?.userData?.id ||
      entity?.collider?.userData?.id ||
      entity?.name ||
      ''
    );
  }

  /**
   * Ingests and normalizes Rapier onCollisionEnter events
   */
  public handleRapierCollisionEnter(
    targetId: string,
    payload: any,
    threeNode?: THREE.Object3D | null,
    targetObject?: SceneObject
  ): void {
    const other = payload?.other;
    const otherId = this.extractObjectId(other);

    const force =
      payload?.totalForceMagnitude ??
      payload?.totalForce ??
      payload?.maxForceMagnitude ??
      15;

    // Cooldown check for pair (50ms)
    const pairKey = this.getPairKey(targetId, otherId || 'unknown');
    const now = performance.now();
    const lastTime = this.lastCollisionTime.get(pairKey) ?? 0;
    if (now - lastTime < 50) {
      return;
    }
    this.lastCollisionTime.set(pairKey, now);

    // Look up scene object definitions
    const objects = useStore.getState().objects;
    const resolvedTarget = targetObject || objects.find((o) => o.id === targetId);
    const resolvedOther = otherId ? objects.find((o) => o.id === otherId) : undefined;

    // Contact point estimation
    let contactPoint: [number, number, number] | undefined;
    let normal: [number, number, number] | undefined;
    if (payload?.manifold) {
      const manifold = payload.manifold;
      if (typeof manifold.normal === 'function') {
        const n = manifold.normal();
        if (n) normal = [n.x, n.y, n.z];
      }
    }

    const event: CollisionEvent = {
      type: 'collision_enter',
      targetId,
      otherId,
      targetObject: resolvedTarget,
      otherObject: resolvedOther,
      force,
      impactSpeed: force > 0 ? force / 10 : 1,
      contactPoint,
      normal,
      timestamp: Date.now(),
      rawEvent: payload,
    };

    // 1. Trigger spatial audio if applicable
    if (threeNode && resolvedTarget && force > 5) {
      const intensity = Math.min(2.0, Math.max(0.2, force / 25));
      const audioUrl = resolvedTarget.audioProps?.url || (resolvedTarget as any).collisionAudioUrl;
      SpatialAudioManager.playCollisionAudio(threeNode, resolvedTarget.id, audioUrl, intensity, {
        refDistance: resolvedTarget.audioProps?.refDistance ?? 1,
        maxDistance: resolvedTarget.audioProps?.maxDistance ?? 40,
        rolloffFactor: resolvedTarget.audioProps?.rolloffFactor ?? 1,
        volume: resolvedTarget.audioProps?.volume ?? 0.8,
      });
    }

    // 2. Dispatch event to broker
    this.dispatch(event);

    // 3. Bridge physics impact to gameplay logic (e.g. enemy defeat upon high impact)
    if (force > 15) {
      const store = useStore.getState();
      const targetIsEnemy =
        (resolvedTarget?.name && /enemy|boss|goblin|monster|target|npc/i.test(resolvedTarget.name)) ||
        (resolvedTarget as any)?.isEnemy;
      const otherIsEnemy =
        (resolvedOther?.name && /enemy|boss|goblin|monster|target|npc/i.test(resolvedOther.name)) ||
        (resolvedOther as any)?.isEnemy;

      if (targetIsEnemy) {
        store.triggerScriptedEvents('on_enemy_defeated', targetId);
      }
      if (otherIsEnemy && otherId) {
        store.triggerScriptedEvents('on_enemy_defeated', otherId);
      }
    }
  }

  /**
   * Ingests and normalizes Rapier onCollisionExit events
   */
  public handleRapierCollisionExit(
    targetId: string,
    payload: any,
    targetObject?: SceneObject
  ): void {
    const other = payload?.other;
    const otherId = this.extractObjectId(other);

    const objects = useStore.getState().objects;
    const resolvedTarget = targetObject || objects.find((o) => o.id === targetId);
    const resolvedOther = otherId ? objects.find((o) => o.id === otherId) : undefined;

    const event: CollisionEvent = {
      type: 'collision_exit',
      targetId,
      otherId,
      targetObject: resolvedTarget,
      otherObject: resolvedOther,
      force: 0,
      timestamp: Date.now(),
      rawEvent: payload,
    };

    this.dispatch(event);
  }

  /**
   * Ingests and normalizes Rapier onIntersectionEnter (Trigger sensor) events
   */
  public handleRapierIntersectionEnter(
    targetId: string,
    payload: any,
    targetObject?: SceneObject
  ): void {
    const other = payload?.other;
    const otherId = this.extractObjectId(other);

    const objects = useStore.getState().objects;
    const resolvedTarget = targetObject || objects.find((o) => o.id === targetId);
    const resolvedOther = otherId ? objects.find((o) => o.id === otherId) : undefined;

    const event: CollisionEvent = {
      type: 'trigger_enter',
      targetId,
      otherId,
      targetObject: resolvedTarget,
      otherObject: resolvedOther,
      force: 0,
      timestamp: Date.now(),
      rawEvent: payload,
    };

    this.dispatch(event);

    // Bridge physics trigger volumes to gameplay logic scripted events & quests
    const store = useStore.getState();
    store.triggerScriptedEvents('on_enter_trigger', targetId);
    if (otherId) {
      store.triggerScriptedEvents('on_enter_trigger', otherId);
    }
  }

  /**
   * Ingests and normalizes Rapier onIntersectionExit (Trigger sensor) events
   */
  public handleRapierIntersectionExit(
    targetId: string,
    payload: any,
    targetObject?: SceneObject
  ): void {
    const other = payload?.other;
    const otherId = this.extractObjectId(other);

    const objects = useStore.getState().objects;
    const resolvedTarget = targetObject || objects.find((o) => o.id === targetId);
    const resolvedOther = otherId ? objects.find((o) => o.id === otherId) : undefined;

    const event: CollisionEvent = {
      type: 'trigger_exit',
      targetId,
      otherId,
      targetObject: resolvedTarget,
      otherObject: resolvedOther,
      force: 0,
      timestamp: Date.now(),
      rawEvent: payload,
    };

    this.dispatch(event);
  }

  /**
   * Returns recent collision history for diagnostics and telemetry
   */
  public getRecentEvents(): CollisionEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clears event listeners and collision history (e.g. on scene reset or test teardown)
   */
  public clear(): void {
    this.globalListeners.clear();
    this.typeListeners.forEach((set) => set.clear());
    this.objectListeners.clear();
    this.pairListeners.clear();
    this.lastCollisionTime.clear();
    this.eventHistory = [];
  }
}

export const CollisionEventBroker = new CollisionEventBrokerClass();
