const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec4 aInstance0;
attribute vec4 aInstance1;
attribute vec4 aInstance2;
attribute vec4 aInstance3;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uInstanced;
varying vec3 vNormal;
varying vec3 vWorld;
void main(){
  mat4 instanceModel=mat4(aInstance0,aInstance1,aInstance2,aInstance3);
  mat4 model=uInstanced>0.5?instanceModel:uModel;
  vec4 world = model * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = mat3(model) * aNormal;
  gl_Position = uProjection * uView * world;
}`;

const FRAGMENT = `
precision mediump float;
uniform vec3 uColor;
uniform float uGlow;
uniform vec3 uCamera;
uniform float uAmbient;
uniform float uNatural;
uniform float uFade;
uniform float uPulseResponse;
uniform vec4 uLanternLights[8];
uniform float uLanternRadii[8];
uniform vec4 uPulseLight;
uniform float uPulseRadius;
varying vec3 vNormal;
varying vec3 vWorld;
float lampLight(vec4 lamp, float radius, vec3 n){
  vec3 delta = lamp.xyz - vWorld;
  float distanceToLamp = length(delta);
  float falloff = max(0.0, 1.0 - distanceToLamp / max(radius, 0.01));
  float diffuse = 0.22 + 0.78 * max(dot(n, normalize(delta)), 0.0);
  return falloff * falloff * lamp.w * diffuse;
}
float hash3(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
void main(){
  vec3 n = normalize(vNormal);
  vec3 light = normalize(vec3(-0.35, 0.8, 0.45));
  float diffuse = max(dot(n, light), 0.0);
  float rim = pow(1.0 - max(dot(n, normalize(uCamera - vWorld)), 0.0), 2.0);
  float shade = 0.34 + uAmbient * 0.58 + diffuse * 0.48;
  float warmLight = 0.0;
  warmLight += lampLight(uLanternLights[0],uLanternRadii[0],n);
  warmLight += lampLight(uLanternLights[1],uLanternRadii[1],n);
  warmLight += lampLight(uLanternLights[2],uLanternRadii[2],n);
  warmLight += lampLight(uLanternLights[3],uLanternRadii[3],n);
  warmLight += lampLight(uLanternLights[4],uLanternRadii[4],n);
  warmLight += lampLight(uLanternLights[5],uLanternRadii[5],n);
  warmLight += lampLight(uLanternLights[6],uLanternRadii[6],n);
  warmLight += lampLight(uLanternLights[7],uLanternRadii[7],n);
  vec3 color = uColor * shade + uColor * (uGlow * 0.75 + rim * uGlow * 0.22);
  color += uColor * vec3(1.0,0.58,0.27) * min(warmLight,1.35) * 1.15;
  float pulseDistance=length(uPulseLight.xyz-vWorld);
  float pulseFalloff=max(0.0,1.0-pulseDistance/max(uPulseRadius,0.01));
  color += uColor * vec3(.50,.78,1.0) * pulseFalloff * uPulseLight.w * 1.55 * uPulseResponse;
  float variation = hash3(floor(vWorld * 2.2)) - 0.5;
  color *= (1.0 + uNatural * variation * 0.32) * uFade;
  gl_FragColor = vec4(color, 1.0);
}`;

function shader(gl, type, source) {
  const item = gl.createShader(type);
  gl.shaderSource(item, source);
  gl.compileShader(item);
  if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(item) || "Shader compile error");
  return item;
}

function mesh(gl, positions, normals) {
  const p = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, p);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  const n = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, n);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  return { p, n, count: positions.length / 3 };
}

function sphere(gl, segments = 12, rings = 8) {
  const p = [], n = [];
  for (let y = 0; y < rings; y++) for (let x = 0; x < segments; x++) {
    const a0 = (y / rings) * Math.PI, a1 = ((y + 1) / rings) * Math.PI;
    const b0 = (x / segments) * Math.PI * 2, b1 = ((x + 1) / segments) * Math.PI * 2;
    const point = (a, b) => [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
    const tri = [point(a0,b0), point(a1,b0), point(a1,b1), point(a0,b0), point(a1,b1), point(a0,b1)];
    for (const v of tri) { p.push(...v); n.push(...v); }
  }
  return mesh(gl, p, n);
}

function organicSphere(gl, segments = 14, rings = 9, seed = 0) {
  const p = [], n = [];
  for (let y = 0; y < rings; y++) for (let x = 0; x < segments; x++) {
    const a0 = (y / rings) * Math.PI, a1 = ((y + 1) / rings) * Math.PI;
    const b0 = (x / segments) * Math.PI * 2, b1 = ((x + 1) / segments) * Math.PI * 2;
    const point = (a, b) => {
      const wobble = 1 + 0.13 * Math.sin(3 * b + seed) * Math.sin(2 * a + seed * 0.7) + 0.055 * Math.sin(5 * b - a * 3 + seed * 1.3);
      const v = [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
      return v.map(q => q * wobble);
    };
    for (const v of [point(a0,b0),point(a1,b0),point(a1,b1),point(a0,b0),point(a1,b1),point(a0,b1)]) {
      p.push(...v); const m=Math.hypot(...v)||1; n.push(v[0]/m,v[1]/m,v[2]/m);
    }
  }
  return mesh(gl, p, n);
}

function cylinder(gl, segments = 12, cone = false) {
  const p = [], n = [];
  const topRadius = cone ? 0 : 1;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2, b = ((i + 1) / segments) * Math.PI * 2;
    const p0 = [Math.cos(a), 0, Math.sin(a)], p1 = [Math.cos(b), 0, Math.sin(b)];
    const q0 = [Math.cos(a) * topRadius, 1, Math.sin(a) * topRadius], q1 = [Math.cos(b) * topRadius, 1, Math.sin(b) * topRadius];
    const norm = (v) => { const m = Math.hypot(v[0], 0.25, v[2]); return [v[0] / m, 0.25 / m, v[2] / m]; };
    for (const v of [p0,q0,q1,p0,q1,p1]) { p.push(...v); n.push(...norm(v)); }
    p.push(0,0,0,...p1,...p0); n.push(0,-1,0, 0,-1,0, 0,-1,0);
    if (!cone) { p.push(0,1,0,...q0,...q1); n.push(0,1,0, 0,1,0, 0,1,0); }
  }
  return mesh(gl, p, n);
}

function torus(gl, segments = 32, sides = 7) {
  const p=[],n=[],major=1,minor=0.055;
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
    const u0=i/segments*Math.PI*2,u1=(i+1)/segments*Math.PI*2,v0=j/sides*Math.PI*2,v1=(j+1)/sides*Math.PI*2;
    const point=(u,v)=>[(major+minor*Math.cos(v))*Math.cos(u),minor*Math.sin(v),(major+minor*Math.cos(v))*Math.sin(u)];
    const normal=(u,v)=>[Math.cos(v)*Math.cos(u),Math.sin(v),Math.cos(v)*Math.sin(u)];
    for(const [u,v] of [[u0,v0],[u1,v0],[u1,v1],[u0,v0],[u1,v1],[u0,v1]]){p.push(...point(u,v));n.push(...normal(u,v));}
  }
  return mesh(gl,p,n);
}

function cube(gl) {
  const faces=[
    [[0,0,-1],[-1,-1,-1,1,-1,-1,1,1,-1,-1,-1,-1,1,1,-1,-1,1,-1]],
    [[0,0,1],[-1,-1,1,1,1,1,1,-1,1,-1,-1,1,-1,1,1,1,1,1]],
    [[-1,0,0],[-1,-1,-1,-1,1,-1,-1,1,1,-1,-1,-1,-1,1,1,-1,-1,1]],
    [[1,0,0],[1,-1,-1,1,-1,1,1,1,1,1,-1,-1,1,1,1,1,1,-1]],
    [[0,-1,0],[-1,-1,-1,-1,-1,1,1,-1,1,-1,-1,-1,1,-1,1,1,-1,-1]],
    [[0,1,0],[-1,1,-1,1,1,1,-1,1,1,-1,1,-1,1,1,-1,1,1,1]],
  ];
  const positions=[],normals=[];for(const[normal,vertices]of faces)for(let i=0;i<vertices.length;i+=3){positions.push(vertices[i],vertices[i+1],vertices[i+2]);normals.push(...normal);}
  return mesh(gl,positions,normals);
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
  return out;
}

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
}

function lookAt(eye, center, up = [0,1,0]) {
  const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x/l); };
  const sub = (a,b) => a.map((x,i) => x-b[i]);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const z = norm(sub(eye, center)), x = norm(cross(up, z)), y = cross(z, x);
  return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -x[0]*eye[0]-x[1]*eye[1]-x[2]*eye[2], -y[0]*eye[0]-y[1]*eye[1]-y[2]*eye[2], -z[0]*eye[0]-z[1]*eye[1]-z[2]*eye[2], 1]);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", { antialias: true, alpha: false, powerPreference: "high-performance" });
    if (!this.gl) throw new Error("WebGL is unavailable in this browser");
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    ["aPosition","aNormal","aInstance0","aInstance1","aInstance2","aInstance3"].forEach((name,index)=>gl.bindAttribLocation(program,index,name));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Could not link renderer");
    this.program = program;
    this.loc = {
      pos: gl.getAttribLocation(program, "aPosition"), normal: gl.getAttribLocation(program, "aNormal"),
      instance0:gl.getAttribLocation(program,"aInstance0"),instance1:gl.getAttribLocation(program,"aInstance1"),instance2:gl.getAttribLocation(program,"aInstance2"),instance3:gl.getAttribLocation(program,"aInstance3"),
      projection: gl.getUniformLocation(program, "uProjection"), view: gl.getUniformLocation(program, "uView"), model: gl.getUniformLocation(program, "uModel"),
      instanced:gl.getUniformLocation(program,"uInstanced"),
      color: gl.getUniformLocation(program, "uColor"), glow: gl.getUniformLocation(program, "uGlow"), camera: gl.getUniformLocation(program, "uCamera"), ambient: gl.getUniformLocation(program,"uAmbient"),
      natural: gl.getUniformLocation(program,"uNatural"), fade: gl.getUniformLocation(program,"uFade"), pulseResponse: gl.getUniformLocation(program,"uPulseResponse"), pulseLight: gl.getUniformLocation(program,"uPulseLight"), pulseRadius: gl.getUniformLocation(program,"uPulseRadius"), lanternLights: gl.getUniformLocation(program,"uLanternLights[0]"), lanternRadii: gl.getUniformLocation(program,"uLanternRadii[0]"),
    };
    this.instanceLocations=[this.loc.instance0,this.loc.instance1,this.loc.instance2,this.loc.instance3];
    this.meshes = { sphere: sphere(gl), organicSphere: organicSphere(gl), cylinder: cylinder(gl), cone: cylinder(gl, 12, true), torus: torus(gl), cube:cube(gl) };
    this.treeCache = new Map();
    this.colorblind = false;
    this.reduceMotion = false;
    this.instancing = gl.getExtension("ANGLE_instanced_arrays");
    this.instanceBuffer = gl.createBuffer();
    this.pendingDraws = [];
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0.035, 0.055, 0.12, 1);
    this.lastDpr = 0;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const width = Math.floor(this.canvas.clientWidth * dpr), height = Math.floor(this.canvas.clientHeight * dpr);
    if (width !== this.canvas.width || height !== this.canvas.height || dpr !== this.lastDpr) {
      this.canvas.width = width; this.canvas.height = height; this.lastDpr = dpr;
      this.gl.viewport(0, 0, width, height);
    }
  }

  draw(game, yaw, elapsed, cameraOverride = null) {
    this.resize();
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const p = game.player.pos;
    const back = [-Math.sin(yaw) * 14, 9.5, -Math.cos(yaw) * 14];
    const eye = cameraOverride?.eye ?? [p[0] + back[0], p[1] + back[1], p[2] + back[2]];
    const projection = perspective(Math.PI / 3, this.canvas.width / Math.max(1, this.canvas.height), 0.1, 180);
    const view = lookAt(eye, cameraOverride?.target ?? [p[0], 1.5, p[2]]);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.loc.projection, false, projection);
    gl.uniformMatrix4fv(this.loc.view, false, view);
    gl.uniform3fv(this.loc.camera, eye);

    const litRatio=game.lanterns.filter(l=>l.lit).length/Math.max(1,game.lanterns.length);
    gl.uniform1f(this.loc.ambient,0.13+0.24*litRatio);
    const lights=new Float32Array(32),radii=new Float32Array(8);
    for(let i=0;i<Math.min(8,game.lanterns.length);i++){
      const l=game.lanterns[i]; if(!l.lit)continue;
      const age=Math.max(0,(game.tick-(l.litAtTick??(game.tick-180)))/60),t=Math.min(1,age/3.2),growth=t*t*(3-2*t);
      const fuel=l.fuelUnits/60,flicker=fuel<30&&Math.floor(elapsed*2)%2===1?.04:1;
      lights.set([l.pos[0],(l.pos[1]||0)+2.65,l.pos[2],(0.28+growth*0.92)*flicker],i*4);
      radii[i]=(2.2+growth*17.8)*flicker;
    }
    gl.uniform4fv(this.loc.lanternLights,lights); gl.uniform1fv(this.loc.lanternRadii,radii);
    const pulseProgress=game.pulseVisualTicks>0?1-game.pulseVisualTicks/24:0,pulseGrowth=pulseProgress*pulseProgress*(3-2*pulseProgress),pulseActive=game.pulseVisualTicks>0&&!this.reduceMotion;
    gl.uniform4f(this.loc.pulseLight,p[0],p[1]+.9,p[2],pulseActive?1.8-.55*pulseProgress:0);
    gl.uniform1f(this.loc.pulseRadius,pulseActive?2.4+pulseGrowth*8.6:.01);
    let pulseResponse=1;
    this.pendingDraws.length=0;
    const draw = (kind, pos, scale, color, glow = 0, rotation = 0, tilt = 0, natural = 0, fade = 1) => {
      const c=Math.cos(rotation),s=Math.sin(rotation),cx=Math.cos(tilt),sx=Math.sin(tilt);
      const model=new Float32Array([scale[0]*c,0,-scale[0]*s,0, scale[1]*s*sx,scale[1]*cx,scale[1]*c*sx,0, scale[2]*s*cx,-scale[2]*sx,scale[2]*c*cx,0,pos[0],pos[1],pos[2],1]);
      this.pendingDraws.push({kind,model,color,glow,natural,fade,pulseResponse});
    };

    // Terrain varies by night; broad ground shapes keep the scene legible from the follow camera.
    if (game.night === 2) {
      for (const cx of [0,70]) { draw("cylinder", [cx,-0.48,0], [29,0.95,29], [0.18,0.23,0.27]); draw("cylinder", [cx,0,0], [28.3,0.08,28.3], [0.25,0.40,0.29]); }
      draw("cylinder", [35,-0.16,0], [9,0.22,2.05], [0.34,0.35,0.30]);
    } else {
      const radius=game.night===3?46:41;
      draw("cylinder", [0,-0.48,0], [radius,0.95,radius], [0.18,0.23,0.27]);
      draw("cylinder", [0,0,0], [radius-0.7,0.08,radius-0.7], [0.25,0.40,0.29]);
      if(game.night===3){draw("cylinder",[0,1.45,18],[24,0.13,12],[0.28,0.43,0.31]);draw("cylinder",[0,3,0],[24,0.14,24],[0.29,0.46,0.32]);draw("cylinder",[0,6,0],[8,0.14,8],[0.31,0.49,0.34]);}
    }
    // Benchmark keeps the standardized terrain and lantern lighting while omitting decorative assets.
    if(!game.benchmarkMode){
    // Low grass tufts are batched into three meshes so the whole island gets ground cover cheaply.
    const grassKey=`grass${game.night}`;
    if(!this.meshes[`${grassKey}0`]){
      let state=92317+game.night*3803;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
      const positions=[[],[],[]],normals=[[],[],[]],count=game.night===2?23000:19000;
      for(let i=0;i<count;i++){
        let cx=0,cz=0,r=0,y=0;
        if(game.night===2){cx=rand()<.5?0:70;cz=(rand()*2-1)*25;cx+=(rand()*2-1)*25;r=Math.hypot(cx-(cx<35?0:70),cz);if(r>26)continue;}
        else {const a=rand()*Math.PI*2;r=Math.sqrt(rand())*(game.night===3?44:39);cx=Math.cos(a)*r;cz=Math.sin(a)*r;if(game.night===3){if(r<8)y=6;else if(r>=12&&r<=24&&cz>0)y=3;}}
        y+=.13;const group=Math.floor(rand()*3),arr=positions[group],ns=normals[group];
        // Three slim, bent blades read as grass strokes instead of bright ground speckles.
        for(let blade=0;blade<3;blade++){
          const a=rand()*Math.PI*2,w=.045+rand()*.035,h=.42+rand()*.48,lean=.05+rand()*.15;
          const sx=Math.cos(a),sz=Math.sin(a),bx=-sz*w,bz=sx*w,tx=cx+sx*lean,tz=cz+sz*lean;
          arr.push(cx+bx,y,cz+bz,tx,y+h,tz,cx-bx,y,cz-bz);
          const nx=sx*.62,ny=.48,nz=sz*.62;ns.push(nx,ny,nz,nx,ny,nz,nx,ny,nz);
        }
      }
      for(let i=0;i<3;i++)this.meshes[`${grassKey}${i}`]=mesh(gl,positions[i],normals[i]);
    }
    const grassColors=[[.23,.38,.18],[.29,.43,.20],[.20,.34,.16]];
    for(let i=0;i<3;i++)draw(`${grassKey}${i}`,[0,0,0],[1,1,1],grassColors[i],0,0,0,.25);
    // Build a seeded grove once per night: substantial trunks, visible limbs, and varied crowns.
    const groveKey=`${game.night}:${game.seed}`;
    if(!this.treeCache.has(groveKey)){
      let state=(game.seed+game.night*73471)>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const trees=[];
      const centers=game.night===2?[[0,24],[70,24]]:[[0,game.night===3?40:38]];
      for(const[cx,maxR]of centers){const count=game.night===2?42:72;for(let i=0;i<count;i++){const a=rand()*Math.PI*2,r=5+rand()*(maxR-5),x=cx+Math.cos(a)*r,z=Math.sin(a)*r;
        if(game.night===1&&r<12)continue;if(game.night===3&&r<13)continue;
        const type=Math.floor(rand()*4),size=.8+rand()*.75;let y=0;if(game.night===3&&r>=12&&r<=24&&z>0)y=3;
        trees.push({x,z,y,type,size,phase:rand()*6});}}
      this.treeCache.set(groveKey,trees);
    }
    for(const t of this.treeCache.get(groveKey)){
      const {x,z,y,type,size}=t, trunk=[0.39*size, (type===2?5.1:type===1?3.8:3.2)*size, 0.39*size];
      draw("cylinder",[x,y,z],trunk,type===3?[0.31,0.21,0.16]:[0.29,0.20,0.14],0,0,0,.5);
      if(type===1){ // coconut palm
        draw("cone",[x,y+trunk[1]*.68,z],[1.45*size,.34*size,1.45*size],[0.20,0.36,0.22],0,0,0,.65);
        for(let b=0;b<5;b++){const a=b*1.256+t.phase;draw("cone",[x+Math.cos(a)*.5*size,y+trunk[1]*.9,z+Math.sin(a)*.5*size],[.43*size,1.75*size,.43*size],[0.23,0.41,0.25],0,a,0.6,.65);}
      }else if(type===2){ // tall pine
        for(let b=0;b<3;b++)draw("cone",[x,y+trunk[1]*(.4+b*.22),z],[1.42*size*(1-b*.18),1.42*size,.1+1.42*size*(1-b*.18)],[0.16,0.32+b*.025,0.21],0,0,0,.65);
      }else{
        const crown=type===3?[0.72,0.38,0.32]:[0.19,0.34,0.21];
        for(let b=0;b<3;b++){const a=b*2.094+t.phase;const bx=x+Math.cos(a)*.57*size,bz=z+Math.sin(a)*.57*size,by=y+trunk[1]*.67;
          draw("cylinder",[x,y+trunk[1]*.46,z],[.11*size,1.32*size,.11*size],[0.35,0.25,0.17],0,a,.7,.45);
          draw("organicSphere",[bx,by+1.25*size,bz],[1.1*size,1.12*size,1.05*size],crown,0,0,0,.8);
        }
      }
    }
    }

    // Lanterns make the route and current objective obvious.
    for (const l of game.lanterns) {
      const lit = l.lit;
      const lx=l.pos[0],ly=l.pos[1]||0,lz=l.pos[2],metal=lit?[0.56,0.35,0.16]:[0.31,0.22,0.15],squash=lit?1:.8,fuel=l.fuelUnits/60,blink=lit&&fuel<30&&Math.floor(elapsed*2)%2===1;
      draw("cylinder", [lx,ly+0.1*squash,lz], [0.34*squash,2.15*squash,0.34*squash], [0.29,0.18,0.13],0,0,0,.35);
      draw("cylinder",[lx,ly+2.1*squash,lz],[.55*squash,.12*squash,.55*squash],[.34,.22,.15],0,0,0,.25);
      // Open lantern cage: narrow uprights and thin hoops leave the flame visible.
      draw("torus",[lx,ly+2.38*squash,lz],[.4*squash,.4*squash,.4*squash],metal,lit?.08:0,0,0,.25);
      draw("torus",[lx,ly+3.04*squash,lz],[.4*squash,.4*squash,.4*squash],metal,lit?.08:0,0,0,.25);
      for(let bar=0;bar<8;bar++){
        const a=bar*Math.PI/4;
        draw("cylinder",[lx+Math.cos(a)*.34*squash,ly+2.4*squash,lz+Math.sin(a)*.34*squash],[.047*squash,.63*squash,.047*squash],metal,lit?.04:0,0,0,.2);
      }
      draw("sphere",[lx,ly+2.65*squash,lz],[.12*squash,.22*squash,.12*squash],lit?(blink?[.3,.2,.12]:[1,.49,.10]):[.32,.22,.11],lit&&!blink?.75:0);
      if(lit&&!blink)draw("sphere",[lx,ly+2.7*squash,lz],[.055*squash,.13*squash,.055*squash],[1,.82,.40],.55);
      draw("cone", [lx,ly+3.08*squash,lz], [.62*squash,.38*squash,.62*squash], [0.30,0.19,0.13],0,0,0,.3);
      draw("cylinder", [lx,ly+3.45*squash,lz], [0.075*squash,0.15*squash,0.075*squash], [0.46,0.30,0.17],0,0,0,.2);
      if(lit){draw("cube",[lx,ly+4.05,lz],[.48,.055,.06],[.1,.11,.12],0);if(!blink)draw("cube",[lx-.48*(1-fuel/100)/2,ly+4.05,lz],[.48*fuel/100,.055,.065],fuel<30?[1,.9,.68]:[1,.62,.2],.22);}
      else for(let tear=0;tear<5;tear++){const a=tear*Math.PI*2/5;draw("cone",[lx+Math.cos(a)*.2,ly+1.62*squash,lz+Math.sin(a)*.2],[.08,.2,.08],[.68,.58,.43],0,a,Math.PI,.1);}
    }

    // Motes: small warm lights that stand out against the dark ground.
    for (let i = 0; i < game.motes.length; i++) {
      const m = game.motes[i];
      const bob = Math.sin(elapsed * 2.2 + i * 1.7) * 0.13;
      draw("sphere", [m.pos[0],1.15+bob,m.pos[2]], [0.34,0.42,0.34], [1,0.78,0.28], 1.4);
    }

    // Ink shades, with a clear stunned color cue.
    for (const shade of game.shades) {
      if(game.benchmarkMode){draw("sphere",[shade.pos[0],shade.pos[1],shade.pos[2]],[.92,1.13,.92],[.20,.10,.38],.5);continue;}
      const stunned = shade.state === "stunned";
      const fade=shade.state==="spawning"?(()=>{const t=1-Math.max(0,Math.min(60,shade.stateTicks))/60;return t*t*(3-2*t);})():1;
      const bob=Math.sin(elapsed*3+Number(shade.id.replace(/\D/g,"")))*.12;
      const dx=p[0]-shade.pos[0],dz=p[2]-shade.pos[2],face=Math.atan2(dx,dz),fx=Math.sin(face),fz=Math.cos(face),rx=Math.cos(face),rz=-Math.sin(face);
      const shadeColor=stunned?[0.40,0.75,1]:this.colorblind?[0,.25,.42]:[0.20,0.10,0.38],accent=this.colorblind?[0,.70,1]:[.48,.24,1];
      draw("sphere", [shade.pos[0],shade.pos[1]+bob,shade.pos[2]], [0.92,1.13,0.92], shadeColor, stunned ? 1.1 : 0.5,0,0,0,fade);
      draw("torus",[shade.pos[0],shade.pos[1]-.24+bob,shade.pos[2]],[.85,.85,.85],stunned?[.5,.8,1]:accent,.3,0,0,0,fade);
      draw("cone", [shade.pos[0],shade.pos[1]-0.55+bob,shade.pos[2]], [0.88,.86,.88], stunned?[.36,.68,.94]:[.14,.07,.28],stunned?.6:.25,0,0,0,fade);
      for(const side of [-1,1]){
        const ex=shade.pos[0]+rx*side*.28+fx*.77,ez=shade.pos[2]+rz*side*.28+fz*.77,ey=shade.pos[1]+.15+bob;
        draw("sphere",[ex,ey,ez],[.2,.22,.11],[.97,.95,.86],.42,0,0,0,fade);
        draw("sphere",[ex+fx*.09,ey,ez+fz*.09],[.085,.095,.05],this.colorblind?accent:[.12,.08,.19],.3,0,0,0,fade);
      }
    }

    // Mây: layered tunic, moving limbs, readable face, nón lá, and a small hand lantern.
    const px = p[0], py = p[1], pz = p[2];
    pulseResponse=.06;
    const face=game.player.facingYaw||0,fx=Math.sin(face),fz=Math.cos(face),rx=Math.cos(face),rz=-Math.sin(face);
    const stride=Math.min(1,Math.hypot(game.player.vel[0],game.player.vel[2])/4),swing=Math.sin(elapsed*9)*.34*stride;
    for(const side of [-1,1]){
      draw("cylinder",[px+rx*side*.17,py+.04,pz+rz*side*.17],[.13,.42,.13],[.13,.27,.28],0,face,swing*side);
      draw("sphere",[px+rx*side*.17+fx*swing*.2,py+.05,pz+rz*side*.17+fz*swing*.2],[.17,.11,.23],[.13,.16,.18],0,face);
      draw("cylinder",[px+rx*side*.37,py+.78,pz+rz*side*.37],[.14,.45,.14],[.14,.40,.35],0,face,-swing*side);
      draw("sphere",[px+rx*side*.39,py+.68,pz+rz*side*.39],[.13,.15,.13],[.88,.61,.43]);
    }
    draw("cone",[px,py+.36,pz],[.48,.94,.42],[.12,.39,.34],0,face);
    draw("cylinder",[px,py+1.05,pz],[.29,.12,.29],[.82,.56,.24],0,face);
    draw("sphere", [px,py+1.48,pz], [.37,.4,.36], [.91,.69,.51]);
    for(const side of [-1,1]){
      const ex=px+fx*.30+rx*side*.12,ez=pz+fz*.30+rz*side*.12;
      draw("sphere",[ex,py+1.51,ez],[.05,.07,.035],[.98,.93,.79],.05);
      draw("sphere",[ex+fx*.025,py+1.51,ez+fz*.025],[.024,.043,.018],[.12,.09,.08]);
    }
    draw("cone", [px,py+1.78,pz], [0.77,0.39,0.77], [0.62,0.40,0.17],0,face);
    draw("torus",[px,py+1.83,pz],[.77,.2,.77],[.75,.52,.23],.04,0,0,.15);
    const hx=px+rx*.56, hz=pz+rz*.56;
    draw("cylinder", [hx,py+.83,hz], [.045,.19,.045], [.33,.20,.12]);
    draw("torus",[hx,py+1.09,hz],[.16,.17,.16],[.52,.32,.14],.04);
    draw("sphere", [hx,py+1.10,hz], [.075,.12,.075], [1,.59,.18], .52);

    pulseResponse=1;
    if(!this.reduceMotion&&game.pulseVisualTicks>0){const progress=pulseProgress,radius=.9+pulseGrowth*9.5,second=Math.max(.65,radius-1.8);draw("torus",[px,py+.1,pz],[radius,.3,radius],[.57,.82,1],1.12-progress*.32);draw("torus",[px,py+.14,pz],[second,.18,second],[.82,.93,1],.62-progress*.2);}

    if (game.player.invulnTicks > 0) {pulseResponse=.06;draw("sphere", [px,py+0.95,pz], [0.62,0.84,0.51], [0.30,0.62,0.79], 0.35);}
    this.flushDraws();
  }

  flushDraws() {
    const gl=this.gl, groups=new Map();
    for(const draw of this.pendingDraws){const key=[draw.kind,draw.color.join(","),draw.glow,draw.natural,draw.fade,draw.pulseResponse].join("|");let group=groups.get(key);if(!group){group={...draw,models:[]};groups.set(key,group);}group.models.push(draw.model);}
    for(const group of groups.values()){
      const item=this.meshes[group.kind];
      gl.bindBuffer(gl.ARRAY_BUFFER,item.p);gl.enableVertexAttribArray(this.loc.pos);gl.vertexAttribPointer(this.loc.pos,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,item.n);gl.enableVertexAttribArray(this.loc.normal);gl.vertexAttribPointer(this.loc.normal,3,gl.FLOAT,false,0,0);
      gl.uniform3fv(this.loc.color,group.color);gl.uniform1f(this.loc.glow,group.glow);gl.uniform1f(this.loc.natural,group.natural);gl.uniform1f(this.loc.fade,group.fade);gl.uniform1f(this.loc.pulseResponse,group.pulseResponse);
      if(this.instancing&&group.models.length>1){
        const data=new Float32Array(group.models.length*16);group.models.forEach((model,index)=>data.set(model,index*16));gl.bindBuffer(gl.ARRAY_BUFFER,this.instanceBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
        for(let column=0;column<4;column++){const location=this.instanceLocations[column];gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,4,gl.FLOAT,false,64,column*16);this.instancing.vertexAttribDivisorANGLE(location,1);}
        gl.uniform1f(this.loc.instanced,1);this.instancing.drawArraysInstancedANGLE(gl.TRIANGLES,0,item.count,group.models.length);
        for(let column=0;column<4;column++)this.instancing.vertexAttribDivisorANGLE(this.instanceLocations[column],0);
      }else{
        gl.uniform1f(this.loc.instanced,0);
        for(const model of group.models){gl.uniformMatrix4fv(this.loc.model,false,model);gl.drawArrays(gl.TRIANGLES,0,item.count);}
      }
    }
  }
}
