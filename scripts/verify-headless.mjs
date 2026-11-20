import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTRACT_VERSION, TUNING } from "../src/sim.js";
import { insertEntry, orderEntries } from "../src/leaderboard.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = join(root, "src", "cli.js");
const scratch = await mkdtemp(join(tmpdir(), "dao-den-long-"));
const node = process.execPath;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run(name, { seed = 19, night = 1, ticks = 120, snapshotEvery = 10, scenario, inputs } = {}) {
  const out = join(scratch, `${name}.jsonl`);
  const args = [cli, "--seed", String(seed), "--night", String(night), "--ticks", String(ticks), "--snapshot-every", String(snapshotEvery), "--out", out];
  if (scenario !== undefined) {
    const path = join(scratch, `${name}.scenario.json`);
    await writeFile(path, JSON.stringify(scenario)); args.push("--scenario", path);
  }
  if (inputs !== undefined) {
    const path = join(scratch, `${name}.inputs.json`);
    await writeFile(path, JSON.stringify(inputs)); args.push("--inputs", path);
  }
  execFileSync(node, args, { cwd: root, stdio: "pipe" });
  const raw = await readFile(out, "utf8");
  return { raw, records: raw.trimEnd().split("\n").map((line) => JSON.parse(line)) };
}

async function main() {
  const contract = JSON.parse(await readFile(join(root, "game.contract.json"), "utf8"));
  assert(JSON.stringify(contract.tuning) === JSON.stringify(TUNING), "game.contract.json tuning does not match src/sim.js");
  assert(contract.contract_version === CONTRACT_VERSION, "game.contract.json version does not match src/sim.js");
  assert(contract.contract_version === "1.3", "contract version must be 1.3");
  assert(contract.bench_cmd && contract.soak_cmd, "contract must declare benchmark and soak commands");
  assert(TUNING.night1_duration_s === 240 && TUNING.night2_duration_s === 270 && TUNING.night3_duration_s === 300, "night durations must match contract 1.2 tuning");
  const scores=orderEntries([
    {name:"late",score:100,nights_won:2,achieved_at:"2026-01-02T00:00:00Z",seed:2},
    {name:"early",score:100,nights_won:1,achieved_at:"2026-01-01T00:00:00Z",seed:1},
  ]);
  assert(scores[0].name==="early"&&insertEntry(scores,{name:"best",score:200,nights_won:3,achieved_at:"2026-01-03T00:00:00Z",seed:3})[0].name==="best","leaderboard ordering or insertion failed");

  const deterministicArgs = { seed: 2026, ticks: 240 };
  const first = await run("determinism-a", deterministicArgs);
  const second = await run("determinism-b", deterministicArgs);
  assert(first.raw === second.raw, "same seed and inputs produced different JSONL output");
  assert(first.records[0].tick === 0, "first record must be the tick 0 snapshot");
  assert(first.records.at(-1).type === "end" && first.records.at(-1).ticks === 240, "end record is missing or has the wrong tick count");
  assert(first.records.some(r => r.type === "event" && r.name === "night_start" && r.tick === 1) && !first.records.some(r => r.type === "event" && r.tick === 0), "night_start must be the first-step event at tick 1");
  for (const [night,position,duration] of [[1,[0,0,0],240],[2,[0,0,0],270],[3,[0,0,-15],300]]) {
    const start = await run(`night-start-${night}`, { night, ticks: 0, snapshotEvery: 1 });
    const snapshot = start.records.find(r => r.type === "snapshot" && r.tick === 0);
    assert(JSON.stringify(snapshot.player.pos) === JSON.stringify(position) && snapshot.time_left_s === duration, `night ${night} start position or timer is incorrect`);
  }
  const invuln = await run("invuln-boolean", { ticks: 1, snapshotEvery: 1, scenario: { random_motes:false, random_shades:false, motes:[], shades:[], player:{invuln_ticks:2} } });
  const invulnStart = invuln.records.find(r => r.type === "snapshot" && r.tick === 0)?.player;
  assert(typeof invulnStart?.invuln === "boolean" && invulnStart.invuln === true && !("invuln_ticks" in invulnStart), "snapshot invuln must be boolean and omit remaining ticks");
  const scenarioSpawn = await run("scenario-shade-spawn", { ticks: 1, snapshotEvery: 1, scenario: { random_motes:false, random_shades:false, motes:[], shades:[{id:"S1",pos:[20,1,0],state:"spawning"}] } });
  assert(scenarioSpawn.records.find(r => r.type === "snapshot" && r.tick === 0)?.shades[0].state === "wander", "scenario-created shades must skip spawning and begin wandering");
  const liveSpawn = await run("live-shade-spawn", { ticks: 361, snapshotEvery: 1, scenario: { random_motes:false, random_shades:false, motes:[], shades:[] } });
  assert(liveSpawn.records.find(r => r.type === "snapshot" && r.tick === 300)?.shades[0].state === "spawning" && liveSpawn.records.find(r => r.type === "snapshot" && r.tick === 360)?.shades[0].state === "wander", "live shades must spawn for 60 ticks before wandering");

  const empty = { random_motes: false, random_shades: false, motes: [[0,0,0.5]], shades: [] };
  const pickup = await run("pickup", { ticks: 2, scenario: empty });
  assert(pickup.records.some((r) => r.type === "event" && r.name === "mote_picked" && r.tick === 1), "mote pickup event missing");

  const movement = await run("movement", { ticks: 1, snapshotEvery: 1, scenario: { random_motes: false, random_shades: false, motes: [], shades: [] }, inputs: { frames: [{ tick: 0, move: [1,0] }] } });
  assert(movement.records.some((r) => r.type === "snapshot" && r.tick === 1 && r.player.pos[0] === 0.083), "movement speed or fixed tick is incorrect");

  const lanternScenario = { random_motes: false, random_shades: false, motes: [], shades: [], player: { pos: [0,0,0], carried: 10, flames: 3 }, lanterns: [{ id: "L1", pos: [0,0,0] }] };
  const lanterns = await run("lantern", { ticks: 2, scenario: lanternScenario, inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] } });
  assert(lanterns.records.some((r) => r.type === "event" && r.name === "deposit" && r.data.amount === 10), "deposit event missing");
  assert(lanterns.records.some((r) => r.type === "event" && r.name === "lantern_lit" && r.data.lantern_id === "L1"), "lantern_lit event missing");

  const heldInteract = await run("held-interact", { ticks: 24, scenario: { random_motes: false, random_shades: false, motes: [], shades: [], player: { pos: [0,0,-4], carried: 10 }, lanterns: [{ id: "L1", pos: [0,0,0] }] }, inputs: { frames: [{ tick: 0, move: [0,1], interact: true }] } });
  assert(heldInteract.records.some((r) => r.type === "event" && r.name === "lantern_lit" && r.data.lantern_id === "L1"), "holding interact while approaching a lantern should light it on entry");

  const pulseScenario = { random_motes: false, random_shades: false, motes: [], shades: [{ id: "S1", pos: [3,0,0] }], player: { pos: [0,0,0], carried: 2, flames: 3 } };
  const pulse = await run("pulse", { ticks: 2, snapshotEvery: 1, scenario: pulseScenario, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert(pulse.records.some((r) => r.type === "event" && r.name === "pulse" && r.data.stunned_ids.includes("S1")), "pulse event/stun missing");
  assert(pulse.records.some((r) => r.type === "snapshot" && r.shades?.[0]?.state === "stunned"), "stunned shade state missing from snapshot");
  const wandering = await run("shade-wander", { ticks: 120, snapshotEvery: 120, scenario: { random_motes: false, random_shades: false, motes: [], shades: [{ id: "S1", pos: [20,1,0], state: "wander" }] } });
  const shadeStart = wandering.records.find((r) => r.type === "snapshot" && r.tick === 0)?.shades[0].pos;
  const shadeEnd = wandering.records.find((r) => r.type === "snapshot" && r.tick === 120)?.shades[0].pos;
  assert(Math.hypot(shadeEnd[0]-shadeStart[0],shadeEnd[2]-shadeStart[2]) > 1.5, "a shade outside detection range should visibly patrol while wandering");
  const stunDuration = await run("stun-duration", { ticks: 152, snapshotEvery: 1, scenario: pulseScenario, inputs: { frames: [{ tick: 0, pulse: true }] } });
  const stunAt = (tick) => stunDuration.records.find((r) => r.type === "snapshot" && r.tick === tick)?.shades?.[0]?.state;
  assert(stunAt(150) === "stunned" && stunAt(151) === "chase", "stun should last exactly pulse_stun_s after the pulse tick");

  const hitScenario = { random_motes: false, random_shades: false, motes: [], shades: [{ id: "S1", pos: [0,0,0] }], player: { pos: [0,0,0], carried: 4, flames: 3 } };
  const hit = await run("hit", { ticks: 2, snapshotEvery: 1, scenario: hitScenario });
  assert(hit.records.some((r) => r.type === "event" && r.name === "player_hit" && r.data.by === "shade" && r.data.flames === 2 && r.data.dropped === 2), "shade hit, damage, or drop event is incorrect");

  const lanternPositions = Array.from({ length: 5 }, (_, i) => ({ id: `L${i+1}`, pos: [0,0,0] }));
  const noEarlyWin = await run("no-early-win", { ticks: 2, snapshotEvery: 1, scenario: { random_motes:false,random_shades:false,motes:[],shades:[],lanterns:lanternPositions.map(l=>({...l,lit:true})) } });
  assert(noEarlyWin.records.at(-1).state === "playing", "lighting every lantern must not end a night before dawn");
  const dawnWinScenario={random_motes:false,random_shades:false,motes:[],shades:[],time_left_s:1/60,lanterns:lanternPositions.slice(0,3).map(l=>({...l,lit:true,fuel:80}))};
  const dawnWin=await run("dawn-win",{ticks:2,snapshotEvery:1,scenario:dawnWinScenario});
  assert(dawnWin.records.at(-1).state==="won"&&dawnWin.records.some(r=>r.name==="game_over"&&r.data.reason==="dawn_survived"),"three of five lit lanterns should win at dawn");
  const dawnLoss=await run("dawn-loss",{ticks:2,scenario:{random_motes:false,random_shades:false,motes:[],shades:[],time_left_s:1/60,lanterns:lanternPositions.slice(0,2).map(l=>({...l,lit:true}))}});
  assert(dawnLoss.records.at(-1).state==="lost"&&dawnLoss.records.some(r=>r.name==="game_over"&&r.data.reason==="dawn"),"fewer than three lit lanterns should lose at dawn");
  for(const [night,total,required] of [[2,6,4],[3,7,5]]){const positions=Array.from({length:required},(_,i)=>({id:`L${i+1}`,lit:true}));const dawn=await run(`dawn-night-${night}`,{night,ticks:2,scenario:{random_motes:false,random_shades:false,motes:[],shades:[],time_left_s:1/60,lanterns:positions}});assert(dawn.records.at(-1).state==="won",`night ${night} should require ${required} of ${total} lanterns at dawn`);}
  const lastTickPriority=await run("no-flames-at-dawn",{ticks:2,scenario:{random_motes:false,random_shades:false,motes:[],shades:[],time_left_s:1/60,player:{flames:0},lanterns:lanternPositions.slice(0,3).map(l=>({...l,lit:true}))}});
  assert(lastTickPriority.records.at(-1).state==="lost"&&lastTickPriority.records.some(r=>r.name==="game_over"&&r.data.reason==="no_flames"),"no_flames must take priority over dawn on the final tick");

  const initiallyLit=await run("fuel-decay",{ticks:60,snapshotEvery:60,scenario:{random_motes:false,random_shades:false,motes:[],shades:[],lanterns:[{id:"L1",lit:true,fuel:50}]}});
  assert(initiallyLit.records.find(r=>r.type==="snapshot"&&r.tick===60).lanterns[0].fuel===49,"lantern fuel must decay by one per second");
  const lanternOut=await run("lantern-out",{ticks:1,snapshotEvery:1,scenario:{random_motes:false,random_shades:false,motes:[],shades:[],lanterns:[{id:"L1",lit:true,fuel:1/60}]}});
  assert(lanternOut.records.some(r=>r.name==="lantern_out"&&r.data.lantern_id==="L1")&&lanternOut.records.find(r=>r.type==="snapshot"&&r.tick===1).lanterns[0].fuel===0,"empty fuel must turn a lantern off and emit lantern_out");
  const refill=await run("refuel",{ticks:2,snapshotEvery:1,scenario:{random_motes:false,random_shades:false,motes:[],shades:[],player:{pos:[0,0,0],carried:2},lanterns:[{id:"L1",pos:[0,0,0],lit:true,fuel:85}]},inputs:{frames:[{tick:0,interact:true}]}});
  assert(refill.records.some(r=>r.name==="refuel"&&r.data.amount===2&&r.data.fuel===100),"refueling must use the ceiling mote cost and cap fuel at 100");
  const drain=await run("shade-drain",{ticks:62,snapshotEvery:1,scenario:{random_motes:false,random_shades:false,motes:[],shades:[{id:"S1",pos:[1,0,0],state:"wander"}],player:{pos:[10,0,0]},lanterns:[{id:"L1",pos:[0,0,0],lit:true,fuel:20}]}});
  assert(drain.records.some(r=>r.type==="snapshot"&&r.tick===1&&r.shades[0].state==="drain"),"wandering shade should drain the nearest weak lantern within two meters");
  assert(drain.records.some(r=>r.name==="fuel_drain"&&r.data.shade_id==="S1"),"draining shade should emit fuel_drain every 60 ticks");
  const relight=await run("relight",{ticks:2,snapshotEvery:1,scenario:{random_motes:false,random_shades:false,motes:[],shades:[],player:{carried:5},lanterns:[{id:"L1",pos:[0,0,0],lit:false,ever_lit:true}]},inputs:{frames:[{tick:0,interact:true}]}});
  assert(relight.records.some(r=>r.name==="lantern_lit"&&r.data.relight===true)&&relight.records.find(r=>r.type==="snapshot"&&r.tick===1).player.capacity===12,"relight should cost five motes and raise capacity after a successful light");
  const drainPulse=await run("drain-pulse-score",{ticks:1,scenario:{random_motes:false,random_shades:false,motes:[],player:{carried:2},shades:[{id:"S1",pos:[3,0,0],state:"drain",target_lantern_id:"L1"}],lanterns:[{id:"L1",pos:[4,0,0],lit:true,fuel:20}]},inputs:{frames:[{tick:0,pulse:true}]}});
  assert(drainPulse.records.at(-1).score===15,"pulsing a draining shade should award 15 points");

  const loss = await run("loss", { ticks: 2, scenario: { random_motes: false, random_shades: false, motes: [], shades: [], player: { flames: 0 } } });
  assert(loss.records.at(-1).state === "lost" && loss.records.some((r) => r.type === "event" && r.name === "game_over" && r.data.reason === "no_flames"), "zero flames should produce a no_flames loss");

  const dash = await run("dash", { ticks: 2, snapshotEvery: 1, scenario: { random_motes: false, random_shades: false, motes: [], shades: [] }, inputs: { frames: [{ tick: 0, move: [0,1], dash: true }, { tick: 1, dash: false }] } });
  assert(dash.records.some((r) => r.type === "event" && r.name === "dash"), "dash event missing");
  assert(dash.records.some((r) => r.type === "snapshot" && r.tick === 1 && r.player.pos[2] > 0.2), "dash movement or velocity incorrect");

  const paused = await run("paused", { ticks: 3, snapshotEvery: 1, scenario: { random_motes: false, random_shades: false, motes: [], shades: [] }, inputs: { frames: [{ tick: 0, pause: true, move: [0,1] }, { tick: 1, pause: false }, { tick: 2, pause: true }] } });
  const pausedAt1 = paused.records.find((r) => r.type === "snapshot" && r.tick === 1);
  assert(pausedAt1?.state === "paused" && pausedAt1.sim_tick === 0 && pausedAt1.time_left_s === TUNING.night1_duration_s, "pause should freeze simulation timers and movement");
  assert(paused.records.some((r) => r.type === "snapshot" && r.tick === 3 && r.state === "playing" && r.sim_tick === 1), "resume should continue simulation");

  const drifter = await run("drifter", { night: 2, ticks: 2, snapshotEvery: 1, scenario: { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [], player: { carried: 5 }, drifters: [{ id: "D1", pos: [1,0,0], state: "chase" }] } });
  assert(drifter.records.some((r) => r.type === "event" && r.name === "drifter_steal" && r.data.amount === 3), "drifter should steal three carried motes on contact");

  const charm = await run("charm", { night: 2, ticks: 2, scenario: { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [], charms: [{ id: "C1", pos: [0,0,0] }] } });
  assert(charm.records.some((r) => r.type === "event" && r.name === "charm_picked"), "wind charm pickup event missing");

  const wind = await run("wind", { night: 3, ticks: 1801, snapshotEvery: 1, scenario: { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [], wind_enabled: true } });
  assert(wind.records.some((r) => r.type === "snapshot" && r.tick === 1800 && r.wind.active), "night 3 scheduled wind should activate at 30 seconds");

  const invalidPath = join(scratch, "invalid.json");
  const out = join(scratch, "invalid-out.jsonl");
  await writeFile(invalidPath, "{bad json");
  const invalid = spawnSync(node, [cli,"--seed","1","--night","1","--ticks","1","--out",out,"--scenario",invalidPath], { cwd: root, encoding: "utf8" });
  assert(invalid.status === 2 && invalid.stderr.trim().length > 0, "malformed scenario must fail with code 2 and stderr message");

  process.stdout.write("PASS: contract 1.3, night starts/timers, tick-1 night_start, invulnerability snapshot, shade spawning, determinism, movement, pickup, fuel/refuel/relight/drain, dawn win/loss, pulse/stun, hit/drop, dash, pause/resume, drifter, charm, wind, JSONL end, invalid scenario exit code\n");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}).finally(async () => {
  await rm(scratch, { recursive: true, force: true });
});
