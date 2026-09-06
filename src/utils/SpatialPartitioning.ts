/**
 * SpatialPartitioning.ts — Spatial Acceleration Structures & Hierarchical Frustum Culling
 * 
 * Provides:
 * 1. SpatialBoundingBox math utilities (zero-allocation AABB/Sphere/Ray/Frustum operations).
 * 2. SpatialOctree: Loose Octree supporting hierarchical frustum culling, fast raycasting, and range queries.
 * 3. SpatialBVH: Binary Bounding Volume Hierarchy with centroid/median splitting and leaf refitting.
 * 4. SceneSpatialIndex: Unified singleton manager coordinating scene graph synchronization,
 *    per-frame camera frustum culling, mesh visibility switching, and spatial picking acceleration.
 */

import * as THREE from 'three';
import { SceneObject } from '../store/useStore';

// ─── Spatial Types ──────────────────────────────────────────────────────────

export interface SpatialItem {
  id: string;
  name?: string;
  type?: string;
  bounds: THREE.Box3;
  boundingSphere: THREE.Sphere;
  object3D?: THREE.Object3D | null;
  visible?: boolean;
  culled?: boolean;
  userData?: any;
}

export interface SpatialRaycastHit {
  distance: number;
  point: THREE.Vector3;
  item: SpatialItem;
  object?: THREE.Object3D;
}

export interface SpatialDebugWireframe {
  min: [number, number, number];
  max: [number, number, number];
  depth: number;
  itemCount: number;
}

export interface SpatialCullResult {
  visibleIds: Set<string>;
  totalCount: number;
  visibleCount: number;
  culledCount: number;
  durationMs: number;
}

export type FrustumIntersection = 'INSIDE' | 'OUTSIDE' | 'INTERSECTING';

// ─── Zero-Allocation Module-Level Scratch Objects ────────────────────────────

const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _boxA = new THREE.Box3();
const _boxB = new THREE.Box3();
const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const _center = new THREE.Vector3();
const _size = new THREE.Vector3();
const _ray = new THREE.Ray();

// ─── Spatial Math & Frustum Classification ──────────────────────────────────

/**
 * Classifies an AABB against a Camera Frustum:
 * - 'INSIDE': The box is strictly inside all 6 frustum planes (all descendants are visible).
 * - 'OUTSIDE': The box is completely outside at least one frustum plane (prune entire subtree).
 * - 'INTERSECTING': The box straddles one or more frustum planes.
 */
export function classifyBoxFrustum(box: THREE.Box3, frustum: THREE.Frustum): FrustumIntersection {
  if (box.isEmpty()) return 'OUTSIDE';

  const planes = frustum.planes;
  let isIntersecting = false;

  for (let i = 0; i < 6; i++) {
    const plane = planes[i];
    const normal = plane.normal;

    // p-vertex: furthest along normal
    const px = normal.x > 0 ? box.max.x : box.min.x;
    const py = normal.y > 0 ? box.max.y : box.min.y;
    const pz = normal.z > 0 ? box.max.z : box.min.z;

    // n-vertex: opposite of normal
    const nx = normal.x > 0 ? box.min.x : box.max.x;
    const ny = normal.y > 0 ? box.min.y : box.max.y;
    const nz = normal.z > 0 ? box.min.z : box.max.z;

    const pDist = normal.x * px + normal.y * py + normal.z * pz + plane.constant;
    if (pDist < 0) {
      // Entire box is on the negative (outside) side of this plane
      return 'OUTSIDE';
    }

    const nDist = normal.x * nx + normal.y * ny + normal.z * nz + plane.constant;
    if (nDist < 0) {
      // Box intersects this plane
      isIntersecting = true;
    }
  }

  return isIntersecting ? 'INTERSECTING' : 'INSIDE';
}

/**
 * Fast Ray-AABB intersection test using the slab method.
 * Returns entry distance >= 0 if intersecting, or null if no hit.
 */
export function intersectRayAABB(
  ray: THREE.Ray,
  box: THREE.Box3,
  minDist = 0,
  maxDist = Infinity
): number | null {
  let tmin = (box.min.x - ray.origin.x) / (ray.direction.x || 1e-12);
  let tmax = (box.max.x - ray.origin.x) / (ray.direction.x || 1e-12);

  if (tmin > tmax) {
    const tmp = tmin;
    tmin = tmax;
    tmax = tmp;
  }

  let tymin = (box.min.y - ray.origin.y) / (ray.direction.y || 1e-12);
  let tymax = (box.max.y - ray.origin.y) / (ray.direction.y || 1e-12);

  if (tymin > tymax) {
    const tmp = tymin;
    tymin = tymax;
    tymax = tmp;
  }

  if (tmin > tymax || tymin > tmax) return null;
  if (tymin > tmin) tmin = tymin;
  if (tymax < tmax) tmax = tymax;

  let tzmin = (box.min.z - ray.origin.z) / (ray.direction.z || 1e-12);
  let tzmax = (box.max.z - ray.origin.z) / (ray.direction.z || 1e-12);

  if (tzmin > tzmax) {
    const tmp = tzmin;
    tzmin = tzmax;
    tzmax = tmp;
  }

  if (tmin > tzmax || tzmin > tmax) return null;
  if (tzmin > tmin) tmin = tzmin;
  if (tzmax < tmax) tmax = tzmax;

  if (tmax < minDist || tmin > maxDist) return null;

  return tmin >= minDist ? tmin : tmax >= minDist ? tmax : null;
}

// ─── Spatial Octree ─────────────────────────────────────────────────────────

export class SpatialOctreeNode {
  public bounds: THREE.Box3;
  public center: THREE.Vector3;
  public halfSize: THREE.Vector3;
  public depth: number;
  public children: SpatialOctreeNode[] | null = null;
  public items: SpatialItem[] = [];

  constructor(bounds: THREE.Box3, depth = 0) {
    this.bounds = bounds.clone();
    this.center = new THREE.Vector3();
    this.halfSize = new THREE.Vector3();
    this.bounds.getCenter(this.center);
    this.bounds.getSize(this.halfSize).multiplyScalar(0.5);
    this.depth = depth;
  }

  public subdivide(): void {
    if (this.children) return;

    this.children = [];
    const min = this.bounds.min;
    const max = this.bounds.max;
    const c = this.center;

    // 8 octants
    for (let i = 0; i < 8; i++) {
      const childMin = new THREE.Vector3(
        (i & 1) === 0 ? min.x : c.x,
        (i & 2) === 0 ? min.y : c.y,
        (i & 4) === 0 ? min.z : c.z
      );
      const childMax = new THREE.Vector3(
        (i & 1) === 0 ? c.x : max.x,
        (i & 2) === 0 ? c.y : max.y,
        (i & 4) === 0 ? c.z : max.z
      );
      this.children.push(new SpatialOctreeNode(new THREE.Box3(childMin, childMax), this.depth + 1));
    }
  }

  public insert(item: SpatialItem, maxDepth = 6, maxItems = 8): boolean {
    if (!this.bounds.intersectsBox(item.bounds)) {
      return false;
    }

    // If leaf node and has space, or max depth reached
    if (!this.children && (this.items.length < maxItems || this.depth >= maxDepth)) {
      this.items.push(item);
      return true;
    }

    if (!this.children) {
      this.subdivide();
      // Re-distribute existing items
      const existing = this.items;
      this.items = [];
      for (let i = 0; i < existing.length; i++) {
        this.insertToChildren(existing[i], maxDepth, maxItems);
      }
    }

    return this.insertToChildren(item, maxDepth, maxItems);
  }

  private insertToChildren(item: SpatialItem, maxDepth: number, maxItems: number): boolean {
    let inserted = false;
    if (this.children) {
      for (let i = 0; i < 8; i++) {
        if (this.children[i].insert(item, maxDepth, maxItems)) {
          inserted = true;
        }
      }
    }

    // If item straddles multiple children or doesn't fit strictly in any child, store at this node
    if (!inserted) {
      this.items.push(item);
      return true;
    }
    return inserted;
  }

  public remove(id: string): boolean {
    let removed = false;
    const idx = this.items.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.items.splice(idx, 1);
      removed = true;
    }

    if (this.children) {
      for (let i = 0; i < 8; i++) {
        if (this.children[i].remove(id)) {
          removed = true;
        }
      }
    }
    return removed;
  }

  public queryFrustum(
    frustum: THREE.Frustum,
    visibleSet: Set<string>,
    classification?: FrustumIntersection
  ): void {
    const status = classification || classifyBoxFrustum(this.bounds, frustum);

    if (status === 'OUTSIDE') {
      return;
    }

    if (status === 'INSIDE') {
      // Bulk accept all items in this node and all descendant children without further bounding checks
      this.collectAll(visibleSet);
      return;
    }

    // INTERSECTING: Test items residing directly in this node
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (classifyBoxFrustum(item.bounds, frustum) !== 'OUTSIDE') {
        visibleSet.add(item.id);
      }
    }

    // Recurse into children
    if (this.children) {
      for (let i = 0; i < 8; i++) {
        this.children[i].queryFrustum(frustum, visibleSet);
      }
    }
  }

  public collectAll(visibleSet: Set<string>): void {
    for (let i = 0; i < this.items.length; i++) {
      visibleSet.add(this.items[i].id);
    }
    if (this.children) {
      for (let i = 0; i < 8; i++) {
        this.children[i].collectAll(visibleSet);
      }
    }
  }

  public queryRay(
    ray: THREE.Ray,
    minDist: number,
    maxDist: number,
    hits: SpatialRaycastHit[],
    visitedSet: Set<string>
  ): void {
    const hitDist = intersectRayAABB(ray, this.bounds, minDist, maxDist);
    if (hitDist === null) return;

    // Test items in this node
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (visitedSet.has(item.id)) continue;

      const itemDist = intersectRayAABB(ray, item.bounds, minDist, maxDist);
      if (itemDist !== null) {
        visitedSet.add(item.id);
        const hitPoint = ray.origin.clone().addScaledVector(ray.direction, itemDist);
        hits.push({
          distance: itemDist,
          point: hitPoint,
          item,
          object: item.object3D || undefined,
        });
      }
    }

    // Traverse children
    if (this.children) {
      // Order children by entry distance for efficient early termination
      const childHits: { node: SpatialOctreeNode; dist: number }[] = [];
      for (let i = 0; i < 8; i++) {
        const d = intersectRayAABB(ray, this.children[i].bounds, minDist, maxDist);
        if (d !== null) {
          childHits.push({ node: this.children[i], dist: d });
        }
      }

      childHits.sort((a, b) => a.dist - b.dist);
      for (let i = 0; i < childHits.length; i++) {
        childHits[i].node.queryRay(ray, minDist, maxDist, hits, visitedSet);
      }
    }
  }

  public queryBox(box: THREE.Box3, result: SpatialItem[], visitedSet: Set<string>): void {
    if (!this.bounds.intersectsBox(box)) return;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (!visitedSet.has(item.id) && item.bounds.intersectsBox(box)) {
        visitedSet.add(item.id);
        result.push(item);
      }
    }

    if (this.children) {
      for (let i = 0; i < 8; i++) {
        this.children[i].queryBox(box, result, visitedSet);
      }
    }
  }

  public querySphere(sphere: THREE.Sphere, result: SpatialItem[], visitedSet: Set<string>): void {
    if (!this.bounds.intersectsSphere(sphere)) return;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (!visitedSet.has(item.id) && item.bounds.intersectsSphere(sphere)) {
        visitedSet.add(item.id);
        result.push(item);
      }
    }

    if (this.children) {
      for (let i = 0; i < 8; i++) {
        this.children[i].querySphere(sphere, result, visitedSet);
      }
    }
  }

  public getDebugWireframes(list: SpatialDebugWireframe[]): void {
    list.push({
      min: [this.bounds.min.x, this.bounds.min.y, this.bounds.min.z],
      max: [this.bounds.max.x, this.bounds.max.y, this.bounds.max.z],
      depth: this.depth,
      itemCount: this.items.length,
    });

    if (this.children) {
      for (let i = 0; i < 8; i++) {
        this.children[i].getDebugWireframes(list);
      }
    }
  }
}

export class SpatialOctree {
  public root: SpatialOctreeNode;
  public maxDepth: number;
  public maxItems: number;
  private itemsMap: Map<string, SpatialItem> = new Map();

  constructor(
    initialBounds: THREE.Box3 = new THREE.Box3(
      new THREE.Vector3(-250, -100, -250),
      new THREE.Vector3(250, 200, 250)
    ),
    maxDepth = 6,
    maxItems = 8
  ) {
    this.maxDepth = maxDepth;
    this.maxItems = maxItems;
    this.root = new SpatialOctreeNode(initialBounds, 0);
  }

  public insert(item: SpatialItem): void {
    this.itemsMap.set(item.id, item);

    // Expand root bounds if item is outside initial domain
    if (!this.root.bounds.containsBox(item.bounds)) {
      this.root.bounds.union(item.bounds);
      this.root.bounds.getCenter(this.root.center);
      this.root.bounds.getSize(this.root.halfSize).multiplyScalar(0.5);
    }

    this.root.insert(item, this.maxDepth, this.maxItems);
  }

  public remove(id: string): void {
    this.itemsMap.delete(id);
    this.root.remove(id);
  }

  public clear(): void {
    this.itemsMap.clear();
    const bounds = this.root.bounds.clone();
    this.root = new SpatialOctreeNode(bounds, 0);
  }

  public rebuild(items: SpatialItem[]): void {
    this.clear();
    if (items.length === 0) return;

    // Calculate bounding box enclosing all items
    _boxA.makeEmpty();
    for (let i = 0; i < items.length; i++) {
      _boxA.union(items[i].bounds);
    }
    _boxA.expandByScalar(10); // Padding margin

    this.root = new SpatialOctreeNode(_boxA, 0);
    for (let i = 0; i < items.length; i++) {
      this.insert(items[i]);
    }
  }

  public queryFrustum(frustum: THREE.Frustum): Set<string> {
    const visibleSet = new Set<string>();
    this.root.queryFrustum(frustum, visibleSet);
    return visibleSet;
  }

  public raycast(ray: THREE.Ray, minDist = 0, maxDist = Infinity): SpatialRaycastHit[] {
    const hits: SpatialRaycastHit[] = [];
    const visited = new Set<string>();
    this.root.queryRay(ray, minDist, maxDist, hits, visited);
    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }

  public queryBox(box: THREE.Box3): SpatialItem[] {
    const result: SpatialItem[] = [];
    const visited = new Set<string>();
    this.root.queryBox(box, result, visited);
    return result;
  }

  public querySphere(sphere: THREE.Sphere): SpatialItem[] {
    const result: SpatialItem[] = [];
    const visited = new Set<string>();
    this.root.querySphere(sphere, result, visited);
    return result;
  }

  public getDebugWireframes(): SpatialDebugWireframe[] {
    const list: SpatialDebugWireframe[] = [];
    this.root.getDebugWireframes(list);
    return list;
  }

  public getItemCount(): number {
    return this.itemsMap.size;
  }
}

// ─── Spatial BVH (Bounding Volume Hierarchy) ────────────────────────────────

export class SpatialBVHNode {
  public bounds: THREE.Box3;
  public left: SpatialBVHNode | null = null;
  public right: SpatialBVHNode | null = null;
  public items: SpatialItem[] = [];
  public depth: number;

  constructor(bounds: THREE.Box3, depth = 0) {
    this.bounds = bounds.clone();
    this.depth = depth;
  }

  public isLeaf(): boolean {
    return this.left === null && this.right === null;
  }

  public queryFrustum(
    frustum: THREE.Frustum,
    visibleSet: Set<string>,
    classification?: FrustumIntersection
  ): void {
    const status = classification || classifyBoxFrustum(this.bounds, frustum);
    if (status === 'OUTSIDE') return;

    if (status === 'INSIDE') {
      this.collectAll(visibleSet);
      return;
    }

    // INTERSECTING: Test leaf items
    if (this.isLeaf()) {
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        if (classifyBoxFrustum(item.bounds, frustum) !== 'OUTSIDE') {
          visibleSet.add(item.id);
        }
      }
      return;
    }

    if (this.left) this.left.queryFrustum(frustum, visibleSet);
    if (this.right) this.right.queryFrustum(frustum, visibleSet);
  }

  public collectAll(visibleSet: Set<string>): void {
    for (let i = 0; i < this.items.length; i++) {
      visibleSet.add(this.items[i].id);
    }
    if (this.left) this.left.collectAll(visibleSet);
    if (this.right) this.right.collectAll(visibleSet);
  }

  public queryRay(
    ray: THREE.Ray,
    minDist: number,
    maxDist: number,
    hits: SpatialRaycastHit[],
    visitedSet: Set<string>
  ): void {
    const hitDist = intersectRayAABB(ray, this.bounds, minDist, maxDist);
    if (hitDist === null) return;

    if (this.isLeaf()) {
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        if (visitedSet.has(item.id)) continue;

        const itemDist = intersectRayAABB(ray, item.bounds, minDist, maxDist);
        if (itemDist !== null) {
          visitedSet.add(item.id);
          const hitPoint = ray.origin.clone().addScaledVector(ray.direction, itemDist);
          hits.push({
            distance: itemDist,
            point: hitPoint,
            item,
            object: item.object3D || undefined,
          });
        }
      }
      return;
    }

    let leftDist: number | null = null;
    let rightDist: number | null = null;

    if (this.left) leftDist = intersectRayAABB(ray, this.left.bounds, minDist, maxDist);
    if (this.right) rightDist = intersectRayAABB(ray, this.right.bounds, minDist, maxDist);

    if (leftDist !== null && rightDist !== null) {
      if (leftDist < rightDist) {
        this.left!.queryRay(ray, minDist, maxDist, hits, visitedSet);
        this.right!.queryRay(ray, minDist, maxDist, hits, visitedSet);
      } else {
        this.right!.queryRay(ray, minDist, maxDist, hits, visitedSet);
        this.left!.queryRay(ray, minDist, maxDist, hits, visitedSet);
      }
    } else if (leftDist !== null) {
      this.left!.queryRay(ray, minDist, maxDist, hits, visitedSet);
    } else if (rightDist !== null) {
      this.right!.queryRay(ray, minDist, maxDist, hits, visitedSet);
    }
  }

  public queryBox(box: THREE.Box3, result: SpatialItem[], visitedSet: Set<string>): void {
    if (!this.bounds.intersectsBox(box)) return;

    if (this.isLeaf()) {
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        if (!visitedSet.has(item.id) && item.bounds.intersectsBox(box)) {
          visitedSet.add(item.id);
          result.push(item);
        }
      }
      return;
    }

    if (this.left) this.left.queryBox(box, result, visitedSet);
    if (this.right) this.right.queryBox(box, result, visitedSet);
  }

  public querySphere(sphere: THREE.Sphere, result: SpatialItem[], visitedSet: Set<string>): void {
    if (!this.bounds.intersectsSphere(sphere)) return;

    if (this.isLeaf()) {
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        if (!visitedSet.has(item.id) && item.bounds.intersectsSphere(sphere)) {
          visitedSet.add(item.id);
          result.push(item);
        }
      }
      return;
    }

    if (this.left) this.left.querySphere(sphere, result, visitedSet);
    if (this.right) this.right.querySphere(sphere, result, visitedSet);
  }

  public refit(): void {
    if (this.isLeaf()) {
      this.bounds.makeEmpty();
      for (let i = 0; i < this.items.length; i++) {
        this.bounds.union(this.items[i].bounds);
      }
      return;
    }

    if (this.left) this.left.refit();
    if (this.right) this.right.refit();

    this.bounds.makeEmpty();
    if (this.left) this.bounds.union(this.left.bounds);
    if (this.right) this.bounds.union(this.right.bounds);
  }

  public getDebugWireframes(list: SpatialDebugWireframe[]): void {
    list.push({
      min: [this.bounds.min.x, this.bounds.min.y, this.bounds.min.z],
      max: [this.bounds.max.x, this.bounds.max.y, this.bounds.max.z],
      depth: this.depth,
      itemCount: this.items.length,
    });

    if (this.left) this.left.getDebugWireframes(list);
    if (this.right) this.right.getDebugWireframes(list);
  }
}

export class SpatialBVH {
  public root: SpatialBVHNode | null = null;
  public maxDepth: number;
  public maxItemsPerLeaf: number;
  private itemsMap: Map<string, SpatialItem> = new Map();

  constructor(maxDepth = 10, maxItemsPerLeaf = 4) {
    this.maxDepth = maxDepth;
    this.maxItemsPerLeaf = maxItemsPerLeaf;
  }

  public build(items: SpatialItem[]): void {
    this.itemsMap.clear();
    for (let i = 0; i < items.length; i++) {
      this.itemsMap.set(items[i].id, items[i]);
    }

    if (items.length === 0) {
      this.root = null;
      return;
    }

    this.root = this.buildRecursive([...items], 0);
  }

  private buildRecursive(items: SpatialItem[], depth: number): SpatialBVHNode {
    const bounds = new THREE.Box3();
    for (let i = 0; i < items.length; i++) {
      bounds.union(items[i].bounds);
    }

    const node = new SpatialBVHNode(bounds, depth);

    if (items.length <= this.maxItemsPerLeaf || depth >= this.maxDepth) {
      node.items = items;
      return node;
    }

    // Split along longest axis of the enclosing bounds
    bounds.getSize(_size);
    let splitAxis = 0; // 0 = X, 1 = Y, 2 = Z
    if (_size.y > _size.x && _size.y > _size.z) splitAxis = 1;
    else if (_size.z > _size.x && _size.z > _size.y) splitAxis = 2;

    // Sort items by centroid along split axis
    items.sort((a, b) => {
      a.bounds.getCenter(_v0);
      b.bounds.getCenter(_v1);
      if (splitAxis === 0) return _v0.x - _v1.x;
      if (splitAxis === 1) return _v0.y - _v1.y;
      return _v0.z - _v1.z;
    });

    const mid = Math.floor(items.length / 2);
    const leftItems = items.slice(0, mid);
    const rightItems = items.slice(mid);

    node.left = this.buildRecursive(leftItems, depth + 1);
    node.right = this.buildRecursive(rightItems, depth + 1);

    return node;
  }

  public queryFrustum(frustum: THREE.Frustum): Set<string> {
    const visibleSet = new Set<string>();
    if (this.root) {
      this.root.queryFrustum(frustum, visibleSet);
    }
    return visibleSet;
  }

  public raycast(ray: THREE.Ray, minDist = 0, maxDist = Infinity): SpatialRaycastHit[] {
    const hits: SpatialRaycastHit[] = [];
    if (this.root) {
      const visited = new Set<string>();
      this.root.queryRay(ray, minDist, maxDist, hits, visited);
      hits.sort((a, b) => a.distance - b.distance);
    }
    return hits;
  }

  public queryBox(box: THREE.Box3): SpatialItem[] {
    const result: SpatialItem[] = [];
    if (this.root) {
      const visited = new Set<string>();
      this.root.queryBox(box, result, visited);
    }
    return result;
  }

  public querySphere(sphere: THREE.Sphere): SpatialItem[] {
    const result: SpatialItem[] = [];
    if (this.root) {
      const visited = new Set<string>();
      this.root.querySphere(sphere, result, visited);
    }
    return result;
  }

  public refit(): void {
    if (this.root) {
      this.root.refit();
    }
  }

  public getDebugWireframes(): SpatialDebugWireframe[] {
    const list: SpatialDebugWireframe[] = [];
    if (this.root) {
      this.root.getDebugWireframes(list);
    }
    return list;
  }

  public getItemCount(): number {
    return this.itemsMap.size;
  }
}

// ─── Scene Spatial Index (Unified Engine Manager) ───────────────────────────

export class SceneSpatialIndex {
  private static instance: SceneSpatialIndex;

  private structureType: 'octree' | 'bvh' = 'octree';
  private octree: SpatialOctree = new SpatialOctree();
  private bvh: SpatialBVH = new SpatialBVH();
  private itemsMap: Map<string, SpatialItem> = new Map();
  private dirty = true;
  private lastCullTime = 0;
  private cachedCullResult: SpatialCullResult = {
    visibleIds: new Set(),
    totalCount: 0,
    visibleCount: 0,
    culledCount: 0,
    durationMs: 0,
  };

  private constructor() {}

  public static getInstance(): SceneSpatialIndex {
    if (!SceneSpatialIndex.instance) {
      SceneSpatialIndex.instance = new SceneSpatialIndex();
    }
    return SceneSpatialIndex.instance;
  }

  public setStructureType(type: 'octree' | 'bvh'): void {
    if (this.structureType !== type) {
      this.structureType = type;
      this.dirty = true;
    }
  }

  public getStructureType(): 'octree' | 'bvh' {
    return this.structureType;
  }

  /**
   * Registers or updates an object's spatial item bounds in the acceleration structure.
   */
  public registerItem(
    id: string,
    bounds: THREE.Box3,
    object3D?: THREE.Object3D | null,
    meta?: { name?: string; type?: string; userData?: any }
  ): void {
    const existing = this.itemsMap.get(id);
    const sphere = new THREE.Sphere();
    bounds.getBoundingSphere(sphere);

    if (existing) {
      existing.bounds.copy(bounds);
      existing.boundingSphere.copy(sphere);
      if (object3D !== undefined) existing.object3D = object3D;
      if (meta?.name !== undefined) existing.name = meta.name;
      if (meta?.type !== undefined) existing.type = meta.type;
      if (meta?.userData !== undefined) existing.userData = meta.userData;
    } else {
      const item: SpatialItem = {
        id,
        name: meta?.name,
        type: meta?.type,
        bounds: bounds.clone(),
        boundingSphere: sphere,
        object3D: object3D || null,
        visible: true,
        culled: false,
        userData: meta?.userData,
      };
      this.itemsMap.set(id, item);
    }
    this.dirty = true;
  }

  public unregisterItem(id: string): void {
    if (this.itemsMap.has(id)) {
      this.itemsMap.delete(id);
      this.dirty = true;
    }
  }

  public clear(): void {
    this.itemsMap.clear();
    this.octree.clear();
    this.bvh.build([]);
    this.dirty = true;
  }

  /**
   * Synchronizes spatial bounds directly from the Three.js scene graph and store objects.
   */
  public syncScene(scene: THREE.Object3D, storeObjects: SceneObject[]): void {
    const exportScene = scene.getObjectByName('export_scene') || scene;
    const currentStoreIds = new Set(storeObjects.map((o) => o.id));

    // Remove any items that no longer exist in the store
    for (const [id] of this.itemsMap) {
      if (!currentStoreIds.has(id)) {
        this.itemsMap.delete(id);
        this.dirty = true;
      }
    }

    // Traverse exportScene to match Object3D nodes with store objects
    const nodeMap = new Map<string, THREE.Object3D>();
    exportScene.traverse((child) => {
      const id = child.userData?.id;
      if (id && currentStoreIds.has(id)) {
        nodeMap.set(id, child);
      }
    });

    for (let i = 0; i < storeObjects.length; i++) {
      const obj = storeObjects[i];
      // Skip system helpers or celestial objects (sun/moon)
      if (obj.id === 'obj_sun' || obj.id === 'obj_moon') continue;

      const node = nodeMap.get(obj.id);
      if (node) {
        _boxA.setFromObject(node);
        if (!_boxA.isEmpty()) {
          this.registerItem(obj.id, _boxA, node, { name: obj.name, type: obj.type, userData: obj });
        }
      } else {
        // Fallback to position + scale AABB approximation if Object3D not mounted yet
        _v0.set(...obj.position);
        _size.set(...obj.scale).multiplyScalar(0.5);
        _boxA.set(
          _v0.clone().sub(_size),
          _v0.clone().add(_size)
        );
        this.registerItem(obj.id, _boxA, null, { name: obj.name, type: obj.type, userData: obj });
      }
    }

    if (this.dirty) {
      this.rebuildStructure();
    }
  }

  public rebuildStructure(): void {
    const items = Array.from(this.itemsMap.values());
    if (this.structureType === 'octree') {
      this.octree.rebuild(items);
    } else {
      this.bvh.build(items);
    }
    this.dirty = false;
  }

  /**
   * Executes camera Frustum Culling against the active spatial acceleration structure.
   */
  public performFrustumCulling(camera: THREE.Camera): SpatialCullResult {
    const startTime = performance.now();

    // Ensure camera world matrices are current and compute active camera frustum
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreenMatrix);

    if (this.dirty) {
      this.rebuildStructure();
    }

    let visibleIds: Set<string>;
    if (this.structureType === 'octree') {
      visibleIds = this.octree.queryFrustum(_frustum);
    } else {
      visibleIds = this.bvh.queryFrustum(_frustum);
    }

    const totalCount = this.itemsMap.size;
    let visibleCount = 0;
    let culledCount = 0;

    // Apply visibility states to Object3D nodes
    this.itemsMap.forEach((item, id) => {
      const isVisible = visibleIds.has(id);
      item.visible = isVisible;
      item.culled = !isVisible;

      if (item.object3D) {
        // Three.js object visibility toggle
        item.object3D.visible = isVisible;
      }

      if (isVisible) visibleCount++;
      else culledCount++;
    });

    const durationMs = performance.now() - startTime;
    this.lastCullTime = durationMs;

    this.cachedCullResult = {
      visibleIds,
      totalCount,
      visibleCount,
      culledCount,
      durationMs,
    };

    return this.cachedCullResult;
  }

  public getLastCullResult(): SpatialCullResult {
    return this.cachedCullResult;
  }

  public raycast(ray: THREE.Ray, minDist = 0, maxDist = Infinity): SpatialRaycastHit[] {
    if (this.dirty) {
      this.rebuildStructure();
    }
    if (this.structureType === 'octree') {
      return this.octree.raycast(ray, minDist, maxDist);
    } else {
      return this.bvh.raycast(ray, minDist, maxDist);
    }
  }

  public queryBox(box: THREE.Box3): SpatialItem[] {
    if (this.dirty) {
      this.rebuildStructure();
    }
    if (this.structureType === 'octree') {
      return this.octree.queryBox(box);
    } else {
      return this.bvh.queryBox(box);
    }
  }

  public querySphere(sphere: THREE.Sphere): SpatialItem[] {
    if (this.dirty) {
      this.rebuildStructure();
    }
    if (this.structureType === 'octree') {
      return this.octree.querySphere(sphere);
    } else {
      return this.bvh.querySphere(sphere);
    }
  }

  public getDebugWireframes(): SpatialDebugWireframe[] {
    if (this.dirty) {
      this.rebuildStructure();
    }
    if (this.structureType === 'octree') {
      return this.octree.getDebugWireframes();
    } else {
      return this.bvh.getDebugWireframes();
    }
  }

  public getItemCount(): number {
    return this.itemsMap.size;
  }
}
