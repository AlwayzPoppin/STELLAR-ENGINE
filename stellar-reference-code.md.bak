# 🌌 **Stellar Engine — Golden Reference Code Log**
*This file preserves exact copy-pasteable blocks of verified, benchmarked, and warning-free key game loop/rendering abstractions.*

---

## 1. Particle Emitter System (Procedural Textures & Shaders)
Preserves high-performance procedural canvas texture generators and buffer updates.

```tsx
function ParticleEmitter({ type, isPlaying, particleProps }: { type: string; isPlaying: boolean; particleProps?: SceneObject['particleProps'] }) {
  const count = particleProps?.count ?? 150;
  const speedVal = particleProps?.speed ?? 1.5;
  const sizeVal = particleProps?.size ?? (type === 'fire' ? 0.35 : type === 'tornado' ? 0.55 : type === 'smoke' ? 0.55 : type === 'water' ? 0.25 : type === 'sparks' ? 0.15 : 0.2);
  const colorVal = particleProps?.color ?? (type === 'fire' ? '#f97316' : type === 'tornado' ? '#a3a3a3' : type === 'smoke' ? '#a3a3a3' : type === 'water' ? '#38bdf8' : type === 'sparks' ? '#eab308' : '#ffffff');
  const opacityVal = particleProps?.opacity ?? (type === 'fire' ? 0.75 : type === 'tornado' ? 0.7 : type === 'smoke' ? 0.25 : type === 'water' ? 0.6 : type === 'sparks' ? 0.9 : 0.5);
  const shapeVal = particleProps?.shape ?? ((type === 'fire' || type === 'tornado') ? 'realistic' : type === 'sparks' ? 'spark' : 'circle');
  const lifetimeVal = particleProps?.lifetime ?? (type === 'smoke' ? 4.5 : type === 'sparks' ? 3.5 : 4.0);

  const pointsRef = React.useRef<THREE.Points>(null);

  // Soft radial circle texture generated procedurally
  const circleTexture = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Realistic turbulent fluffy wispy flame/smoke texture generated procedurally
  const realisticTexture = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);

      // Create organic fluffy puff shapes by combining multiple offscreen bubbles
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 64;
      tempCanvas.height = 64;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        const drawPuff = (x: number, y: number, r: number, op: number) => {
          tempCtx.fillStyle = `rgba(255, 255, 255, ${op})`;
          tempCtx.beginPath();
          tempCtx.arc(x, y, r, 0, Math.PI * 2);
          tempCtx.fill();
        };

        // Core mass
        drawPuff(32, 32, 13, 0.45);
        
        // Dynamic fractal boundary satellites
        const numPuffs = 12;
        for (let i = 0; i < numPuffs; i++) {
          const angle = (i / numPuffs) * Math.PI * 2;
          const dist = 6 + Math.sin(angle * 3) * 6 + Math.cos(angle * 5) * 3;
          const px = 32 + Math.cos(angle) * dist;
          const py = 32 + Math.sin(angle) * dist;
          const size = 5 + Math.random() * 8;
          drawPuff(px, py, size, 0.15 + Math.random() * 0.2);
        }

        // Draw overlapping fluffy shape using canvas blur filter for premium realistic blending
        ctx.filter = 'blur(4px)';
        ctx.drawImage(tempCanvas, 0, 0);
      }

      // Add high-fidelity internal wispiness and edge fade
      const imgData = ctx.getImageData(0, 0, 64, 64);
      const data = imgData.data;
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const idx = (y * 64 + x) * 4;
          const alpha = data[idx + 3];
          if (alpha > 0) {
            const nx = x - 32;
            const ny = y - 32;
            const dist = Math.sqrt(nx * nx + ny * ny);

            // High frequency wave modulation to mimic micro-turbulences
            const s1 = Math.sin(x * 0.35 + 2.0) * Math.cos(y * 0.35 + 1.0);
            const s2 = Math.sin(x * 0.7 + y * 0.4) * 0.45;
            const noise = (s1 + s2 + 1.45) / 2.9; // normalized noise

            const edgeFade = Math.max(0, 1 - (dist / 32));
            data[idx + 3] = alpha * (0.55 + noise * 0.45) * edgeFade;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Sharp cross-star texture generated procedurally
  const sparkTexture = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Clear canvas
      ctx.clearRect(0, 0, 32, 32);

      // Radial base glow
      const baseGrad = ctx.createRadialGradient(16, 16, 0, 16, 16, 10);
      baseGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      baseGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
      baseGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.arc(16, 16, 16, 0, Math.PI * 2);
      ctx.fill();

      // Sharp flares
      const flareGradX = ctx.createLinearGradient(0, 16, 32, 16);
      flareGradX.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
      flareGradX.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
      flareGradX.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.strokeStyle = flareGradX;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(32, 16);
      ctx.stroke();

      const flareGradY = ctx.createLinearGradient(16, 0, 16, 32);
      flareGradY.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
      flareGradY.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
      flareGradY.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.strokeStyle = flareGradY;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(16, 32);
      ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  const activeTexture = React.useMemo(() => {
    if (shapeVal === 'circle') return circleTexture;
    if (shapeVal === 'realistic') return realisticTexture;
    if (shapeVal === 'spark') return sparkTexture;
    return null; // Square has no texture
  }, [shapeVal, circleTexture, realisticTexture, sparkTexture]);

  // Convert custom hex tint color to RGB multiplier dynamically
  const tintColor = React.useMemo(() => {
    return new THREE.Color(colorVal);
  }, [colorVal]);

  // Initialize particle positions, dynamic variables, color, and size vertex arrays
  const [positions, variables, colors, sizes] = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vars = new Float32Array(count * 3); // [progress/life, speedY, initialAngle]
    const cols = new Float32Array(count * 3); // [r, g, b] per vertex
    const szs = new Float32Array(count); // Per-particle size array
    
    for (let i = 0; i < count; i++) {
      // Set to Y height pre-scatter evenly
      pos[i * 3 + 1] = Math.random() * 4.5; 

      vars[i * 3] = Math.random(); // Lifetime progression index
      vars[i * 3 + 1] = 1.0 + Math.random() * 2.0; // Upward draft velocity velocity
      vars[i * 3 + 2] = Math.random() * Math.PI * 2; // Random initial angle from 0 to 2pi
      szs[i] = sizeVal;
    }
    return [pos, vars, cols, szs];
  }, [type, count, sizeVal]);

  const posAttributeRef = React.useRef<THREE.BufferAttribute>(null);
  const colAttributeRef = React.useRef<THREE.BufferAttribute>(null);
  const sizeAttributeRef = React.useRef<THREE.BufferAttribute>(null);

  // Embers refs & attributes for cinematic sparks/embers overlay
  const embersRef = React.useRef<THREE.Points>(null);
  const embersPosRef = React.useRef<THREE.BufferAttribute>(null);
  const embersColRef = React.useRef<THREE.BufferAttribute>(null);
  const embersSizeRef = React.useRef<THREE.BufferAttribute>(null);

  const embersCount = Math.floor(count * 0.45); // 45% of flame count as floating embers

  // Initialize embers positions, dynamic variables, colors, and sizes
  const [embersPositions, embersVariables, embersColors, embersSizes] = React.useMemo(() => {
    if (type !== 'fire') return [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
    const pos = new Float32Array(embersCount * 3);
    const vars = new Float32Array(embersCount * 3); // [progress/life, speedY, phaseAngle]
    const cols = new Float32Array(embersCount * 3);
    const szs = new Float32Array(embersCount);
    
    for (let i = 0; i < embersCount; i++) {
      pos[i * 3 + 1] = Math.random() * 4.5; // Random height
      vars[i * 3] = Math.random(); // Initial life progression
      vars[i * 3 + 1] = 2.0 + Math.random() * 2.5; // Fast upward vertical draft speed for embers
      vars[i * 3 + 2] = Math.random() * Math.PI * 2; // Unique starting phase angle
      szs[i] = sizeVal * 0.22;
    }
    return [pos, vars, cols, szs];
  }, [type, embersCount, sizeVal]);

  // Smoke layer refs & attributes specifically for fire FBM smoke plumes
  const smokeRef = React.useRef<THREE.Points>(null);
  const smokePosRef = React.useRef<THREE.BufferAttribute>(null);
  const smokeColRef = React.useRef<THREE.BufferAttribute>(null);
  const smokeSizeRef = React.useRef<THREE.BufferAttribute>(null);
  const smokeLifeRef = React.useRef<THREE.BufferAttribute>(null);

  const smokeCount = Math.floor(count * 0.85); // 85% of fire count as smoke clouds

  // Initialize smoke positions, dynamic variables, colors, sizes, and lifeRatios
  const [smokePositions, smokeVariables, smokeColors, smokeSizes, smokeLifeRatios] = React.useMemo(() => {
    if (type !== 'fire') return [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
    const pos = new Float32Array(smokeCount * 3);
    const vars = new Float32Array(smokeCount * 3); // [progress/life, speedY, phaseAngle]
    const cols = new Float32Array(smokeCount * 3);
    const szs = new Float32Array(smokeCount);
    const lifes = new Float32Array(smokeCount);
    
    for (let i = 0; i < smokeCount; i++) {
      pos[i * 3 + 1] = Math.random() * 4.5; // pre-warm start heights
      vars[i * 3] = pos[i * 3 + 1]; 
      vars[i * 3 + 1] = 0.8 + Math.random() * 1.5; // rising speed for smoke (slower, heavier than flame)
      vars[i * 3 + 2] = Math.random() * Math.PI * 2; // Unique phase angle
      szs[i] = sizeVal;
      lifes[i] = pos[i * 3 + 1] / 4.5;
    }
    return [pos, vars, cols, szs, lifes];
  }, [type, smokeCount, sizeVal]);

  useFrame((state, delta) => {
    if (!posAttributeRef.current || !colAttributeRef.current || !sizeAttributeRef.current || !pointsRef.current) return;

    const currentPos = posAttributeRef.current.array as Float32Array;
    const currentCols = colAttributeRef.current.array as Float32Array;
    const currentSizes = sizeAttributeRef.current.array as Float32Array;
    const time = state.clock.getElapsedTime();

    const maxHeight = lifetimeVal;

    // Frame-level Wind Gusts & Turbulence fluctuation (fluctuates strength by up to 30%, swings angle by +/- 15 degrees)
    const gustFactor = (Math.sin(time * 1.5) + Math.sin(time * 2.7 + 1.2)) * 0.5;
    const baseWindStrength = 0.8 * (speedVal / 1.5);
    const baseWindDirection = 0.0; // In degrees
    
    const currentWindStrength = Math.max(0.0, baseWindStrength + (gustFactor * baseWindStrength * 0.3));
    const currentWindAngle = baseWindDirection + (gustFactor * 15.0);
    const currentWindRad = (currentWindAngle * Math.PI) / 180.0;
    
    const windX = Math.cos(currentWindRad) * currentWindStrength;
    const windZ = Math.sin(currentWindRad) * currentWindStrength;

    for (let i = 0; i < count; i++) {
      const xIdx = i * 3;
      const yIdx = i * 3 + 1;
      const zIdx = i * 3 + 2;
      const vIdx = i * 3;

      if (isPlaying) {
        // 1. DYNAMIC ASCENT (Upward Y climbing)
        currentPos[yIdx] += variables[vIdx + 1] * delta * (speedVal / 1.5);

        // Recycle particle cleanly at Y=0 when it finishes its vertical climb loop
        if (currentPos[yIdx] > maxHeight) {
          currentPos[yIdx] = 0.0;
        }
      }

      // Calculate progress percentage
      const currentHeightPct = Math.min(1.0, currentPos[yIdx] / maxHeight);
      const theta0 = variables[vIdx + 2]; // Unique starting phase angle
      const seed = variables[vIdx + 2];

      // 2. 3D VOLUMETRIC SPIRALS & DYNAMICS
      if (type === 'fire') {
        const p = currentHeightPct;
        const taper = 1.0 - p;
        
        // A. Inward Convection Draft: pull X & Z toward center axis cumulatively
        const convectionPull = 1.8 * delta;
        currentPos[xIdx] -= currentPos[xIdx] * convectionPull;
        currentPos[zIdx] -= currentPos[zIdx] * convectionPull;

        // B. High-frequency volatile sways
        const flickerX = Math.sin(time * 30.0 + seed * 9.0) * 0.06 * taper * delta;
        const flickerZ = Math.cos(time * 24.0 + seed * 5.0) * 0.05 * taper * delta;

        // C. Upward licking wave tongues
        const waveX = Math.sin(p * 6.0 - time * 18.0 + seed * 4.0) * 0.1 * taper * delta;
        const waveZ = Math.cos(p * 5.0 - time * 15.0 + seed * 2.0) * 0.08 * taper * delta;

        // D. Wind Influence (gets exponentially stronger as particle burns up near top)
        const windInfluence = p * p;

        // E. Base emission scattering drift
        const rCoeff = Math.abs(Math.sin(seed * 14.3));
        const baseRadius = 0.12 * (sizeVal / 0.35) * taper * rCoeff;
        const bx = Math.cos(seed) * baseRadius * delta;
        const bz = Math.sin(seed) * baseRadius * delta;

        // Apply cumulative physics
        currentPos[xIdx] += bx + flickerX + waveX + windX * windInfluence * delta;
        currentPos[zIdx] += bz + flickerZ + waveZ + windZ * windInfluence * delta;

        // F. Size Decay over Lifetime: large at base (incandescent core), shrinking to 15% at peak
        currentSizes[i] = sizeVal * (1.0 - p * 0.85);
      } else if (type === 'tornado') {
        // Funnel spreads outward as it rises: starts at 0.1 at base, expands up to 2.2
        const radius = (0.1 + currentHeightPct * 2.2) * (sizeVal * 1.5);
        
        // Spin speed is fast at bottom and wide-slow at top
        const spinWinding = time * (speedVal * 6.0) + (currentHeightPct * 10.0) + theta0;

        // Chaotic wind vortex wobbles
        const wobbleX = Math.sin(time * 12 + seed) * 0.1 * currentHeightPct;
        const wobbleZ = Math.cos(time * 12 + seed) * 0.1 * currentHeightPct;

        currentPos[xIdx] = Math.cos(spinWinding) * radius + wobbleX;
        currentPos[zIdx] = Math.sin(spinWinding) * radius + wobbleZ;

        // Dynamic sizing: expands wider at the top
        currentSizes[i] = sizeVal * (1.0 + currentHeightPct * 0.5);
      } else if (type === 'sparks') {
        // Erratic, high-frequency snapping embers
        currentPos[xIdx] += (Math.sin(time * 15 + seed) * 1.5) * delta;
        currentPos[zIdx] += (Math.cos(time * 15 + seed) * 1.5) * delta;

        // Dynamic sizing: shrink near tip
        currentSizes[i] = sizeVal * (1.0 - currentHeightPct);
      } else if (type === 'water') {
        currentPos[xIdx] += Math.cos(time * 2 + seed) * 0.4 * delta;

        // Dynamic sizing: shrink as it evaporates
        currentSizes[i] = sizeVal * (1.0 - currentHeightPct * 0.7);
      } else {
        // Standard fluid drift expansion for smoke
        currentPos[xIdx] += Math.sin(time * 2 + seed) * 0.1 * delta;

        // Dynamic sizing: expands fluffy as it rises
        currentSizes[i] = sizeVal * (0.6 + currentHeightPct * 1.0);
      }

      // 3. THERMODYNAMIC COLOR GRADIENT (Calculated natively per vertex height)
      let r = 1, g = 1, b = 1;
      const p = currentHeightPct; // Progress shortcut 0.0 -> 1.0

      if (type === 'fire') {
        if (p < 0.15) {
          // Ignition Base (0% - 15% height): Brilliant white with an electric blue hot base
          const t = p / 0.15;
          r = THREE.MathUtils.lerp(0.5, 1.0, t);
          g = THREE.MathUtils.lerp(0.7, 1.0, t);
          b = 1.0;
        } else if (p < 0.5) {
          // Flame Body (15% - 50% height): Vivid incandescent yellow blending rapidly into deep orange
          const t = (p - 0.15) / 0.35;
          r = 1.0;
          g = THREE.MathUtils.lerp(1.0, 0.35, t);
          b = THREE.MathUtils.lerp(0.5, 0.0, t);
        } else if (p < 0.8) {
          // Cooling Edge (50% - 80% height): Deep crimson red
          const t = (p - 0.5) / 0.3;
          r = THREE.MathUtils.lerp(1.0, 0.7, t);
          g = THREE.MathUtils.lerp(0.35, 0.05, t);
          b = THREE.MathUtils.lerp(0.0, 0.05, t);
        } else {
          // Dissipation Tip (80% - 100% height): Fading charcoal gray and dark ash smoke
          const t = (p - 0.8) / 0.2;
          r = THREE.MathUtils.lerp(0.7, 0.15, t);
          g = THREE.MathUtils.lerp(0.05, 0.15, t);
          b = THREE.MathUtils.lerp(0.05, 0.15, t);
        }
      } else if (type === 'tornado') {
        if (p < 0.25) {
          // High energy golden/orange glowing core base intake
          r = 1.0; g = 0.65; b = 0.35;
        } else if (p < 0.7) {
          // Greyish brown swirling windstorm debris
          const t = (p - 0.25) / 0.45;
          r = THREE.MathUtils.lerp(1.0, 0.45, t); g = THREE.MathUtils.lerp(0.65, 0.4, t); b = THREE.MathUtils.lerp(0.35, 0.35, t);
        } else {
          // Dark storm cloud dust at top
          const t = (p - 0.7) / 0.35;
          r = THREE.MathUtils.lerp(0.45, 0.2, t); g = THREE.MathUtils.lerp(0.4, 0.2, t); b = THREE.MathUtils.lerp(0.35, 0.25, t);
        }
      } else if (type === 'sparks') {
        r = 1.0; g = THREE.MathUtils.lerp(0.8, 0.1, p); b = THREE.MathUtils.lerp(0.2, 0.0, p);
      } else if (type === 'water') {
        r = 0.2; g = THREE.MathUtils.lerp(0.6, 0.8, p); b = 1.0;
      } else if (type === 'smoke') {
        r = g = b = THREE.MathUtils.lerp(0.4, 0.2, p);
      }

      // Apply dynamic hex tint multiplier
      currentCols[xIdx] = r * tintColor.r;
      currentCols[yIdx] = g * tintColor.g;
      currentCols[zIdx] = b * tintColor.b;
    }

    // 4. EMBERS & SPARKS DRAFT (Only for fire)
    if (type === 'fire' && embersPosRef.current && embersColRef.current && embersSizeRef.current) {
      const ePos = embersPosRef.current.array as Float32Array;
      const eCols = embersColRef.current.array as Float32Array;
      const eSizes = embersSizeRef.current.array as Float32Array;
      const time = state.clock.getElapsedTime();

      for (let i = 0; i < embersCount; i++) {
        const xIdx = i * 3;
        const yIdx = i * 3 + 1;
        const zIdx = i * 3 + 2;
        const vIdx = i * 3;

        if (isPlaying) {
          // Embers rise faster than the flames
          const emberSpeed = embersVariables[vIdx + 1] * (speedVal / 1.5);
          ePos[yIdx] += emberSpeed * delta;

          // Recycle ember when it reaches the peak height
          if (ePos[yIdx] > maxHeight) {
            ePos[yIdx] = 0.0;
            embersVariables[vIdx + 1] = 2.0 + Math.random() * 2.5; // re-randomize speed draft
          }
        }

        const p = Math.min(1.0, ePos[yIdx] / maxHeight);
        const seed = embersVariables[vIdx + 2];

        // Tight, swirling stream rising straight up (tapers slightly inward at the top tip)
        const radialDist = 0.08 * (sizeVal / 0.35) * (1.0 - p * 0.35); 
        const spin = time * 4.5 + seed + p * 3.5;

        // Extremely subtle ambient micro-sways (keeps the column tight)
        const popX = Math.sin(time * 8.0 + seed * 5.0) * 0.05 * p;
        const popZ = Math.cos(time * 7.0 + seed * 3.0) * 0.05 * p;

        ePos[xIdx] = Math.cos(spin) * radialDist + popX;
        ePos[zIdx] = Math.sin(spin) * radialDist + popZ;

        // Sparks start hot white/gold, turn red-orange, and fade near the peak height
        if (p < 0.2) {
          eCols[xIdx] = 1.0;
          eCols[yIdx] = 0.9;
          eCols[zIdx] = 0.5;
        } else if (p < 0.7) {
          eCols[xIdx] = 1.0;
          eCols[yIdx] = 0.45;
          eCols[zIdx] = 0.05;
        } else {
          const fade = Math.max(0.0, 1.0 - (p - 0.7) / 0.3);
          eCols[xIdx] = 0.9 * fade;
          eCols[yIdx] = 0.1 * fade;
          eCols[zIdx] = 0.0;
        }

        // Dynamic size decay over lifetime: shrink near peak height
        eSizes[i] = sizeVal * 0.22 * (1.0 - p * 0.65);
      }
      embersPosRef.current.needsUpdate = true;
      embersColRef.current.needsUpdate = true;
      embersSizeRef.current.needsUpdate = true;
    }

    // 5. BILLOWING DUST & FBM SMOKE LAYER (Only for fire)
    if (type === 'fire' && smokePosRef.current && smokeColRef.current && smokeSizeRef.current && smokeLifeRef.current) {
      const sPos = smokePosRef.current.array as Float32Array;
      const sCols = smokeColRef.current.array as Float32Array;
      const sSizes = smokeSizeRef.current.array as Float32Array;
      const sLifes = smokeLifeRef.current.array as Float32Array;
      const time = state.clock.getElapsedTime();

      for (let i = 0; i < smokeCount; i++) {
        const xIdx = i * 3;
        const yIdx = i * 3 + 1;
        const zIdx = i * 3 + 2;
        const vIdx = i * 3;

        if (isPlaying) {
          // Smoke rises upwards
          const smokeSpeed = smokeVariables[vIdx + 1] * (speedVal / 1.5);
          sPos[yIdx] += smokeSpeed * delta;

          // Recycle smoke particle when it reaches the peak height
          if (sPos[yIdx] > maxHeight) {
            sPos[yIdx] = 0.0;
            smokeVariables[vIdx + 1] = 0.8 + Math.random() * 1.5;
          }
        }

        const p = Math.min(1.0, sPos[yIdx] / maxHeight);
        const seed = smokeVariables[vIdx + 2];

        // Cumulative sways (drift outward slightly as it rises)
        const convectionPull = 0.8 * delta; // Less convection pull than the flame, so it spreads out!
        sPos[xIdx] -= sPos[xIdx] * convectionPull;
        sPos[zIdx] -= sPos[zIdx] * convectionPull;

        // Mild turbulent sways
        const swayX = Math.sin(time * 6.0 + seed * 8.0) * 0.15 * p * delta;
        const swayZ = Math.cos(time * 5.0 + seed * 4.0) * 0.12 * p * delta;

        // Strong wind influence near the top as the smoke cools
        const windInfluence = p * p;

        sPos[xIdx] += swayX + windX * windInfluence * delta;
        sPos[zIdx] += swayZ + windZ * windInfluence * delta;

        // Fades from glowing dark red/orange to deep charcoal/gray
        let r = 0.15, g = 0.12, b = 0.12;
        if (p < 0.25) {
          // Hot glowing base embers smoke
          const t = p / 0.25;
          r = THREE.MathUtils.lerp(0.45, 0.18, t);
          g = THREE.MathUtils.lerp(0.18, 0.15, t);
          b = THREE.MathUtils.lerp(0.05, 0.15, t);
        } else {
          // Dark charcoal ash smoke
          const t = (p - 0.25) / 0.75;
          r = THREE.MathUtils.lerp(0.18, 0.08, t);
          g = THREE.MathUtils.lerp(0.15, 0.08, t);
          b = THREE.MathUtils.lerp(0.15, 0.08, t);
        }

        sCols[xIdx] = r * tintColor.r;
        sCols[yIdx] = g * tintColor.g;
        sCols[zIdx] = b * tintColor.b;

        // Expanding size: starts tight near emitter base, expands to large fluffy plumes at peak!
        sSizes[i] = sizeVal * (0.8 + p * 2.2);

        // Life ratio representation for fragment shader FBM animated sways & opacities
        sLifes[i] = p;
      }
      smokePosRef.current.needsUpdate = true;
      smokeColRef.current.needsUpdate = true;
      smokeSizeRef.current.needsUpdate = true;
      smokeLifeRef.current.needsUpdate = true;
    }

    posAttributeRef.current.needsUpdate = true;
    colAttributeRef.current.needsUpdate = true;
    sizeAttributeRef.current.needsUpdate = true;
  });

  // Material & Shader setup
  const effectStyles = React.useMemo(() => {
    switch (type) {
      case 'fire': return { opacity: opacityVal, blending: THREE.AdditiveBlending };
      case 'tornado': return { opacity: opacityVal, blending: THREE.NormalBlending };
      case 'smoke': return { opacity: opacityVal, blending: THREE.NormalBlending };
      case 'water': return { opacity: opacityVal, blending: THREE.NormalBlending };
      case 'sparks': return { opacity: opacityVal, blending: THREE.AdditiveBlending };
      default: return { opacity: opacityVal, blending: THREE.NormalBlending };
    }
  }, [type, opacityVal]);

  const vertexShader = React.useMemo(() => `
    attribute float aSize;
    varying vec3 vColor;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = aSize * (300.0 / -mvPosition.z);
    }
  `, []);

  const fragmentShader = React.useMemo(() => `
    uniform sampler2D pointTexture;
    uniform float uOpacity;
    uniform bool uHasTexture;
    varying vec3 vColor;
    void main() {
      vec4 colorMult = vec4(vColor, uOpacity);
      if (uHasTexture) {
        vec4 tex = texture2D(pointTexture, gl_PointCoord);
        if (tex.a < 0.01) discard;
        gl_FragColor = colorMult * tex;
      } else {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;
        float alpha = (0.5 - dist) * 2.0;
        gl_FragColor = vec4(vColor, uOpacity * alpha);
      }
    }
  `, []);

  const smokeVertexShader = React.useMemo(() => `
    attribute float aSize;
    attribute float aLifeRatio;
    varying vec3 vColor;
    varying float vLifeRatio;
    void main() {
      vColor = color;
      vLifeRatio = aLifeRatio;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = aSize * (300.0 / -mvPosition.z);
    }
  `, []);

  const smokeFragmentShader = React.useMemo(() => `
    uniform float uTime;
    uniform float uOpacity;
    varying vec3 vColor;
    varying float vLifeRatio;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 3; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_PointCoord;
      
      // Animate UV coordinates using Time and Age to simulate rising smoke clouds
      vec2 uvAnimated = uv * 3.5 + vec2(0.0, -uTime * 1.4 + vLifeRatio * 2.2);
      float n = fbm(uvAnimated);

      // Soft circular mask
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;
      float mask = smoothstep(0.5, 0.2, dist);

      // Opacity Curve: Fade in during first 10% of life, fade out during last 50% of life
      float p = vLifeRatio;
      float opacityCoeff = 1.0;
      if (p < 0.1) {
        opacityCoeff = p / 0.1;
      } else if (p > 0.5) {
        opacityCoeff = 1.0 - (p - 0.5) / 0.5;
      }
      opacityCoeff = clamp(opacityCoeff, 0.0, 1.0);

      float alpha = n * mask * opacityCoeff * uOpacity;
      if (alpha < 0.01) discard;

      gl_FragColor = vec4(vColor, alpha);
    }
  `, []);

  const uniforms = React.useMemo(() => ({
    pointTexture: { value: activeTexture },
    uOpacity: { value: effectStyles.opacity },
    uHasTexture: { value: activeTexture !== null }
  }), [activeTexture, effectStyles.opacity]);

  const embersUniforms = React.useMemo(() => ({
    pointTexture: { value: sparkTexture },
    uOpacity: { value: opacityVal * 0.9 },
    uHasTexture: { value: true }
  }), [sparkTexture, opacityVal]);

  const smokeUniforms = React.useMemo(() => ({
    uTime: { value: 0.0 },
    uOpacity: { value: opacityVal * 0.65 }
  }), [opacityVal]);

  const smokeMaterialRef = React.useRef<THREE.ShaderMaterial>(null);

  // Bind uniform time value inside useFrame hook
  React.useEffect(() => {
    const handle = setInterval(() => {
      if (smokeMaterialRef.current) {
        smokeMaterialRef.current.uniforms.uTime.value = performance.now() / 1000.0;
      }
    }, 16);
    return () => clearInterval(handle);
  }, []);

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            ref={posAttributeRef}
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            ref={colAttributeRef}
            attach="attributes-color"
            args={[colors, 3]}
          />
          <bufferAttribute
            ref={sizeAttributeRef}
            attach="attributes-aSize"
            args={[sizes, 1]}
          />
        </bufferGeometry>
        <shaderMaterial
          vertexColors={true}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent={true}
          depthWrite={false}
          blending={effectStyles.blending}
        />
      </points>

      {type === 'fire' && (
        <>
          {/* Billowing FBM Smoke Layer */}
          <points ref={smokeRef}>
            <bufferGeometry>
              <bufferAttribute
                ref={smokePosRef}
                attach="attributes-position"
                args={[smokePositions, 3]}
              />
              <bufferAttribute
                ref={smokeColRef}
                attach="attributes-color"
                args={[smokeColors, 3]}
              />
              <bufferAttribute
                ref={smokeSizeRef}
                attach="attributes-aSize"
                args={[smokeSizes, 1]}
              />
              <bufferAttribute
                ref={smokeLifeRef}
                attach="attributes-aLifeRatio"
                args={[smokeLifeRatios, 1]}
              />
            </bufferGeometry>
            <shaderMaterial
              ref={smokeMaterialRef}
              vertexColors={true}
              uniforms={smokeUniforms}
              vertexShader={smokeVertexShader}
              fragmentShader={smokeFragmentShader}
              transparent={true}
              depthWrite={false}
              blending={THREE.NormalBlending}
            />
          </points>

          {/* Sparks/Embers overlay */}
          <points ref={embersRef}>
            <bufferGeometry>
              <bufferAttribute
                ref={embersPosRef}
                attach="attributes-position"
                args={[embersPositions, 3]}
              />
              <bufferAttribute
                ref={embersColRef}
                attach="attributes-color"
                args={[embersColors, 3]}
              />
              <bufferAttribute
                ref={embersSizeRef}
                attach="attributes-aSize"
                args={[embersSizes, 1]}
              />
            </bufferGeometry>
            <shaderMaterial
              vertexColors={true}
              uniforms={embersUniforms}
              vertexShader={vertexShader}
              fragmentShader={fragmentShader}
              transparent={true}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        </>
      )}
    </>
  );
}
```

## 2. Dynamic 3D Rigging Workspace (`PreviewPanel.tsx`)
Preserves the complete copy-pasteable implementation of the isolated 3D component rigging workshop featuring GLTF/FBX multi-model loaders, skeletal connection paths, and interactive `TransformControls` translation synchronization.

```tsx
import React, { Suspense, useMemo, useRef, useState } from 'react';
import { useStore, JointData } from '../store/useStore';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, TransformControls, useGLTF, useFBX, Line } from '@react-three/drei';
import { Bone, Clapperboard, Plus, X, Trash2, Settings } from 'lucide-react';
import * as THREE from 'three';

// Lightweight GLTF loader for the mini-viewport
function MiniGltfModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const cl = scene.clone();
    cl.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cl;
  }, [scene, url]);
  return <primitive object={clone} />;
}

// Lightweight FBX loader for the mini-viewport
function MiniFbxModel({ url }: { url: string }) {
  const fbx = useFBX(url);
  const clone = useMemo(() => {
    const cl = fbx.clone();
    cl.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cl;
  }, [fbx, url]);
  return <primitive object={clone} />;
}

// Lightweight solid shapes rendering for the mini-viewport
function MiniMeshModel({ geometry, material }: { geometry?: string; material?: any }) {
  return (
    <mesh castShadow receiveShadow>
      {geometry === 'sphere' && <sphereGeometry args={[0.6, 32, 32]} />}
      {geometry === 'plane' && <planeGeometry args={[1.2, 1.2]} />}
      {geometry === 'cylinder' && <cylinderGeometry args={[0.4, 0.4, 1.2, 32]} />}
      {geometry === 'cone' && <coneGeometry args={[0.5, 1.0, 32]} />}
      {(!geometry || geometry === 'box') && <boxGeometry args={[0.8, 0.8, 0.8]} />}
      <meshStandardMaterial
        color={material?.color || '#3b82f6'}
        roughness={material?.roughness ?? 0.4}
        metalness={material?.metalness ?? 0.2}
      />
    </mesh>
  );
}

// Interactive Joint Component with TransformControls
function RiggingJoint({
  joint,
  objectId,
  updateJoint,
  selectedJointId,
  setSelectedJointId,
}: {
  joint: JointData;
  objectId: string;
  updateJoint: (objectId: string, jointId: string, updates: Partial<JointData>) => void;
  selectedJointId: string | null;
  setSelectedJointId: (id: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const isSelected = selectedJointId === joint.id;

  return (
    <group>
      <mesh
        ref={meshRef}
        position={joint.position}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedJointId(joint.id);
        }}
      >
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? '#f59e0b' : '#38bdf8'}
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </mesh>

      {isSelected && (
        <TransformControls
          mode="translate"
          size={0.65}
          onObjectChange={(e) => {
            if (e?.target?.object) {
              const pos = e.target.object.position;
              // Real-time update of joint coordinates in state!
              updateJoint(objectId, joint.id, {
                position: [pos.x, pos.y, pos.z],
              });
            }
          }}
        >
          {/* Virtual mesh tracker that receives translation controls */}
          <mesh position={joint.position} visible={false}>
            <sphereGeometry args={[0.01]} />
          </mesh>
        </TransformControls>
      )}
    </group>
  );
}

export default function PreviewPanel() {
  const { previewedAssetId, setPreviewedAsset, objects, addJoint, updateJoint, deleteJoint } = useStore();
  const [selectedJointId, setSelectedJointId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'settings'>('visualizer');

  const asset = useMemo(() => objects.find((o) => o.id === previewedAssetId), [objects, previewedAssetId]);

  if (!asset) return null;

  const joints = asset.joints || [];
  const selectedJoint = joints.find((j) => j.id === selectedJointId);

  const handleAddBone = () => {
    const parentId = selectedJointId;
    const newId = `joint_${crypto.randomUUID()}`;
    const newName = `Joint_${joints.length + 1}`;
    
    const parentPos: [number, number, number] = selectedJoint ? selectedJoint.position : [0, 0, 0];
    const position: [number, number, number] = [
      parentPos[0],
      parentPos[1] + 0.3,
      parentPos[2]
    ];

    addJoint(asset.id, {
      id: newId,
      name: newName,
      position,
      rotation: [0, 0, 0],
      parentId,
    });
    
    setSelectedJointId(newId);
  };

  return (
    <div className="absolute right-0 top-0 w-[340px] h-full bg-bg-surface border-l border-border shadow-2xl z-40 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-neutral-900/50">
        <div className="flex items-center gap-1.5">
          <Clapperboard size={13} className="text-sky-400" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-300">Rigging Workspace</span>
        </div>
        <button
          onClick={() => setPreviewedAsset(null)}
          className="text-text-secondary hover:text-text-primary p-0.5 hover:bg-neutral-800 rounded transition-colors cursor-pointer flex items-center justify-center"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex border-b border-border bg-bg-panel/40 px-2 shrink-0">
        <button
          onClick={() => setActiveTab('visualizer')}
          className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1 \${activeTab === 'visualizer' ? 'border-sky-500 text-sky-400' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          <Bone size={10} /> 3D Viewport
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1 \${activeTab === 'settings' ? 'border-sky-500 text-sky-400' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          <Settings size={10} /> Joint Settings
        </button>
      </div>

      {activeTab === 'visualizer' ? (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 bg-neutral-950 relative overflow-hidden min-h-0">
            <Canvas camera={{ position: [2, 2, 2], fov: 50 }}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
              <OrbitControls makeDefault />
              <gridHelper args={[10, 10, '#333', '#1f1f23']} position={[0, -0.01, 0]} />

              <Suspense fallback={null}>
                <group>
                  {asset.type === 'gltf' && asset.url ? (
                    <MiniGltfModel key={asset.url} url={asset.url} />
                  ) : asset.type === 'fbx' && asset.url ? (
                    <MiniFbxModel key={asset.url} url={asset.url} />
                  ) : (
                    <MiniMeshModel key={asset.id} geometry={asset.geometry} material={asset.material} />
                  )}

                  {joints.map((joint) => {
                    if (joint.parentId) {
                      const parent = joints.find((j) => j.id === joint.parentId);
                      if (parent) {
                        return (
                          <Line
                            key={`line-\${joint.id}`}
                            points={[joint.position, parent.position]}
                            color="#fbbf24"
                            lineWidth={1.5}
                          />
                        );
                      }
                    }
                    return null;
                  })}

                  {joints.map((joint) => (
                    <RiggingJoint
                      key={joint.id}
                      joint={joint}
                      objectId={asset.id}
                      updateJoint={updateJoint}
                      selectedJointId={selectedJointId}
                      setSelectedJointId={setSelectedJointId}
                    />
                  ))}
                </group>
              </Suspense>
            </Canvas>

            <div className="absolute top-3 left-3 bg-neutral-900/90 border border-border px-2 py-1.5 rounded text-[8px] font-mono text-neutral-400 pointer-events-none space-y-1 shadow-lg">
              <div>Preview Model: <strong className="text-white">{asset.name}</strong></div>
              <div>Joints Count: <strong className="text-sky-400">{joints.length}</strong></div>
              <div>Selected Joint: <strong className="text-amber-400">{selectedJoint ? selectedJoint.name : 'None'}</strong></div>
            </div>
          </div>

          <div className="p-3 border-t border-border bg-bg-panel/60 flex gap-2 shrink-0">
            <button
              onClick={handleAddBone}
              className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold tracking-wider rounded transition-all flex items-center justify-center gap-1 shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <Plus size={11} /> ADD BONE
            </button>
            {selectedJointId && (
              <button
                onClick={() => {
                  deleteJoint(asset.id, selectedJointId);
                  setSelectedJointId(null);
                }}
                className="px-3 py-1.5 bg-red-950/40 border border-red-500/30 hover:bg-red-900/30 hover:border-red-500/60 text-red-400 rounded transition-colors flex items-center justify-center cursor-pointer"
                title="Delete Selected Bone"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4 space-y-4 overflow-y-auto select-none min-h-0">
          {selectedJoint ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Bone Identity</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedJoint.name}
                    onChange={(e) => updateJoint(asset.id, selectedJoint.id, { name: e.target.value })}
                    className="flex-1 bg-neutral-900 border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Parent Bone Bind</h4>
                <select
                  value={selectedJoint.parentId || ''}
                  onChange={(e) => updateJoint(asset.id, selectedJoint.id, { parentId: e.target.value || null })}
                  className="w-full bg-neutral-900 border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                >
                  <option value="">None (Root Bone)</option>
                  {joints
                    .filter((j) => j.id !== selectedJoint.id)
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Local Position</h4>
                <div className="grid grid-cols-3 gap-2">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex flex-col gap-1">
                      <span className="text-[8px] font-mono text-neutral-500 text-center">{axis}</span>
                      <input
                        type="number"
                        step="0.05"
                        value={Number(selectedJoint.position[i].toFixed(3))}
                        onChange={(e) => {
                          const nextPos = [...selectedJoint.position] as [number, number, number];
                          nextPos[i] = parseFloat(e.target.value) || 0;
                          updateJoint(asset.id, selectedJoint.id, { position: nextPos });
                        }}
                        className="bg-neutral-900 border border-border rounded py-1 px-1 text-center text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Local Rotation (Euler)</h4>
                <div className="grid grid-cols-3 gap-2">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex flex-col gap-1">
                      <span className="text-[8px] font-mono text-neutral-500 text-center">{axis}°</span>
                      <input
                        type="number"
                        step="1"
                        value={Number(selectedJoint.rotation[i].toFixed(1))}
                        onChange={(e) => {
                          const nextRot = [...selectedJoint.rotation] as [number, number, number];
                          nextRot[i] = parseFloat(e.target.value) || 0;
                          updateJoint(asset.id, selectedJoint.id, { rotation: nextRot });
                        }}
                        className="bg-neutral-900 border border-border rounded py-1 px-1 text-center text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-6 bg-neutral-900/30 border border-border/60 border-dashed rounded-lg space-y-2">
              <Bone size={20} className="mx-auto text-neutral-600 animate-pulse" />
              <p className="text-[10px] text-text-secondary leading-relaxed max-w-[200px] mx-auto font-medium">
                No joint bone selected. Click on a joint sphere inside the 3D viewport tab to customize its name, parent-binding, and translation coords.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

