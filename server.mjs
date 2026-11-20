import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { extname, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { orderEntries, insertEntry } from "./src/leaderboard.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const leaderboardPath = resolve(root, "data", "leaderboard.json");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };

async function loadEntries() {
  try {
    const parsed = JSON.parse(await readFile(leaderboardPath, "utf8"));
    return orderEntries(Array.isArray(parsed.entries) ? parsed.entries : []);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function saveEntry(entry) {
  const entries = insertEntry(await loadEntries(), entry);
  await mkdir(dirname(leaderboardPath), { recursive: true });
  const temp = `${leaderboardPath}.tmp`;
  await writeFile(temp, `${JSON.stringify({ entries }, null, 2)}\n`, "utf8");
  await rename(temp, leaderboardPath);
  return entries;
}

async function exportLeaderboard(path) {
  const target = resolve(process.cwd(), path);
  await writeFile(target, `${JSON.stringify({ entries: await loadEntries() }, null, 2)}\n`, "utf8");
  process.stdout.write(`Exported ${target}\n`);
}

const exportAt = process.argv.indexOf("--export-leaderboard");
if (exportAt >= 0) {
  const output = process.argv[exportAt + 1];
  if (!output || output.startsWith("--") || process.argv.length !== exportAt + 2) {
    process.stderr.write("Usage: node server.mjs --export-leaderboard out.json\n");
    process.exitCode = 2;
  } else {
    await exportLeaderboard(output).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
  }
} else {
  let latestBenchReport = null, benchmarkReady = false, benchmarkError = null;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (process.env.BENCH_LOG === "1") process.stderr.write(`[server] ${req.method} ${url.pathname}\n`);
      if (url.pathname === "/api/leaderboard" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ entries: await loadEntries() }));
        return;
      }
      if (url.pathname === "/api/benchmark" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) { body += chunk; if (body.length > 16384) throw new Error("Request is too large"); }
        const report = JSON.parse(body);
        if (report.contract_version !== "1.3" || !Number.isFinite(report.avg_fps) || !Number.isFinite(report.frames)) throw new TypeError("Invalid benchmark report");
        latestBenchReport = report;
        res.writeHead(204); res.end(); return;
      }
      if (url.pathname === "/api/benchmark" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ report: latestBenchReport, ready: benchmarkReady, error: benchmarkError })); return;
      }
      if (url.pathname === "/api/benchmark-ready" && req.method === "POST") { benchmarkReady = true; res.writeHead(204); res.end(); return; }
      if (url.pathname === "/api/benchmark-error" && req.method === "POST") { let body=""; for await (const chunk of req) body+=chunk; benchmarkError=body.slice(0,1000); res.writeHead(204); res.end(); return; }
      if (url.pathname === "/api/leaderboard" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 8192) throw new Error("Request is too large");
        }
        const input = JSON.parse(body);
        const entries = await saveEntry(input.entry);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ entries }));
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      const requested = pathname === "/" ? "/index.html" : pathname;
      const path = resolve(root, `.${requested}`);
      if (path !== root && !path.startsWith(root + sep)) throw new Error("Not found");
      const body = await readFile(path);
      res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(body);
    } catch (error) {
      const status = error.message === "Not found" ? 404 : error instanceof SyntaxError || error instanceof TypeError ? 400 : 500;
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: status === 404 ? "Not found" : error.message }));
    }
  });
  server.listen(port, "127.0.0.1", () => process.stdout.write(`Dao Den Long is ready at http://localhost:${port}\n`));
}
