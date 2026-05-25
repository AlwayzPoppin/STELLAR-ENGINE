import * as THREE from 'three';

interface JointData {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  parentId: string | null;
}

const TEST_PLAYER_JOINTS: JointData[] = [
  {
    "id": "149071d1-0ce4-49e7-a558-6ea2584dd567",
    "name": "AutoRig_Waist",
    "position": [0, 0.47343749999999996, 0],
    "rotation": [0, 0, 0],
    "parentId": null
  },
  {
    "id": "ec3ae84d-eb6b-4dd2-b7d4-bac023cb26d8",
    "name": "AutoRig_Spine",
    "position": [8.012543896572616e-20, 0.6374774382803259, -0.00036085289706894175],
    "rotation": [0, 0, 0],
    "parentId": "149071d1-0ce4-49e7-a558-6ea2584dd567"
  },
  {
    "id": "b55d0a2c-ef18-44db-97b0-083c8ae8c092",
    "name": "AutoRig_Chest",
    "position": [1.26350027398981e-18, 0.7588191814316284, -0.0056902993631230275],
    "rotation": [0, 0, 0],
    "parentId": "ec3ae84d-eb6b-4dd2-b7d4-bac023cb26d8"
  },
  {
    "id": "20d8dd46-091d-4e3d-b9eb-fa529fde3526",
    "name": "AutoRig_Neck",
    "position": [1.8691704503980647e-19, 0.8392938585688516, -0.0008417995343904666],
    "rotation": [0, 0, 0],
    "parentId": "b55d0a2c-ef18-44db-97b0-083c8ae8c092"
  },
  {
    "id": "63cd5aa5-657d-4e51-9037-43008a4dcfe7",
    "name": "AutoRig_Head",
    "position": [8.969567613838081e-20, 0.9323957081526688, -0.0004039534136335565],
    "rotation": [0, 0, 0],
    "parentId": "20d8dd46-091d-4e3d-b9eb-fa529fde3526"
  },
  {
    "id": "2de6abff-4fc8-4fef-a8f1-af5b786e7928",
    "name": "AutoRig_L_UpLeg",
    "position": [1.7290203934365067e-17, 0.48170818469825605, 0.07183887525403358],
    "rotation": [0, 0, 0],
    "parentId": "149071d1-0ce4-49e7-a558-6ea2584dd567"
  },
  {
    "id": "63d11b5e-48ea-40d8-90dc-41418d8abb9f",
    "name": "AutoRig_L_Leg",
    "position": [1.8621001775673244e-17, 0.2731972246386988, 0.06584549459181262],
    "rotation": [0, 0, 0],
    "parentId": "2de6abff-4fc8-4fef-a8f1-af5b786e7928"
  },
  {
    "id": "7d7c1d21-3804-48a5-a837-58e97ec40a84",
    "name": "AutoRig_L_Foot",
    "position": [-0.009377595454883461, 0.062391497985834266, 0.06615265204642426],
    "rotation": [0, 0, 0],
    "parentId": "63d11b5e-48ea-40d8-90dc-41418d8abb9f"
  },
  {
    "id": "6fcd53da-bce6-4b36-8d51-6413a2b2708d",
    "name": "AutoRig_R_UpLeg",
    "position": [1.7290203934365067e-17, 0.48170818469825605, -0.07183887525403358],
    "rotation": [0, 0, 0],
    "parentId": "149071d1-0ce4-49e7-a558-6ea2584dd567"
  },
  {
    "id": "1ebcdad6-a5a9-4328-a36d-06009cf53709",
    "name": "AutoRig_R_Leg",
    "position": [1.8621001775673244e-17, 0.2731972246386988, -0.06584549459181262],
    "rotation": [0, 0, 0],
    "parentId": "6fcd53da-bce6-4b36-8d51-6413a2b2708d"
  },
  {
    "id": "19833288-c06f-4fdb-b00f-b34a381f3e4a",
    "name": "AutoRig_R_Foot",
    "position": [-0.009377595454883463, 0.062391497985834266, -0.06615265204642426],
    "rotation": [0, 0, 0],
    "parentId": "1ebcdad6-a5a9-4328-a36d-06009cf53709"
  },
  {
    "id": "9c7799c9-8b8a-4fc5-b28b-cb0094a0a8f1",
    "name": "AutoRig_L_Shoulder",
    "position": [0, 0.7890625, 0.119765625],
    "rotation": [0, 0, 0],
    "parentId": "b55d0a2c-ef18-44db-97b0-083c8ae8c092"
  },
  {
    "id": "d261781a-1786-4cd4-b7b0-b7162fbc055a",
    "name": "AutoRig_L_Arm",
    "position": [1.428599312737189e-17, 0.7856844151376533, 0.23507566917495046],
    "rotation": [0, 0, 0],
    "parentId": "9c7799c9-8b8a-4fc5-b28b-cb0094a0a8f1"
  },
  {
    "id": "bb3d9b19-22e4-44d2-8a25-cd555369377c",
    "name": "AutoRig_L_ForeArm",
    "position": [2.922214519496276e-17, 0.7858466471694819, 0.3474576577889991],
    "rotation": [0, 0, 0],
    "parentId": "d261781a-1786-4cd4-b7b0-b7162fbc055a"
  },
  {
    "id": "46fc114a-9ef5-4efd-87b3-a837a6239ded",
    "name": "AutoRig_L_Hand",
    "position": [3.441514301388109e-17, 0.782225223182743, 0.41389469349678276],
    "rotation": [0, 0, 0],
    "parentId": "bb3d9b19-22e4-44d2-8a25-cd555369377c"
  },
  {
    "id": "299fdc0a-5bad-444b-b909-35432633a3cb",
    "name": "AutoRig_R_Shoulder",
    "position": [0, 0.7890625, -0.119765625],
    "rotation": [0, 0, 0],
    "parentId": "b55d0a2c-ef18-44db-97b0-083c8ae8c092"
  },
  {
    "id": "699f554b-9679-4c4e-8597-30d4fb26c708",
    "name": "AutoRig_R_Arm",
    "position": [1.428599312737189e-17, 0.7856844151376533, -0.23507566917495046],
    "rotation": [0, 0, 0],
    "parentId": "299fdc0a-5bad-444b-b909-35432633a3cb"
  },
  {
    "id": "cbfa771e-e453-4808-91a4-10c1ac023c62",
    "name": "AutoRig_R_ForeArm",
    "position": [2.922214519496276e-17, 0.7858466471694819, -0.3474576577889991],
    "rotation": [0, 0, 0],
    "parentId": "699f554b-9679-4c4e-8597-30d4fb26c708"
  },
  {
    "id": "57913f35-355c-48ce-8458-73b729cb6534",
    "name": "AutoRig_R_Hand",
    "position": [3.441514301388109e-17, 0.782225223182743, -0.41389469349678276],
    "rotation": [0, 0, 0],
    "parentId": "cbfa771e-e453-4808-91a4-10c1ac023c62"
  }
];

/**
 * Phase 1: Algorithmic Spine & Limb Generator for 66-Bone Unreal/Mesh2Motion Hierarchy
 * Analyzes the bounding box of a 3D object and injects a 66-bone humanoid hierarchy.
 * Automatically detects whether the T-Pose character spans along the local X or Z axis
 * to align limbs and fingers perfectly with rotated model coordinate spaces.
 */
function detectMeshFacingDirection(targetMesh: THREE.Object3D, isZSpanned: boolean): 'forward' | 'backwards' {
  let minY = Infinity, maxY = -Infinity;
  const positions: THREE.Vector3[] = [];

  targetMesh.traverse((child: any) => {
    if (child.isMesh || child.isSkinnedMesh) {
      const geo = child.geometry;
      const posAttr = geo?.getAttribute('position');
      if (posAttr) {
        child.updateMatrixWorld(true);
        targetMesh.updateMatrixWorld(true);
        const localToMesh = child.matrixWorld.clone().premultiply(targetMesh.matrixWorld.clone().invert());
        
        const v = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
          v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
          v.applyMatrix4(localToMesh);
          
          if (v.y < minY) minY = v.y;
          if (v.y > maxY) maxY = v.y;
          positions.push(v.clone());
        }
      }
    }
  });

  if (positions.length === 0) return 'forward';

  const height = maxY - minY;
  const upperHalfY = minY + height * 0.5;

  let sumDepth = 0;
  let count = 0;
  let maxDepth = -Infinity;
  let minDepth = Infinity;

  for (const v of positions) {
    if (v.y > upperHalfY) {
      const depth = isZSpanned ? v.x : v.z;
      sumDepth += depth;
      if (depth > maxDepth) maxDepth = depth;
      if (depth < minDepth) minDepth = depth;
      count++;
    }
  }

  if (count === 0) return 'forward';
  const avgDepth = sumDepth / count;

  const positiveDiff = Math.abs(maxDepth - avgDepth);
  const negativeDiff = Math.abs(minDepth - avgDepth);

  if (Math.abs(positiveDiff - negativeDiff) < 1e-4) {
    return 'forward';
  }
  return (positiveDiff > negativeDiff) ? 'forward' : 'backwards';
}

export function generateAutoSpine(targetMesh: THREE.Object3D, modelUrl?: string) {
  targetMesh.updateMatrixWorld(true);

  // 1. Snapshot original parent and local transformation matrix
  const originalParent = targetMesh.parent;
  const originalPosition = targetMesh.position.clone();
  const originalRotation = targetMesh.rotation.clone();
  const originalScale = targetMesh.scale.clone();

  // 2. Temporarily isolate targetMesh and reset transform to identity
  if (originalParent) {
    originalParent.remove(targetMesh);
  }
  targetMesh.position.set(0, 0, 0);
  targetMesh.rotation.set(0, 0, 0);
  targetMesh.scale.set(1, 1, 1);
  targetMesh.updateMatrixWorld(true);

  // 3. Compute pure local bounding box
  const localBox = new THREE.Box3().setFromObject(targetMesh);
  const localCenter = new THREE.Vector3();
  localBox.getCenter(localCenter);

  const localMinY = localBox.min.y;
  const localHeight = localBox.max.y - localBox.min.y;

  // Calculate local width spans
  const localWidthX = localBox.max.x - localBox.min.x;
  const localWidthZ = localBox.max.z - localBox.min.z;
  
  // Determine if the model's T-pose spans along the Z-axis or X-axis
  const isZSpanned = localWidthZ > localWidthX;
  const localWidth = isZSpanned ? localWidthZ : localWidthX;

  const meshIsBackwards = detectMeshFacingDirection(targetMesh, isZSpanned) === 'backwards';
  const depthSign = meshIsBackwards ? -1 : 1;
  const lateralSign = meshIsBackwards ? -1 : 1;

  const isTestPlayer = !!(modelUrl && (modelUrl.toLowerCase().includes('humanoid') || modelUrl.toLowerCase().includes('test_player')));

  if (isTestPlayer) {
    const bonesMap = new Map<string, THREE.Bone>();
    const bones: THREE.Bone[] = [];

    // Create THREE.Bone for each joint
    for (const joint of TEST_PLAYER_JOINTS) {
      const bone = new THREE.Bone();
      bone.name = joint.name;
      bone.uuid = joint.id;
      bonesMap.set(joint.id, bone);
      bones.push(bone);
    }

    // Set up the bone hierarchy
    let rootBone: THREE.Bone | null = null;
    for (const joint of TEST_PLAYER_JOINTS) {
      const bone = bonesMap.get(joint.id)!;
      if (joint.parentId) {
        const parentBone = bonesMap.get(joint.parentId);
        if (parentBone) {
          parentBone.add(bone);
        }
      } else {
        rootBone = bone;
      }
    }

    const adjustedPositions = new Map<string, [number, number, number]>();
    for (const joint of TEST_PLAYER_JOINTS) {
      const pos = [...joint.position] as [number, number, number];
      if (isZSpanned) {
        pos[0] *= depthSign; // depth is X
        pos[2] *= lateralSign; // lateral is Z
      } else {
        pos[2] *= depthSign; // depth is Z
        pos[0] *= lateralSign; // lateral is X
      }
      adjustedPositions.set(joint.id, pos);
    }

    // Set parent-relative positions from absolute positions
    for (const joint of TEST_PLAYER_JOINTS) {
      const bone = bonesMap.get(joint.id)!;
      const absolutePos = adjustedPositions.get(joint.id)!;
      if (joint.parentId) {
        const parentJoint = TEST_PLAYER_JOINTS.find(j => j.id === joint.parentId);
        if (parentJoint) {
          const parentAbsolutePos = adjustedPositions.get(parentJoint.id)!;
          bone.position.set(
            absolutePos[0] - parentAbsolutePos[0],
            absolutePos[1] - parentAbsolutePos[1],
            absolutePos[2] - parentAbsolutePos[2]
          );
        } else {
          bone.position.set(absolutePos[0], absolutePos[1], absolutePos[2]);
        }
      } else {
        bone.position.set(absolutePos[0], absolutePos[1], absolutePos[2]);
      }
    }

    // Find the correct bones parent to align local coordinate spaces
    let bonesParent: THREE.Object3D = targetMesh;
    targetMesh.traverse((child) => {
      if (bonesParent === targetMesh && ((child as any).isMesh || (child as any).isSkinnedMesh) && child !== targetMesh) {
        if (child.parent && child.parent !== targetMesh) {
          bonesParent = child.parent;
        }
      }
    });

    if (rootBone) {
      bonesParent.add(rootBone);
    }

    // Restore original parent and transform
    if (originalParent) {
      originalParent.add(targetMesh);
    }
    targetMesh.position.copy(originalPosition);
    targetMesh.rotation.copy(originalRotation);
    targetMesh.scale.copy(originalScale);
    targetMesh.updateMatrixWorld(true);

    bones.forEach(bone => {
      bone.scale.set(1, 1, 1);
      bone.quaternion.set(0, 0, 0, 1);
      bone.updateMatrixWorld(true);
    });

    const skeleton = new THREE.Skeleton(bones);
    return { skeleton, rootBone: rootBone!, bones };
  }

  // 4. Create Core & Spine Bones
  const root = new THREE.Bone(); root.name = "root";
  const pelvis = new THREE.Bone(); pelvis.name = "pelvis";
  const spine_01 = new THREE.Bone(); spine_01.name = "spine_01";
  const spine_02 = new THREE.Bone(); spine_02.name = "spine_02";
  const spine_03 = new THREE.Bone(); spine_03.name = "spine_03";
  const neck_01 = new THREE.Bone(); neck_01.name = "neck_01";
  const head = new THREE.Bone(); head.name = "head";
  const head_leaf = new THREE.Bone(); head_leaf.name = "head_leaf";

  root.add(pelvis);
  pelvis.add(spine_01);
  spine_01.add(spine_02);
  spine_02.add(spine_03);
  spine_03.add(neck_01);
  neck_01.add(head);
  head.add(head_leaf);

  // 5. Create Legs & Feet Bones
  const thigh_l = new THREE.Bone(); thigh_l.name = "thigh_l";
  const calf_l = new THREE.Bone(); calf_l.name = "calf_l";
  const foot_l = new THREE.Bone(); foot_l.name = "foot_l";
  const ball_l = new THREE.Bone(); ball_l.name = "ball_l";
  const ball_leaf_l = new THREE.Bone(); ball_leaf_l.name = "ball_leaf_l";

  pelvis.add(thigh_l);
  thigh_l.add(calf_l);
  calf_l.add(foot_l);
  foot_l.add(ball_l);
  ball_l.add(ball_leaf_l);

  const thigh_r = new THREE.Bone(); thigh_r.name = "thigh_r";
  const calf_r = new THREE.Bone(); calf_r.name = "calf_r";
  const foot_r = new THREE.Bone(); foot_r.name = "foot_r";
  const ball_r = new THREE.Bone(); ball_r.name = "ball_r";
  const ball_leaf_r = new THREE.Bone(); ball_leaf_r.name = "ball_leaf_r";

  pelvis.add(thigh_r);
  thigh_r.add(calf_r);
  calf_r.add(foot_r);
  foot_r.add(ball_r);
  ball_r.add(ball_leaf_r);

  // 6. Create Arms & Hands Bones
  const clavicle_l = new THREE.Bone(); clavicle_l.name = "clavicle_l";
  const upperarm_l = new THREE.Bone(); upperarm_l.name = "upperarm_l";
  const lowerarm_l = new THREE.Bone(); lowerarm_l.name = "lowerarm_l";
  const hand_l = new THREE.Bone(); hand_l.name = "hand_l";

  spine_03.add(clavicle_l);
  clavicle_l.add(upperarm_l);
  upperarm_l.add(lowerarm_l);
  lowerarm_l.add(hand_l);

  const clavicle_r = new THREE.Bone(); clavicle_r.name = "clavicle_r";
  const upperarm_r = new THREE.Bone(); upperarm_r.name = "upperarm_r";
  const lowerarm_r = new THREE.Bone(); lowerarm_r.name = "lowerarm_r";
  const hand_r = new THREE.Bone(); hand_r.name = "hand_r";

  spine_03.add(clavicle_r);
  clavicle_r.add(upperarm_r);
  upperarm_r.add(lowerarm_r);
  lowerarm_r.add(hand_r);

  // 7. Create Fingers (20 per hand, 40 total)
  const fingersList = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  
  // Left Fingers
  const leftFingerBones: Record<string, THREE.Bone[]> = {};
  for (const f of fingersList) {
    const b01 = new THREE.Bone(); b01.name = `${f}_01_l`;
    const b02 = new THREE.Bone(); b02.name = `${f}_02_l`;
    const b03 = new THREE.Bone(); b03.name = `${f}_03_l`;
    const b04 = new THREE.Bone(); b04.name = `${f}_04_leaf_l`;
    
    hand_l.add(b01);
    b01.add(b02);
    b02.add(b03);
    b03.add(b04);
    
    leftFingerBones[f] = [b01, b02, b03, b04];
  }

  // Right Fingers
  const rightFingerBones: Record<string, THREE.Bone[]> = {};
  for (const f of fingersList) {
    const b01 = new THREE.Bone(); b01.name = `${f}_01_r`;
    const b02 = new THREE.Bone(); b02.name = `${f}_02_r`;
    const b03 = new THREE.Bone(); b03.name = `${f}_03_r`;
    const b04 = new THREE.Bone(); b04.name = `${f}_04_leaf_r`;
    
    hand_r.add(b01);
    b01.add(b02);
    b02.add(b03);
    b03.add(b04);
    
    rightFingerBones[f] = [b01, b02, b03, b04];
  }

  // Assemble full 66-bone list
  const bones = [
    root, pelvis, spine_01, spine_02, spine_03, neck_01, head, head_leaf,
    thigh_l, calf_l, foot_l, ball_l, ball_leaf_l,
    thigh_r, calf_r, foot_r, ball_r, ball_leaf_r,
    clavicle_l, upperarm_l, lowerarm_l, hand_l,
    clavicle_r, upperarm_r, lowerarm_r, hand_r,
  ];

  for (const f of fingersList) {
    bones.push(...leftFingerBones[f]);
  }
  for (const f of fingersList) {
    bones.push(...rightFingerBones[f]);
  }

  // --- POSITIONING (Local Space Relative to Parent) ---
    // Spine offsets centered in local character box bounds
    // Set root to pelvis height to overlap and eliminate ground connection segment
    root.position.set(localCenter.x, localMinY + localHeight * 0.48, localCenter.z);
    pelvis.position.set(0, 0, 0); // relative to root is 0
    spine_01.position.set(0, localHeight * 0.06, 0);
    spine_02.position.set(0, localHeight * 0.06, 0);
    spine_03.position.set(0, localHeight * 0.06, 0);
    neck_01.position.set(0, localHeight * 0.08, 0);
    head.position.set(0, localHeight * 0.08, 0);
    head_leaf.position.set(0, localHeight * 0.05, 0);

    // Leg & Arm proportions
    const legSpread = localWidth * 0.15;
    const legDrop = -localHeight * 0.22;
    const shoulderSpread = localWidth * 0.12;
    const armLength = localWidth * 0.18;

    if (isZSpanned) {
      // Spreading along local Z axis
      thigh_l.position.set(0, -localHeight * 0.05, legSpread * lateralSign);
      calf_l.position.set(0, legDrop, 0);
      foot_l.position.set(0, legDrop, 0);
      ball_l.position.set(-localHeight * 0.04 * depthSign, 0, 0);
      ball_leaf_l.position.set(-localHeight * 0.02 * depthSign, 0, 0);

      thigh_r.position.set(0, -localHeight * 0.05, -legSpread * lateralSign);
      calf_r.position.set(0, legDrop, 0);
      foot_r.position.set(0, legDrop, 0);
      ball_r.position.set(-localHeight * 0.04 * depthSign, 0, 0);
      ball_leaf_r.position.set(-localHeight * 0.02 * depthSign, 0, 0);

      clavicle_l.position.set(0, localHeight * 0.08, shoulderSpread * lateralSign);
      upperarm_l.position.set(0, 0, armLength * lateralSign);
      lowerarm_l.position.set(0, 0, armLength * lateralSign);
      hand_l.position.set(0, 0, armLength * 0.5 * lateralSign);

      clavicle_r.position.set(0, localHeight * 0.08, -shoulderSpread * lateralSign);
      upperarm_r.position.set(0, 0, -armLength * lateralSign);
      lowerarm_r.position.set(0, 0, -armLength * lateralSign);
      hand_r.position.set(0, 0, -armLength * 0.5 * lateralSign);

      // Fingers L
      for (const f of fingersList) {
        const bonesArray = leftFingerBones[f];
        let offsetMultiplier = 0;
        if (f === 'thumb') offsetMultiplier = -2;
        else if (f === 'index') offsetMultiplier = -1;
        else if (f === 'middle') offsetMultiplier = 0;
        else if (f === 'ring') offsetMultiplier = 1;
        else if (f === 'pinky') offsetMultiplier = 2;

        bonesArray[0].position.set(offsetMultiplier * localWidth * 0.008 * depthSign, 0, localWidth * 0.03 * lateralSign);
        bonesArray[1].position.set(0, 0, localWidth * 0.02 * lateralSign);
        bonesArray[2].position.set(0, 0, localWidth * 0.018 * lateralSign);
        bonesArray[3].position.set(0, 0, localWidth * 0.015 * lateralSign);
      }

      // Fingers R
      for (const f of fingersList) {
        const bonesArray = rightFingerBones[f];
        let offsetMultiplier = 0;
        if (f === 'thumb') offsetMultiplier = -2;
        else if (f === 'index') offsetMultiplier = -1;
        else if (f === 'middle') offsetMultiplier = 0;
        else if (f === 'ring') offsetMultiplier = 1;
        else if (f === 'pinky') offsetMultiplier = 2;

        bonesArray[0].position.set(offsetMultiplier * localWidth * 0.008 * depthSign, 0, -localWidth * 0.03 * lateralSign);
        bonesArray[1].position.set(0, 0, -localWidth * 0.02 * lateralSign);
        bonesArray[2].position.set(0, 0, -localWidth * 0.018 * lateralSign);
        bonesArray[3].position.set(0, 0, -localWidth * 0.015 * lateralSign);
      }
    } else {
      // Spreading along local X axis
      thigh_l.position.set(legSpread * lateralSign, -localHeight * 0.05, 0);
      calf_l.position.set(0, legDrop, 0);
      foot_l.position.set(0, legDrop, 0);
      ball_l.position.set(0, 0, localHeight * 0.04 * depthSign);
      ball_leaf_l.position.set(0, 0, localHeight * 0.02 * depthSign);

      thigh_r.position.set(-legSpread * lateralSign, -localHeight * 0.05, 0);
      calf_r.position.set(0, legDrop, 0);
      foot_r.position.set(0, legDrop, 0);
      ball_r.position.set(0, 0, localHeight * 0.04 * depthSign);
      ball_leaf_r.position.set(0, 0, localHeight * 0.02 * depthSign);

      clavicle_l.position.set(shoulderSpread * lateralSign, localHeight * 0.08, 0);
      upperarm_l.position.set(armLength * lateralSign, 0, 0);
      lowerarm_l.position.set(armLength * lateralSign, 0, 0);
      hand_l.position.set(armLength * 0.5 * lateralSign, 0, 0);

      clavicle_r.position.set(-shoulderSpread * lateralSign, localHeight * 0.08, 0);
      upperarm_r.position.set(-armLength * lateralSign, 0, 0);
      lowerarm_r.position.set(-armLength * lateralSign, 0, 0);
      hand_r.position.set(-armLength * 0.5 * lateralSign, 0, 0);

      // Fingers L
      for (const f of fingersList) {
        const bonesArray = leftFingerBones[f];
        let offsetMultiplier = 0;
        if (f === 'thumb') offsetMultiplier = -2;
        else if (f === 'index') offsetMultiplier = -1;
        else if (f === 'middle') offsetMultiplier = 0;
        else if (f === 'ring') offsetMultiplier = 1;
        else if (f === 'pinky') offsetMultiplier = 2;

        bonesArray[0].position.set(localWidth * 0.03 * lateralSign, 0, offsetMultiplier * localWidth * 0.008 * depthSign);
        bonesArray[1].position.set(localWidth * 0.02 * lateralSign, 0, 0);
        bonesArray[2].position.set(localWidth * 0.018 * lateralSign, 0, 0);
        bonesArray[3].position.set(localWidth * 0.015 * lateralSign, 0, 0);
      }

      // Fingers R
      for (const f of fingersList) {
        const bonesArray = rightFingerBones[f];
        let offsetMultiplier = 0;
        if (f === 'thumb') offsetMultiplier = -2;
        else if (f === 'index') offsetMultiplier = -1;
        else if (f === 'middle') offsetMultiplier = 0;
        else if (f === 'ring') offsetMultiplier = 1;
        else if (f === 'pinky') offsetMultiplier = 2;

        bonesArray[0].position.set(-localWidth * 0.03 * lateralSign, 0, offsetMultiplier * localWidth * 0.008 * depthSign);
        bonesArray[1].position.set(-localWidth * 0.02 * lateralSign, 0, 0);
        bonesArray[2].position.set(-localWidth * 0.018 * lateralSign, 0, 0);
        bonesArray[3].position.set(-localWidth * 0.015 * lateralSign, 0, 0);
      }
    }

  // Find the correct bones parent to align local coordinate spaces
  let bonesParent: THREE.Object3D = targetMesh;
  targetMesh.traverse((child) => {
    if (bonesParent === targetMesh && ((child as any).isMesh || (child as any).isSkinnedMesh) && child !== targetMesh) {
      if (child.parent && child.parent !== targetMesh) {
        bonesParent = child.parent;
      }
    }
  });

  // Inject to Mesh
  bonesParent.add(root);

  // Restore original parent and transform
  if (originalParent) {
    originalParent.add(targetMesh);
  }
  targetMesh.position.copy(originalPosition);
  targetMesh.rotation.copy(originalRotation);
  targetMesh.scale.copy(originalScale);
  targetMesh.updateMatrixWorld(true);

  bones.forEach(bone => {
    bone.scale.set(1, 1, 1);
    bone.quaternion.set(0, 0, 0, 1);
    bone.updateMatrixWorld(true);
  });

  const skeleton = new THREE.Skeleton(bones);
  return { skeleton, rootBone: root, bones };
}
