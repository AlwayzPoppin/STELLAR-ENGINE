import * as THREE from 'three';
import { JointData } from '../store/useStore';

/**
 * Traverses up the joint hierarchy to compute the absolute model-space rotation
 * of a joint based on the local euler angles stored in the JointData.
 */
export function getModelSpaceRotation(jointId: string, joints: JointData[]): THREE.Quaternion {
  const joint = joints.find((j) => j.id === jointId);
  if (!joint) return new THREE.Quaternion();

  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(joint.rotation[0]),
      THREE.MathUtils.degToRad(joint.rotation[1]),
      THREE.MathUtils.degToRad(joint.rotation[2]),
      'XYZ'
    )
  );

  if (joint.parentId) {
    const parentQ = getModelSpaceRotation(joint.parentId, joints);
    return parentQ.clone().multiply(q);
  }

  return q;
}

/**
 * Solves Inverse Kinematics for a 3-joint chain (e.g., Shoulder -> Elbow -> Hand)
 * using the FABRIK algorithm.
 * 
 * Returns the list of updates (id, position, rotation) to apply to the joints.
 */
export function solveFABRIK(
  joints: JointData[],
  effectorId: string,
  targetPos: [number, number, number]
): Partial<JointData>[] {
  const hand = joints.find((j) => j.id === effectorId);
  if (!hand || !hand.parentId) return [];

  const elbow = joints.find((j) => j.id === hand.parentId);
  if (!elbow || !elbow.parentId) return [];

  const shoulder = joints.find((j) => j.id === elbow.parentId);
  if (!shoulder) return [];

  // 1. Convert positions to Vector3
  const pShoulder = new THREE.Vector3(...shoulder.position);
  const pElbow = new THREE.Vector3(...elbow.position);
  const pHand = new THREE.Vector3(...hand.position);
  const pTarget = new THREE.Vector3(...targetPos);

  // 2. Measure target bone lengths dynamically
  const len1 = pShoulder.distanceTo(pElbow);
  const len2 = pElbow.distanceTo(pHand);
  const totalLength = len1 + len2;

  // Working positions for the chain
  const p = [pShoulder.clone(), pElbow.clone(), pHand.clone()];
  const root = pShoulder.clone();

  // 3. Solve Positions using FABRIK
  const distToTarget = root.distanceTo(pTarget);
  if (distToTarget > totalLength) {
    // Target is out of reach: extend chain fully towards target
    const dir = pTarget.clone().sub(root).normalize();
    p[1].copy(root).addScaledVector(dir, len1);
    p[2].copy(p[1]).addScaledVector(dir, len2);
  } else {
    // Target is in reach: iterate to solve positions
    const iterations = 15;
    const tolerance = 0.0001;

    for (let iter = 0; iter < iterations; iter++) {
      // Check convergence
      if (p[2].distanceTo(pTarget) < tolerance) break;

      // Backward Pass (effector to root)
      p[2].copy(pTarget);
      p[1].copy(p[2]).add(p[1].clone().sub(p[2]).normalize().multiplyScalar(len2));
      p[0].copy(p[1]).add(p[0].clone().sub(p[1]).normalize().multiplyScalar(len1));

      // Forward Pass (root to effector)
      p[0].copy(root);
      p[1].copy(p[0]).add(p[1].clone().sub(p[0]).normalize().multiplyScalar(len1));
      p[2].copy(p[1]).add(p[2].clone().sub(p[1]).normalize().multiplyScalar(len2));
    }
  }

  // 4. Solve Rotations to align bone segments
  const R_parent = shoulder.parentId ? getModelSpaceRotation(shoulder.parentId, joints) : new THREE.Quaternion();

  // Solve Shoulder local rotation
  const solvedOffsetElbow = p[1].clone().sub(p[0]);
  const solvedOffsetElbowLocal = solvedOffsetElbow.clone().applyQuaternion(R_parent.clone().invert());
  
  // Bind offset of elbow relative to shoulder (default bone segment direction)
  const bindOffsetElbow = new THREE.Vector3(...elbow.position).sub(new THREE.Vector3(...shoulder.position));
  
  const Q_shoulder = new THREE.Quaternion().setFromUnitVectors(
    bindOffsetElbow.clone().normalize(),
    solvedOffsetElbowLocal.clone().normalize()
  );

  const eulerShoulder = new THREE.Euler().setFromQuaternion(Q_shoulder, 'XYZ');
  const rotShoulder: [number, number, number] = [
    THREE.MathUtils.radToDeg(eulerShoulder.x),
    THREE.MathUtils.radToDeg(eulerShoulder.y),
    THREE.MathUtils.radToDeg(eulerShoulder.z),
  ];

  // Solve Elbow local rotation
  const R_shoulder_solved = R_parent.clone().multiply(Q_shoulder);
  const solvedOffsetHand = p[2].clone().sub(p[1]);
  const solvedOffsetHandLocal = solvedOffsetHand.clone().applyQuaternion(R_shoulder_solved.clone().invert());

  // Bind offset of hand relative to elbow (default bone segment direction)
  const bindOffsetHand = new THREE.Vector3(...hand.position).sub(new THREE.Vector3(...elbow.position));

  const Q_elbow = new THREE.Quaternion().setFromUnitVectors(
    bindOffsetHand.clone().normalize(),
    solvedOffsetHandLocal.clone().normalize()
  );

  const eulerElbow = new THREE.Euler().setFromQuaternion(Q_elbow, 'XYZ');
  const rotElbow: [number, number, number] = [
    THREE.MathUtils.radToDeg(eulerElbow.x),
    THREE.MathUtils.radToDeg(eulerElbow.y),
    THREE.MathUtils.radToDeg(eulerElbow.z),
  ];

  // 5. Build and return updates
  return [
    {
      id: shoulder.id,
      position: [p[0].x, p[0].y, p[0].z],
      rotation: rotShoulder,
    },
    {
      id: elbow.id,
      position: [p[1].x, p[1].y, p[1].z],
      rotation: rotElbow,
    },
    {
      id: hand.id,
      position: [p[2].x, p[2].y, p[2].z],
      // Effector rotation can match its solved orientation relative to parent
      rotation: [0, 0, 0], // Reset child rotation relative to elbow or leave unchanged
    },
  ];
}
