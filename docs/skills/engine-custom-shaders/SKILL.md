---
name: engine-custom-shaders
description: Add lightweight lighting and material effects to this project's owned WebGL renderer while preserving its rendering contract.
---

# Custom renderer shaders for Đảo Đèn Lồng

This project owns a small WebGL 1 renderer. Keep its game loop, camera, controls, and dependency-free asset approach. This project note adapts the workflow of [ehartye/agent-engine's `engine-custom-shaders` skill](https://skillsmp.com/creators/ehartye/agent-engine/skills-engine-custom-shaders); it is not a copy of the upstream skill or its companion guide.

## Before changing a shader

- Read `src/renderer.js` and identify world-space inputs, camera transforms, draw order, depth behavior, and the existing lighting and emissive calculations.
- Prefer a material/shader change that supports the visual request without changing simulation rules or replacing the renderer.
- Keep GPU loops bounded and WebGL 1 compatible. Avoid unsupported dynamic uniform-array indexing; unroll small fixed light sets when needed.
- Avoid large opaque emissive geometry when the lit object itself needs to stay visible. Model the lamp housing as open geometry and put light on surrounding surfaces with distance-based falloff.
- Use seeded, deterministic geometry variation. Keep per-frame work and new draw calls bounded.

## Verify the result

- Compile the shader through the actual game renderer and inspect it in the browser at normal game scale.
- Check the unlit and newly lit lantern, neighboring ground, trees, and player; confirm the housing stays legible and the light radius grows smoothly.
- Confirm ordinary objects and the HUD remain unaffected, then run the project's build and contract checks.
- Describe shader compilation, visible appearance, and performance as separate kinds of evidence. Do not claim a speed improvement without measuring it.
