#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

function parse(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--") || args.has(key) || argv[i + 1] === undefined) throw new Error("Usage: npm run bench -- --seed 42 --duration 30 --out bench.json");
    args.set(key, argv[i + 1]);
  }
  const seed = Number(args.get("--seed")), duration = Number(args.get("--duration")), out = args.get("--out");
  if (seed !== 42 || !Number.isFinite(duration) || duration < 1 || !out || [...args.keys()].some(key => !["--seed","--duration","--out"].includes(key))) throw new Error("Benchmark uses the standard scene seed 42; duration must be positive and --out is required");
  return { seed, duration, out: resolve(out) };
}

function findBrowser() {
  const candidates=[process.env.CHROME_PATH,process.env.EDGE_PATH,"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe","/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
  for(const candidate of candidates){const probe=spawnSync(candidate,["--version"],{encoding:"utf8",windowsHide:true});if(probe.status===0)return candidate;}
  throw new Error("Chrome or Edge was not found. Set CHROME_PATH to its executable.");
}

async function freePorts(count) {
  const servers=await Promise.all(Array.from({length:count},async()=>{const server=createServer();await new Promise(resolvePromise=>server.listen(0,"127.0.0.1",resolvePromise));return server;}));
  const ports=servers.map(server=>server.address().port);await Promise.all(servers.map(server=>new Promise(resolvePromise=>server.close(resolvePromise))));return ports;
}
async function waitFor(test,timeoutMs,label) {
  const until=Date.now()+timeoutMs;let lastError;
  while(Date.now()<until){try{const value=await test();if(value)return value;}catch(error){lastError=error;}await new Promise(resolvePromise=>setTimeout(resolvePromise,150));}
  throw new Error(`Timed out waiting for ${label}${lastError?`: ${lastError.message}`:""}`);
}
async function getJson(url) {const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}
function readProcessRssMb(pid) {
  if(process.platform==="win32"){
    const result=spawnSync("powershell.exe",["-NoProfile","-Command",`$p=Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue; if($p){[math]::Round($p.WorkingSet64/1MB,1)}`],{encoding:"utf8",windowsHide:true});
    const raw=result.stdout.trim();if(!raw)return null;const value=Number(raw);return Number.isFinite(value)?value:null;
  }
  const result=spawnSync("ps",["-o","rss=","-p",String(pid)],{encoding:"utf8"});const value=Number(result.stdout.trim())/1024;return Number.isFinite(value)?value:null;
}
function closeProcess(child) {
  if(!child?.pid)return;
  if(process.platform==="win32")spawnSync("taskkill.exe",["/pid",String(child.pid),"/t","/f"],{stdio:"ignore",windowsHide:true,timeout:3000});
  else child.kill("SIGTERM");
}

async function main() {
  const {seed,duration,out}=parse(process.argv.slice(2)),startedAt=Date.now(),[port]=await freePorts(1),profile=await mkdtemp(join(tmpdir(),"dao-den-long-bench-")),profiles=[profile],root=fileURLToPath(new URL("..",import.meta.url));
  await mkdir(dirname(out),{recursive:true});
  const server=spawn(process.execPath,["server.mjs"],{cwd:root,env:{...process.env,PORT:String(port),BENCH_LOG:"1"},stdio:"inherit",windowsHide:true});
  let browser,memPeak=0;
  const memoryTimer=setInterval(()=>{const rss=browser?.pid?readProcessRssMb(browser.pid):null;if(rss!==null)memPeak=Math.max(memPeak,rss);},500);
  try {
    await waitFor(async()=>{try{return await getJson(`http://127.0.0.1:${port}/api/leaderboard`);}catch{return null;}},10000,"the game server");
    const chrome=findBrowser(),url=`http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}&started_at=${startedAt}`;
    const browserArgs=(dataDir,software=false)=>[`--user-data-dir=${dataDir}`,"--no-first-run","--no-default-browser-check","--disable-extensions","--disable-background-networking","--disable-frame-rate-limit","--disable-gpu-vsync","--disable-background-timer-throttling","--disable-renderer-backgrounding","--disable-features=CalculateNativeWinOcclusion","--window-size=1280,720","--force-device-scale-factor=1",...(software?["--disable-gpu-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]:[]),"--new-window",url];
    process.stderr.write("[bench] Starting visible Chrome window with hardware renderer\n");browser=spawn(chrome,browserArgs(profile),{stdio:"inherit"});
    const checkReady=async()=>{const status=await getJson(`http://127.0.0.1:${port}/api/benchmark`);return status.error||status.ready;};
    try{const ready=await waitFor(checkReady,12000,"the hardware-rendered benchmark scene");if(ready!==true)throw new Error(ready);}
    catch{
      process.stderr.write("[bench] Hardware renderer did not initialize; retrying with SwiftShader\n");
      closeProcess(browser);await new Promise(resolvePromise=>setTimeout(resolvePromise,400));
      const fallbackProfile=await mkdtemp(join(tmpdir(),"dao-den-long-bench-swiftshader-"));profiles.push(fallbackProfile);
      browser=spawn(chrome,browserArgs(fallbackProfile,true),{stdio:"inherit"});
      const ready=await waitFor(checkReady,25000,"the SwiftShader benchmark scene");if(ready!==true)throw new Error(ready);
    }
    process.stderr.write("[bench] Scene rendered; waiting for timed result\n");
    const report=await waitFor(async()=> (await getJson(`http://127.0.0.1:${port}/api/benchmark`)).report,duration*1000+45000,"the benchmark result");
    const finished={...report,peak_mem_mb:Math.round(memPeak*10)/10,vsync_off:true,os:process.platform==="win32"?"Windows":process.platform};
    await writeFile(out,`${JSON.stringify(finished,null,2)}\n`,"utf8");process.stdout.write(`${JSON.stringify(finished)}\n`);
  } finally {
    clearInterval(memoryTimer);closeProcess(browser);closeProcess(server);
    await new Promise(resolvePromise=>setTimeout(resolvePromise,400));
    for(const dataDir of profiles)if(dataDir.startsWith(tmpdir()))try{await rm(dataDir,{recursive:true,force:true,maxRetries:3,retryDelay:300});}catch{}
  }
}

main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1;});
