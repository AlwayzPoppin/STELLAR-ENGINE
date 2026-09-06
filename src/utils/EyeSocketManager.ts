import * as THREE from 'three';

export interface EyeCentersInfo {
  leftEyeWorld: THREE.Vector3;
  rightEyeWorld: THREE.Vector3;
  leftEyeLocal: THREE.Vector3;
  rightEyeLocal: THREE.Vector3;
  headBone: THREE.Bone | null;
  eyeScale: number;
}

/**
 * Automatically calculates Left and Right Eye center positions based on
 * existing facial rig bones or by analyzing head mesh geometry.
 */
export function calculateEyeCenters(scene: THREE.Object3D): EyeCentersInfo | null {
  let headBone: THREE.Bone | null = null;
  let faceEyeLeft: THREE.Bone | null = null;
  let faceEyeRight: THREE.Bone | null = null;

  scene.traverse((child: any) => {
    if (child.isBone || child instanceof THREE.Bone) {
      const lower = child.name.toLowerCase();
      if (child.name === 'Face_EyeLeft' || lower === 'eye_l' || lower === 'eye.l' || lower === 'eyel') {
        faceEyeLeft = child;
      } else if (child.name === 'Face_EyeRight' || lower === 'eye_r' || lower === 'eye.r' || lower === 'eyer') {
        faceEyeRight = child;
      }
      if (lower.includes('head') && !headBone) {
        headBone = child;
      }
    }
  });

  const leftEyeWorld = new THREE.Vector3();
  const rightEyeWorld = new THREE.Vector3();
  const leftEyeLocal = new THREE.Vector3();
  const rightEyeLocal = new THREE.Vector3();
  let eyeScale = 0.035;

  if (faceEyeLeft && faceEyeRight) {
    faceEyeLeft.getWorldPosition(leftEyeWorld);
    faceEyeRight.getWorldPosition(rightEyeWorld);
    leftEyeLocal.copy(faceEyeLeft.position);
    rightEyeLocal.copy(faceEyeRight.position);

    const dist = leftEyeWorld.distanceTo(rightEyeWorld);
    if (dist > 0.001) {
      eyeScale = dist * 0.45;
    }

    return {
      leftEyeWorld,
      rightEyeWorld,
      leftEyeLocal,
      rightEyeLocal,
      headBone: headBone || (faceEyeLeft.parent as THREE.Bone) || null,
      eyeScale,
    };
  }

  // Fallback: analyze skinned meshes associated with head bone or whole scene
  let targetMesh: THREE.SkinnedMesh | THREE.Mesh | null = null;
  scene.traverse((child: any) => {
    if (child.isSkinnedMesh && !targetMesh) {
      targetMesh = child;
    } else if (child.isMesh && !targetMesh) {
      targetMesh = child;
    }
  });

  if (targetMesh && (targetMesh as any).geometry) {
    const mesh = targetMesh as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox || new THREE.Box3();
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    // Estimate head dimensions (top 20% of character)
    const headHeight = size.y * 0.16;
    const headWidth = size.x * 0.22;
    const headDepth = size.z * 0.25;

    const eyeY = bbox.max.y - headHeight * 0.45;
    const eyeZ = bbox.max.z - headDepth * 0.15;
    const eyeXOffset = headWidth * 0.32;

    const leftLocal = new THREE.Vector3(center.x - eyeXOffset, eyeY, eyeZ);
    const rightLocal = new THREE.Vector3(center.x + eyeXOffset, eyeY, eyeZ);

    mesh.localToWorld(leftEyeWorld.copy(leftLocal));
    mesh.localToWorld(rightEyeWorld.copy(rightLocal));

    if (headBone) {
      const headInv = (headBone as THREE.Bone).matrixWorld.clone().invert();
      leftEyeLocal.copy(leftEyeWorld).applyMatrix4(headInv);
      rightEyeLocal.copy(rightEyeWorld).applyMatrix4(headInv);
    } else {
      leftEyeLocal.copy(leftLocal);
      rightEyeLocal.copy(rightLocal);
    }

    eyeScale = Math.max(0.015, eyeXOffset * 0.85);

    return {
      leftEyeWorld,
      rightEyeWorld,
      leftEyeLocal,
      rightEyeLocal,
      headBone,
      eyeScale,
    };
  }

  return null;
}

/**
 * Insets (depresses) mesh vertices around eye centers to form concave eye socket cavities.
 * Caches original vertex positions in mesh.userData for non-destructive adjustment & removal.
 */
export function applyEyeSocketInset(
  mesh: THREE.Mesh | THREE.SkinnedMesh,
  leftEyeWorld: THREE.Vector3,
  rightEyeWorld: THREE.Vector3,
  depth: number = 0.035,
  radius: number = 0.045
): void {
  const geom = mesh.geometry;
  if (!geom || !geom.attributes.position) return;

  const posAttr = geom.attributes.position;
  const count = posAttr.count;

  // Cache original vertex positions if not already cached
  if (!mesh.userData.originalPreSocketPositions) {
    mesh.userData.originalPreSocketPositions = new Float32Array(posAttr.array);
  }

  const origArray = mesh.userData.originalPreSocketPositions as Float32Array;
  const vPos = new THREE.Vector3();
  const vWorld = new THREE.Vector3();
  const meshWorldInv = mesh.matrixWorld.clone().invert();

  // Forward direction in mesh local space (+Z forward)
  const forwardLocal = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i < count; i++) {
    const origX = origArray[i * 3];
    const origY = origArray[i * 3 + 1];
    const origZ = origArray[i * 3 + 2];
    vPos.set(origX, origY, origZ);

    mesh.localToWorld(vWorld.copy(vPos));

    const distL = vWorld.distanceTo(leftEyeWorld);
    const distR = vWorld.distanceTo(rightEyeWorld);
    const minParamDist = Math.min(distL, distR);

    if (minParamDist < radius) {
      // Smooth cosine falloff from center (1.0) to radius border (0.0)
      const factor = Math.cos((minParamDist / radius) * (Math.PI / 2));
      const falloff = factor * factor;

      // Inset backward (opposite of forward)
      vPos.addScaledVector(forwardLocal, -depth * falloff);

      posAttr.setXYZ(i, vPos.x, vPos.y, vPos.z);
    } else {
      posAttr.setXYZ(i, origX, origY, origZ);
    }
  }

  posAttr.needsUpdate = true;
  geom.computeVertexNormals();
}

/**
 * Restores original mesh vertex positions prior to socket insetting.
 */
export function restoreOriginalEyeSocketMesh(mesh: THREE.Mesh | THREE.SkinnedMesh): void {
  const geom = mesh.geometry;
  if (!geom || !geom.attributes.position || !mesh.userData.originalPreSocketPositions) return;

  const posAttr = geom.attributes.position;
  posAttr.array.set(mesh.userData.originalPreSocketPositions);
  posAttr.needsUpdate = true;
  geom.computeVertexNormals();
  delete mesh.userData.originalPreSocketPositions;
}

/**
 * Applies smooth upper eyelid blink deformation over the 3D eye spheres.
 */
export function applyEyelidBlinkDeformation(
  mesh: THREE.Mesh | THREE.SkinnedMesh,
  leftEyeWorld: THREE.Vector3,
  rightEyeWorld: THREE.Vector3,
  blinkLeft: number,
  blinkRight: number,
  radius: number = 0.045
): void {
  const geom = mesh.geometry;
  if (!geom || !geom.attributes.position) return;

  const posAttr = geom.attributes.position;
  const count = posAttr.count;

  const baseArray = mesh.userData.originalPreSocketPositions || posAttr.array;
  const vPos = new THREE.Vector3();
  const vWorld = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const bx = baseArray[i * 3];
    const by = baseArray[i * 3 + 1];
    const bz = baseArray[i * 3 + 2];
    vPos.set(bx, by, bz);

    mesh.localToWorld(vWorld.copy(vPos));

    const distL = vWorld.distanceTo(leftEyeWorld);
    const distR = vWorld.distanceTo(rightEyeWorld);

    let blinkFactor = 0;
    let eyeCenterWorld: THREE.Vector3 | null = null;

    if (distL < radius) {
      blinkFactor = blinkLeft;
      eyeCenterWorld = leftEyeWorld;
    } else if (distR < radius) {
      blinkFactor = blinkRight;
      eyeCenterWorld = rightEyeWorld;
    }

    if (blinkFactor > 0.001 && eyeCenterWorld) {
      // Only deform upper eyelid vertices (y >= eyeCenter.y - radius * 0.2)
      if (vWorld.y >= eyeCenterWorld.y - radius * 0.15) {
        const heightRatio = Math.max(0, (vWorld.y - eyeCenterWorld.y) / radius);
        const falloff = Math.cos(heightRatio * (Math.PI / 2));
        const pullDown = radius * 1.3 * blinkFactor * falloff;
        
        vPos.y -= pullDown;
        posAttr.setXYZ(i, vPos.x, vPos.y, vPos.z);
      }
    }
  }

  posAttr.needsUpdate = true;
}
