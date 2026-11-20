import { createGame, gameEvents, seededRandom, stepGame } from "./sim.js";
import { Renderer } from "./renderer.js";
import { GameAudio } from "./audio.js";

const $ = (id) => document.getElementById(id);
const canvas = $("scene"), keys = new Set();
const params = new URLSearchParams(location.search);
const benchMode = params.get("bench") === "1";
if(benchMode){const reportError=message=>fetch("/api/benchmark-error",{method:"POST",body:String(message).slice(0,1000),keepalive:true}).catch(()=>{});window.addEventListener("error",event=>reportError(event.message));window.addEventListener("unhandledrejection",event=>reportError(event.reason?.message||event.reason));}
const benchDuration = Math.max(1, Number(params.get("duration")) || 30);
const benchHostStartedAt = Number(params.get("started_at")) || Date.now();
const DEFAULT_BINDINGS = Object.freeze({ up:"KeyW", down:"KeyS", left:"KeyA", right:"KeyD", jump:"Space", dash:"ShiftLeft", interact:"KeyE", pulse:"KeyQ", pause:"Escape" });
const ACTION_LABELS = { up:"Tiến", down:"Lùi", left:"Sang trái", right:"Sang phải", jump:"Nhảy", dash:"Lướt", interact:"Tương tác", pulse:"Tỏa sáng", pause:"Tạm dừng" };
const CODE_LABELS = { Space:"Space", Escape:"Esc", ShiftLeft:"Shift trái", ShiftRight:"Shift phải", ArrowUp:"↑", ArrowDown:"↓", ArrowLeft:"←", ArrowRight:"→", Enter:"Enter", Backspace:"Backspace", Tab:"Tab" };
const readBindings = () => {
  try { const saved = JSON.parse(localStorage.getItem("dd bindings") || "{}"); return { ...DEFAULT_BINDINGS, ...saved }; }
  catch { return { ...DEFAULT_BINDINGS }; }
};
const getPreference = (key, fallback=false) => localStorage.getItem(key) === null ? fallback : localStorage.getItem(key) === "true";
let bindings = readBindings(), remapping = null, renderer, yaw = 0, started = false, previousTime = 0, accumulator = 0, lastHud = 0;
let toastTimer = 0, nextSeed = Math.floor(Date.now() % 2147483646) + 1, dragging = null, stickPointer = null, stickVector = [0,0];
let nightBaseScore = 0, runSeed = 1, currentSeed = 1, nightsWon = 0, resultSaved = false, resultScore = 0;
let sensitivity = Number(localStorage.getItem("dd sensitivity") || .004), volume = Number(localStorage.getItem("dd volume") || .45);
let colorblind = getPreference("dd colorblind"), reduceMotion = getPreference("dd reduce motion"), largeText = getPreference("dd large text");
let shadeWarnUntil = 0, lastCountdownMark = 10;
const audio = new GameAudio(volume);
const held = { jump:false, interact:false, pulse:false, dash:false, pause:false };

function makeBenchmarkScenario() {
  const random = seededRandom(42);
  const point = radius => { const angle=random()*Math.PI*2, r=Math.sqrt(random())*radius; return [Math.cos(angle)*r,0,Math.sin(angle)*r]; };
  return {
    random_motes:false, random_shades:false, random_drifters:false,
    motes:Array.from({length:100},(_,i)=>({id:`BM${i+1}`,pos:point(39),kind:"random"})),
    shades:Array.from({length:200},(_,i)=>{const [x,,z]=point(37);return{id:`BS${i+1}`,pos:[x,1,z],state:"wander",wanderOrigin:[x,z],wanderRadius:2.8,wanderDirection:random()<.5?-1:1,wanderSpeed:1.8,wanderPhase:random()*Math.PI*2};}),
    lanterns:[{id:"L1",lit:true,fuel:100},{id:"L2",lit:true,fuel:100},{id:"L3",lit:true,fuel:100}],
  };
}
let game = benchMode ? createGame({ seed:42, night:1, scenario:makeBenchmarkScenario() }) : createGame({ seed:1 });
game.benchmarkMode=benchMode;
try { renderer = new Renderer(canvas); } catch(error) { if(benchMode)fetch("/api/benchmark-error",{method:"POST",body:error.message,keepalive:true}).catch(()=>{});$("render-error").hidden=false; $("render-error").textContent=`Không thể mở đồ họa 3D: ${error.message}. Hãy dùng trình duyệt có hỗ trợ WebGL.`; }

function hideScreens(){ for(const id of ["start-screen","pause-screen","end-screen","leaderboard-screen"]) $(id).classList.remove("active"); }
function freshSeed(){ nextSeed=(nextSeed+0x9e3779b9)>>>0; return nextSeed; }
function startNight(night=1, carryScore=0, seed=freshSeed()){
  audio.unlock(); currentSeed=seed; game=createGame({seed,night}); nightBaseScore=carryScore; yaw=0; accumulator=0; started=true; resultSaved=false;
  hideScreens(); $("night-label").textContent=`ĐÊM ${night} · ${["ĐẢO BẾN","HAI BỜ","ĐẢO TẦNG"][night-1]}`; updateHud(performance.now(),true);
}
function beginGame(){ nightsWon=0; runSeed=freshSeed(); startNight(1,0,runSeed); }
if(!benchMode){
  $("start-button").addEventListener("click",beginGame);
  $("restart-button").addEventListener("click",()=>startNight(game.night,nightBaseScore));
  $("next-night-button").addEventListener("click",()=>{ if(game.night<3){ nightsWon=game.night; startNight(game.night+1,nightBaseScore+game.score); } });
}
function togglePause(){ if(!started||!["playing","paused"].includes(game.state))return; held.pause=true; }
if(!benchMode){
  $("resume-button").addEventListener("click",()=>{if(game.state==="paused")togglePause();});
  $("pause-restart").addEventListener("click",()=>startNight(game.night,nightBaseScore));
  $("main-menu-button").addEventListener("click",()=>{started=false;hideScreens();$("start-screen").classList.add("active");});
  $("settings-button").addEventListener("click",()=>{$("settings-row").hidden=!$("settings-row").hidden;});
}

$("volume-setting").value=volume; $("sensitivity-setting").value=sensitivity;
$("colorblind-setting").checked=colorblind; $("reduce-motion-setting").checked=reduceMotion; $("large-text-setting").checked=largeText;
document.body.classList.toggle("colorblind",colorblind); document.body.classList.toggle("reduce-motion",reduceMotion); document.body.classList.toggle("large-text",largeText);
$("volume-setting").addEventListener("input",e=>{volume=Number(e.target.value);localStorage.setItem("dd volume",volume);audio.setVolume(volume);});
$("sensitivity-setting").addEventListener("input",e=>{sensitivity=Number(e.target.value);localStorage.setItem("dd sensitivity",sensitivity);});
$("colorblind-setting").addEventListener("change",e=>{colorblind=e.target.checked;localStorage.setItem("dd colorblind",String(colorblind));document.body.classList.toggle("colorblind",colorblind);if(renderer)renderer.colorblind=colorblind;});
$("reduce-motion-setting").addEventListener("change",e=>{reduceMotion=e.target.checked;localStorage.setItem("dd reduce motion",String(reduceMotion));document.body.classList.toggle("reduce-motion",reduceMotion);if(renderer)renderer.reduceMotion=reduceMotion;});
$("large-text-setting").addEventListener("change",e=>{largeText=e.target.checked;localStorage.setItem("dd large text",String(largeText));document.body.classList.toggle("large-text",largeText);});
if(renderer){renderer.colorblind=colorblind;renderer.reduceMotion=reduceMotion;}

function codeLabel(code){return CODE_LABELS[code]||code.replace(/^Key/,"").replace(/^Digit/,"");}
function renderBindings(){
  const host=$("key-bindings"); host.replaceChildren();
  for(const[action,label]of Object.entries(ACTION_LABELS)){
    const row=document.createElement("div"),caption=document.createElement("span"),button=document.createElement("button");
    caption.textContent=label; button.type="button";button.className="secondary binding-button";button.dataset.action=action;
    button.textContent=remapping===action?"Nhấn phím…":codeLabel(bindings[action]);button.setAttribute("aria-label",`${label}: ${button.textContent}. Chọn để đổi phím`);
    button.addEventListener("click",()=>{remapping=action;$("binding-message").textContent=`Nhấn phím mới cho “${label}”.`;renderBindings();button.focus();});
    row.append(caption,button);host.append(row);
  }
}
renderBindings();
$("reset-bindings").addEventListener("click",()=>{bindings={...DEFAULT_BINDINGS};remapping=null;localStorage.setItem("dd bindings",JSON.stringify(bindings));$("binding-message").textContent="Đã khôi phục phím mặc định.";renderBindings();});
function actionForCode(code){return Object.keys(bindings).find(action=>bindings[action]===code);}
window.addEventListener("keydown",event=>{
  const code=event.code||event.key.toLowerCase();
  if(remapping){event.preventDefault();const conflict=Object.entries(bindings).find(([action,bound])=>action!==remapping&&bound===code);
    if(conflict){$("binding-message").textContent=`Phím ${codeLabel(code)} đang dùng cho “${ACTION_LABELS[conflict[0]]}”. Hãy chọn phím khác.`;return;}
    bindings[remapping]=code;localStorage.setItem("dd bindings",JSON.stringify(bindings));$("binding-message").textContent=`Đã gán “${ACTION_LABELS[remapping]}” cho ${codeLabel(code)}.`;remapping=null;renderBindings();return;
  }
  if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(code))event.preventDefault();
  if(!keys.has(code)){
    keys.add(code);const action=actionForCode(code);
    if(action==="jump")held.jump=true;if(action==="interact")held.interact=true;if(action==="pulse")held.pulse=true;if(action==="dash")held.dash=true;if(action==="pause")togglePause();
    if((code==="KeyP"||code==="Escape")&&action!=="pause")togglePause();
    if(code==="KeyR"&&game.state!=="playing"&&started)startNight(game.night,nightBaseScore);
  }
},{passive:false});
window.addEventListener("keyup",event=>{const code=event.code||event.key.toLowerCase();keys.delete(code);const action=actionForCode(code);if(action==="jump")held.jump=false;if(action==="interact")held.interact=false;if(action==="pulse")held.pulse=false;if(action==="dash")held.dash=false;if(action==="pause")held.pause=false;});
window.addEventListener("blur",()=>{keys.clear();held.jump=held.interact=held.pulse=held.dash=held.pause=false;stickVector=[0,0];});
canvas.addEventListener("pointerdown",event=>{if(event.pointerType==="mouse"&&event.button!==0)return;dragging={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener("pointermove",event=>{if(!dragging||dragging.id!==event.pointerId)return;yaw=(yaw+(event.clientX-dragging.x)*sensitivity)%(Math.PI*2);dragging.x=event.clientX;dragging.y=event.clientY;});
canvas.addEventListener("pointerup",()=>dragging=null);canvas.addEventListener("pointercancel",()=>dragging=null);canvas.addEventListener("wheel",event=>event.preventDefault(),{passive:false});
const stick=$("stick");
function moveStick(event){const r=stick.getBoundingClientRect(),dx=event.clientX-(r.left+r.width/2),dy=event.clientY-(r.top+r.height/2),max=r.width*.34,len=Math.hypot(dx,dy),scale=len>max?max/len:1;stickVector=[dx*scale/max,-dy*scale/max];stick.querySelector("span").style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
stick.addEventListener("pointerdown",event=>{stickPointer=event.pointerId;stick.setPointerCapture(event.pointerId);moveStick(event);});stick.addEventListener("pointermove",event=>{if(stickPointer===event.pointerId)moveStick(event);});
function resetStick(){stickPointer=null;stickVector=[0,0];stick.querySelector("span").style.transform="translate(0,0)";}
stick.addEventListener("pointerup",resetStick);stick.addEventListener("pointercancel",resetStick);
for(const[id,action]of[["touch-jump","jump"],["touch-interact","interact"],["touch-pulse","pulse"],["touch-dash","dash"]]){const button=$(id);button.addEventListener("pointerdown",event=>{event.preventDefault();held[action]=true;button.setPointerCapture(event.pointerId);});const release=()=>held[action]=false;button.addEventListener("pointerup",release);button.addEventListener("pointercancel",release);button.addEventListener("lostpointercapture",release);}

function currentMove(){
  let x=(keys.has(bindings.left)||keys.has("ArrowLeft")?1:0)-(keys.has(bindings.right)||keys.has("ArrowRight")?1:0),z=(keys.has(bindings.up)||keys.has("ArrowUp")?1:0)-(keys.has(bindings.down)||keys.has("ArrowDown")?1:0);
  x+=stickVector[0];z+=stickVector[1];const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}return[x,z];
}
function fuelValue(l){return l.lit?(l.fuelUnits??0)/60:0;}
function nearestLantern(){let target=null,distance=Infinity;for(const l of game.lanterns)if(!l.lit||fuelValue(l)<100){const d=Math.hypot(game.player.pos[0]-l.pos[0],game.player.pos[2]-l.pos[2]);if(d<distance){target=l;distance=d;}}return{target,distance};}
function showToast(message){const el=$("toast");el.textContent=message;el.classList.add("visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("visible"),2200);}
function drawMap(){const map=$("map"),ctx=map.getContext("2d"),size=map.width,c=size/2,scale=size/2.25;ctx.clearRect(0,0,size,size);ctx.fillStyle="rgba(34,50,56,.9)";ctx.beginPath();ctx.arc(c,c,scale,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(197,207,204,.25)";ctx.stroke();const sx=game.night===2?Math.max(100,size/96):size/84,centerX=game.night===2?35:0;const dot=(x,z,col,r)=>{ctx.beginPath();ctx.arc(c+(x-centerX)*sx,c+z*sx,r,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();};for(const l of game.lanterns)dot(l.pos[0],l.pos[2],l.lit?"#ffc86c":"#a79b86",l.lit?3.5:2.6);for(const s of game.shades)dot(s.pos[0],s.pos[2],s.state==="stunned"?"#8bd8ff":colorblind?"#00b3ff":"#c883ec",2.7);dot(game.player.pos[0],game.player.pos[2],"#fff2c6",4);}
function renderLeaderboard(entries){const list=$("leaderboard-list");list.replaceChildren();for(const[index,entry]of entries.entries()){const item=document.createElement("li");item.textContent=`${index+1}. ${entry.name} — ${entry.score.toLocaleString("vi-VN")} điểm · ${entry.nights_won}/3 đêm`;list.append(item);}if(entries.length===0)$("leaderboard-message").textContent="Chưa có điểm được lưu trên máy này.";}
async function openLeaderboard(){hideScreens();$("leaderboard-screen").classList.add("active");$("leaderboard-message").textContent="Đang tải…";try{const response=await fetch("/api/leaderboard");if(!response.ok)throw new Error("Không thể đọc bảng xếp hạng");const data=await response.json();renderLeaderboard(data.entries);}catch(error){$("leaderboard-message").textContent=`Không thể đọc dữ liệu cục bộ: ${error.message}`;}}
if(!benchMode){$("leaderboard-button").addEventListener("click",openLeaderboard);$("leaderboard-back").addEventListener("click",()=>{$("leaderboard-screen").classList.remove("active");$("start-screen").classList.add("active");});}
$("score-form").addEventListener("submit",async event=>{
  event.preventDefault();const name=$("score-name").value.trim();
  if(!/^[A-Za-z0-9_]{3,12}$/.test(name)){ $("score-message").textContent="Tên cần có 3–12 ký tự: chữ Latin, số hoặc gạch dưới.";return; }
  const entry={name,score:resultScore,nights_won:game.state==="won"?3:Math.max(0,game.night-1),achieved_at:new Date().toISOString(),seed:runSeed};
  try{const response=await fetch("/api/leaderboard",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entry})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Lưu điểm thất bại");resultSaved=true;$("score-message").textContent="Đã lưu điểm vào bảng xếp hạng trên máy này.";$("save-score").disabled=true;renderLeaderboard(data.entries);}catch(error){$("score-message").textContent=`Không lưu được điểm: ${error.message}`;}
});

function updateHud(now,force=false){
  if(!force&&now-lastHud<100)return;lastHud=now;
  $("health").textContent=`${"♥ ".repeat(game.player.flames).trim()}${game.player.flames<3?` ${"♡ ".repeat(3-game.player.flames).trim()}`:""}`;
  $("carried").textContent=game.player.carried;$("capacity").textContent=game.player.capacity;
  const sec=Math.ceil(game.timeLeft);$("timer").textContent=`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;$("timer").classList.toggle("urgent",sec<=30);
  $("last-seconds-warning").hidden=!(sec<=10&&game.state==="playing");
  $("score").textContent=(nightBaseScore+game.score).toLocaleString("vi-VN");
  const lit=game.lanterns.filter(l=>l.lit).length;$("lantern-count").textContent=`${lit} / ${game.lanterns.length}`;
  const{target,distance}=nearestLantern();
  const fuel=target?fuelValue(target):0;
  $("objective").textContent=!target?"Các đèn đã đủ dầu":target.lit?`⚠ ${target.id} dầu ${fuel.toFixed(1)}/100`:distance<=2.6?`E — Thắp ${target.id} (${game.player.carried}/${target.everLit?5:10})`:game.player.carried?`Thắp ${target.id} · ${game.player.carried}/${target.everLit?5:10}`:`Gom đom đóm cho ${target.id}`;
  $("objective").classList.toggle("fuel-warning",Boolean(target?.lit&&fuel<30));
  $("pulse-meter").textContent=game.player.pulseCdTicks?`Q · ${(game.player.pulseCdTicks/60).toFixed(1)}s`:`Q · TỎA SÁNG (${game.player.carried})`;
  $("dash-meter").textContent=game.player.dashCdTicks?`Lướt · ${(game.player.dashCdTicks/60).toFixed(1)}s`:"Lướt · SẴN SÀNG";
  $("wind-banner").classList.toggle("visible",game.wind.warn||game.wind.active);
  $("wind-banner").textContent=`${colorblind?"⚠ ":""}${game.wind.active?"Gió lớn đang thổi — giữ thăng bằng!":"Gió lớn sắp tới — lá cây đang lay động"}`;
  const warning=$("shade-warning"),nearest=game.shades.reduce((best,shade)=>{const d=Math.hypot(game.player.pos[0]-shade.pos[0],game.player.pos[2]-shade.pos[2]);return !best||d<best.distance?{shade,distance:d}:best;},null);
  warning.hidden=now>shadeWarnUntil||!nearest;
  if(!warning.hidden){const dx=nearest.shade.pos[0]-game.player.pos[0],dz=nearest.shade.pos[2]-game.player.pos[2],forward=dx*Math.sin(yaw)+dz*Math.cos(yaw),right=-dx*Math.cos(yaw)+dz*Math.sin(yaw),angle=Math.atan2(right,forward);const nx=Math.sin(angle),ny=-Math.cos(angle),rx=window.innerWidth/2-90,ry=window.innerHeight/2-100,scale=Math.min(rx/Math.max(.001,Math.abs(nx)),ry/Math.max(.001,Math.abs(ny)));warning.style.left=`calc(50% + ${nx*scale}px)`;warning.style.top=`calc(50% + ${ny*scale}px)`;$("shade-arrow").style.transform=`rotate(${angle*180/Math.PI}deg)`;}
  drawMap();
  if(game.state==="paused")$("pause-screen").classList.add("active");if(game.state==="playing")$("pause-screen").classList.remove("active");
  if(["won","lost"].includes(game.state)){
    const won=game.state==="won";resultScore=won?nightBaseScore+game.score:nightBaseScore;
    $("end-title").textContent=won?(game.night===3?"Bình minh trên đảo":"Đêm đã sáng"):"Đêm vẫn còn tối";
    $("end-copy").textContent=won?(game.night===3?"Ba hòn đảo đã được thắp sáng. Bình minh trở lại trên biển mây.":"Mây đã giữ đảo sáng tới bình minh và sẵn sàng cho chuyến đi tiếp theo."):(game.reason==="dawn"?"Bình minh đến trước khi đủ số đèn còn sáng.":game.reason==="no_flames"?"Ngọn lửa cuối cùng đã tắt.":"Mây cần nghỉ một chút. Đom đóm vẫn đang chờ trên đảo.");
    $("end-eyebrow").textContent=won?`CHIẾN THẮNG · ĐÊM ${game.night}`:`ĐÊM ${game.night} · THỬ LẠI NHÉ`;
    $("final-score").textContent=resultScore.toLocaleString("vi-VN");$("restart-button").textContent=won?"Chơi lại đêm này":"Thử lại đêm này";$("next-night-button").hidden=!(won&&game.night<3);
    const showSave=!resultSaved&&(game.state==="lost"||game.night===3);$("score-form").hidden=!showSave;
    if(!showSave&&game.state==="won")$("score-message").textContent="Bảng xếp hạng được lưu sau Đêm 3.";
    $("end-screen").classList.add("active");
  }
}

let benchmarkLastFrame=0,benchmarkFirstFrame=0,benchmarkWarmEnd=0,benchmarkMeasureEnd=0,benchmarkDts=[],benchmarkDone=false,benchmarkReadySent=false,benchmarkAccumulator=0;
function benchmarkTick(){
  const tick=game.simTick;
  for(const shade of game.shades)if(shade.state==="wander"){
    const radius=shade.wanderRadius??(game.night===1?2.8:2);
    const speed=shade.wanderSpeed??1.8,direction=shade.wanderDirection??1,phase=(shade.wanderPhase??0)+direction*tick/60*speed/radius;
    shade.pos[0]=shade.wanderOrigin[0]+Math.cos(phase)*radius;shade.pos[2]=shade.wanderOrigin[1]+Math.sin(phase)*radius;
  }
  game.simTick++;game.tick++;
}
function completeBenchmark(){
  if(benchmarkDone)return;benchmarkDone=true;
  const frames=benchmarkDts.length||1,sorted=[...benchmarkDts].sort((a,b)=>b-a),k=Math.max(1,Math.ceil(.01*frames)),sum=benchmarkDts.reduce((a,b)=>a+b,0),slow=sorted.slice(0,k).reduce((a,b)=>a+b,0)/k;
  const ascending=[...benchmarkDts].sort((a,b)=>a-b),p95=ascending[Math.min(ascending.length-1,Math.ceil(.95*ascending.length)-1)]??0;
  const gl=canvas.getContext("webgl"),ext=gl?.getExtension("WEBGL_debug_renderer_info"),rendererName=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER)||"WebGL";
  const report={contract_version:"1.3",avg_fps:round1(1000*frames/(sum||1)),p1_low_fps:round1(1000/(slow||1)),frame_ms_p95:round1(p95),frames,load_ms:Math.round(performance.timeOrigin+benchmarkFirstFrame-benchHostStartedAt),renderer:`WebGL 1 custom renderer · ${rendererName}`,os:navigator.platform};
  window.__benchResult=report;fetch("/api/benchmark",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(report),keepalive:true}).catch(()=>{});
}
function round1(number){return Math.round(number*10)/10;}

function loop(now){
  if(benchMode&&benchmarkDone)return;
  const delta=previousTime?Math.min((now-previousTime)/1000,.1):0;previousTime=now;
  if(benchMode){
    benchmarkAccumulator+=delta;while(benchmarkAccumulator>=1/60){benchmarkTick();benchmarkAccumulator-=1/60;}
    if(!benchmarkFirstFrame){const angle=0;renderer?.draw(game,0,0,{eye:[30*Math.cos(angle),15,-30*Math.sin(angle)],target:[0,0,0]});benchmarkFirstFrame=now;benchmarkWarmEnd=now+3000;benchmarkMeasureEnd=benchmarkWarmEnd+benchDuration*1000;benchmarkLastFrame=now;if(!benchmarkReadySent){benchmarkReadySent=true;fetch("/api/benchmark-ready",{method:"POST",keepalive:true}).catch(()=>{});}}
    else{
      const elapsed=(now-benchmarkFirstFrame)/1000,angle=elapsed*(Math.PI*2/15),eye=[30*Math.cos(angle),15,-30*Math.sin(angle)];renderer?.draw(game,0,elapsed,{eye,target:[0,0,0]});
      if(now>=benchmarkWarmEnd){const intervalStart=Math.max(benchmarkLastFrame,benchmarkWarmEnd),intervalEnd=Math.min(now,benchmarkMeasureEnd);if(intervalEnd>intervalStart)benchmarkDts.push(intervalEnd-intervalStart);if(now>=benchmarkMeasureEnd)completeBenchmark();}
      benchmarkLastFrame=now;
    }
    requestAnimationFrame(loop);return;
  }
  if(started&&["playing","paused"].includes(game.state)){
    accumulator=Math.min(accumulator+delta,.1);
    while(accumulator>=1/60){game.controls.move=currentMove();game.controls.cam_yaw_deg=yaw*180/Math.PI;Object.assign(game.controls,{jump:held.jump,interact:held.interact,pulse:held.pulse,dash:held.dash,pause:held.pause});stepGame(game);
      for(const event of gameEvents(game)){
        audio.event(event.name);
        if(event.name==="shade_spawned"){shadeWarnUntil=performance.now()+5000;showToast("⚠ Bóng Mực xuất hiện — xem mũi tên chỉ hướng");}
        if(event.name==="deposit")showToast(`${event.data.lantern_id}: đã nạp ${event.data.deposited}/${event.data.needed} đom đóm`);
        if(event.name==="refuel")showToast(`${event.data.lantern_id}: dầu đã đầy ${event.data.fuel}/100`);
        if(event.name==="lantern_out")showToast(`⚠ ${event.data.lantern_id} đã cạn dầu`);
        if(event.name==="lantern_lit")showToast(`${event.data.lantern_id} bừng sáng! Ánh ấm đang lan rộng`);
        if(event.name==="player_hit")showToast("Bóng Mực chạm vào Mây!");
        if(event.name==="pulse")showToast(event.data.stunned_ids.length?`Sóng sáng đẩy lùi ${event.data.stunned_ids.length} bóng!`:"Sóng sáng lan ra quanh Mây");
        if(event.name==="charm_picked")showToast("Lá gió! Mây lướt nhanh hơn trong 10 giây");
        if(event.name==="game_over"&&event.data.reason==="dawn_survived")showToast("Bình minh đã lên — đảo còn đủ đèn sáng!");
      }
      if(held.pause)held.pause=false;accumulator-=1/60;if(!["playing","paused"].includes(game.state))break;
    }
    updateHud(now);
  }
  if(renderer)renderer.draw(game,yaw,now/1000);requestAnimationFrame(loop);
}

if(benchMode){
  started=true;hideScreens();document.body.classList.add("benchmark-mode");document.querySelector(".hud").hidden=true;document.querySelector(".mini-map").hidden=true;
  window.__benchMeta={seed:42,shades:game.shades.length,motes:game.motes.length,lanterns:game.lanterns.filter(l=>l.lit).length};
}
updateHud(performance.now(),true);requestAnimationFrame(loop);
