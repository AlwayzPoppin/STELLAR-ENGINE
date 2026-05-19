# 🌠 **Stellar Engine — Golden Reference Code**
### *Last Verified: 2026-05-16*

This document contains the exact code blocks for critical engine systems. Use this as a reference if a new feature causes a regression.

---

## **1) Celestial & Atmospheric Math**
### *Subsystem: Day/Night Cycle, SkyDome, and Intensity Scaling*
**File:** `src/components/Viewport.tsx`

```tsx
// Inside useFrame of DayNightCycle
useFrame((state) => {
  let currentHour = environment.timeOfDay;
  if (isPlaying) {
    if (!prevIsPlaying.current) {
      startClockTime.current = state.clock.getElapsedTime();
      startTimeRef.current = environment.timeOfDay;
    }
    const elapsed = state.clock.getElapsedTime() - startClockTime.current;
    currentHour = (startTimeRef.current + (elapsed / (environment.cycleDuration || 60)) * 24) % 24;
  }
  
  // Track state for React-rendered components like Stars
  setCurrentHourState(currentHour);

  // Update sky dome uniforms directly for high-perf updates
  const { top, bottom } = getSkyColors(currentHour);
  const skyObj = scene.getObjectByName('SkyDome');
  if (skyObj) {
    const mat = skyObj.material as THREE.ShaderMaterial;
    mat.uniforms.colorTop.value = top;
    mat.uniforms.colorBottom.value = bottom;
  }

  const timeAngle = (currentHour / 24) * Math.PI * 2 - Math.PI / 2;
  const radius = 400;
  const x = Math.cos(timeAngle) * radius;
  const y = Math.sin(timeAngle) * radius;
  const z = 200;

  const sunHeight = y / radius; // -1 to 1
  const isDay = sunHeight > 0;

  // Intensity Scaling (Atmospheric Contribution)
  const baseAmbientDay = 0.05 + sunHeight * 0.45;
  const newAmbientInt = isDay 
    ? baseAmbientDay * sunCelestial.atmosphericContribution 
    : 0.01 + moonCelestial.atmosphericContribution * 0.05;

  // Scene Environment Intensity (IBL Damping at Night)
  const envIntensity = isDay ? Math.max(0.3, sunHeight) : 0.05;
  scene.environmentIntensity = envIntensity;
});
```

---

## **2) Volumetric Pattern (Focus-Safe Rendering)**
### *Subsystem: GodRays / LensFlares (Off-Scene-Graph)*
**File:** `src/components/Viewport.tsx`

```tsx
function SunGodRays() {
  const ghostSunMesh = useMemo(() => {
    const geom = new THREE.SphereGeometry(15, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffdd88',
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      toneMapped: false,
    });
    return new THREE.Mesh(geom, mat);
  }, []);

  const { scene } = useThree();
  useFrame(() => {
    const sunObj = scene.getObjectByName('Physical Sun');
    if (sunObj) {
      ghostSunMesh.position.copy(sunObj.position);
      ghostSunMesh.updateMatrixWorld();
    }
  });

  if (!isDay || !sunCelestial.godRaysEnabled) return null;

  return (
    <GodRays
      sun={ghostSunMesh}
      blendFunction={BlendFunction.SCREEN}
      decay={sunCelestial.rayDecay ?? 0.93}
      weight={(sunCelestial.rayWeight ?? 0.6) * sunCelestial.volumetricIntensity}
      exposure={sunCelestial.rayExposure ?? 0.6}
    />
  );
}
```

---

## **3) Editor Navigation (Camera Focus & WASD)**
### *Subsystem: UX Stability*
**File:** `src/components/Viewport.tsx`

```tsx
// Focus Math (lerp + easeOutQuart)
if (focusState.current && focusState.current.active) {
  focusState.current.progress += delta * 2.5;
  if (focusState.current.progress >= 1) {
    focusState.current.progress = 1;
    focusState.current.active = false;
  }
  const t = focusState.current.progress;
  const ease = 1 - Math.pow(1 - t, 4); 

  camera.position.lerpVectors(focusState.current.startCamPos, focusState.current.endCamPos, ease);
  orbitRef.current.target.lerpVectors(focusState.current.startTarget, focusState.current.targetPos, ease);
  orbitRef.current.update();
}

// WASD Movement
const speed = (keys.current.shift ? 15 : 5) * delta;
camera.getWorldDirection(dir);
right.crossVectors(dir, up).normalize();

if (keys.current.w) deltaPos.add(dir.clone().multiplyScalar(speed));
if (keys.current.s) deltaPos.add(dir.clone().multiplyScalar(-speed));
if (keys.current.a) deltaPos.add(right.clone().multiplyScalar(-speed));
if (keys.current.d) deltaPos.add(right.clone().multiplyScalar(speed));
```

---

## **4) State Management (Persistence Patterns)**
### *Subsystem: Zustand Store*
**File:** `src/store/useStore.ts`

```tsx
updateObject: (id, updates) =>
  set((state) => ({
    objects: state.objects.map((obj) =>
      obj.id === id ? { ...obj, ...updates } : obj
    ),
  })),

// Nested Celestial Update Example
updateObject(selectedObj.id, {
  celestialProps: { 
    ...selectedObj.celestialProps!, 
    atmosphericContribution: parseFloat(e.target.value) 
  }
});
```

---

## **5) Dynamic Clouds System & Compass Wind Vectors**
### *Subsystem: Clouds Generation & Wind Drift*
**File:** `src/components/Viewport.tsx`

```tsx
const COMPASS_DEGREES: Record<string, number> = {
  N: 270,
  NE: 315,
  E: 0,
  SE: 45,
  S: 90,
  SW: 135,
  W: 180,
  NW: 225,
};

function getWindAngle(direction: string | undefined): number {
  const deg = COMPASS_DEGREES[direction || 'SE'] ?? 45;
  return (deg * Math.PI) / 180;
}

function IndividualCloud({
  initialX,
  y,
  z,
  scale,
  speedMultiplier,
  cloudsType,
  currentHour,
}: {
  initialX: number;
  y: number;
  z: number;
  scale: number;
  speedMultiplier: number;
  cloudsType: 'volumetric' | 'flat' | 'voxel' | 'nimbus' | 'snow' | 'blizzard';
  currentHour: number;
}) {
  const environment = useStore((s) => s.environment);
  const xRef = useRef(initialX);
  const zRef = useRef(z);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current && environment.cloudsEnabled) {
      // Wind Vector Calculation
      const angle = environment.windEnabled ? getWindAngle(environment.windDirection) : 0.0;
      const strength = environment.windEnabled ? (environment.windStrength || 2.0) * 0.75 : environment.cloudsSpeed * 1.5;

      xRef.current += Math.cos(angle) * strength * speedMultiplier * delta * 4.0;
      zRef.current += Math.sin(angle) * strength * speedMultiplier * delta * 4.0;

      // Boundary reset loop
      if (xRef.current > 180) xRef.current = -180;
      if (xRef.current < -180) xRef.current = 180;
      if (zRef.current > 180) zRef.current = -180;
      if (zRef.current < -180) zRef.current = 180;

      // Dissipation fading near bounds
      const maxDist = Math.max(Math.abs(xRef.current), Math.abs(zRef.current));
      let fade = 1.0;
      if (maxDist > 130) {
        fade = Math.max(0.0, (180 - maxDist) / 50);
      }

      const activeScale = scale * fade;
      groupRef.current.scale.set(activeScale, activeScale, activeScale);
      groupRef.current.position.set(xRef.current, y, zRef.current);
    }
  });

  if (!environment.cloudsEnabled) return null;

  return (
    <group ref={groupRef}>
      {cloudsType === 'flat' ? (
        <FlatCloudCluster position={[0, 0, 0]} scale={1} currentHour={currentHour} />
      ) : cloudsType === 'voxel' ? (
        <VoxelCloudCluster position={[0, 0, 0]} scale={1} currentHour={currentHour} />
      ) : cloudsType === 'snow' ? (
        <SnowCloudCluster position={[0, 0, 0]} scale={1} currentHour={currentHour} />
      ) : (
        <CloudCluster position={[0, 0, 0]} scale={1} currentHour={currentHour} />
      )}
    </group>
  );
}
```

---

## **6) Dynamic Precipitation & Custom Texture Emitters**
### *Subsystem: Rain & Snow Shaders*
**File:** `src/components/Viewport.tsx`

```tsx
function useDynamicTexture(url: string | null) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    const loader = new THREE.TextureLoader();
    let active = true;

    loader.load(url, (tex) => {
      if (active) {
        tex.needsUpdate = true;
        setTexture(tex);
      }
    });

    return () => { active = false; };
  }, [url]);

  return texture;
}

function RainParticles() {
  const environment = useStore((s) => s.environment);
  const count = 1500;
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const customTexture = useDynamicTexture(environment.rainTextureUrl);

  const rainData = useMemo(() => {
    const positions = new Float32Array(count * 6);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 6] = (Math.random() - 0.5) * 200;
      positions[i * 6 + 1] = Math.random() * 120;
      positions[i * 6 + 2] = (Math.random() - 0.5) * 200;
      speeds[i] = 0.8 + Math.random() * 0.4;
    }
    return { positions, speeds };
  }, [count]);

  const posAttributeRef = useRef<THREE.BufferAttribute>(null);

  useFrame((_, delta) => {
    const activeRef = environment.rainTextureUrl && customTexture ? pointsRef : linesRef;
    if (!activeRef.current || !environment.rainEnabled || !posAttributeRef.current) return;

    const positions = posAttributeRef.current.array as Float32Array;
    const speed = environment.rainSpeed || 1.0;
    const density = environment.rainIntensity || 0.5;

    const windRad = getWindAngle(environment.windDirection);
    const windX = environment.windEnabled ? Math.cos(windRad) * (environment.windStrength || 2.0) : 0;
    const windZ = environment.windEnabled ? Math.sin(windRad) * (environment.windStrength || 2.0) : 0;

    for (let i = 0; i < count; i++) {
      if (i > count * density) {
        positions[i * 6 + 1] = -10;
        positions[i * 6 + 4] = -10;
        continue;
      }

      const dropSpeed = rainData.speeds[i] * speed * 90.0 * delta;
      let topY = positions[i * 6 + 1] - dropSpeed;
      let x = positions[i * 6] + windX * delta * 20.0 * rainData.speeds[i];
      let z = positions[i * 6 + 2] + windZ * delta * 20.0 * rainData.speeds[i];

      if (topY < 0) {
        topY = 100 + Math.random() * 30;
        x = (Math.random() - 0.5) * 200;
        z = (Math.random() - 0.5) * 200;
      }

      positions[i * 6] = x;
      positions[i * 6 + 1] = topY;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x + windX * 1.5;
      positions[i * 6 + 4] = topY - (2.0 + rainData.speeds[i] * 2.0);
      positions[i * 6 + 5] = z + windZ * 1.5;
    }
    posAttributeRef.current.needsUpdate = true;
  });

  if (!environment.rainEnabled) return null;

  if (environment.rainTextureUrl && customTexture) {
    return (
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute ref={posAttributeRef} attach="attributes-position" args={[rainData.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial map={customTexture} size={1.6} transparent depthWrite={false} />
      </points>
    );
  }

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute ref={posAttributeRef} attach="attributes-position" args={[rainData.positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#78a0d0" transparent opacity={0.35 * (environment.rainIntensity || 0.5)} depthWrite={false} />
    </lineSegments>
  );
}
```

---

## **7) Solid Floor Box Colliders & Custom Model Mapping**
### *Subsystem: Rapier Ground Plane Physics*
**File:** `src/components/Viewport.tsx`

```tsx
  const isPlane = obj.geometry === 'plane';

  const getColliderProp = () => {
    if (obj.physicsCollisions === false || obj.isSolid === false) return false;
    if (isPlane || obj.geometry === 'box' || obj.geometry === 'sphere') return false;
    const type = obj.physicsColliderType || 'auto';
    if (type !== 'auto') return type as any;
    if (obj.type === 'mesh') return 'hull';
    if (obj.type === 'gltf' || obj.type === 'fbx') return 'hull';
    return undefined;
  };

  const wrapperProps = isSimulating
    ? {
        type: obj.anchored || obj.physics === 'fixed' ? 'fixed' : 'dynamic',
        position: obj.position,
        rotation: obj.rotation,
        colliders: getColliderProp(),
        ...(obj.physicsMass !== undefined ? { mass: obj.physicsMass } : {}),
        restitution: obj.physicsRestitution !== undefined ? obj.physicsRestitution : 0.2,
        friction: obj.physicsFriction !== undefined ? obj.physicsFriction : 0.5,
        ccd: true,
      }
    : {};

// ... inside SceneNode return:
<RigidBody {...wrapperProps} ref={ref}>
  {groupContent}
  {obj.physicsCollisions !== false && obj.isSolid !== false && isPlane && (
    <CuboidCollider
      args={[obj.scale[0] * 0.5, obj.scale[1] * 0.5, 0.5]}
      position={[0, 0, -0.5]}
    />
  )}
  {obj.physicsCollisions !== false && obj.isSolid !== false && !isPlane && obj.geometry === 'box' && (
    <CuboidCollider
      args={[obj.scale[0] * 0.5, obj.scale[1] * 0.5, obj.scale[2] * 0.5]}
    />
  )}
  {obj.physicsCollisions !== false && obj.isSolid !== false && !isPlane && obj.geometry === 'sphere' && (
    <BallCollider
      args={[obj.scale[0] * 0.5]}
    />
  )}
</RigidBody>
```


