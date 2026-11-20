# Phase 2 · Ticket-02 · Acceptance criteria and assumptions

## Acceptance criteria

1. Contract is v1.1. Tuning values in JSON equal the simulation constants. `--night` accepts 1, 2, or 3; an entire night runs headlessly in fewer than 30 seconds for at most 21,600 ticks.
2. Tick order follows the ticket. Pause input is handled first. Wall `tick` increments during pause, while `sim_tick`, night time, cooldowns, spawning, and TTLs stop. Pause snapshots say `paused`.
3. Night 1 uses a radius-40 island with five lamps; Night 2 has two radius-28 islands joined by the narrow trestle bridge and launch pads; Night 3 has a radius-45 three-level island, ramps, bell tower, and launch pad.
4. Night 2 starts Mây at `[0,0,0]`; Night 3 starts at `[0,0,-15]`. Both face world `+Z`.
5. Player input has stable screen-relative movement, jump, dash, wind push, falling/landing, and launch-pad trajectories. Lanterns and pickup positions match the ticket.
6. Night-specific shade schedules, deterministic spawn locations, shade states, pulse effects, safe zones, and hit ordering are represented in snapshots/events.
7. Drifters spawn on nights 2–3, pursue a player carrying five or more motes, steal at most once, flee, and respond to Pulse as specified.
8. Wind charms are collectible, expire after 600 sim ticks, refresh on pickup, and respawn after 2,700 ticks. They raise movement speed to 7.2 m/s and remove Dash cooldown.
9. The browser game flows menu → night introduction → gameplay → result → next night; losing restarts that night. Winning Night 3 shows sunrise and total score.
10. Esc/P pauses. Pause menu provides continue, restart night, settings, and main menu. Volume and mouse sensitivity persist across reloads.
11. Synthesized background audio and effects exist for pickup, light, pulse, hit, jump, dash, win/loss, shade spawn, and last-10-second countdown; volume setting controls them.
12. HUD shows flames, timer (red/blinking at 30 seconds or less), lamp progress, score, 10 mote slots, Dash/Pulse cooldowns, near-lamp prompt, and an off-screen marker to the nearest unlit lamp.
13. Fixed palette values from the supplied ticket are applied within ±10% per RGB channel once available in the full contract. Ambient light follows `0.15 + 0.55 × lit/total`.
14. Headless snapshots include the v1.1 fields: night, wind, player velocity/grounded/invulnerability/cooldowns/charm, motes with kind/TTL, drifters, and charms. `player.invuln` is boolean; the remaining duration is represented internally by ticks and scenario input `invuln_ticks`.
15. Tick-0 snapshot is the pre-step state and contains no events. `night_start` is emitted at tick 1 during the first step.
16. Existing Phase 1 headless scenarios continue passing under the v1.1 standard tuning. Each new feature has at least one headless scenario. The browser renderer averages at least 30 FPS at 1280×720 on the development machine.

## Assumptions required by the pasted text

The copied ticket omitted the numerical tuning table, exact RGB palette, and a complete v1.1 JSON schema. These choices are explicit and should be replaced if the instructor later provides the omitted values:

- Carry capacity and lantern cost are 10, derived from the 10-slot bar and `Nạp ánh sáng (x/10)` HUD.
- Night lengths are 300, 300, and 360 seconds (the stated 21,600-tick maximum is 360 seconds). Base speed remains 5 m/s; flames 3; pulse costs one carried mote.
- Lantern delivery awards +10 for each mote deposited; pickup itself awards no points. Pulse awards +5 per shade hit, even when already stunned. Winning bonus uses floor(seconds left) × 2 + 50 × remaining flames.
- Ordinary motes occupy fixed spawn points and respawn 180 ticks after pickup so each night has enough light to finish. Dropped motes expire after 30 seconds.
- Night 1 spawns two shades at 5 seconds, then one every 8 seconds, capped at six. Nights 2 and 3 spawn one every 7 and 6 seconds, capped at eight and ten.
- Night 2 and 3 shade schedules begin at 7 and 6 seconds, respectively. Night 1 first wave begins at 5 seconds.
- Dash uses the current move direction, or facing direction when idle; it lasts 12 ticks at 14 m/s, with a 2-second base cooldown.
- A launch pad applies the listed velocity once on contact; it is not retriggered until Mây leaves and touches it again.
- A spawned shade remains in `spawning` for 60 ticks (1 second), fades in during that interval, cannot damage Mây, and then enters `wander`. Shades supplied by a scenario skip this phase and default to `wander`.
- Wandering shades patrol a compact circular route at 1.8 m/s even when Mây is outside their 18 m chase radius; route radius is 2.8 m on Night 1 and 2 m on later nights. Chasing begins under 18 m and ends beyond 24 m. The route stays inside the island, and only a lit lantern with low fuel can draw a shade into draining behavior.
- If the final lamp is lit on the same tick as dawn, a win takes precedence; running out of flames takes precedence over both.
- The supplied phrase “8 color palette” contains the ambient formula but no RGB table in the pasted text. Existing project colors are retained until exact palette values arrive.

## Changes from Phase 1

- Left/right browser controls now map to camera screen-relative directions; headless `move:[x,z]` continues following the contract's world-space transform.
- The title is one line, `Đảo Đèn Lồng`, with the same heading font and color.
- Phase 1 pulse scoring/carry capacity/lamp cost are replaced by v1.1 values; prior scenarios are recalibrated to v1.1 and retained as regression checks.

## Superseded by Phase 3

Ticket-03 replaces the v1.1 night lengths, fixed carry capacity, lantern scoring, all-lantern early win, and the dawn tie rule. These are now contract 1.2 rules; all other Phase 2 movement, pause, wind, drifter, charm, and shade behavior remains in force unless explicitly changed by Ticket-03.
