# 🌠 **Stellar Engine — Known-Good Systems Log**
### *Verified Stable Subsystems & Features*

---

## **1) Rendering & Environment**
- [x] **Day/Night Cycle:** Dynamic sun/moon positioning via animated clock and store time.
- [x] **Sky Dome:** Gradient shader transitions (Midnight -> Dawn -> Noon -> Dusk -> Midnight).
- [x] **Stars:** Automatic visibility toggle between 7 PM and 5 AM (animated).
- [x] **God Rays:** Memory-only mesh tracking sun position without focus theft.
- [x] **Atmospheric Lighting:** Dynamic IBL (EnvironmentIntensity) dimming at night.
- [x] **Dynamic Clouds:** Toggleable, speed-controlled, and density-controlled volumetric (3D puffs) or flat (2D stratus) clouds that drift under simulated wind and dynamically transition colors with the Day/Night cycle.

## **2) Physics & Interaction**
- [x] **Collision Engine:** RigidBody interaction for dynamic and fixed objects.
- [x] **Plane & Primitive Colliders:** Correctly mapped local Z-space CuboidColliders for planes (floor/walls), auto-rotated with visual mesh, using default restitution and friction to prevent sensor tunneling.
- [x] **Orbit Controls:** Smooth camera rotation and zoom (disabled during simulation).
- [x] **Focus System:** "F" key camera snapping to selected objects.

## **3) Editor Features**
- [x] **World Settings:** UI controls for environment presets, time, cycle speed, and exposure.
- [x] **Inspector Panel:** Object-specific properties (Celestial, Transform, Material).
- [x] **Hierarchy:** Object selection and management.

---

## **⚠️ Modification Rules**
1. **Reference First:** Check this list before touching shared utilities or global state.
2. **Isolation:** If a task requires touching a [x] system, wrap changes in unit-test-like manual verification.
3. **Regression:** If a feature on this list is observed to fail, uncheck it [ ] and prioritize its stabilization.
