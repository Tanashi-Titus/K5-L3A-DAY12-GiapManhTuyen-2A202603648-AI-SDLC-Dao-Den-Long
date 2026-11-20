# Agent guide

- Read `CHANGELOG.md`, the current contract, applicable phase notes/spec, and local lab requirements before changing game rules. Phase 1 and 2 notes are historical where superseded by contract 1.2; the current contract metadata is 1.3.
- The simulation in `src/sim.js` is the source of truth for gameplay; values in `game.contract.json` must match `TUNING` exactly.
- Keep headless logic independent of WebGL, DOM, localStorage, and audio APIs. The grader runs `node src/cli.js` on macOS/Linux.
- Build: `npm run build`. Contract checks: `npm run verify`. Start the game: `npm start`, then open `http://localhost:4173`.
- Preserve deterministic output for a fixed seed, night, scenario, and input. Use the seeded RNG; never use wall clock or `Math.random()` in simulation code.
- Keep output JSONL on the requested file; diagnostics go to stderr. Input/schema errors must return exit code 2.
- After changing simulation values, update `game.contract.json`, assumptions, scenarios, and proof notes together.
- Preserve behavior required by the current contract and still-valid earlier requirements; document each intentional replacement and update the old scenario instead of deleting it silently.
- Keep render draw calls and per-tick entity scans bounded. Headless full-night performance target is under 30 seconds for 21,600 ticks.
- Use `npm run bench -- --seed 42 --duration 30 --out <report.json> --screenshot <image.png>` for the repeatable browser performance measurement; report the actual contract version and environment.
- Keep visuals lightweight and dependency-free. Do not add network-loaded assets or packages without a clear need.
