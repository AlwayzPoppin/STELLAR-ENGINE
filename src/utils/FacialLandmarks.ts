import * as THREE from 'three';

export interface FacialLandmarkDef {
  key: string;
  boneName: string;
  label: string;
  category: 'eyes' | 'brows' | 'nose' | 'mouth' | 'cheeks' | 'jaw';
  hint: string;
  isPair?: boolean;
  pairSide?: 'left' | 'right';
  pairedWith?: string;
  defaultLocalOffset: [number, number, number];
}

export const FACIAL_LANDMARKS: FacialLandmarkDef[] = [
  {
    key: 'eye_left',
    boneName: 'Face_EyeLeft',
    label: 'Left Eye',
    category: 'eyes',
    hint: 'Click the center of the character\'s LEFT eye (from character\'s perspective).',
    isPair: true,
    pairSide: 'left',
    pairedWith: 'eye_right',
    defaultLocalOffset: [-0.03, 0.04, 0.08],
  },
  {
    key: 'eye_right',
    boneName: 'Face_EyeRight',
    label: 'Right Eye',
    category: 'eyes',
    hint: 'Click the center of the character\'s RIGHT eye.',
    isPair: true,
    pairSide: 'right',
    pairedWith: 'eye_left',
    defaultLocalOffset: [0.03, 0.04, 0.08],
  },
  {
    key: 'brow_left',
    boneName: 'Face_BrowLeft',
    label: 'Left Eyebrow',
    category: 'brows',
    hint: 'Click above the left eye on the eyebrow arch.',
    isPair: true,
    pairSide: 'left',
    pairedWith: 'brow_right',
    defaultLocalOffset: [-0.04, 0.06, 0.08],
  },
  {
    key: 'brow_right',
    boneName: 'Face_BrowRight',
    label: 'Right Eyebrow',
    category: 'brows',
    hint: 'Click above the right eye on the eyebrow arch.',
    isPair: true,
    pairSide: 'right',
    pairedWith: 'brow_left',
    defaultLocalOffset: [0.04, 0.06, 0.08],
  },
  {
    key: 'nose_tip',
    boneName: 'Face_NoseBridge',
    label: 'Nose Tip / Bridge',
    category: 'nose',
    hint: 'Click the tip or center bridge of the nose.',
    defaultLocalOffset: [0.0, 0.03, 0.09],
  },
  {
    key: 'cheek_left',
    boneName: 'Face_CheekLeft',
    label: 'Left Cheek',
    category: 'cheeks',
    hint: 'Click on the prominent point of the left cheekbone.',
    isPair: true,
    pairSide: 'left',
    pairedWith: 'cheek_right',
    defaultLocalOffset: [-0.05, 0.01, 0.07],
  },
  {
    key: 'cheek_right',
    boneName: 'Face_CheekRight',
    label: 'Right Cheek',
    category: 'cheeks',
    hint: 'Click on the prominent point of the right cheekbone.',
    isPair: true,
    pairSide: 'right',
    pairedWith: 'cheek_left',
    defaultLocalOffset: [0.05, 0.01, 0.07],
  },
  {
    key: 'lip_upper',
    boneName: 'Face_LipUpper',
    label: 'Upper Lip',
    category: 'mouth',
    hint: 'Click the center of the upper lip / Cupid\'s bow.',
    defaultLocalOffset: [0.0, -0.01, 0.09],
  },
  {
    key: 'lip_lower',
    boneName: 'Face_LipLower',
    label: 'Lower Lip',
    category: 'mouth',
    hint: 'Click the center of the lower lip.',
    defaultLocalOffset: [0.0, -0.03, 0.09],
  },
  {
    key: 'lip_corner_left',
    boneName: 'Face_LipCornerLeft',
    label: 'Left Mouth Corner',
    category: 'mouth',
    hint: 'Click the left corner of the mouth opening.',
    isPair: true,
    pairSide: 'left',
    pairedWith: 'lip_corner_right',
    defaultLocalOffset: [-0.03, -0.02, 0.085],
  },
  {
    key: 'lip_corner_right',
    boneName: 'Face_LipCornerRight',
    label: 'Right Mouth Corner',
    category: 'mouth',
    hint: 'Click the right corner of the mouth opening.',
    isPair: true,
    pairSide: 'right',
    pairedWith: 'lip_corner_left',
    defaultLocalOffset: [0.03, -0.02, 0.085],
  },
  {
    key: 'chin_jaw',
    boneName: 'Face_Chin',
    label: 'Chin / Jaw',
    category: 'jaw',
    hint: 'Click the bottom center of the chin or jawline.',
    defaultLocalOffset: [0.0, -0.06, 0.07],
  },
];

/**
 * Computes mirrored position across X axis for symmetrical placement.
 */
export function getMirroredPosition(pos: [number, number, number]): [number, number, number] {
  return [-pos[0], pos[1], pos[2]];
}
