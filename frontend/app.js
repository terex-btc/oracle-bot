/* ─── Oracle Bot — Cosmic Edition ───────────────────────────── */

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

const tg = window.Telegram?.WebApp;

function applyTopInset() {
  const deviceTop  = tg?.safeAreaInset?.top        ?? 0;
  const contentTop = tg?.contentSafeAreaInset?.top ?? 0;
  const sum = deviceTop + contentTop;
  const top = tg?.isFullscreen ? Math.max(sum, 62) : Math.max(sum, 0);
  document.documentElement.style.setProperty('--tg-safe-top', top + 'px');
}

if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#03020f');
  tg.setBackgroundColor('#03020f');

  if (tg.requestFullscreen) tg.requestFullscreen();

  tg.onEvent('fullscreenChanged', () => {
    if (!tg.isFullscreen && tg.requestFullscreen) tg.requestFullscreen();
    applyTopInset();
  });

  tg.onEvent('safeAreaChanged', applyTopInset);
  tg.onEvent('contentSafeAreaChanged', applyTopInset);

  applyTopInset();
}

document.addEventListener('DOMContentLoaded', () => {
  const current = getComputedStyle(document.documentElement).getPropertyValue('--tg-safe-top').trim();
  const currentVal = parseInt(current) || 0;
  if (currentVal < 62) {
    document.documentElement.style.setProperty('--tg-safe-top', '62px');
  }
});

// ─── Cosmic Background ─────────────────────────────────────────
function buildCosmicBg() {
  const bg = document.createElement('div');
  bg.className = 'cosmic-bg';
  bg.innerHTML = `
    <div class="nebula nebula-1"></div>
    <div class="nebula nebula-2"></div>
    <div class="nebula nebula-3"></div>`;
  document.getElementById('app').prepend(bg);
}
buildCosmicBg();

// ─── Stars + Shooting Stars ─────────────────────────────────────
function createStars(container, count = 80) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.8 + 0.4;
    s.style.cssText = [
      `width:${size}px`, `height:${size}px`,
      `left:${Math.random() * 100}%`, `top:${Math.random() * 100}%`,
      `--d:${(Math.random() * 5 + 2).toFixed(1)}s`,
      `--delay:${(Math.random() * 6).toFixed(1)}s`,
      `--min-op:${(Math.random() * 0.1 + 0.03).toFixed(2)}`,
      `--max-op:${(Math.random() * 0.6 + 0.4).toFixed(2)}`
    ].join(';');
    frag.appendChild(s);
  }
  for (let i = 0; i < 4; i++) {
    const ss = document.createElement('div');
    ss.className = 'shooting-star';
    const w = Math.random() * 120 + 60;
    ss.style.cssText = [
      `width:${w}px`,
      `left:${Math.random() * 70}%`,
      `top:${Math.random() * 50}%`,
      `--sd:${(Math.random() * 1.5 + 1.5).toFixed(1)}s`,
      `--ss:${(Math.random() * 12 + 4).toFixed(1)}s`,
      `--sa:${-(Math.random() * 20 + 10)}deg`
    ].join(';');
    frag.appendChild(ss);
  }
  container.appendChild(frag);
}
document.querySelectorAll('.stars-bg').forEach(c => createStars(c));

// ─── Canvas 2D Crystal Ball ────────────────────────────────────
function OrbCanvas(canvas, size, isMain) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const noop = () => {};
    return { setColor: noop, pause: noop, resume: noop, stop: noop, setEnergy: noop, setTilt: noop, clearTilt: noop };
  }
  const R = (size * dpr) / 2;

  let hue = 278, targetHue = 278, raf;

  // Randomly initialized wisps — organic, unique each load
  const n = isMain ? 9 : 4;
  const wisps = Array.from({ length: n }, () => ({
    ph1: Math.random() * Math.PI * 2,
    ph2: Math.random() * Math.PI * 2,
    sp1: 0.10 + Math.random() * 0.16,
    sp2: 0.06 + Math.random() * 0.11,
    rx:  0.22 + Math.random() * 0.28,
    ry:  0.14 + Math.random() * 0.22,
    sz:  0.24 + Math.random() * 0.22,
    ho:  (Math.random() - 0.5) * 56,
    al:  0.28 + Math.random() * 0.24,
  }));

  const sparkles = Array.from({ length: isMain ? 24 : 8 }, () => ({
    r:   0.06 + Math.random() * 0.78,
    ph:  Math.random() * Math.PI * 2,
    spd: 0.08 + Math.random() * 0.22,
    epy: 0.48 + Math.random() * 0.52,
    sz:  0.9 + Math.random() * 2.4,
    al:  0.38 + Math.random() * 0.52,
    tw:  Math.random() * Math.PI * 2,
    tws: 0.6 + Math.random() * 2.2,
    ho:  (Math.random() - 0.5) * 90,
  }));

  function drawFrame(t) {
    ctx.clearRect(0, 0, R * 2, R * 2);

    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R * 0.918, 0, Math.PI * 2);
    ctx.clip();

    // ── Base gradient: light source top-left, shadow bottom-right ──
    const base = ctx.createRadialGradient(R * 0.52, R * 0.32, R * 0.01, R * 0.86, R * 0.88, R * 1.08);
    base.addColorStop(0.00, `hsl(${hue + 30}, 86%, 70%)`);
    base.addColorStop(0.16, `hsl(${hue + 12}, 100%, 46%)`);
    base.addColorStop(0.40, `hsl(${hue},       100%, 28%)`);
    base.addColorStop(0.66, `hsl(${hue - 12}, 100%, 12%)`);
    base.addColorStop(0.88, `hsl(${hue - 24}, 100%, 4%)`);
    base.addColorStop(1.00, `hsl(${hue - 32}, 100%, 1%)`);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, R * 2, R * 2);

    // ── Smoke wisps ──
    wisps.forEach(w => {
      const cx = R + Math.cos(t * w.sp1 + w.ph1) * R * w.rx;
      const cy = R + Math.sin(t * w.sp2 + w.ph2) * R * w.ry;
      const r  = R * (w.sz + Math.sin(t * 0.33 + w.ph1 * 0.7) * 0.08);

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const lum = 56 + Math.abs(w.ho) * 0.12;
      g.addColorStop(0.00, `hsla(${hue + w.ho + 22}, 94%, ${lum}%, ${w.al})`);
      g.addColorStop(0.38, `hsla(${hue + w.ho +  8}, 88%, ${lum - 12}%, ${w.al * 0.50})`);
      g.addColorStop(0.72, `hsla(${hue + w.ho},      80%, ${lum - 22}%, ${w.al * 0.15})`);
      g.addColorStop(1.00, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, R * 2, R * 2);
    });

    // ── Nebula swirl (two opposing rotating blobs) ──
    [[t * 0.09, 0.60, 38], [t * 0.09 + Math.PI, 0.52, -30]].forEach(([ang, fac, dh]) => {
      const sx = R + Math.cos(ang) * R * 0.27;
      const sy = R + Math.sin(ang) * R * 0.27;
      const g  = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * fac);
      g.addColorStop(0,    `hsla(${hue + dh}, 92%, 66%, 0.20)`);
      g.addColorStop(0.48, `hsla(${hue + dh / 2}, 82%, 50%, 0.08)`);
      g.addColorStop(1,    'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, R * 2, R * 2);
    });

    // ── Inner sparkles / floating stars ──
    sparkles.forEach(s => {
      const ang  = t * s.spd + s.ph;
      const dist = s.r * R * 0.78;
      const sx   = R + Math.cos(ang) * dist;
      const sy   = R + Math.sin(ang * s.epy) * dist * 0.82;
      const tw   = 0.5 + Math.sin(t * s.tws + s.tw) * 0.5;
      const sz   = s.sz * dpr * (0.4 + tw * 0.7);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(sz, 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue + s.ho + 28}, 95%, 95%, ${s.al * tw})`;
      ctx.fill();
    });

    // ── Pulsing inner core (breathes life into the ball) ──
    const pulse = 0.5 + Math.sin(t * 1.15) * 0.5;
    const core = ctx.createRadialGradient(R, R, 0, R, R, R * 0.46);
    core.addColorStop(0,    `hsla(${hue + 28}, 78%, 90%, ${0.20 + pulse * 0.12})`);
    core.addColorStop(0.50, `hsla(${hue + 14}, 68%, 65%, 0.07)`);
    core.addColorStop(1,    'transparent');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, R * 2, R * 2);

    // ── Edge vignette (Fresnel depth) ──
    const vign = ctx.createRadialGradient(R, R, R * 0.52, R, R, R * 0.918);
    vign.addColorStop(0,    'transparent');
    vign.addColorStop(0.65, `hsla(${hue - 10}, 80%, 5%, 0.16)`);
    vign.addColorStop(1,    `hsla(${hue - 24}, 80%, 2%, 0.72)`);
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, R * 2, R * 2);

    // ── Inner energy rings ──
    if (isMain) {
      const rp = 0.5 + Math.sin(t * 0.62) * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R * (0.46 + Math.sin(t * 0.38) * 0.04), 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue + 22}, 100%, 84%, ${0.09 + rp * 0.08})`;
      ctx.lineWidth = dpr * 1.3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(R, R, R * (0.64 + Math.sin(t * 0.27 + 1.2) * 0.035), 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue - 18}, 90%, 72%, ${0.05 + rp * 0.04})`;
      ctx.lineWidth = dpr * 0.7;
      ctx.stroke();
      ctx.restore();
    }

    // ── Glass sheen (environment reflection, upper-right) ──
    const sheen = ctx.createRadialGradient(R * 1.18, R * 0.72, R * 0.55, R, R, R * 0.90);
    sheen.addColorStop(0,    'transparent');
    sheen.addColorStop(0.65, `hsla(${hue + 42}, 55%, 94%, 0.08)`);
    sheen.addColorStop(1,    `hsla(${hue + 52}, 44%, 99%, 0.28)`);
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, R * 2, R * 2);

    // ── Rim light from bottom-left (secondary light source → 3D depth) ──
    if (isMain) {
      const rim2 = ctx.createRadialGradient(R * (-0.15), R * 1.55, 0, R * (-0.15), R * 1.55, R * 0.85);
      rim2.addColorStop(0,    `hsla(${hue - 28}, 88%, 70%, 0.14)`);
      rim2.addColorStop(0.50, `hsla(${hue - 18}, 78%, 50%, 0.05)`);
      rim2.addColorStop(1,    'transparent');
      ctx.fillStyle = rim2;
      ctx.fillRect(0, 0, R * 2, R * 2);
    }

    // ── Primary specular highlight (large, soft, white) ──
    const hl1 = ctx.createRadialGradient(R * 0.44, R * 0.32, 0, R * 0.44, R * 0.32, R * 0.34);
    hl1.addColorStop(0,    'rgba(255,255,255,0.82)');
    hl1.addColorStop(0.35, 'rgba(255,255,255,0.30)');
    hl1.addColorStop(0.68, 'rgba(255,255,255,0.08)');
    hl1.addColorStop(1,    'transparent');
    ctx.fillStyle = hl1;
    ctx.fillRect(0, 0, R * 2, R * 2);

    // ── Tight secondary specular (glass glint) ──
    const hl2 = ctx.createRadialGradient(R * 0.56, R * 0.42, 0, R * 0.56, R * 0.42, R * 0.072);
    hl2.addColorStop(0,   'rgba(255,255,255,0.96)');
    hl2.addColorStop(0.5, 'rgba(255,255,255,0.40)');
    hl2.addColorStop(1,   'transparent');
    ctx.fillStyle = hl2;
    ctx.fillRect(0, 0, R * 2, R * 2);

    ctx.restore();

    // ── Rim stroke ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R * 0.918, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue + 32}, 100%, 85%, 0.48)`;
    ctx.lineWidth = dpr * 1.4;
    ctx.stroke();
    ctx.restore();
  }

  let paused = false;
  let lastFrame = 0;

  function tick(now) {
    if (paused) { raf = null; return; }
    raf = requestAnimationFrame(tick);
    // Throttle to 30fps when idle, 60fps when active
    const fps = orbIdle ? 30 : 60;
    if (now - lastFrame < 1000 / fps) return;
    lastFrame = now;
    hue += (targetHue - hue) * 0.026;
    drawFrame(now * 0.001);
  }
  tick(0);

  function pause()  { paused = true;  }
  function resume() { if (!paused) return; paused = false; tick(performance.now()); }

  function setColor(colorName) {
    const map = { yes: 152, no: 352, maybe: 44, default: 278 };
    targetHue = map[colorName] ?? 278;
  }

  const noop = () => {};
  return { setColor, pause, resume, stop: () => { paused = true; cancelAnimationFrame(raf); }, setEnergy: noop, setTilt: noop, clearTilt: noop };
}

// ─── WebGL Mystic Orb — galaxy inside a crystal sphere ────────
function OrbGL(canvas, size) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';

  const gl = canvas.getContext('webgl', {
    alpha: true, premultipliedAlpha: true, antialias: false,
    depth: false, stencil: false, powerPreference: 'low-power',
  });
  if (!gl) return null;

  const VERT = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';

  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2  uRes;
uniform float uTime;
uniform float uHue;
uniform float uEnergy;
uniform vec2  uTilt;
uniform float uSteps;

#define PI 3.14159265
#define MAX_STEPS 28

vec3 hsl2rgb(vec3 c){
  vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);
  return c.z + c.y*(rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
}
mat3 rotX(float a){ float c=cos(a),s=sin(a); return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c); }
mat3 rotY(float a){ float c=cos(a),s=sin(a); return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c); }

float hash13(vec3 p){
  p = fract(p*0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float n000=hash13(i+vec3(0.0,0.0,0.0)), n100=hash13(i+vec3(1.0,0.0,0.0));
  float n010=hash13(i+vec3(0.0,1.0,0.0)), n110=hash13(i+vec3(1.0,1.0,0.0));
  float n001=hash13(i+vec3(0.0,0.0,1.0)), n101=hash13(i+vec3(1.0,0.0,1.0));
  float n011=hash13(i+vec3(0.0,1.0,1.0)), n111=hash13(i+vec3(1.0,1.0,1.0));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
             mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
}
float fbm3(vec3 p){
  float v=0.0, a=0.58;
  for(int i=0;i<3;i++){ v += a*noise3(p); p*=2.03; a*=0.5; }
  return v;
}

float hash21(vec2 p){
  p = fract(p*vec2(123.34,345.45));
  p += dot(p, p + 34.345);
  return fract(p.x*p.y);
}

// studio environment used for glass reflection + rim (dark, so the glass stays deep not milky)
vec3 envCol(vec3 d, float hue){
  vec3 c = vec3(0.008,0.008,0.022);
  c += vec3(0.30,0.36,0.62) * smoothstep(0.25,0.98,d.y) * 0.30;   // faint cool top sky
  return c;
}

// deep space seen through the lens: mostly black, coloured wisps + twinkling stars
vec3 deepSpace(vec3 d, float hue, float t){
  float n1 = fbm3(d*2.6 + vec3(0.0,0.0,t*0.015));
  float n2 = fbm3(d*6.0 + n1*1.5 - vec3(t*0.012,0.0,0.0));
  float neb = smoothstep(0.50,0.95,n1);                 // colour only in the dense wisps
  vec3 col = mix(hsl2rgb(vec3(fract(hue-0.04),0.95,0.14)),
                 hsl2rgb(vec3(fract(hue+0.10),1.00,0.42)), n2) * neb * 0.7;
  vec2 uvp = vec2(atan(d.z,d.x), asin(clamp(d.y,-1.0,1.0)));
  for(int k=0;k<2;k++){
    float sc = 24.0 + float(k)*40.0;
    vec2 g  = uvp*sc;
    vec2 f  = fract(g)-0.5;
    float h = hash21(floor(g) + float(k)*19.7);
    float tw = 0.5+0.5*sin(t*(0.8+h*2.5)+h*40.0);
    col += vec3(1.0,0.96,0.95) * step(0.92,h) * exp(-dot(f,f)*60.0) * tw * 1.5;
  }
  return col;
}

// soft clumpy fog inside the glass — lots of empty gaps so it reads as depth, not a fill
float fog(vec3 q, float t){
  float n1 = fbm3(q*1.7 + vec3(0.0,t*0.07,0.0));
  float n  = fbm3(q*2.7 + n1*1.7 + vec3(0.0,0.0,t*0.04));
  return smoothstep(0.55,0.92,n) * smoothstep(1.0,0.18,length(q));
}

void main(){
  vec2 uv  = (gl_FragCoord.xy*2.0 - uRes)/min(uRes.x,uRes.y);
  float hue = uHue/360.0;
  float t   = uTime;
  float en  = uEnergy;

  // perspective camera, tilted by touch for parallax
  vec3 ro = vec3(0.0,0.0,3.25);
  vec3 rd = normalize(vec3(uv, -2.7));
  mat3 vt = rotY(uTilt.x*0.20) * rotX(-uTilt.y*0.20);
  ro = vt*ro; rd = vt*rd;

  // analytic ray vs unit sphere (real 3D geometry)
  float b  = dot(ro,rd);
  float c0 = dot(ro,ro) - 1.0;
  float disc = b*b - c0;
  if(disc < 0.0){ gl_FragColor = vec4(0.0); return; }   // outside the glass -> fully transparent

  float sq  = sqrt(disc);
  vec3 pos  = ro + rd*(-b - sq);        // front surface point
  vec3 nrm  = pos;                       // normal (unit sphere @ origin)
  float ndv = max(dot(-rd, nrm), 0.0);
  float fres = 0.04 + 0.96*pow(1.0-ndv, 5.0);

  // refract through the glass -> lens direction that bends the background
  vec3 rr = refract(rd, nrm, 1.0/1.46);

  vec3 cCore = hsl2rgb(vec3(fract(hue+0.12),0.85,0.85));
  vec3 cMid  = hsl2rgb(vec3(fract(hue),     1.00,0.62));

  // the whole interior space spins in 3D (auto + touch)
  mat3 gm = rotY(t*(0.05+en*0.20) + uTilt.x*0.6) * rotX(0.35 + uTilt.y*0.45);

  // distorted starfield seen through the lens
  vec3 bg = deepSpace(normalize(gm*rr), hue, t);

  // soft glow from the heart that lights the surrounding fog
  float pulse = 0.5+0.5*sin(t*(1.0+en*3.5));

  // march the inner fog along the refracted ray, lit by the central heart
  float dt  = 2.0 / max(uSteps,1.0);
  float jit = hash21(gl_FragCoord.xy + fract(t));
  vec3  sp  = pos + rr*dt*jit;
  vec3  fogAcc = vec3(0.0);
  float fogT   = 1.0;
  for(int i=0;i<MAX_STEPS;i++){
    if(float(i) >= uSteps) break;
    if(dot(sp,sp) > 1.0) break;
    vec3 q = gm*sp;
    float d = fog(q,t);
    if(d > 0.001){
      float rl  = length(q);
      vec3  fc  = mix(cCore, cMid, smoothstep(0.0,0.6,rl));   // brighter toward the heart
      float lit = 0.35 + 1.6*exp(-rl*rl*2.2);                 // central light falloff
      fogAcc += fc * d * fogT * dt * 9.0 * lit;
      fogT   *= 1.0 - d*dt*4.5;
      if(fogT < 0.04) break;
    }
    sp += rr*dt;
  }

  // luminous heart at the centre (coloured, not blown-out white)
  float ca    = length(pos - rr*dot(pos,rr));   // distance of the inner ray from the centre
  float core  = exp(-ca*ca*10.0);
  vec3  coreCol = mix(cCore, vec3(1.0,0.97,1.0), 0.45);

  // compose interior: deep starfield, glowing fog over it, bright heart
  vec3 inside = bg * fogT + fogAcc;
  inside += coreCol * core * (0.55 + 0.35*pulse + 0.9*en);

  // vertical light/shadow gradient -> real volume (lit top, dark bottom)
  inside *= 0.55 + 0.45*smoothstep(-0.9, 0.7, nrm.y);

  // glass: reflect the room, stronger toward the rim (fresnel)
  vec3 refl = envCol(reflect(rd, nrm), hue);
  vec3 col  = mix(inside, refl, fres*0.30);

  // iridescent rim
  float rim = pow(1.0-ndv, 3.0);
  col += hsl2rgb(vec3(fract(hue+0.45*rim+0.05*sin(t*0.4)),0.85,0.72)) * rim * 0.6;

  // window speculars — the bright glass highlights that sell the "glass"
  float s1 = pow(max(dot(nrm, normalize(vec3(-0.48,0.64,0.60))),0.0), 16.0); // big soft window
  float s2 = pow(max(dot(nrm, normalize(vec3(-0.40,0.55,0.73))),0.0), 230.0);// tight glint
  float s3 = pow(max(dot(nrm, normalize(vec3(0.34,-0.52,0.78))),0.0), 12.0); // soft bounce below
  col += vec3(0.97,0.95,1.0)*s1*0.95 + vec3(1.0)*s2*1.3 + cMid*s3*0.22;

  // pink caustic where the ball meets the stand
  col += cMid * pow(max(-nrm.y-0.25,0.0),2.0) * 0.5;

  col *= 1.0 + en*0.25;
  col  = col/(1.0+col*0.36);            // tonemap
  col  = pow(col, vec3(0.92));

  float cov = smoothstep(0.0, 0.012, disc);   // silhouette AA
  gl_FragColor = vec4(col*cov, cov);
}`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
    return sh;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uRes','uTime','uHue','uEnergy','uTilt','uSteps'].forEach(u => U[u] = gl.getUniformLocation(prog, u));
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(U.uRes, canvas.width, canvas.height);
  // interior march quality — heavier for the big orb, lighter for the mini one
  gl.uniform1f(U.uSteps, size >= 160 ? 22.0 : 12.0);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  let hue = 278, targetHue = 278;
  let energy = 0, targetEnergy = 0;
  let tiltX = 0, tiltY = 0, userTiltX = 0, userTiltY = 0, userTiltAt = 0;
  let paused = false, raf = null, lastFrame = 0, lost = false;

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });

  function frame(now) {
    if (paused || lost) { raf = null; return; }
    raf = requestAnimationFrame(frame);
    const fps = orbIdle ? 30 : 60;
    if (now - lastFrame < 1000 / fps) return;
    lastFrame = now;
    const t = now * 0.001;
    hue    += (targetHue - hue) * 0.026;
    energy += (targetEnergy - energy) * (targetEnergy > energy ? 0.07 : 0.03);
    // touch parallax, drifts on its own when untouched
    const hasUser = (performance.now() - userTiltAt) < 2200;
    const tx = hasUser ? userTiltX : Math.sin(t * 0.21) * 0.20;
    const ty = hasUser ? userTiltY : Math.cos(t * 0.16) * 0.16;
    tiltX += (tx - tiltX) * 0.05;
    tiltY += (ty - tiltY) * 0.05;
    gl.uniform1f(U.uTime, t);
    gl.uniform1f(U.uHue, hue);
    gl.uniform1f(U.uEnergy, energy);
    gl.uniform2f(U.uTilt, tiltX, tiltY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  raf = requestAnimationFrame(frame);

  return {
    setColor(name) {
      const map = { yes: 152, no: 352, maybe: 44, default: 278 };
      targetHue = map[name] ?? 278;
    },
    setEnergy(v) { targetEnergy = v; },
    setTilt(x, y) { userTiltX = x; userTiltY = y; userTiltAt = performance.now(); },
    clearTilt() { userTiltAt = 0; },
    pause() { paused = true; },
    resume() { if (!paused) return; paused = false; if (!raf) raf = requestAnimationFrame(frame); },
    stop() { paused = true; if (raf) cancelAnimationFrame(raf); },
  };
}

function createOrb(canvas, size, isMain) {
  try {
    const orb = OrbGL(canvas, size);
    if (orb) return orb;
  } catch (e) {}
  return OrbCanvas(canvas, size, isMain);
}

// Idle detection — 30fps after 5s of no touch/click
let orbIdle = false;
let orbIdleTimer = null;
function resetOrbIdle() {
  orbIdle = false;
  clearTimeout(orbIdleTimer);
  orbIdleTimer = setTimeout(() => { orbIdle = true; }, 5000);
}
['touchstart', 'touchmove', 'mousedown', 'mousemove'].forEach(ev =>
  document.addEventListener(ev, resetOrbIdle, { passive: true })
);
resetOrbIdle();

const mainOrb   = createOrb(document.getElementById('orb-canvas'),        240, true);
const answerOrb = createOrb(document.getElementById('answer-orb-canvas'),  90, false);

// ─── Mystic decor: rising motes ────────────────────────────────
function buildOrbDecor() {
  const section = document.getElementById('orb-section');
  if (!section) return;

  const motes = document.createElement('div');
  motes.className = 'orb-motes';
  const colors = ['rgba(245,200,66,', 'rgba(244,63,143,', 'rgba(192,132,252,', 'rgba(255,255,255,'];
  for (let i = 0; i < 14; i++) {
    const m = document.createElement('i');
    const sz = (Math.random() * 2.5 + 1.5).toFixed(1);
    m.style.cssText = [
      `left:${(Math.random() * 76 + 12).toFixed(0)}%`,
      `bottom:${(Math.random() * 18 + 4).toFixed(0)}%`,
      `width:${sz}px`, `height:${sz}px`,
      `--mc:${colors[i % 4]}0.9)`,
      `--md:${(Math.random() * 7 + 6).toFixed(1)}s`,
      `--mdel:${(Math.random() * 9).toFixed(1)}s`,
      `--mx:${(Math.random() * 60 - 30).toFixed(0)}px`,
    ].join(';');
    motes.appendChild(m);
  }
  section.appendChild(motes);
}
buildOrbDecor();

// Шар реагує на дотик — паралакс галактики всередині
const orbTouchEl = document.getElementById('orb-wrapper');
if (orbTouchEl) {
  orbTouchEl.addEventListener('pointermove', e => {
    const b = orbTouchEl.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 2 - 1;
    const y = -(((e.clientY - b.top) / b.height) * 2 - 1);
    mainOrb.setTilt(x * 0.6, y * 0.6);
  }, { passive: true });
  ['pointerleave', 'pointerup', 'pointercancel'].forEach(ev =>
    orbTouchEl.addEventListener(ev, () => mainOrb.clearTilt(), { passive: true })
  );
}

// ─── i18n ──────────────────────────────────────────────────────
const LANGS = {
  ru: {
    badge:            '🔮 ОРАКУЛ СУДЬБЫ',
    subtitle:         'задай вопрос — получи ответ судьбы',
    placeholder:      'Напиши свой вопрос здесь...',
    askBtn:           'Спросить Оракул',
    orbDefault:       'Сосредоточься на вопросе...',
    orbFocus:         'Сначала задай вопрос...',
    orbError:         '⚠️ Туман мешает Оракулу...',
    orbPremium:       '⭐ Добро пожаловать в Премиум!',
    thinking:         ['Оракул слышит тебя...', 'Нити судьбы сплетаются...', 'Ответ раскрывается...'],
    counterPremium:   '⭐ ПРЕМИУМ — БЕЗЛИМИТ',
    counterLeft:      n => `${n} из 2 вопросов сегодня`,
    counterEmpty:     'Лимит исчерпан — вернись завтра',
    premiumActive:    '⭐ Активен',
    premiumDefault:   '⭐ Премиум',
    answerLabel:      'Твой вопрос',
    btnAgain:         '🌀 Новый вопрос',
    btnShare:         '✨ Поделиться',
    loadingText:      'Оракул читает судьбу...',
    paywallTitle:     'Оракул молчит...',
    paywallSub:       'Ты исчерпал лимит на сегодня',
    shareText:        (q, v) => `🔮 Оракул Судьбы ответил!\n\n❓ ${q}\n\n${v}\n\n✨ Спроси и ты: @oracle_666bot`,
    shareCopied:      '✅ Скопировано!',
    refMsg:           link => `🔮 Попробуй Оракул Судьбы! Задай вопрос судьбе.\n${link}`,
    refCopied:        '✅ Посилання скопійовано!',
    refBtn:           '🔗 Запросити друга — +3 питання',
    planWeek:         '7 дней',
    planMonth:        '30 дней',
    planLifetime:     'Навсегда',
    planDescWeek:     'Безлим вопросов',
    planDescMonth:    'Безлим вопросов',
    planDescLifetime: 'Навечно ♾️',
    planBtn:          'Выбрать',
    featUnlimited:    '✓ Безлимитные вопросы',
    featCategories:   '✓ Все категории',
    featPriority:     '✓ Приоритет судьбы',
    packDivider:      'или пополни баланс вопросов',
    packBtn:          'Купить',
    historyTitle:     '🔮 Мои вопросы',
    historyBack:      '← Назад',
    historyEmpty:     'Ты ещё не задавал вопросов Оракулу',
    historyLoading:   'Загрузка...',
    greeting:         name => `${name}, `,
    paywallTitleB:    '⏰ Ответ готов!',
    paywallSubB:      'Оракул знает — открой доступ',
    btnComeBack:      '🌙 Вернуться завтра (бесплатно)',
    langBtn:          '🌐 UA',
    streakToast:      (n, b) => `🔥 ${n} дней подряд! +${b} бонусных вопроса`,
    offerTitle:       'Только сейчас: 7 дней за полцены!',
    offerBtn:         'Забрать',
  },
  ua: {
    badge:            '🔮 ОРАКУЛ ДОЛІ',
    subtitle:         'постав питання — отримай відповідь долі',
    placeholder:      'Напиши своє питання тут...',
    askBtn:           'Запитати Оракул',
    orbDefault:       'Зосередься на питанні...',
    orbFocus:         'Спочатку постав питання...',
    orbError:         '⚠️ Туман заважає Оракулу...',
    orbPremium:       '⭐ Ласкаво просимо до Преміум!',
    thinking:         ['Оракул чує тебе...', 'Нитки долі сплітаються...', 'Відповідь розкривається...'],
    counterPremium:   '⭐ ПРЕМІУМ — БЕЗЛІМІТ',
    counterLeft:      n => `${n} з 2 питань сьогодні`,
    counterEmpty:     'Ліміт вичерпано — повернись завтра',
    premiumActive:    '⭐ Активний',
    premiumDefault:   '⭐ Преміум',
    answerLabel:      'Твоє питання',
    btnAgain:         '🌀 Нове питання',
    btnShare:         '✨ Поділитись',
    loadingText:      'Оракул читає долю...',
    paywallTitle:     'Оракул мовчить...',
    paywallSub:       'Ти вичерпав ліміт на сьогодні',
    shareText:        (q, v) => `🔮 Оракул Долі відповів!\n\n❓ ${q}\n\n${v}\n\n✨ Запитай і ти: @oracle_666bot`,
    shareCopied:      '✅ Скопійовано!',
    refMsg:           link => `🔮 Спробуй Оракул Долі! Задай питання долі.\n${link}`,
    refCopied:        '✅ Посилання скопійовано!',
    refBtn:           '🔗 Запросити друга — +3 питання',
    planWeek:         '7 днів',
    planMonth:        '30 днів',
    planLifetime:     'Назавжди',
    planDescWeek:     'Безліміт питань',
    planDescMonth:    'Безліміт питань',
    planDescLifetime: 'Навічно ♾️',
    planBtn:          'Вибрати',
    featUnlimited:    '✓ Безлімітні питання',
    featCategories:   '✓ Всі категорії',
    featPriority:     '✓ Пріоритет долі',
    packDivider:      'або поповни баланс питань',
    packBtn:          'Купити',
    historyTitle:     '🔮 Мої питання',
    historyBack:      '← Назад',
    historyEmpty:     'Ти ще не ставив питань Оракулу',
    historyLoading:   'Завантаження...',
    greeting:         name => `${name}, `,
    paywallTitleB:    '⏰ Відповідь готова!',
    paywallSubB:      'Оракул знає — відкрий доступ',
    btnComeBack:      '🌙 Повернутись завтра (безкоштовно)',
    langBtn:          '🌐 RU',
    streakToast:      (n, b) => `🔥 ${n} днів поспіль! +${b} бонусних питання`,
    offerTitle:       'Лише зараз: 7 днів за пів ціни!',
    offerBtn:         'Забрати',
  },
};
let currentLang = localStorage.getItem('oracle_lang') || 'ru';

function applyLang() {
  const L = LANGS[currentLang];

  const langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.textContent = L.langBtn;

  const badge = document.querySelector('.oracle-badge');
  if (badge) badge.textContent = L.badge;
  const subtitle = document.querySelector('.oracle-subtitle');
  if (subtitle) {
    const prefix = tgFirstName ? L.greeting(tgFirstName) : '';
    subtitle.textContent = prefix + L.subtitle;
  }

  const qi = document.getElementById('question-input');
  if (qi) qi.placeholder = L.placeholder;

  const at = document.querySelector('.ask-text');
  if (at) at.textContent = L.askBtn;

  const os = document.getElementById('orb-status');
  if (os) {
    const isDefault = Object.values(LANGS).some(l => l.orbDefault === os.textContent);
    if (isDefault) os.textContent = L.orbDefault;
  }

  const aql = document.querySelector('.answer-question-label');
  if (aql) aql.textContent = L.answerLabel;
  const ba = document.getElementById('btn-again');
  if (ba) ba.textContent = L.btnAgain;
  const bs = document.getElementById('btn-share');
  if (bs) bs.textContent = L.btnShare;

  const lt = document.querySelector('.loading-text');
  if (lt) lt.textContent = L.loadingText;

  const pt = document.querySelector('.paywall-title');
  if (pt) pt.textContent = L.paywallTitle;
  const ps = document.querySelector('.paywall-sub');
  if (ps) ps.textContent = L.paywallSub;

  [['week', L.planWeek, L.planDescWeek], ['month', L.planMonth, L.planDescMonth], ['lifetime', L.planLifetime, L.planDescLifetime]].forEach(([id, name, desc]) => {
    const nameEl = document.querySelector(`#plan-${id} .plan-name`);
    const descEl = document.querySelector(`#plan-${id} .plan-desc`);
    const btnEl  = document.querySelector(`#plan-${id} .plan-btn`);
    if (nameEl) nameEl.textContent = name;
    if (descEl) descEl.textContent = desc;
    if (btnEl)  btnEl.textContent  = L.planBtn;
  });

  const feats = document.querySelectorAll('.paywall-features span');
  [L.featUnlimited, L.featCategories, L.featPriority].forEach((t, i) => { if (feats[i]) feats[i].textContent = t; });

  const bcb = document.getElementById('btn-come-back');
  if (bcb) bcb.textContent = L.btnComeBack;
  const br = document.getElementById('btn-ref');
  if (br) br.textContent = L.refBtn;

  const pd = document.querySelector('.packs-divider');
  if (pd) pd.textContent = L.packDivider;

  document.querySelectorAll('.pack-btn').forEach(btn => { btn.textContent = L.packBtn; });

  const ht = document.querySelector('.history-title');
  if (ht) ht.textContent = L.historyTitle;
  const hb = document.getElementById('btn-history-back');
  if (hb) hb.textContent = L.historyBack;

  const ot = document.getElementById('offer-title');
  if (ot) ot.textContent = L.offerTitle;
  const ob = document.getElementById('offer-btn');
  if (ob && !ob.disabled) ob.textContent = L.offerBtn;

  updateCounter();
}

function toggleLang() {
  currentLang = currentLang === 'ru' ? 'ua' : 'ru';
  localStorage.setItem('oracle_lang', currentLang);
  applyLang();
}

// ─── User State ────────────────────────────────────────────────
const tgUser      = tg?.initDataUnsafe?.user;
const userId      = tgUser?.id      ?? 'guest';
const tgUsername  = tgUser?.username   ?? null;
const tgFirstName = tgUser?.first_name ?? null;

let userStatus = { canAsk: true, remaining: 2, isPremium: false };
let abVariant  = 'A';
let lastAnswer = null;

function trackEvent(event) {
  if (userId === 'guest') return;
  fetch('/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, event, variant: abVariant }),
  }).catch(() => {});
}

async function fetchStatus() {
  if (userId === 'guest') return;
  try {
    const r = await fetch(`/api/user/${userId}/status`);
    const data = await r.json();
    userStatus = data;
    abVariant  = data.variant || 'A';
    updateCounter();
    applyABVariant();
  } catch {}
}

// Sync username/name once on startup — not on every fetchStatus call
if (userId !== 'guest' && (tgUsername || tgFirstName)) {
  fetch('/api/user/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, username: tgUsername, firstName: tgFirstName }),
  }).catch(() => {});
}

function applyABVariant() {
  if (abVariant !== 'B') return;
  const L = LANGS[currentLang];
  const pt = document.querySelector('.paywall-title');
  const ps = document.querySelector('.paywall-sub');
  if (pt) pt.textContent = L.paywallTitleB || '⏰ Відповідь готова!';
  if (ps) ps.textContent = L.paywallSubB   || 'Оракул знає — відкрий доступ';
}

function updateCounter() {
  const el  = document.getElementById('question-counter');
  const btn = document.getElementById('premium-btn');
  if (!el) return;
  const L = LANGS[currentLang];
  const streakSuffix = (userStatus.streak ?? 0) >= 2 ? ` · 🔥${userStatus.streak}` : '';
  if (userStatus.isPremium) {
    el.textContent = L.counterPremium + streakSuffix;
    el.className = 'question-counter premium';
    if (btn) { btn.textContent = L.premiumActive; btn.classList.add('is-premium'); }
  } else if (userStatus.remaining !== null) {
    const left = userStatus.remaining ?? 2;
    el.textContent = (left > 0 ? L.counterLeft(left) : L.counterEmpty) + streakSuffix;
    el.className = `question-counter${left <= 1 ? ' low' : ''}`;
    if (btn) { btn.textContent = L.premiumDefault; btn.classList.remove('is-premium'); }
  }
}

const selectedCat = 'general';

// ─── Toast ──────────────────────────────────────────────────────
let toastTimer = null;
function showToast(text) {
  let el = document.getElementById('oracle-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'oracle-toast';
    el.className = 'oracle-toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ─── Screen Switch ──────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // Pause orbs on screens where they are not visible
  if (id === 'screen-home')   { mainOrb.resume(); answerOrb.pause(); }
  else if (id === 'screen-answer') { mainOrb.pause(); answerOrb.resume(); }
  else                              { mainOrb.pause(); answerOrb.pause(); }
}

// Pause all animations when app is backgrounded
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { mainOrb.pause(); answerOrb.pause(); }
  else {
    const active = document.querySelector('.screen.active')?.id;
    if (active === 'screen-home')   mainOrb.resume();
    else if (active === 'screen-answer') answerOrb.resume();
  }
});

// ─── Loading ────────────────────────────────────────────────────
const overlay = document.getElementById('loading-overlay');
function showLoading(on) { overlay.classList.toggle('hidden', !on); }

// ─── Question Input ─────────────────────────────────────────────
const input     = document.getElementById('question-input');
const charCount = document.getElementById('char-count');
const askBtn    = document.getElementById('ask-btn');
const orbStatus = document.getElementById('orb-status');
const orbWrap   = document.getElementById('orb-wrapper');

input.addEventListener('input', () => { charCount.textContent = input.value.length; });

// ─── Keyboard detection ─────────────────────────────────────────
const FULL_HEIGHT = window.visualViewport?.height || window.innerHeight;

function onViewportResize() {
  const h = window.visualViewport?.height || window.innerHeight;
  document.body.classList.toggle('keyboard-open', h < FULL_HEIGHT * 0.78);
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', onViewportResize);
} else {
  window.addEventListener('resize', onViewportResize);
}

input.addEventListener('focus', () => document.body.classList.add('keyboard-open'));
input.addEventListener('blur',  () => {
  setTimeout(() => {
    if (document.activeElement !== input) document.body.classList.remove('keyboard-open');
  }, 150);
});

document.getElementById('kbd-dismiss')?.addEventListener('mousedown', e => {
  e.preventDefault();
  input.blur();
});

document.querySelector('.oracle-header')?.addEventListener('click', () => {
  if (document.body.classList.contains('keyboard-open')) input.blur();
});

document.querySelector('.orb-section')?.addEventListener('click', () => input.blur());

// ─── Oracle Sound (Web Audio API, no files needed) ──────────────
let _ac = null;
function playOracleSound(color) {
  try {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume();
    const ac  = _ac;
    const now = ac.currentTime;
    const cfg = {
      yes:   { freqs: [261.63, 329.63, 392.00, 523.25], drift: 1.006, decay: 2.2, vol: 0.15 },
      no:    { freqs: [293.66, 349.23, 415.30],          drift: 0.982, decay: 1.8, vol: 0.13 },
      maybe: { freqs: [349.23, 440.00, 466.16],          drift: 1.000, decay: 2.4, vol: 0.12, vib: true },
    }[color] || { freqs: [349.23, 440.00], drift: 1.0, decay: 2.0, vol: 0.12 };

    const master = ac.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.linearRampToValueAtTime(cfg.vol, now + 0.06);
    master.gain.exponentialRampToValueAtTime(0.001, now + cfg.decay);
    master.connect(ac.destination);

    cfg.freqs.forEach((f, i) => {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * cfg.drift, now + cfg.decay);
      if (cfg.vib) {
        const vib = ac.createOscillator();
        vib.frequency.value = 5;
        const vg = ac.createGain();
        vg.gain.value = 5;
        vib.connect(vg);
        vg.connect(osc.frequency);
        vib.start(now);
        vib.stop(now + cfg.decay + 0.3);
      }
      const g = ac.createGain();
      g.gain.setValueAtTime(1 / (i + 1.5), now + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + cfg.decay);
      osc.connect(g); g.connect(master);
      osc.start(now + i * 0.05);
      osc.stop(now + cfg.decay + 0.3);
    });
    const sh = ac.createOscillator();
    sh.type = 'sine';
    sh.frequency.value = cfg.freqs[0] * 4;
    const sg = ac.createGain();
    sg.gain.setValueAtTime(0.04, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    sh.connect(sg); sg.connect(master);
    sh.start(now); sh.stop(now + 0.8);
  } catch(e) {}
}

// ─── Orb burst flash ─────────────────────────────────────────────
function triggerOrbBurst(color) {
  const el = document.getElementById('orb-flash');
  if (!el) return;
  el.className = `burst-${color}`;
  void el.offsetWidth;
  el.classList.add('active');
  setTimeout(() => { el.className = ''; }, 700);
}

// ─── Ask ────────────────────────────────────────────────────────
async function askOracle() {
  const question = input.value.trim();
  if (!question) {
    input.focus();
    orbStatus.textContent = LANGS[currentLang].orbFocus;
    setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 2000);
    return;
  }

  askBtn.disabled = true;
  orbWrap?.classList.add('asking');
  mainOrb.setEnergy(1);
  showLoading(true);

  try {
    const apiPromise = fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question, userId,
        category:  selectedCat,
        username:  tgUsername  || undefined,
        firstName: tgFirstName || undefined,
      })
    });

    const phrases = LANGS[currentLang].thinking;
    for (let i = 0; i < phrases.length; i++) {
      orbStatus.textContent = phrases[i];
      await new Promise(r => setTimeout(r, 900));
    }

    const res = await apiPromise;
    if (res.status === 403) {
      // Сервер міг запустити оффер першої покупки — забираємо статус із відповіді
      try {
        const body = await res.json();
        if (body.status) userStatus = body.status;
      } catch {}
      showPaywall();
      return;
    }
    if (!res.ok) throw new Error('server error');
    const data = await res.json();
    if (data.status) { userStatus = data.status; updateCounter(); }
    showLoading(false);
    orbWrap?.classList.remove('asking');
    playOracleSound(data.answer.color);
    triggerOrbBurst(data.answer.color);
    await new Promise(r => setTimeout(r, 230));
    showAnswer(question, data.answer);
    if (data.streak?.reward) {
      setTimeout(() => showToast(LANGS[currentLang].streakToast(data.streak.streak, data.streak.reward)), 1200);
    }
  } catch {
    orbStatus.textContent = LANGS[currentLang].orbError;
    setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 3000);
  } finally {
    askBtn.disabled = false;
    orbWrap?.classList.remove('asking');
    mainOrb.setEnergy(0);
    showLoading(false);
  }
}

// ─── Paywall ────────────────────────────────────────────────────
let offerInterval = null;

function renderOffer() {
  const banner = document.getElementById('offer-banner');
  if (!banner) return;
  clearInterval(offerInterval);
  const offer = userStatus.offer;
  if (!offer || offer.until <= Date.now()) { banner.style.display = 'none'; return; }
  banner.style.display = 'flex';
  const timerEl = document.getElementById('offer-timer');
  const tick = () => {
    const left = offer.until - Date.now();
    if (left <= 0 || userStatus.isPremium) { banner.style.display = 'none'; clearInterval(offerInterval); return; }
    const h = Math.floor(left / 3600000), m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
    if (timerEl) timerEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  tick();
  offerInterval = setInterval(tick, 1000);
}

document.getElementById('offer-btn')?.addEventListener('click', function() {
  buyPremiumFlow(this, 'offerweek');
});

function showPaywall() {
  showScreen('screen-paywall');
  applyABVariant();
  renderOffer();
  trackEvent('paywall_shown');
  if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
}

document.getElementById('btn-come-back').addEventListener('click', () => {
  showScreen('screen-home');
});

askBtn.addEventListener('click', askOracle);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askOracle(); }
});

// ─── Poll status after payment (handles race with bot webhook) ───
async function pollStatus(check, timeoutMs = 9000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 900));
    try {
      const r = await fetch(`/api/user/${userId}/status`);
      const data = await r.json();
      userStatus = data;
      abVariant = data.variant || 'A';
      updateCounter();
      if (check(data)) return true;
    } catch {}
  }
  return false;
}

const pollUntilPremium = () => pollStatus(d => d.isPremium);
const pollUntilBonus   = (prev) => pollStatus(d => (d.remaining ?? 0) > prev || (d.bonusLeft ?? 0) > prev);

// ─── Premium purchase flow ────────────────────────────────────────
async function buyPremiumFlow(btn, plan = 'month') {
  if (!btn || btn.disabled) return;
  if (userId === 'guest') { showPaywall(); return; }
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '⏳...';
  trackEvent('invoice_click');
  try {
    const r = await fetch(`/api/user/${userId}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const data = await r.json();
    if (!r.ok || !data.url) throw new Error(data.error || 'Не вдалось створити рахунок');
    if (tg?.openInvoice) {
      tg.openInvoice(data.url, async (status) => {
        if (status === 'paid') {
          trackEvent('payment_success');
          btn.textContent = '⏳ Активація...';
          const ok = await pollUntilPremium();
          showScreen('screen-home');
          orbStatus.textContent = ok ? LANGS[currentLang].orbPremium : '⭐ Преміум активується...';
          setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 4000);
          if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        } else if (status === 'cancelled') {
          // user closed payment — silent, just re-enable button
        } else if (status === 'failed') {
          orbStatus.textContent = '❌ Оплата не пройшла';
          setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 3000);
        }
        btn.disabled = false;
        btn.textContent = orig;
      });
    } else {
      window.open(data.url, '_blank');
      btn.disabled = false;
      btn.textContent = orig;
    }
  } catch (e) {
    orbStatus.textContent = '❌ ' + e.message;
    setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 3000);
    btn.disabled = false;
    btn.textContent = orig;
  }
}

document.getElementById('premium-btn')?.addEventListener('click', function() {
  showPaywall();
});

document.querySelectorAll('.plan-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    buyPremiumFlow(this, this.dataset.plan || 'month');
  });
});

document.getElementById('btn-ref')?.addEventListener('click', () => {
  const refLink = `https://t.me/oracle_666bot?start=ref_${userId}`;
  const L = LANGS[currentLang];
  if (tg?.switchInlineQuery) {
    tg.switchInlineQuery(L.refMsg(refLink));
  } else if (navigator.share) {
    navigator.share({ text: L.refMsg(refLink) }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(refLink).then(() => {
      const btn = document.getElementById('btn-ref');
      btn.textContent = L.refCopied;
      setTimeout(() => { btn.textContent = L.refBtn; }, 2500);
    });
  }
});

// ─── Pack purchase flow ───────────────────────────────────────────
async function buyPackFlow(btn, pack) {
  if (!btn || btn.disabled) return;
  if (userId === 'guest') { showPaywall(); return; }
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '⏳...';
  trackEvent('pack_click');
  let invoiceQuestions = 0;
  try {
    const r = await fetch(`/api/user/${userId}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: pack }),
    });
    const data = await r.json();
    if (!r.ok || !data.url) throw new Error(data.error || 'Не вдалось створити рахунок');
    invoiceQuestions = data.questions || 0;
    if (tg?.openInvoice) {
      tg.openInvoice(data.url, async (status) => {
        if (status === 'paid') {
          trackEvent('pack_paid');
          btn.textContent = '⏳ Нарахування...';
          const prevRemaining = userStatus.remaining ?? 0;
          await pollUntilBonus(prevRemaining);
          showScreen('screen-home');
          orbStatus.textContent = `🎁 +${invoiceQuestions} питань додано!`;
          setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 4000);
          if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        } else if (status === 'failed') {
          orbStatus.textContent = '❌ Оплата не пройшла';
          setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 3000);
        }
        btn.disabled = false;
        btn.textContent = orig;
      });
    } else {
      window.open(data.url, '_blank');
      btn.disabled = false;
      btn.textContent = orig;
    }
  } catch (e) {
    orbStatus.textContent = '❌ ' + e.message;
    setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 3000);
    btn.disabled = false;
    btn.textContent = orig;
  }
}

document.querySelectorAll('.pack-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    buyPackFlow(this, this.dataset.pack);
  });
});

// ─── History screen ───────────────────────────────────────────────
const COLOR_EMOJI = { yes: '🟢', no: '🔴', maybe: '🟡' };
const COLOR_LABEL = {
  ru: { yes: 'ДА', no: 'НЕТ', maybe: 'ВОЗМОЖНО' },
  ua: { yes: 'ТАК', no: 'НІ',  maybe: 'МОЖЛИВО'  },
};

async function loadHistory() {
  if (userId === 'guest') return;
  const L = LANGS[currentLang];
  const list = document.getElementById('history-list');
  const loading = document.getElementById('history-loading');
  if (loading) loading.textContent = L.historyLoading;

  try {
    const r = await fetch(`/api/user/${userId}/history`);
    const questions = await r.json();
    if (!list) return;

    if (!questions.length) {
      list.innerHTML = `<div class="history-empty">${L.historyEmpty}</div>`;
      return;
    }

    list.innerHTML = questions.map(q => {
      const date = new Date(q.ts).toLocaleDateString(
        currentLang === 'ua' ? 'uk' : 'ru',
        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      );
      const emoji = COLOR_EMOJI[q.color] || '⚪';
      const label = (COLOR_LABEL[currentLang] || COLOR_LABEL.ru)[q.color] || q.verdict || '';
      return `
        <div class="history-item history-item-${q.color || 'maybe'}">
          <div class="history-item-top">
            <span class="history-item-emoji">${emoji}</span>
            <span class="history-item-verdict">${label}</span>
            <span class="history-item-date">${date}</span>
          </div>
          <div class="history-item-q">${escapeHtml(q.question)}</div>
        </div>`;
    }).join('');
  } catch {
    if (list) list.innerHTML = `<div class="history-empty">Помилка завантаження</div>`;
  }
}

document.getElementById('history-btn')?.addEventListener('click', () => {
  showScreen('screen-history');
  loadHistory();
});

document.getElementById('btn-history-back')?.addEventListener('click', () => {
  showScreen('screen-home');
});

fetchStatus();

// ─── Auto-ask from daily question deep link (?q=...) ───────────
const _autoQ = new URLSearchParams(window.location.search).get('q');
if (_autoQ) {
  input.value = _autoQ;
  charCount.textContent = String(_autoQ.length);
  setTimeout(askOracle, 1400);
}

// ─── Show Answer ────────────────────────────────────────────────
function showAnswer(question, answer) {
  lastAnswer = answer;
  const ua = currentLang === 'ua';
  document.getElementById('answer-question').textContent = question;
  document.getElementById('answer-verdict').textContent  = ua ? (answer.verdict_ua || answer.verdict) : answer.verdict;
  document.getElementById('answer-title').textContent    = ua ? (answer.title_ua   || answer.title)   : answer.title;
  document.getElementById('answer-message').textContent  = ua ? (answer.message_ua || answer.message) : answer.message;

  const wrap = document.getElementById('answer-verdict-wrap');
  wrap.className = `answer-verdict-wrap verdict-${answer.color}`;

  mainOrb.setColor(answer.color);
  answerOrb.setColor(answer.color);

  const glowColors = { yes: '#00f5a0', no: '#ff4d6d', maybe: '#f5c842' };
  const orbGlow = document.getElementById('orb-glow');
  if (orbGlow) {
    const c = glowColors[answer.color] || '#8b3dff';
    orbGlow.style.background = `radial-gradient(circle, transparent 28%, ${c}40 55%, transparent 78%)`;
  }

  const glowMap = {
    yes:   'drop-shadow(0 0 40px rgba(0,245,160,0.75))   drop-shadow(0 0 80px rgba(0,245,160,0.35))',
    no:    'drop-shadow(0 0 40px rgba(255,77,109,0.75))  drop-shadow(0 0 80px rgba(255,77,109,0.35))',
    maybe: 'drop-shadow(0 0 40px rgba(245,200,66,0.75))  drop-shadow(0 0 80px rgba(245,200,66,0.35))',
  };
  const orbCanvas = document.getElementById('orb-canvas');
  if (orbCanvas) orbCanvas.style.filter = glowMap[answer.color] || '';

  showScreen('screen-answer');

  requestAnimationFrame(() => {
    document.getElementById('answer-orb-mini').classList.add('visible');
    document.getElementById('answer-card').classList.add('visible');
  });

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred(
      answer.color === 'yes' ? 'success' : answer.color === 'no' ? 'error' : 'warning'
    );
  }
}

// ─── Again ─────────────────────────────────────────────────────
document.getElementById('btn-again').addEventListener('click', async () => {
  if (!userStatus.isPremium && userStatus.remaining === 0) {
    showPaywall();
    return;
  }

  const miniOrb = document.getElementById('answer-orb-mini');
  const card    = document.getElementById('answer-card');
  miniOrb.classList.remove('visible');
  card.classList.remove('visible');

  mainOrb.setColor('default');
  answerOrb.setColor('default');

  const orbCanvas = document.getElementById('orb-canvas');
  if (orbCanvas) orbCanvas.style.filter = '';

  const orbGlow = document.getElementById('orb-glow');
  if (orbGlow) orbGlow.style.background = '';

  input.value = '';
  charCount.textContent = '0';
  orbStatus.textContent = LANGS[currentLang].orbDefault;

  showScreen('screen-home');
});

// ─── Language switch ────────────────────────────────────────────
document.getElementById('lang-btn')?.addEventListener('click', toggleLang);
applyLang();

// ─── Share image (Canvas) ──────────────────────────────────────
function wrapCanvasText(ctx, text, x, y, maxWidth, lineH) {
  const words = String(text).split(' ');
  let line = '';
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, y);
      line = word + ' ';
      y += lineH;
    } else { line = test; }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, y);
  return y;
}

function buildShareCanvas(question, answer) {
  const W = 540, H = 760;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#03020f');
  bg.addColorStop(1, '#130625');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glowCol = answer.color === 'yes' ? '#00f5a0' : answer.color === 'no' ? '#ff4d6d' : '#f5c842';
  const glow = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, 220);
  glow.addColorStop(0, glowCol + '44');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.font = 'bold 15px Inter, sans-serif';
  ctx.fillStyle = 'rgba(139,61,255,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText('🔮  ОРАКУЛ ДОЛІ', W / 2, 52);

  ctx.strokeStyle = 'rgba(139,61,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 68); ctx.lineTo(W - 60, 68); ctx.stroke();

  ctx.font = '13px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('питання', W / 2, 96);

  ctx.font = '600 17px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  wrapCanvasText(ctx, `"${question}"`, W / 2, 126, W - 80, 26);

  const vGlow = ctx.createRadialGradient(W / 2, H * 0.52, 0, W / 2, H * 0.52, 130);
  vGlow.addColorStop(0, glowCol + '55');
  vGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = vGlow;
  ctx.fillRect(0, H * 0.38, W, H * 0.28);

  const verdictText = (currentLang === 'ua' ? (answer.verdict_ua || answer.verdict) : answer.verdict) || '';
  ctx.font = 'bold 44px Cinzel, Inter, sans-serif';
  ctx.fillStyle = glowCol;
  ctx.shadowColor = glowCol;
  ctx.shadowBlur = 28;
  ctx.fillText(verdictText, W / 2, H * 0.50);
  ctx.shadowBlur = 0;

  const msgText = (currentLang === 'ua' ? (answer.message_ua || answer.message) : answer.message) || '';
  ctx.font = '15px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  wrapCanvasText(ctx, msgText, W / 2, H * 0.62, W - 80, 24);

  ctx.strokeStyle = 'rgba(139,61,255,0.25)';
  ctx.beginPath(); ctx.moveTo(60, H - 72); ctx.lineTo(W - 60, H - 72); ctx.stroke();

  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillStyle = 'rgba(139,61,255,0.7)';
  ctx.fillText('@oracle_666bot', W / 2, H - 44);
  ctx.font = '12px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillText('t.me/oracle_666bot/app', W / 2, H - 22);

  return canvas;
}

async function shareWithImage(question, answer) {
  const L = LANGS[currentLang];
  const verdict = currentLang === 'ua' ? (answer.verdict_ua || answer.verdict) : answer.verdict;
  const text = L.shareText(question, verdict);

  try {
    const canvas = buildShareCanvas(question, answer);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const file = new File([blob], 'oracle.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return;
    }
  } catch {}

  if (tg?.switchInlineQuery) {
    tg.switchInlineQuery(text);
  } else if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    const btn = document.getElementById('btn-share');
    const orig = btn.textContent;
    navigator.clipboard?.writeText(text).then(() => {
      btn.textContent = L.shareCopied;
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  }
}

document.getElementById('btn-share').addEventListener('click', async () => {
  const question = document.getElementById('answer-question').textContent;
  if (lastAnswer) {
    await shareWithImage(question, lastAnswer);
  } else {
    const verdict = document.getElementById('answer-verdict').textContent;
    const L = LANGS[currentLang];
    const text = L.shareText(question, verdict);
    if (tg?.switchInlineQuery) tg.switchInlineQuery(text);
    else if (navigator.share) navigator.share({ text }).catch(() => {});
  }
});
