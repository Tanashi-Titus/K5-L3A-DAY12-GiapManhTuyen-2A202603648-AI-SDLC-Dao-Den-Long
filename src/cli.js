#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { applyInputFrame, createGame, endRecord, gameEvents, ScenarioError, snapshot, stepGame } from "./sim.js";

function usageError(message) {
  const error = new Error(message);
  error.exitCode = 1;
  throw error;
}

function parseArgs(argv) {
  const values = new Map();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) usageError(`Unexpected argument: ${key}`);
    if (values.has(key)) usageError(`Duplicate option: ${key}`);
    if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) usageError(`Missing value for ${key}`);
    values.set(key, argv[++i]);
  }
  for (const key of values.keys()) if (!["--seed", "--night", "--scenario", "--inputs", "--ticks", "--out", "--snapshot-every"].includes(key)) usageError(`Unknown option: ${key}`);
  const required = ["--seed", "--night", "--ticks", "--out"];
  for (const key of required) if (!values.has(key)) usageError(`Missing required option ${key}`);
  const int = (key, fallback, allowNegative = false) => {
    if (!values.has(key)) return fallback;
    const n = Number(values.get(key));
    if (!Number.isSafeInteger(n) || (!allowNegative && n < 0)) usageError(`${key} must be a ${allowNegative ? "integer" : "non-negative integer"}`);
    return n;
  };
  const seed = int("--seed", undefined, true);
  const ticks = int("--ticks");
  const snapshotEvery = int("--snapshot-every", 10);
  if (snapshotEvery < 1) usageError("--snapshot-every must be at least 1");
  const night = Number(values.get("--night"));
  if (![1, 2, 3].includes(night)) usageError("--night must be 1, 2, or 3");
  return { seed, ticks, snapshotEvery, night, scenarioPath: values.get("--scenario"), inputsPath: values.get("--inputs"), outPath: values.get("--out") };
}

async function readJson(path, label) {
  if (!path) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new ScenarioError(`Cannot read ${label} file ${path}: ${error.message}`);
  }
}

function validateFrames(inputs) {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs) || !Array.isArray(inputs.frames)) throw new ScenarioError("inputs file must contain a frames array");
  let previous = -1;
  for (const frame of inputs.frames) {
    if (!frame || typeof frame !== "object" || Array.isArray(frame) || !Number.isInteger(frame.tick) || frame.tick < 0) throw new ScenarioError("each input frame needs a non-negative integer tick");
    if (frame.tick <= previous) throw new ScenarioError("input frame ticks must increase strictly");
    previous = frame.tick;
    applyInputFrame({ controls: { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false } }, frame);
  }
  return inputs.frames;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [scenario, inputsFile] = await Promise.all([readJson(args.scenarioPath, "scenario"), readJson(args.inputsPath, "inputs")]);
  const frames = inputsFile ? validateFrames(inputsFile) : [];
  const game = createGame({ seed: args.seed, night: args.night, scenario });
  const lines = [snapshot(game), ...gameEvents(game)];
  let frameIndex = 0;
  while (game.tick < args.ticks && (game.state === "playing" || game.state === "paused")) {
    while (frameIndex < frames.length && frames[frameIndex].tick === game.tick) applyInputFrame(game, frames[frameIndex++]);
    stepGame(game);
    lines.push(...gameEvents(game));
    if (game.tick % args.snapshotEvery === 0) lines.push(snapshot(game));
  }
  lines.push(endRecord(game));
  await writeFile(args.outPath, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error.exitCode ?? (error instanceof ScenarioError ? 2 : 1);
});
