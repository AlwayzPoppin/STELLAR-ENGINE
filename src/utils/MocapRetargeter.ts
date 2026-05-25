import * as THREE from 'three';

/**
 * Phase 5: Mocap Retargeting Dictionary
 *
 * Maps incoming animation track bone names from Mixamo, HumanIK, and Unreal Engine skeletons
 * onto our 66-bone target skeleton hierarchy.
 *
 * Rotation tracks are applied directly; position tracks are only applied
 * to the root bones (pelvis/root) since our skeleton has different proportions.
 */

// ── Mixamo → 66-Bone target bone name dictionary ──────────────────────────────
export const MIXAMO_MAP: Record<string, string> = {
  'mixamorig:Hips':          'pelvis',
  'mixamorigHips':           'pelvis',
  'mixamorig:Spine':         'spine_01',
  'mixamorigSpine':          'spine_01',
  'mixamorig:Spine1':        'spine_02',
  'mixamorigSpine1':         'spine_02',
  'mixamorig:Spine2':        'spine_03',
  'mixamorigSpine2':         'spine_03',
  'mixamorig:Neck':          'neck_01',
  'mixamorigNeck':           'neck_01',
  'mixamorig:Head':          'head',
  'mixamorigHead':           'head',
  'mixamorig:LeftShoulder':  'clavicle_l',
  'mixamorigLeftShoulder':   'clavicle_l',
  'mixamorig:LeftArm':       'upperarm_l',
  'mixamorigLeftArm':        'upperarm_l',
  'mixamorig:LeftForeArm':   'lowerarm_l',
  'mixamorigLeftForeArm':    'lowerarm_l',
  'mixamorig:LeftHand':      'hand_l',
  'mixamorigLeftHand':       'hand_l',
  'mixamorig:RightShoulder': 'clavicle_r',
  'mixamorigRightShoulder':  'clavicle_r',
  'mixamorig:RightArm':      'upperarm_r',
  'mixamorigRightArm':       'upperarm_r',
  'mixamorig:RightForeArm':  'lowerarm_r',
  'mixamorigRightForeArm':   'lowerarm_r',
  'mixamorig:RightHand':     'hand_r',
  'mixamorigRightHand':      'hand_r',
  'mixamorig:LeftUpLeg':     'thigh_l',
  'mixamorigLeftUpLeg':      'thigh_l',
  'mixamorig:LeftLeg':       'calf_l',
  'mixamorigLeftLeg':        'calf_l',
  'mixamorig:LeftFoot':      'foot_l',
  'mixamorigLeftFoot':       'foot_l',
  'mixamorig:LeftToeBase':   'ball_l',
  'mixamorigLeftToeBase':    'ball_l',
  'mixamorig:RightUpLeg':    'thigh_r',
  'mixamorigRightUpLeg':     'thigh_r',
  'mixamorig:RightLeg':      'calf_r',
  'mixamorigRightLeg':       'calf_r',
  'mixamorig:RightFoot':     'foot_r',
  'mixamorigRightFoot':      'foot_r',
  'mixamorig:RightToeBase':  'ball_r',
  'mixamorigRightToeBase':   'ball_r',
};

// Dynamically generate finger mappings for MIXAMO_MAP
const mixamoFingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
for (const f of mixamoFingers) {
  const fLower = f.toLowerCase();
  for (let i = 1; i <= 4; i++) {
    const targetSuffix = i === 4 ? '04_leaf' : `0${i}`;
    // Left hand fingers
    MIXAMO_MAP[`mixamorig:LeftHand${f}${i}`] = `${fLower}_${targetSuffix}_l`;
    MIXAMO_MAP[`mixamorigLeftHand${f}${i}`] = `${fLower}_${targetSuffix}_l`;
    // Right hand fingers
    MIXAMO_MAP[`mixamorig:RightHand${f}${i}`] = `${fLower}_${targetSuffix}_r`;
    MIXAMO_MAP[`mixamorigRightHand${f}${i}`] = `${fLower}_${targetSuffix}_r`;
  }
}

// ── HumanIK → 66-Bone target bone name dictionary ─────────────────────────────
export const HUMANIK_MAP: Record<string, string> = {
  'Character1_Hips':          'pelvis',
  'Character1_Spine':         'spine_01',
  'Character1_Spine1':        'spine_02',
  'Character1_Spine2':        'spine_03',
  'Character1_Neck':          'neck_01',
  'Character1_Head':          'head',
  'Character1_LeftShoulder':  'clavicle_l',
  'Character1_LeftArm':       'upperarm_l',
  'Character1_LeftForeArm':   'lowerarm_l',
  'Character1_LeftHand':      'hand_l',
  'Character1_RightShoulder': 'clavicle_r',
  'Character1_RightArm':      'upperarm_r',
  'Character1_RightForeArm':  'lowerarm_r',
  'Character1_RightHand':     'hand_r',
  'Character1_LeftUpLeg':     'thigh_l',
  'Character1_LeftLeg':       'calf_l',
  'Character1_LeftFoot':      'foot_l',
  'Character1_RightUpLeg':    'thigh_r',
  'Character1_RightLeg':      'calf_r',
  'Character1_RightFoot':     'foot_r',
};

// Dynamically generate finger mappings for HUMANIK_MAP
for (const f of mixamoFingers) {
  const fLower = f.toLowerCase();
  for (let i = 1; i <= 4; i++) {
    const targetSuffix = i === 4 ? '04_leaf' : `0${i}`;
    HUMANIK_MAP[`Character1_LeftHand${f}${i}`] = `${fLower}_${targetSuffix}_l`;
    HUMANIK_MAP[`Character1_RightHand${f}${i}`] = `${fLower}_${targetSuffix}_r`;
  }
}

// ── Unreal Engine Mannequin → 66-Bone target bone name dictionary ─────────────
// Unreal clips map directly 1:1 to our standard 66-bone labels.
export const UNREAL_MAP: Record<string, string> = {
  'root':                     'root',
  'pelvis':                   'pelvis',
  'spine_01':                 'spine_01',
  'spine_02':                 'spine_02',
  'spine_03':                 'spine_03',
  'neck_01':                  'neck_01',
  'head':                     'head',
  'head_leaf':                'head_leaf',
  'clavicle_l':               'clavicle_l',
  'upperarm_l':               'upperarm_l',
  'lowerarm_l':               'lowerarm_l',
  'hand_l':                   'hand_l',
  'clavicle_r':               'clavicle_r',
  'upperarm_r':               'upperarm_r',
  'lowerarm_r':               'lowerarm_r',
  'hand_r':                   'hand_r',
  'thigh_l':                  'thigh_l',
  'calf_l':                   'calf_l',
  'foot_l':                   'foot_l',
  'ball_l':                   'ball_l',
  'ball_leaf_l':              'ball_leaf_l',
  'thigh_r':                  'thigh_r',
  'calf_r':                   'calf_r',
  'foot_r':                   'foot_r',
  'ball_r':                   'ball_r',
  'ball_leaf_r':              'ball_leaf_r',
};

// Populate 1:1 finger tracks for Unreal
for (const f of mixamoFingers) {
  const fLower = f.toLowerCase();
  for (let i = 1; i <= 4; i++) {
    const targetSuffix = i === 4 ? '04_leaf' : `0${i}`;
    const nameL = `${fLower}_${targetSuffix}_l`;
    const nameR = `${fLower}_${targetSuffix}_r`;
    UNREAL_MAP[nameL] = nameL;
    UNREAL_MAP[nameR] = nameR;
  }
}

function parseTrackName(trackName: string) {
  const parts = trackName.split('.');
  if (parts.length === 0) return null;
  const bonePath = parts[0];
  const property = parts[1] || '';

  // Handle path mappings like: group/boneName or boneName
  const pathParts = bonePath.split('/');
  const boneName = pathParts[pathParts.length - 1];

  return { boneName, property };
}

export function detectSkeletonType(url: string, trackNames: string[]): 'mixamo' | 'humanik' | 'unreal' | 'unknown' | 'native' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('mixamo')) return 'mixamo';
  if (lowerUrl.includes('humanik') || lowerUrl.includes('legacy')) return 'humanik';
  if (lowerUrl.includes('unreal') || lowerUrl.includes('human_animations')) return 'unreal';

  for (const track of trackNames) {
    if (track.includes('mixamorig')) return 'mixamo';
    if (track.includes('Character1_')) return 'humanik';
    if (track.includes('pelvis') || track.includes('spine_01')) return 'unreal';
  }

  return 'unknown';
}

export function retargetClip(clip: THREE.AnimationClip, type: string): THREE.AnimationClip {
  const retargetedTracks: THREE.KeyframeTrack[] = [];
  const seenTargets = new Set<string>();

  const map = type === 'mixamo'
    ? MIXAMO_MAP
    : type === 'humanik'
    ? HUMANIK_MAP
    : type === 'unreal'
    ? UNREAL_MAP
    : null;

  if (!map) return clip.clone();

  for (const track of clip.tracks) {
    const parsed = parseTrackName(track.name);
    if (!parsed) continue;

    const { boneName, property } = parsed;
    const targetBone = map[boneName];

    // Skip unmapped bones
    if (!targetBone) continue;

    const targetKey = `${targetBone}.${property}`;
    if (seenTargets.has(targetKey)) continue;
    seenTargets.add(targetKey);

    // Only keep position tracks for root bones (pelvis/root) — all others use rotation-only FK
    if (property === 'position' && targetBone !== 'pelvis' && targetBone !== 'root') continue;

    // Only keep quaternion and position properties
    if (property !== 'quaternion' && property !== 'position') continue;

    const newTrackName = `${targetBone}.${property}`;

    let newTrack: THREE.KeyframeTrack;
    if (property === 'quaternion') {
      newTrack = new THREE.QuaternionKeyframeTrack(
        newTrackName,
        Array.from(track.times),
        Array.from(track.values)
      );
    } else {
      newTrack = new THREE.VectorKeyframeTrack(
        newTrackName,
        Array.from(track.times),
        Array.from(track.values)
      );
    }

    retargetedTracks.push(newTrack);
  }

  return new THREE.AnimationClip(
    `retargeted_${clip.name}`,
    clip.duration,
    retargetedTracks
  );
}

export function extractBoneNames(clip: THREE.AnimationClip): string[] {
  const boneSet = new Set<string>();
  for (const track of clip.tracks) {
    const parsed = parseTrackName(track.name);
    if (parsed) {
      boneSet.add(parsed.boneName);
    }
  }
  return Array.from(boneSet);
}