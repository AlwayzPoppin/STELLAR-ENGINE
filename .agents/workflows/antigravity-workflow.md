---
description: 
---

# 🌌 **Stellar Engine — Antigravity Workflow (AAA 3D Engine Edition)**  
### *Optimized for: minimal errors, stable builds, cinematic visual testing, and high‑fidelity 3D behavior*

--- 

**#0) do not edit known good systema d stellar reference code unless i have verified for myself.

## **1) Clarify the Task Before Writing Code**
This is where AAA engines prevent catastrophic regressions.

- If instructions feel vague, **investigate the context**  
- Reproduce the user’s issue **inside a real 3D scene**  
- Identify the **exact subsystem** involved:  
  - Rendering  
  - Physics  
  - Animation  
  - Materials  
  - Camera  
  - Input  
  - Scene graph  
- Predict which systems could be affected by your change  
- Define the **expected 3D behavior** (movement, lighting, physics response, camera feel)

**AAA rule:** No code is written until the behavior is understood visually and technically.

---

## **2) Verify the Dev Server + Engine Environment**
3D engines break easily when the environment is stale.

- Confirm Stellar Engine dev server is running  
- Ensure the editor loads the scene with **zero warnings**  
- Validate:  
  - GPU backend initialized  
  - Shaders compiled  
  - Scene graph loaded  
  - Physics world active  
- If anything looks off, **restart the engine** and recompile shaders

**Start from a clean, stable environment so new errors stand out.**

---

## **3) Implement the Change in Small, Controlled Steps**
AAA engines die from “big batch edits.”  
You avoid that.

- Edit **only the intended component**  
- Avoid touching shared systems (rendering, physics, animation) unless absolutely necessary  
- Keep code clean to avoid lint buildup  
- After each micro‑change:  
  - Save  
  - Let the compiler re-evaluate  
  - Watch for new warnings or errors  
  - Rebuild shaders if needed  

**Rule:** If the change affects more than one subsystem, break it into multiple commits.

---

## **4) Immediate Visual Verification (Critical for 3D Engines)**
Every change must be visually confirmed in a real 3D scene.

- Reload the scene  
- Confirm the world renders correctly  
- Move the camera around the object  
- Check lighting, shadows, reflections  
- Watch the console for warnings or errors  
- Validate that **no other systems broke** (common in 3D engines)

**If the scene “feels wrong,” assume something is wrong.**

---

## **5) Test the Player Object in the 3D Scene**
Your player object is the anchor of the entire engine.

- Select the player in the hierarchy  
- Press **F** to focus the camera  
- Move using **WASD**  
- Rotate camera with mouse  
- Zoom with scroll wheel  
- Validate:  
  - Physics grounding  
  - Collision volumes  
  - Animation blending  
  - Material correctness  
  - Transform stability  
  - Camera follow behavior  

**If the player breaks, the engine breaks.**

---

## **6) Think Like a Human Tester**
AAA engines rely heavily on “feel.”

- Move through the world naturally  
- Try unexpected interactions  
- Jump, collide, slide, rotate, sprint  
- Move the camera in natural arcs  
- Check if lighting reacts correctly  
- Ask:  
  - “Does this feel like a real 3D world?”  
  - “Does anything jitter, pop, or lag?”  

**Human intuition catches what logs never will.**

---

## **7) Run a Full 3D Regression Sweep**
This is where Stellar Engine proves its stability.

Test across all major systems:

### **Rendering**
- Shadows  
- Reflections  
- Post‑processing  
- Shader compilation  

### **Physics**
- Collisions  
- Rigidbodies  
- Gravity  
- Constraints  

### **Animation**
- Blend trees  
- IK  
- Transitions  

### **Scene Graph**
- Parent/child transforms  
- LOD switching  
- Culling  

### **Performance**
- Frame pacing  
- GPU spikes  
- CPU stalls  
- Memory usage  

### **Console**
- Zero errors  
- Zero warnings  

**Regression sweeps prevent slow engine decay — the #1 killer of 3D engines.**

---

## **8) Finalize, Clean Up, and Stabilize**
End every session with a stable, production‑ready build.

- Remove unused code, logs, debug prints  
- Fix all lint issues  
- Ensure the console is **completely clean**  
- Validate the scene loads with no shader warnings  
- Commit only when the build is stable  
- Document:  
  - What changed  
  - Why it changed  
  - What systems were tested  
  - Any visual anomalies found  


## 9) Establish a “Known‑Good Systems Log” to prevent accidental regressions

**Takeaway:**  
We maintain a living document `known-good-systems.md` detailing all systems validated as 100% functional. Before editing any subsystem, we consult this list to understand dependencies and execute targeted visual verifications.

**Workflow rule:**  
- If a target subsystem is in the log, avoid editing it unless directly required.
- If edits are required, isolate the work, test immediately, and sign off before proceeding.
- If a feature breaks during work, it is immediately unchecked/removed from the log until it is fully restabilized.

---

## 10) Secure a “Golden Reference Code” log to safeguard baseline logic

**Takeaway:**  
We keep a dedicated file `stellar-reference-code.md` containing absolute copy-pasteable blocks of our working, key game-loop/renderer elements. If a regression occurs that Git histories make complex to isolate, this serves as our absolute source of truth.

**Workflow rule:**  
- When a complex math, shader, or state persistence change is fully verified in the viewport, the code is updated/frozen in the reference log.
- During A/B debug testing, reference code is used to swap out experimental blocks immediately.
- This reference is updated incrementally, keeping a historic, known-good benchmark of our engine's heart.

---

# 🌠 **Stellar Engine Workflow Summary**
1. **Clarify Behavior:** Pinpoint visual/mathematical expectations before coding.
2. **Clean Slate:** Start only with a running, warning-free dev server.
3. **Controlled Steps:** Limit changes to single subsystems; let compilers validate.
4. **Visual Sweep:** Verify lighting, shadows, and viewport depth on every change.
5. **Test Player:** Anchor checks on physics, collision, and player camera.
6. **Intuitive Play:** Test the scene's dynamic "feel" manually.
7. **Regression Sweep:** Audit performance, culling, frames, and console logs.
8. **Finalize & Clean:** Clean imports, styles, and console warnings.
9. **Log Stability:** Consult `known-good-systems.md` to secure verified logic.
10. **Reference Base:** Update and secure functional scripts in `stellar-reference-code.md`.