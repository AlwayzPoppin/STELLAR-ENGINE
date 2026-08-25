import * as THREE from 'three';

export interface WaveParams {
  waveHeight?: number;
  waveSpeed?: number;
}

export interface BuoyancyObject {
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  quaternion: THREE.Quaternion;
  mass?: number;
  massUnit?: 'kg' | 'lbs';
  scale?: THREE.Vector3;
  height?: number;
}

// Pre-allocated module-scope temp objects for internal use
const _tempNormal = new THREE.Vector3();
const _tempUp = new THREE.Vector3(0, 1, 0);
const _tempQuat = new THREE.Quaternion();
const _defaultScale = new THREE.Vector3(1, 1, 1);

/**
 * Calculates real-time wave height displacement at world position (x, z).
 * Synchronized with the water material's vertex shader displacement.
 */
export function getWaveDisplacementAt(x: number, z: number, uTime: number, waveParams?: WaveParams): number {
  const waveHeight = waveParams?.waveHeight ?? 0.08;
  const waveSpeed = waveParams?.waveSpeed ?? 1.0;
  const phaseX = x * 4.0 + uTime * 2.0 * waveSpeed;
  const phaseZ = z * 4.0 + uTime * 1.5 * waveSpeed;
  return Math.sin(phaseX) * waveHeight + Math.cos(phaseZ) * waveHeight;
}

/**
 * Calculates spatial slopes and normal vector of the wave surface at (x, z).
 * @param target Optional output Vector3 to write the result into for zero-allocation pooling.
 */
export function getWaveNormalAt(
  x: number,
  z: number,
  uTime: number,
  waveParams?: WaveParams,
  target: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  const waveHeight = waveParams?.waveHeight ?? 0.08;
  const waveSpeed = waveParams?.waveSpeed ?? 1.0;
  const phaseX = x * 4.0 + uTime * 2.0 * waveSpeed;
  const phaseZ = z * 4.0 + uTime * 1.5 * waveSpeed;

  const slopeX = 4.0 * Math.cos(phaseX) * waveHeight;
  const slopeZ = -4.0 * Math.sin(phaseZ) * waveHeight;

  return target.set(-slopeX, 1.0, -slopeZ).normalize();
}

/**
 * Constructs a quaternion aligned with a wave surface normal vector.
 * @param target Optional output Quaternion to write the result into for zero-allocation pooling.
 */
export function quaternionFromNormal(
  normal: THREE.Vector3,
  target: THREE.Quaternion = new THREE.Quaternion()
): THREE.Quaternion {
  _tempUp.set(0, 1, 0);
  return target.setFromUnitVectors(_tempUp, normal);
}

/**
 * Applies Archimedes Principle (Dynamic Mass vs. Gravity & Buoyant Force Integration)
 * for floating objects on wave surfaces.
 */
export function updateWaterBuoyancy(
  object: BuoyancyObject,
  waterSurfaceY: number,
  uTime: number,
  delta: number,
  waveParams?: WaveParams,
  buoyancyDensity: number = 1.0,
  fluidDragDamping: number = 0.92
) {
  const waveHeight = getWaveDisplacementAt(object.position.x, object.position.z, uTime, waveParams);
  const targetY = waterSurfaceY + waveHeight;

  // Convert object.mass (in lbs or kg) to kilograms for standard physics calculations
  const rawMass = object.mass ?? 1.0;
  const massKg = object.massUnit === 'lbs' ? rawMass * 0.453592 : rawMass;

  // Calculate physical object volume using scale or height bounding dimensions
  const scale = object.scale ?? _defaultScale.set(1, object.height ?? 1, 1);
  const avgRadius = (scale.x + scale.y + scale.z) / 6.0;
  const volume = (4.0 / 3.0) * Math.PI * Math.pow(avgRadius, 3);

  // Archimedes Displacement Force
  const fluidDensity = 1000 * buoyancyDensity; // kg/m^3 (Water)
  const gravity = 9.81;
  const maxBuoyantForce = fluidDensity * volume * gravity; // Upward force when fully submerged

  // Calculate submergence ratio based on current Y position relative to wave surface
  const height = Math.max(0.1, scale.y);
  const depthSubmerged = Math.max(0, (targetY + (height / 2)) - object.position.y);
  const submergenceFraction = Math.min(1.0, depthSubmerged / height);

  // Net Vertical Force = Upward Displacement - Downward Weight
  const totalUpwardForce = maxBuoyantForce * submergenceFraction;
  const totalDownwardForce = massKg * gravity;
  const netYForce = totalUpwardForce - totalDownwardForce;

  // Acceleration = Force / Mass
  const accelerationY = netYForce / Math.max(0.01, massKg);

  if (!object.velocity) {
    object.velocity = new THREE.Vector3(0, 0, 0);
  }

  // Clamp physics delta to 33ms (30 FPS max step size) to prevent velocity explosions or lag spikes
  const safeDelta = Math.min(delta, 0.033);

  // Update Y velocity and apply fluid damping
  object.velocity.y += accelerationY * safeDelta;
  object.velocity.y *= fluidDragDamping; // Water drag

  object.position.y += object.velocity.y * safeDelta;

  // Rotational wave normal alignment using reusable internal temp targets
  const waveNormal = getWaveNormalAt(object.position.x, object.position.z, uTime, waveParams, _tempNormal);
  const targetRot = quaternionFromNormal(waveNormal, _tempQuat);
  object.quaternion.slerp(targetRot, safeDelta * 3.0);
}
