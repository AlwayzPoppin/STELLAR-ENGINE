import * as THREE from 'three';

export interface VertexWeightBrushParams {
  mesh?: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  hitPoint?: THREE.Vector3;
  localHitPoint?: THREE.Vector3;
  radius: number;
  strength: number;
  targetValue: number;
  channel: 'r' | 'g' | 'b' | 'a';
}

const _brushVPos = new THREE.Vector3();
const _brushWorldVPos = new THREE.Vector3();

export function applyVertexWeightBrush(params: VertexWeightBrushParams): boolean {
  const { mesh, geometry, hitPoint, localHitPoint, radius, strength, targetValue, channel } = params;
  if (!geometry || !geometry.attributes.position) return false;

  const posAttr = geometry.attributes.position;
  const count = posAttr.count;
  if (count === 0) return false;

  let colorAttr = geometry.attributes.color as THREE.BufferAttribute;
  if (!colorAttr || colorAttr.itemSize < 3) {
    const colors = new Float32Array(count * 4);
    colorAttr = new THREE.BufferAttribute(colors, 4);
    geometry.setAttribute('color', colorAttr);
  }

  const channelIndex = channel === 'r' ? 0 : channel === 'g' ? 1 : channel === 'b' ? 2 : 3;
  const hasWorld = !!(mesh && mesh.matrixWorld && hitPoint);
  let modified = false;

  for (let i = 0; i < count; i++) {
    _brushVPos.fromBufferAttribute(posAttr, i);

    let dist = 0;
    if (hasWorld && hitPoint) {
      _brushWorldVPos.copy(_brushVPos).applyMatrix4(mesh!.matrixWorld);
      dist = _brushWorldVPos.distanceTo(hitPoint);
    } else if (localHitPoint) {
      dist = _brushVPos.distanceTo(localHitPoint);
    } else {
      continue;
    }

    if (dist <= radius) {
      const falloff = 1 - dist / radius;
      const factor = falloff * strength;

      const currentVal = colorAttr.getComponent(i, channelIndex);
      const newVal = THREE.MathUtils.lerp(currentVal, targetValue, factor);

      colorAttr.setComponent(i, channelIndex, newVal);
      modified = true;
    }
  }

  if (modified) {
    colorAttr.needsUpdate = true;
  }

  return modified;
}
