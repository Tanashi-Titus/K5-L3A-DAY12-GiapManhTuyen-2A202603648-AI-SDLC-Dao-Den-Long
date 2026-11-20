#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createGame, gameEvents, seededRandom, stepGame } from "../src/sim.js";

function parse(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--") || args.has(key) || argv[i + 1] === undefined) throw new Error("Usage: node scripts/soak.mjs --seed 7 --nights 10 --out soak.json");
    args.set(key, argv[i + 1]);
  }
  const seed = Number(args.get("--seed")), nights = Number(args.get("--nights")), out = args.get("--out");
  if (!Number.isSafeInteger(seed) || !Number.isInteger(nights) || nights < 1 || !out || args.size !== 3) throw new Error("Invalid soak arguments");
  return { seed, nights, out: resolve(out) };
}

async function main() {
  const { seed, nights, out } = parse(process.argv.slice(2));
  const started = performance.now(), results = [];
  let memStart = null, game = null, crashes = 0;
  try {
    for (let index = 0; index < nights; index++) {
      const nightSeed = seed + index;
      const night = index % 3 + 1;
      game = createGame({ seed: nightSeed, night });
      gameEvents(game);
      if (memStart === null) memStart = process.memoryUsage.rss() / 1048576;
      const random = seededRandom((nightSeed ^ 0x51a7) >>> 0);
      let move = [0, 0];
      const maxTicks = game.duration * 60;
      for (let tick = 0; tick < maxTicks && game.state === "playing"; tick++) {
        if (tick % 30 === 0) {
          const directions = [[0,0],[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,-1],[-1,1]];
          move = directions[Math.floor(random() * directions.length)];
        }
        game.controls.move = move;
        game.controls.jump = random() < 0.05;
        game.controls.dash = random() < 0.03;
        game.controls.pulse = random() < 0.02;
        game.controls.interact = random() < 0.10;
        stepGame(game);
        gameEvents(game);
        if ((tick + 1) % 600 === 0) global.gc?.();
      }
      if (!["won", "lost"].includes(game.state)) throw new Error(`Night ${index + 1} did not end`);
      results.push(game.state);
      game = null;
    }
    global.gc?.();
    const memEnd = process.memoryUsage.rss() / 1048576;
    const result = { nights, crashes, results, mem_start_mb: round1(memStart ?? 0), mem_end_mb: round1(memEnd), duration_s: round1((performance.now() - started) / 1000) };
    await writeFile(out, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    crashes++;
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

function round1(value) { return Math.round(value * 10) / 10; }
main();
