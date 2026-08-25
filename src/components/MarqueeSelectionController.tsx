import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

interface MarqueeSelectionControllerProps {
  setMarqueeBox: (box: { startX: number; startY: number; endX: number; endY: number } | null) => void;
  setMarqueeSelectedIds: (ids: string[]) => void;
}

interface CachedObjectBounds {
  id: string;
  box: THREE.Box3;
  worldPos: THREE.Vector3;
  isEmpty: boolean;
}

// Module-level pre-allocated scratch vectors for zero-allocation projection & overlap tests
const _cornerVecs = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
];
const _scratchProjVec = new THREE.Vector3();
const _scratchBox = new THREE.Box3();
const _scratchPos = new THREE.Vector3();

export const MarqueeSelectionController: React.FC<MarqueeSelectionControllerProps> = ({
  setMarqueeBox,
  setMarqueeSelectedIds,
}) => {
  const { gl, camera, scene } = useThree();
  const setSelectedIds = useStore((s) => s.setSelectedIds);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastCalcTimeRef = useRef(0);
  const cachedBoundsRef = useRef<CachedObjectBounds[]>([]);
  const cachedRectRef = useRef<{ left: number; top: number; width: number; height: number }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const updateCachedRect = () => {
      if (gl.domElement) {
        const domRect = gl.domElement.getBoundingClientRect();
        cachedRectRef.current = {
          left: domRect.left,
          top: domRect.top,
          width: domRect.width,
          height: domRect.height,
        };
      }
    };

    // Initial cache initialization
    updateCachedRect();

    // Cache 3D bounding boxes on pointerdown to eliminate expensive matrix recalculations during dragging
    const cacheObjectBounds = () => {
      const exportScene = scene.getObjectByName('export_scene');
      if (!exportScene) {
        cachedBoundsRef.current = [];
        return;
      }

      const storeObjects = useStore.getState().objects;
      const list: CachedObjectBounds[] = [];

      for (const obj of storeObjects) {
        if (obj.visible === false) continue;

        // Ignore ground plane
        const isGround =
          obj.name === 'Ground Plane' ||
          obj.id === 'obj_3' ||
          obj.geometry === 'plane';
        if (isGround) continue;

        let node: THREE.Object3D | null = null;
        exportScene.traverse((child) => {
          if (!node && (child.userData?.id === obj.id || (child.name === obj.name && child !== exportScene))) {
            node = child;
          }
        });

        if (!node) continue;

        _scratchBox.setFromObject(node);
        node.getWorldPosition(_scratchPos);

        list.push({
          id: obj.id,
          box: _scratchBox.clone(),
          worldPos: _scratchPos.clone(),
          isEmpty: _scratchBox.isEmpty(),
        });
      }

      cachedBoundsRef.current = list;
    };

    // Helper function to find all objects inside the marquee selection box
    const getObjectsInBox = (
      startX: number,
      startY: number,
      endX: number,
      endY: number
    ): string[] => {
      const rect = cachedRectRef.current;
      if (rect.width === 0 || rect.height === 0) return [];

      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      const toSelect: string[] = [];
      const storeObjects = useStore.getState().objects;

      // Helper function to resolve any child part or nested mesh to its top-most selectable group/csg ancestor
      const resolveSelectableId = (id: string): string => {
        let currentId = id;
        const visited = new Set();
        while (currentId && !visited.has(currentId)) {
          visited.add(currentId);
          const obj = storeObjects.find((o) => o.id === currentId);
          if (!obj) break;

          if (obj.parentId) {
            const parent = storeObjects.find((o) => o.id === obj.parentId);
            if (parent && (parent.type === 'group' || parent.type === 'csg')) {
              currentId = parent.id;
              continue;
            }
          }
          break;
        }
        return currentId;
      };

      const cachedBounds = cachedBoundsRef.current;

      for (let i = 0; i < cachedBounds.length; i++) {
        const item = cachedBounds[i];

        if (item.isEmpty) {
          // Fallback to origin point
          _scratchProjVec.copy(item.worldPos);
          _scratchProjVec.project(camera);
          if (_scratchProjVec.z >= -1 && _scratchProjVec.z <= 1) {
            const screenX = (_scratchProjVec.x * 0.5 + 0.5) * rect.width;
            const screenY = (-_scratchProjVec.y * 0.5 + 0.5) * rect.height;
            if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
              const resolvedId = resolveSelectableId(item.id);
              if (!toSelect.includes(resolvedId)) toSelect.push(resolvedId);
            }
          }
        } else {
          // Check 2D projected bounding box overlap using pre-allocated corner scratch vectors
          const b = item.box;
          _cornerVecs[0].set(b.min.x, b.min.y, b.min.z);
          _cornerVecs[1].set(b.min.x, b.min.y, b.max.z);
          _cornerVecs[2].set(b.min.x, b.max.y, b.min.z);
          _cornerVecs[3].set(b.min.x, b.max.y, b.max.z);
          _cornerVecs[4].set(b.max.x, b.min.y, b.min.z);
          _cornerVecs[5].set(b.max.x, b.min.y, b.max.z);
          _cornerVecs[6].set(b.max.x, b.max.y, b.min.z);
          _cornerVecs[7].set(b.max.x, b.max.y, b.max.z);

          let objMinX = Infinity;
          let objMaxX = -Infinity;
          let objMinY = Infinity;
          let objMaxY = -Infinity;
          let anyInFront = false;

          for (let c = 0; c < 8; c++) {
            const corner = _cornerVecs[c];
            corner.project(camera);
            if (corner.z >= -1 && corner.z <= 1) {
              anyInFront = true;
            }
            const screenX = (corner.x * 0.5 + 0.5) * rect.width;
            const screenY = (-corner.y * 0.5 + 0.5) * rect.height;
            objMinX = Math.min(objMinX, screenX);
            objMaxX = Math.max(objMaxX, screenX);
            objMinY = Math.min(objMinY, screenY);
            objMaxY = Math.max(objMaxY, screenY);
          }

          if (anyInFront) {
            // 2D AABB overlap test
            const overlaps = !(objMaxX < minX || objMinX > maxX || objMaxY < minY || objMinY > maxY);
            if (overlaps) {
              const resolvedId = resolveSelectableId(item.id);
              if (!toSelect.includes(resolvedId)) {
                toSelect.push(resolvedId);
              }
            }
          }
        }
      }

      return toSelect;
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Only trigger on left-click
      if (e.button !== 0) return;

      const store = useStore.getState();
      // Only trigger if not in play mode and in select tool
      if (store.isPlaying) return;
      if (store.activeTool !== 'select') return;
      if (store.gizmoFocused) return;

      // Refresh bounding rect on pointer down
      updateCachedRect();
      const rect = cachedRectRef.current;
      if (rect.width === 0 || rect.height === 0) return;

      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const mouse = new THREE.Vector2(
        (clientX / rect.width) * 2 - 1,
        -(clientY / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(scene.children, true);
      let clickedDragHandle = false;

      intersects.some((h) => {
        let cur: THREE.Object3D | null = h.object;
        while (cur && cur !== scene) {
          if (cur.userData?.isDragHandle || cur.userData?.isGizmo) {
            clickedDragHandle = true;
            return true;
          }
          cur = cur.parent;
        }
        return false;
      });

      if (clickedDragHandle) {
        // Dragging a transform gizmo arrow/ring: let TransformControls handle it
        return;
      }

      // Eagerly cache 3D bounding boxes for all candidate objects at start of drag
      cacheObjectBounds();

      // Start marquee selection drag
      isDraggingRef.current = true;
      dragStartRef.current = { x: clientX, y: clientY };
      setMarqueeBox({
        startX: clientX,
        startY: clientY,
        endX: clientX,
        endY: clientY,
      });
      setMarqueeSelectedIds([]);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      const rect = cachedRectRef.current;
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const startX = dragStartRef.current.x;
      const startY = dragStartRef.current.y;
      const endX = clientX;
      const endY = clientY;

      setMarqueeBox({
        startX,
        startY,
        endX,
        endY,
      });

      // Throttle dynamic object highlighting inside box during drag (30ms)
      const now = performance.now();
      if (now - lastCalcTimeRef.current > 30) {
        lastCalcTimeRef.current = now;
        const insideIds = getObjectsInBox(startX, startY, endX, endY);
        setMarqueeSelectedIds(insideIds);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      const rect = cachedRectRef.current;
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const startX = dragStartRef.current.x;
      const startY = dragStartRef.current.y;
      const endX = clientX;
      const endY = clientY;

      isDraggingRef.current = false;
      dragStartRef.current = null;
      setMarqueeBox(null);
      setMarqueeSelectedIds([]); // Clear dynamic highlights

      // If the drag distance is very small (< 5px), treat it as a normal click
      const dist = Math.sqrt((startX - endX) ** 2 + (startY - endY) ** 2);
      if (dist < 5) {
        cachedBoundsRef.current = [];
        return;
      }

      const toSelect = getObjectsInBox(startX, startY, endX, endY);
      cachedBoundsRef.current = []; // Free cached bounding boxes on drag end

      const currentSelected = useStore.getState().selectedIds;

      if (toSelect.length > 0) {
        if (e.shiftKey || e.ctrlKey) {
          // Add to selection
          const newSelection = [...currentSelected];
          toSelect.forEach((id) => {
            if (!newSelection.includes(id)) {
              newSelection.push(id);
            }
          });
          setSelectedIds(newSelection);
        } else {
          // Replace selection
          setSelectedIds(toSelect);
        }
      } else {
        // Dragged but hit nothing: clear selection if Shift/Ctrl is not held
        if (!e.shiftKey && !e.ctrlKey) {
          setSelectedIds([]);
        }
      }
    };

    const dom = gl.domElement;
    dom.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('resize', updateCachedRect);

    return () => {
      dom.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', updateCachedRect);
    };
  }, [gl, camera, scene, setSelectedIds, setMarqueeBox, setMarqueeSelectedIds]);

  return null;
};
