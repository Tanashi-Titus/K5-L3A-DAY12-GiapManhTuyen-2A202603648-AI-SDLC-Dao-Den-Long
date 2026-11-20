export const CONTRACT_VERSION = "1.3";
export const TUNING = Object.freeze({
  player_speed: 5, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5,
  fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, relight_cost: 5,
  win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20,
  pickup_radius: 1.25, interact_radius: 2.6, pulse_cost: 1, pulse_radius: 8,
  night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300, flames: 3, invuln_s: 1.2, hit_drop_ratio: 0.5,
  pulse_stun_s: 2.5, pulse_push_m: 3.5, pulse_cooldown_s: 0.8, safe_radius: 4,
  shade_speed: 2.2, shade_wander_speed: 1.8, shade_wander_radius_night1: 2.8, shade_wander_radius_other: 2, shade_hit_radius: 1.3, fall_enabled: true,
  score: Object.freeze({ per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_drain_stun: 15, per_lantern_at_dawn: 50, per_flame_left: 50 }),
  dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 2,
});

const STEP = 1 / 60, round3 = (n) => Math.round(n * 1000) / 1000;
const validNumber = (n) => typeof n === "number" && Number.isFinite(n);
const distXZ = (a,b) => Math.hypot(a[0]-b[0],a[2]-b[2]);
const dist2 = (x,z,X,Z) => Math.hypot(x-X,z-Z);
const clamp = (n,lo,hi) => Math.max(lo,Math.min(hi,n));
export class ScenarioError extends Error {}

function wanderPath(game,pos,direction,tick=game.simTick){
  const radius=game.night===1?TUNING.shade_wander_radius_night1:TUNING.shade_wander_radius_other;
  const speed=TUNING.shade_wander_speed,cx=game.night===2&&pos[0]>=35?70:0;
  const phase=Math.atan2(pos[2],pos[0]-cx);
  return {wanderOrigin:[pos[0]-Math.cos(phase)*radius,pos[2]-Math.sin(phase)*radius],wanderPhase:phase-direction*tick*STEP*speed/radius,wanderRadius:radius,wanderSpeed:speed,wanderDirection:direction};
}

export function seededRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return () => { state += 0x6d2b79f5; let t=state; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}

const polar = (cx,cz,r,deg,y=0) => { const a=deg*Math.PI/180; return [round3(cx+Math.cos(a)*r),y,round3(cz+Math.sin(a)*r)]; };
function nightSpec(night) {
  if (night === 1) {
    const lanterns = [[0,0,25],[23.8,0,7.7],[14.7,0,-20.2],[-14.7,0,-20.2],[-23.8,0,7.7]].map((pos,i)=>({id:`L${i+1}`,pos,lit:false,deposited:0}));
    const motePoints = [...Array.from({length:8},(_,i)=>polar(0,0,12,i*45)),...Array.from({length:16},(_,i)=>polar(0,0,33,i*22.5))];
    const shadePoints = Array.from({length:12},(_,i)=>polar(0,0,37,15+i*30,1));
    return { duration:TUNING.night1_duration_s,lanterns,motePoints,shadePoints,shadeFirst:300,shadeEvery:480,shadeWave:2,shadeMax:6,drifters:false,charms:[],wind:false,world:"island1" };
  }
  if (night === 2) {
    const lanterns = [[0,0,20],[17,0,-10],[-17,0,-10],[70,0,20],[87,0,-10],[53,0,-10]].map((pos,i)=>({id:`L${i+1}`,pos,lit:false,deposited:0}));
    const motePoints = [];
    for (const cx of [0,70]) { for (const a of [0,90,180,270]) motePoints.push(polar(cx,0,10,a)); for (const a of [45,90,135,180,225,270,315,0]) motePoints.push(polar(cx,0,22,a)); }
    const shadePoints=[]; for(const cx of [0,70]) for(let i=0;i<8;i++) shadePoints.push(polar(cx,0,26,22.5+i*45,1));
    return { duration:TUNING.night2_duration_s,lanterns,motePoints,shadePoints,shadeFirst:420,shadeEvery:420,shadeWave:1,shadeMax:8,drifters:true,charms:[{id:"C1",pos:[35,0,0],available:true,respawnTicks:0}],wind:false,world:"islands2" };
  }
  const lanterns = [[0,6,6],[18,3,10],[-18,3,10],[35,0,-10],[-35,0,-10],[20,0,-35],[-20,0,-35]].map((pos,i)=>({id:`L${i+1}`,pos,lit:false,deposited:0}));
  const motePoints=[];
  for(let i=0;i<18;i++) motePoints.push(polar(0,0,34,i*20));
  for(let d=20;d<=160;d+=20) motePoints.push(polar(0,0,18,d,3));
  for(const d of [45,135,225,315]) motePoints.push(polar(0,0,5,d,6));
  const shadePoints=Array.from({length:16},(_,i)=>polar(0,0,43,i*22.5,1));
  return { duration:TUNING.night3_duration_s,lanterns,motePoints,shadePoints,shadeFirst:360,shadeEvery:360,shadeWave:1,shadeMax:10,drifters:true,charms:[{id:"C1",pos:[30,0,25],available:true,respawnTicks:0},{id:"C2",pos:[-30,0,25],available:true,respawnTicks:0}],wind:true,world:"tiers3" };
}

function defaultMotes(spec) { return spec.motePoints.map((pos,i)=>({id:`M${i+1}`,pos:[...pos],kind:"random",ttlTicks:null,spawnIndex:i})); }
function defaultShades() { return []; }
function defaultDrifters() { return []; }
function vec(value,label) { if(!Array.isArray(value)||value.length!==3||!value.every(validNumber)) throw new ScenarioError(`${label} must be an array of three finite numbers`); }
function createPlayer() { return {pos:[0,0,0],vel:[0,0,0],carried:0,capacity:TUNING.carry_capacity,successfulLights:0,flames:TUNING.flames,grounded:true,invulnTicks:0,dashTicks:0,dashCdTicks:0,pulseCdTicks:0,charmTicks:0,verticalSpeed:0,facingYaw:0}; }

export function createGame({seed=1,night=1,scenario=null}={}) {
  if(!Number.isSafeInteger(Number(seed))) throw new ScenarioError("--seed must be an integer");
  if(![1,2,3].includes(Number(night))) throw new ScenarioError("--night must be 1, 2, or 3");
  const n=Number(night),spec=nightSpec(n),rng=seededRandom(seed);
  for(const lantern of spec.lanterns)Object.assign(lantern,{fuelUnits:0,everLit:false,relitCount:0,deposited:0});
  const player=createPlayer();
  if(n===3)player.pos=[0,0,-15];
  const game={contractVersion:CONTRACT_VERSION,seed:Number(seed),night:n,world:spec.world,tick:0,simTick:0,state:"playing",result:null,reason:null,
    duration:spec.duration,timeLeft:spec.duration,score:0,player,lanterns:spec.lanterns,motes:defaultMotes(spec),shades:defaultShades(),drifters:defaultDrifters(),charms:spec.charms.map(c=>({...c})),
    moteRespawns:new Array(spec.motePoints.length).fill(-1),spawnPoints:spec.motePoints,shadeSpawnPoints:spec.shadePoints,shadeFirst:spec.shadeFirst,shadeEvery:spec.shadeEvery,shadeWave:spec.shadeWave,shadeMax:spec.shadeMax,nextShadeId:1,nextDrifterId:1,nextMoteId:spec.motePoints.length+1,
    driftersEnabled:spec.drifters,windEnabled:spec.wind,wind:{active:false,dir_deg:0,warn:false},rng,events:[],
    controls:{move:[0,0],cam_yaw_deg:0,jump:false,interact:false,pulse:false,dash:false,pause:false},previousControls:{jump:false,interact:false,pulse:false,dash:false,pause:false},
    previousPlayerPos:[...player.pos],spawnedShadeCount:0,lastMoteSpawnTick:0,pulseVisualTicks:0,nightStartEmitted:false};
  if(scenario) applyScenario(game,scenario);
  return game;
}

function applyScenario(game,s) {
  if(!s||typeof s!=="object"||Array.isArray(s)) throw new ScenarioError("scenario must be a JSON object");
  if(s.player!==undefined){if(!s.player||typeof s.player!=="object"||Array.isArray(s.player)) throw new ScenarioError("scenario.player must be an object");
    if(s.player.pos!==undefined){vec(s.player.pos,"scenario.player.pos");game.player.pos=s.player.pos.map(Number);game.previousPlayerPos=[...game.player.pos];}
    if(s.player.successful_lights!==undefined){if(!Number.isInteger(s.player.successful_lights)||s.player.successful_lights<0)throw new ScenarioError("scenario.player.successful_lights must be a non-negative integer");game.player.successfulLights=s.player.successful_lights;game.player.capacity=Math.min(TUNING.capacity_max,TUNING.carry_capacity+2*game.player.successfulLights);}
    for(const [key,lo,hi] of [["carried",0,TUNING.capacity_max],["flames",0,TUNING.flames]]) if(s.player[key]!==undefined){if(!Number.isInteger(s.player[key])||s.player[key]<lo||s.player[key]>hi) throw new ScenarioError(`scenario.player.${key} outside ${lo}..${hi}`);game.player[key]=s.player[key];}
    if(game.player.carried>game.player.capacity)throw new ScenarioError("scenario.player.carried exceeds capacity");
    for(const [key,target] of [["invuln_ticks","invulnTicks"],["dash_cd_ticks","dashCdTicks"],["pulse_cd_ticks","pulseCdTicks"],["charm_ticks","charmTicks"]]) if(s.player[key]!==undefined){if(!Number.isInteger(s.player[key])||s.player[key]<0) throw new ScenarioError(`scenario.player.${key} must be non-negative integer`);game.player[target]=s.player[key];}
    if(s.player.grounded!==undefined) game.player.grounded=Boolean(s.player.grounded);
    if(s.player.vel!==undefined){vec(s.player.vel,"scenario.player.vel");game.player.vel=s.player.vel.map(Number);game.player.verticalSpeed=game.player.vel[1];}
  }
  if(s.random_motes!==undefined&&typeof s.random_motes!=="boolean") throw new ScenarioError("random_motes must be boolean");
  if(s.random_motes===false){game.motes=[];game.moteRespawns.fill(-1);}
  if(s.motes!==undefined){if(!Array.isArray(s.motes)) throw new ScenarioError("scenario.motes must be an array");game.motes=s.motes.map((m,i)=>{const pos=Array.isArray(m)?m:m?.pos;vec(pos,`scenario.motes[${i}].pos`);return {id:Array.isArray(m)?`M${i+1}`:String(m.id??`M${i+1}`),pos:pos.map(Number),kind:Array.isArray(m)?"random":(m.kind??"random"),ttlTicks:m?.ttl_s==null?null:Math.max(0,Math.round(m.ttl_s*60)),spawnIndex:null};});game.nextMoteId=game.motes.length+1;}
  if(s.random_shades===false) game.shades=[];
  if(s.shades!==undefined){if(!Array.isArray(s.shades)) throw new ScenarioError("scenario.shades must be an array");game.shades=s.shades.map((s,i)=>{vec(s.pos,`scenario.shades[${i}].pos`);const state=s.state??"wander";if(!["spawning","wander","chase","drain","recoil","stunned"].includes(state)) throw new ScenarioError(`invalid shade state ${state}`);const id=String(s.id??`S${i+1}`),pos=s.pos.map(Number),path=wanderPath(game,pos,i%2===0?1:-1,0);return {id,pos,...path,state:state==="spawning"?"wander":state,targetLanternId:s.target_lantern_id??null,drainTicks:0,repelledTicks:0,stunTicks:s.state_ticks_left??0,stateTicks:s.state_ticks_left??0,justSpawned:false};});game.nextShadeId=game.shades.length+1;}
  if(s.lanterns!==undefined){if(!Array.isArray(s.lanterns)) throw new ScenarioError("scenario.lanterns must be an array");for(const p of s.lanterns){const l=game.lanterns.find(x=>x.id===p.id);if(!l) throw new ScenarioError(`unknown lantern ${p.id}`);if(p.pos!==undefined){vec(p.pos,`lantern ${p.id}.pos`);l.pos=p.pos.map(Number);}if(p.lit!==undefined&&typeof p.lit!=="boolean") throw new ScenarioError(`lantern ${p.id}.lit must be boolean`);if(p.deposited!==undefined&&(!Number.isInteger(p.deposited)||p.deposited<0||p.deposited>TUNING.lantern_cost))throw new ScenarioError(`lantern ${p.id}.deposited invalid`);const lit=p.lit===true||p.deposited>=TUNING.lantern_cost;if(p.fuel!==undefined&&(!validNumber(p.fuel)||p.fuel<0||p.fuel>TUNING.fuel_max))throw new ScenarioError(`lantern ${p.id}.fuel outside 0..${TUNING.fuel_max}`);l.lit=lit&&(p.fuel??TUNING.fuel_max)>0;l.fuelUnits=l.lit?Math.round((p.fuel??TUNING.fuel_max)*60):0;l.everLit=p.ever_lit===undefined?lit:Boolean(p.ever_lit);if(typeof p.ever_lit!=="undefined"&&typeof p.ever_lit!=="boolean")throw new ScenarioError(`lantern ${p.id}.ever_lit must be boolean`);l.relitCount=p.relit_count??0;if(!Number.isInteger(l.relitCount)||l.relitCount<0)throw new ScenarioError(`lantern ${p.id}.relit_count must be a non-negative integer`);l.deposited=l.lit?0:(p.deposited??0);}}
  if(s.time_left_s!==undefined){if(!validNumber(s.time_left_s)||s.time_left_s<0||s.time_left_s>game.duration) throw new ScenarioError("scenario.time_left_s is outside night duration");game.timeLeft=s.time_left_s;}
  if(s.random_drifters!==undefined){if(typeof s.random_drifters!=="boolean") throw new ScenarioError("random_drifters must be boolean");game.driftersEnabled=s.random_drifters;}
  if(s.drifters!==undefined){if(!Array.isArray(s.drifters)) throw new ScenarioError("scenario.drifters must be an array");game.drifters=s.drifters.map((d,i)=>{vec(d.pos,`scenario.drifters[${i}].pos`);return {id:String(d.id??`D${i+1}`),pos:d.pos.map(Number),origin:d.pos.map(Number),state:d.state??"idle",stolen:d.stolen??0,fleeTicks:d.state_ticks_left??0,removeTicks:0,stealDone:(d.stolen??0)>0};});game.nextDrifterId=game.drifters.length+1;}
  if(s.charms!==undefined){if(!Array.isArray(s.charms)) throw new ScenarioError("scenario.charms must be an array");game.charms=s.charms.map((c,i)=>{vec(c.pos,`scenario.charms[${i}].pos`);return {id:String(c.id??`C${i+1}`),pos:c.pos.map(Number),available:c.available!==false,respawnTicks:Math.round((c.respawn_s??0)*60)};});}
  if(s.wind_enabled!==undefined){if(typeof s.wind_enabled!=="boolean") throw new ScenarioError("wind_enabled must be boolean");game.windEnabled=s.wind_enabled;}
  if(s.wind!==undefined){if(typeof s.wind!=="object"||typeof s.wind.active!=="boolean"||!validNumber(s.wind.dir_deg)) throw new ScenarioError("wind must have active and dir_deg");game.wind={active:s.wind.active,dir_deg:s.wind.dir_deg,warn:false};}
}

export function applyInputFrame(game,frame) {
  if(!frame||typeof frame!=="object"||Array.isArray(frame)||!Number.isInteger(frame.tick)||frame.tick<0) throw new ScenarioError("each input frame needs a non-negative integer tick");
  if(frame.move!==undefined){if(!Array.isArray(frame.move)||frame.move.length!==2||!frame.move.every(n=>validNumber(n)&&n>=-1&&n<=1)) throw new ScenarioError("move must be [x,z] in [-1,1]");let [x,z]=frame.move;const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}game.controls.move=[x,z];}
  if(frame.cam_yaw_deg!==undefined){if(!validNumber(frame.cam_yaw_deg)) throw new ScenarioError("cam_yaw_deg must be finite");game.controls.cam_yaw_deg=frame.cam_yaw_deg;}
  for(const key of ["jump","interact","pulse","dash","pause"])if(frame[key]!==undefined){if(typeof frame[key]!=="boolean")throw new ScenarioError(`${key} must be boolean`);game.controls[key]=frame[key];}
}

function emit(game,name,data,tick=game.tick+1){game.events.push({type:"event",tick,name,data});}
function nearest(game,items){let selected=null,best=Infinity;for(const item of items){const d=distXZ(game.player.pos,item.pos);if(d<best){best=d;selected=item;}}return{item:selected,distance:best};}
function surfaceAt(game,x,z,fromY=100){
  if(game.night===1) return Math.hypot(x,z)<=40?0:null;
  if(game.night===2){if(dist2(x,z,0,0)<=28||dist2(x,z,70,0)<=28) return 0;if(x>=26&&x<=44&&Math.abs(z)<=2)return 0;return null;}
  const r=Math.hypot(x,z);let y=r<=45?0:null;
  if(r<=8&&fromY>=5.8)y=6;else if(r>=12&&r<=24&&z>0&&fromY>=2.8)y=3;
  for(const angle of [30,150]){const a=angle*Math.PI/180,ux=Math.cos(a),uz=Math.sin(a),along=x*ux+z*uz,side=Math.abs(x*uz-z*ux);if(side<=1.5&&along>=24&&along<=30)y=Math.max(y??-Infinity,3*(30-along)/6);}
  return y;
}
function onLaunchPad(game,x,z){if(game.night===2){if(dist2(x,z,20,18)<=1)return[24,14,0];if(dist2(x,z,50,-18)<=1)return[-24,14,0];}if(game.night===3&&dist2(x,z,0,13)<=1)return[0,12,-8];return null;}
function worldMove(game){const [mx,mz]=game.controls.move,theta=game.controls.cam_yaw_deg*Math.PI/180;return[mx*Math.cos(theta)+mz*Math.sin(theta),-mx*Math.sin(theta)+mz*Math.cos(theta)];}

function reduceTimers(game){
  game.timeLeft=Math.max(0,game.timeLeft-STEP);
  game.pulseVisualTicks=Math.max(0,game.pulseVisualTicks-1);
  const p=game.player;for(const k of ["invulnTicks","dashCdTicks","pulseCdTicks","charmTicks"])p[k]=Math.max(0,p[k]-1);
  for(const s of game.shades){if(s.stateTicks>0)s.stateTicks--;if(s.repelledTicks>0)s.repelledTicks--;if(s.state==="stunned"&&s.stunTicks>0)s.stunTicks--;if(s.state==="spawning"&&s.stateTicks===0)s.state="wander";if(s.state==="stunned"&&s.stunTicks===0)s.state="wander";if(s.state==="recoil"&&s.stateTicks===0)s.state="chase";}
  for(const d of game.drifters){if(d.state==="flee"&&d.fleeTicks>0)d.fleeTicks--;if(d.state==="removed"&&d.removeTicks>0)d.removeTicks--;}
  for(let i=game.motes.length-1;i>=0;i--){const m=game.motes[i];if(m.ttlTicks!==null){m.ttlTicks--;if(m.ttlTicks<=0)game.motes.splice(i,1);}}
  for(const c of game.charms)if(!c.available&&c.respawnTicks>0){c.respawnTicks--;if(c.respawnTicks===0)c.available=true;}
  const next=game.simTick+1;game.wind.warn=false;game.wind.active=false;
  if(game.night===3&&game.windEnabled){const phase=next%1800;game.wind.active=phase>=0&&phase<300&&next>=1800;game.wind.warn=!game.wind.active&&phase>=1680;const gust=Math.floor(next/1800);if(gust>0)game.wind.dir_deg=round3((seededRandom(game.seed+gust*997)( ))*360);}
}

function movePlayer(game){
  const p=game.player,old=[...p.pos],move=worldMove(game),speed=p.charmTicks>0?7.2:TUNING.player_speed,prior=game.previousControls;
  if(Math.hypot(...game.controls.move)>0.05)p.facingYaw=Math.atan2(move[0],move[1]);
  if(game.controls.dash&&!prior.dash&&p.dashCdTicks===0&&p.dashTicks===0){let [dx,dz]=move;if(Math.hypot(dx,dz)<0.001){const a=game.controls.cam_yaw_deg*Math.PI/180;dx=Math.sin(a);dz=Math.cos(a);}const l=Math.hypot(dx,dz)||1;p.vel[0]=dx/l*TUNING.dash_speed;p.vel[2]=dz/l*TUNING.dash_speed;p.dashTicks=Math.ceil(TUNING.dash_duration_s*60);p.dashCdTicks=p.charmTicks>0?0:Math.ceil(TUNING.dash_cooldown_s*60);emit(game,"dash",{});}
  if(game.controls.jump&&!prior.jump&&p.grounded){p.grounded=false;p.verticalSpeed=6.5;}
  const pad=onLaunchPad(game,p.pos[0],p.pos[2]);if(pad&&p.grounded){p.vel=[pad[0],pad[1],pad[2]];p.verticalSpeed=pad[1];p.grounded=false;}
  let vx=move[0]*speed,vz=move[1]*speed;
  if(p.dashTicks>0){vx=p.vel[0];vz=p.vel[2];p.dashTicks--;}
  if(game.wind.active){const a=game.wind.dir_deg*Math.PI/180;vx+=2*Math.cos(a);vz+=2*Math.sin(a);}
  if(p.grounded){const nx=p.pos[0]+vx*STEP,nz=p.pos[2]+vz*STEP;const floor=surfaceAt(game,nx,nz,p.pos[1]+0.25);const oldFloor=surfaceAt(game,p.pos[0],p.pos[2],p.pos[1]+0.25);
    if(floor!==null&&oldFloor!==null&&floor>oldFloor+0.35){p.pos[0]=old[0];p.pos[2]=old[2];vx=0;vz=0;}else{p.pos[0]=nx;p.pos[2]=nz;if(floor===null){p.grounded=false;p.verticalSpeed=0;}else p.pos[1]=floor;}
  }else{p.pos[0]+=vx*STEP;p.pos[2]+=vz*STEP;p.verticalSpeed-=16*STEP;p.pos[1]+=p.verticalSpeed*STEP;const floor=surfaceAt(game,p.pos[0],p.pos[2]);if(floor!==null&&p.verticalSpeed<=0&&p.pos[1]<=floor){p.pos[1]=floor;p.verticalSpeed=0;p.grounded=true;p.vel[1]=0;} }
  p.vel[0]=vx;p.vel[1]=p.grounded?0:p.verticalSpeed;p.vel[2]=vz;
  const tower=game.night===3&&p.pos[1]>=5.8&&Math.hypot(p.pos[0],p.pos[2])<2;if(tower){p.pos[0]=old[0];p.pos[2]=old[2];}
  const landedPad=onLaunchPad(game,p.pos[0],p.pos[2]);if(landedPad&&p.grounded&&!pad){p.vel=[landedPad[0],landedPad[1],landedPad[2]];p.verticalSpeed=landedPad[1];p.grounded=false;}
  if(!p.grounded&&surfaceAt(game,p.pos[0],p.pos[2])===null&&p.pos[1]<-2)hitPlayer(game,"fall");
}

function pickup(game){
  for(let i=0;i<game.motes.length&&game.player.carried<game.player.capacity;){const m=game.motes[i];if(distXZ(game.player.pos,m.pos)<=TUNING.pickup_radius){game.motes.splice(i,1);game.player.carried++;emit(game,"mote_picked",{carried:game.player.carried});if(m.spawnIndex!==null)game.moteRespawns[m.spawnIndex]=game.simTick+1+180;}else i++;}
  for(const c of game.charms)if(c.available&&distXZ(game.player.pos,c.pos)<=TUNING.pickup_radius){c.available=false;c.respawnTicks=2700;game.player.charmTicks=600;emit(game,"charm_picked",{charm_id:c.id,charm_ticks:game.player.charmTicks});}
}
function lanternFuel(l){return l.fuelUnits/60;}
function lanternNeedsMotes(l){return !l.lit||(l.fuelUnits<TUNING.fuel_max*60);}
function repelShadesFromLantern(game,l){for(const s of game.shades){const d=distXZ(s.pos,l.pos);if(d>6)continue;if(d>0.001){s.pos[0]=l.pos[0]+(s.pos[0]-l.pos[0])/d*TUNING.safe_radius;s.pos[2]=l.pos[2]+(s.pos[2]-l.pos[2])/d*TUNING.safe_radius;}else s.pos[0]=l.pos[0]+TUNING.safe_radius;s.repelledTicks=30;if(s.state==="drain"){s.state="wander";s.targetLanternId=null;}}}
function interact(game){
  const {item:l,distance}=nearest(game,game.lanterns.filter(lanternNeedsMotes));
  if(!l||distance>TUNING.interact_radius||game.player.carried<=0)return;
  if(l.lit){const amount=Math.min(game.player.carried,Math.ceil((TUNING.fuel_max*60-l.fuelUnits)/(TUNING.fuel_per_mote*60)));if(amount<=0)return;game.player.carried-=amount;l.fuelUnits=Math.min(TUNING.fuel_max*60,l.fuelUnits+TUNING.fuel_per_mote*60*amount);game.score+=amount*TUNING.score.per_mote;emit(game,"refuel",{lantern_id:l.id,amount,fuel:round1(lanternFuel(l))});if(l.fuelUnits>=TUNING.low_fuel_threshold*60)repelShadesFromLantern(game,l);return;}
  const cost=l.everLit?TUNING.relight_cost:TUNING.lantern_cost,amount=Math.min(game.player.carried,cost-l.deposited);if(amount<=0)return;game.player.carried-=amount;l.deposited+=amount;game.score+=amount*TUNING.score.per_mote;emit(game,"deposit",{lantern_id:l.id,amount,deposited:l.deposited,needed:cost});
  if(l.deposited>=cost){const relight=l.everLit;l.lit=true;l.everLit=true;l.fuelUnits=TUNING.fuel_max*60;l.deposited=0;if(relight)l.relitCount++;game.player.successfulLights++;game.player.capacity=Math.min(TUNING.capacity_max,TUNING.carry_capacity+2*game.player.successfulLights);l.litAtTick=game.tick+1;game.score+=relight?TUNING.score.per_relight:TUNING.score.per_lantern;emit(game,"lantern_lit",{lantern_id:l.id,relight});repelShadesFromLantern(game,l);}
}
function round1(n){return Math.round(n*10)/10;}
function updateFuel(game){
  for(const l of game.lanterns)if(l.lit)l.fuelUnits-=1;
  for(const s of game.shades)if(s.state==="drain"&&s.targetLanternId){const l=game.lanterns.find(x=>x.id===s.targetLanternId);if(l?.lit){l.fuelUnits-=TUNING.drain_per_s;s.drainTicks=(s.drainTicks??0)+1;if(s.drainTicks%60===0)emit(game,"fuel_drain",{lantern_id:l.id,shade_id:s.id,fuel:round1(Math.max(0,lanternFuel(l)))});}}
  for(const l of game.lanterns)if(l.lit&&l.fuelUnits<=0){l.fuelUnits=0;l.lit=false;l.deposited=0;emit(game,"lantern_out",{lantern_id:l.id});}
}

function pulse(game){const p=game.player;if(p.carried<TUNING.pulse_cost||p.pulseCdTicks>0)return;p.carried-=TUNING.pulse_cost;p.pulseCdTicks=Math.ceil(TUNING.pulse_cooldown_s*60);game.pulseVisualTicks=24;const hit=[];
  for(const s of [...game.shades].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))){if(distXZ(p.pos,s.pos)<=TUNING.pulse_radius){const wasDraining=s.state==="drain";const d=distXZ(p.pos,s.pos);if(d>0.001){s.pos[0]+=(s.pos[0]-p.pos[0])/d*TUNING.pulse_push_m;s.pos[2]+=(s.pos[2]-p.pos[2])/d*TUNING.pulse_push_m;}else s.pos[0]+=TUNING.pulse_push_m;s.state="stunned";s.targetLanternId=null;s.stunTicks=Math.ceil(TUNING.pulse_stun_s*60);s.stateTicks=s.stunTicks;game.score+=wasDraining?TUNING.score.per_drain_stun:TUNING.score.per_stun;hit.push(s.id);}}
  for(const d of game.drifters){if(distXZ(p.pos,d.pos)<=TUNING.pulse_radius){if(d.state==="chase"){d.state="flee";d.fleeTicks=240;}else if(d.state==="flee"&&d.stolen>0){const amount=d.stolen;for(let i=0;i<amount;i++)game.motes.push({id:`M${game.nextMoteId++}`,pos:[...d.pos],kind:"dropped",ttlTicks:1800,spawnIndex:null});emit(game,"drifter_drop",{drifter_id:d.id,amount});d.stolen=0;d.state="removed";d.fleeTicks=0;d.removeTicks=120;}}}
  emit(game,"pulse",{stunned_ids:hit});}

function moveShades(game){
  const p=game.player;
  for(const s of game.shades){if(s.state==="spawning"||s.state==="stunned")continue;if(s.state==="recoil"){const dx=s.pos[0]-p.pos[0],dz=s.pos[2]-p.pos[2],d=Math.hypot(dx,dz)||1;s.pos[0]+=dx/d*3*STEP;s.pos[2]+=dz/d*3*STEP;continue;}
    let d=distXZ(p.pos,s.pos);
    if(s.state==="drain"){
      const target=game.lanterns.find(l=>l.id===s.targetLanternId);
      if(d<=6){s.state="chase";s.targetLanternId=null;s.drainTicks=0;}
      else if(!target?.lit||target.fuelUnits>=TUNING.low_fuel_threshold*60||distXZ(s.pos,target.pos)>2){s.state="wander";s.targetLanternId=null;s.drainTicks=0;}
      else continue;
    }
    if(s.state==="wander"){
      const weak=game.lanterns.filter(l=>l.lit&&l.fuelUnits<TUNING.low_fuel_threshold*60),target=nearestTo(s.pos,weak);
      s.targetLanternId=target?.id??null;
      if(target&&distXZ(s.pos,target.pos)<=2){s.state="drain";s.drainTicks=0;continue;}
      if(d<18)s.state="chase";
    }else if(s.state==="chase"&&d>24)s.state="wander";
    d=distXZ(p.pos,s.pos);
    if(s.state==="chase"&&d>0.001){const step=Math.min(TUNING.shade_speed*STEP,d);s.pos[0]+=(p.pos[0]-s.pos[0])/d*step;s.pos[2]+=(p.pos[2]-s.pos[2])/d*step;}
    else if(s.state==="wander"){
      // Patrol a small loop at a real walking speed; the old per-tick sine offset nearly canceled itself out.
      const radius=s.wanderRadius??(game.night===1?TUNING.shade_wander_radius_night1:TUNING.shade_wander_radius_other),speed=s.wanderSpeed??TUNING.shade_wander_speed,direction=s.wanderDirection??1,phase=(s.wanderPhase??0)+direction*game.simTick*STEP*speed/radius;
      s.pos[0]=s.wanderOrigin[0]+Math.cos(phase)*radius;s.pos[2]=s.wanderOrigin[1]+Math.sin(phase)*radius;
    }
  }
}
function nearestTo(pos,items){let selected=null,best=Infinity;for(const item of items){const d=distXZ(pos,item.pos);if(d<best||(d===best&&selected&&item.id.localeCompare(selected.id,undefined,{numeric:true})<0)){best=d;selected=item;}}return selected;}
function applySafeZones(game){for(const s of game.shades)for(const l of game.lanterns)if(l.lit&&l.fuelUnits>=TUNING.low_fuel_threshold*60){const d=distXZ(s.pos,l.pos);if(d<TUNING.safe_radius){const dx=s.pos[0]-l.pos[0],dz=s.pos[2]-l.pos[2],len=d||1;s.pos[0]=l.pos[0]+dx/len*TUNING.safe_radius;s.pos[2]=l.pos[2]+dz/len*TUNING.safe_radius;}}}
function moveDrifters(game){const p=game.player;for(const d of game.drifters){if(d.state==="removed")continue;if(d.state==="flee"){if(d.fleeTicks===0)d.state="removed";else{const dx=d.pos[0]-p.pos[0],dz=d.pos[2]-p.pos[2],len=Math.hypot(dx,dz)||1;d.pos[0]+=dx/len*7*STEP;d.pos[2]+=dz/len*7*STEP;}continue;}const range=distXZ(p.pos,d.pos);if(p.carried>=5&&range<=15)d.state="chase";else if(d.state==="chase"&&(p.carried<5||range>15))d.state="idle";if(d.state==="chase"&&range>0.001){d.pos[0]+=(p.pos[0]-d.pos[0])/range*7*STEP;d.pos[2]+=(p.pos[2]-d.pos[2])/range*7*STEP;}else if(d.state==="idle"){const phase=game.simTick*STEP*0.5+Number(d.id.slice(1));d.pos[0]=d.origin[0]+Math.cos(phase)*2;d.pos[2]=d.origin[2]+Math.sin(phase)*2;}}game.drifters=game.drifters.filter(d=>d.state!=="removed"||d.removeTicks>0);}
function touch(game){const p=game.player;for(const d of [...game.drifters].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))){if(d.state==="chase"&&!d.stealDone&&distXZ(p.pos,d.pos)<=1.2){const amount=Math.min(3,p.carried);p.carried-=amount;d.stolen=amount;d.stealDone=true;d.state="flee";d.fleeTicks=240;emit(game,"drifter_steal",{drifter_id:d.id,amount,carried:p.carried});}}
  if(p.invulnTicks>0)return;for(const s of [...game.shades].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))){if(s.repelledTicks===0&&s.state!=="stunned"&&s.state!=="spawning"&&s.state!=="drain"&&distXZ(p.pos,s.pos)<=TUNING.shade_hit_radius){hitPlayer(game,"shade");s.state="recoil";s.stateTicks=24;break;}}
}
function hitPlayer(game,by){const p=game.player;if(by==="shade"&&p.invulnTicks>0)return;const oldFlames=p.flames;p.flames=Math.max(0,p.flames-1);const dropped=Math.min(p.carried,Math.floor(p.carried*TUNING.hit_drop_ratio));p.carried-=dropped;for(let i=0;i<dropped;i++)game.motes.push({id:`M${game.nextMoteId++}`,pos:[p.pos[0]+Math.cos(i*2.4)*1.1,Math.max(0,p.pos[1]),p.pos[2]+Math.sin(i*2.4)*1.1],kind:"dropped",ttlTicks:1800,spawnIndex:null});if(by==="shade")p.invulnTicks=Math.ceil(TUNING.invuln_s*60);if(by==="fall"){p.pos=[0,0,0];p.vel=[0,0,0];p.verticalSpeed=0;p.grounded=true;}emit(game,"player_hit",by==="fall"?{by,flames:p.flames,dropped,lost:oldFlames-p.flames}:{by,flames:p.flames,dropped});}

function spawnSystems(game){
  const p=game.player;for(let i=0;i<game.moteRespawns.length;i++)if(game.moteRespawns[i]>=0&&game.simTick+1>=game.moteRespawns[i]){const pos=game.spawnPoints[i];if(!game.motes.some(m=>m.spawnIndex===i))game.motes.push({id:`M${game.nextMoteId++}`,pos:[...pos],kind:"random",ttlTicks:null,spawnIndex:i});game.moteRespawns[i]=-1;}
  const t=game.simTick+1;if(t>=game.shadeFirst&&(t-game.shadeFirst)%game.shadeEvery===0&&game.shades.length<game.shadeMax){const wave=game.spawnedShadeCount===0?game.shadeWave:1;const count=Math.min(wave,game.shadeMax-game.shades.length);for(let n=0;n<count;n++){const candidates=game.shadeSpawnPoints.filter(pos=>distXZ(p.pos,pos)>=15);if(!candidates.length)continue;const pos=candidates[Math.floor(game.rng()*candidates.length)];const id=`S${game.nextShadeId++}`,direction=game.rng()<.5?-1:1,path=wanderPath(game,pos,direction,t);game.shades.push({id,pos:[...pos],...path,state:"spawning",drainTicks:0,stunTicks:0,stateTicks:60,justSpawned:true});emit(game,"shade_spawned",{id});game.spawnedShadeCount++;}}
  if(game.driftersEnabled&&t%1200===0&&game.drifters.filter(d=>d.state!=="removed").length<2){const points=game.shadeSpawnPoints;const pos=points[Math.floor(game.rng()*points.length)]??[0,1,0];const id=`D${game.nextDrifterId++}`;game.drifters.push({id,pos:[pos[0],1,pos[2]],origin:[pos[0],1,pos[2]],state:"idle",stolen:0,fleeTicks:0,removeTicks:0,stealDone:false});}
}
function updateEnd(game){if(game.player.flames<=0){game.state="lost";game.result="lost";game.reason="no_flames";}else if(game.timeLeft<=0){const lit=game.lanterns.filter(l=>l.lit).length,required=Math.ceil(TUNING.win_ratio*game.lanterns.length);if(lit>=required){game.state="won";game.result="won";game.reason="dawn_survived";}else{game.state="lost";game.result="lost";game.reason="dawn";}}else return;
  if(game.result==="won"){game.score+=game.lanterns.filter(l=>l.lit).reduce((score,l)=>score+TUNING.score.per_lantern_at_dawn+Math.floor(lanternFuel(l)),0)+game.player.flames*TUNING.score.per_flame_left;}emit(game,"game_over",{result:game.result,reason:game.reason},game.tick);}

export function stepGame(game){
  const prior=game.previousControls;
  if(game.controls.pause&&!prior.pause){game.state=game.state==="paused"?"playing":"paused";emit(game,game.state==="paused"?"paused":"resumed",{});}
  if(!game.nightStartEmitted){emit(game,"night_start",{night:game.night});game.nightStartEmitted=true;}
  if(game.state==="paused"){game.previousControls={...game.previousControls,...Object.fromEntries(["jump","interact","pulse","dash","pause"].map(k=>[k,game.controls[k]]))};game.tick++;return;}
  if(game.state!=="playing"){game.tick++;return;}
  game.previousPlayerPos=[...game.player.pos];reduceTimers(game);updateFuel(game);movePlayer(game);pickup(game);if(game.controls.interact)interact(game);applySafeZones(game);if(game.controls.pulse&&!prior.pulse)pulse(game);moveShades(game);applySafeZones(game);moveDrifters(game);touch(game);spawnSystems(game);game.simTick++;game.tick++;updateEnd(game);
  game.previousControls={...game.previousControls,...Object.fromEntries(["jump","interact","pulse","dash","pause"].map(k=>[k,game.controls[k]]))};
}

export function snapshot(game){const p=game.player;return{type:"snapshot",tick:game.tick,sim_tick:game.simTick,night:game.night,state:game.state,time_left_s:round3(game.timeLeft),score:game.score,wind:{active:game.wind.active,dir_deg:round3(game.wind.dir_deg)},player:{pos:p.pos.map(round3),vel:p.vel.map(round3),flames:p.flames,carried:p.carried,capacity:p.capacity,successful_lights:p.successfulLights,grounded:p.grounded,invuln:p.invulnTicks>0,dash_cd_s:round3(p.dashCdTicks/60),pulse_cd_s:round3(p.pulseCdTicks/60),charm_s:round3(p.charmTicks/60)},lanterns:game.lanterns.map(l=>({id:l.id,pos:l.pos.map(round3),lit:l.lit,deposited:l.deposited,fuel:l.lit?round1(lanternFuel(l)):0,ever_lit:l.everLit,relit_count:l.relitCount})),shades:game.shades.map(s=>({id:s.id,pos:s.pos.map(round3),state:s.state,target_lantern_id:s.targetLanternId})),motes:game.motes.map(m=>({id:m.id,pos:m.pos.map(round3),kind:m.kind,ttl_s:m.ttlTicks===null?null:round3(m.ttlTicks/60)})),motes_active:game.motes.length,drifters:game.drifters.map(d=>({id:d.id,pos:d.pos.map(round3),state:d.state,stolen:d.stolen})),charms:game.charms.map(c=>({id:c.id,pos:c.pos.map(round3),available:c.available,respawn_s:round3(c.respawnTicks/60)}))};}
export function endRecord(game){return{type:"end",ticks:game.tick,sim_tick:game.simTick,night:game.night,state:game.state,score:game.score};}
export function gameEvents(game){return game.events.splice(0);}
export function publicState(game){return game;}
