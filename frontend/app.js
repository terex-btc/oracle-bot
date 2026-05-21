/* ─── Oracle Bot — Cosmic Edition ───────────────────────────── */

const tg = window.Telegram?.WebApp;

function applyTopInset() {
  // Telegram надає safeAreaInset і contentSafeAreaInset в fullscreen
  const tgTop = tg?.safeAreaInset?.top ?? tg?.contentSafeAreaInset?.top ?? 0;
  // Також беремо CSS env() як fallback
  const cssTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tg-viewport-stable-height') || '0');
  const top = tgTop > 0 ? tgTop : 0;
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

// Fallback: якщо Telegram не дав інсет — беремо з CSS env()
document.addEventListener('DOMContentLoaded', () => {
  const current = getComputedStyle(document.documentElement).getPropertyValue('--tg-safe-top').trim();
  if (!current || current === '0px') {
    // iPhone notch ~44px, Dynamic Island ~59px — ставимо 52px як безпечний fallback
    document.documentElement.style.setProperty('--tg-safe-top', '52px');
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
    container.appendChild(s);
  }

  // 4 shooting stars
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
    container.appendChild(ss);
  }
}
document.querySelectorAll('.stars-bg').forEach(c => createStars(c));

// ─── Premium Orb Canvas ────────────────────────────────────────
function OrbCanvas(canvas, size = 280, isMain = false) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2;
  const r  = size * 0.42;
  let phase = 0;
  let color = { r: 139, g: 61, b: 255 };
  let targetColor = { ...color };
  let raf;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rgba(c, a) {
    return `rgba(${clamp(c.r,0,255)|0},${clamp(c.g,0,255)|0},${clamp(c.b,0,255)|0},${a})`;
  }

  // ── Internal galaxy stars ──────────────────────────────────────
  const galaxyStars = Array.from({ length: isMain ? 90 : 30 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist  = Math.pow(Math.random(), 0.6) * r * 0.88;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist * 0.75,
      size: Math.random() * (isMain ? 1.6 : 1.0) + 0.3,
      brightness: Math.random() * 0.7 + 0.3,
      twinkleSpeed: Math.random() * 0.05 + 0.01,
      twinkleOffset: Math.random() * Math.PI * 2,
    };
  });

  // ── Nebula blobs ───────────────────────────────────────────────
  const blobs = [
    { angle: 0.5,  speed:  0.006, orbitR: r * 0.28, size: r * 0.55, type: 0 },
    { angle: 2.1,  speed: -0.004, orbitR: r * 0.20, size: r * 0.45, type: 1 },
    { angle: 3.8,  speed:  0.007, orbitR: r * 0.32, size: r * 0.50, type: 2 },
    { angle: 5.2,  speed: -0.005, orbitR: r * 0.15, size: r * 0.40, type: 0 },
    { angle: 1.2,  speed:  0.003, orbitR: r * 0.38, size: r * 0.42, type: 1 },
  ];

  // ── Sparkles (зовнішні іскри) ──────────────────────────────────
  const sparkles = isMain ? Array.from({ length: 14 }, (_, i) => ({
    angle: (i / 14) * Math.PI * 2 + Math.random() * 0.5,
    orbitR: r * (1.15 + Math.random() * 0.45),
    speed: (Math.random() * 0.008 + 0.003) * (Math.random() > 0.5 ? 1 : -1),
    size: Math.random() * 2.5 + 0.8,
    brightness: Math.random() * 0.6 + 0.4,
    twinkle: Math.random() * Math.PI * 2,
    twinkleSpeed: Math.random() * 0.08 + 0.03,
  })) : [];

  // ── Light rays ─────────────────────────────────────────────────
  const rays = isMain ? Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * Math.PI * 2,
    length: r * (0.6 + Math.random() * 0.8),
    width: Math.random() * 3 + 1,
    speed: (Math.random() * 0.003 + 0.001) * (i % 2 ? 1 : -1),
    opacity: Math.random() * 0.12 + 0.04,
  })) : [];

  // ── Energy veins (прожилки) ────────────────────────────────────
  const veins = isMain ? Array.from({ length: 6 }, (_, i) => ({
    angle: (i / 6) * Math.PI * 2,
    speed: 0.004 + Math.random() * 0.003,
    radius: r * (0.3 + Math.random() * 0.5),
    opacity: 0.04 + Math.random() * 0.06,
  })) : [];

  function drawRays(t) {
    rays.forEach(ray => {
      ray.angle += ray.speed;
      const pulse = 0.5 + Math.sin(t * 1.5 + ray.angle) * 0.5;
      const op = ray.opacity * pulse;
      if (op < 0.005) return;

      const x1 = cx + Math.cos(ray.angle) * r;
      const y1 = cy + Math.sin(ray.angle) * r;
      const x2 = cx + Math.cos(ray.angle) * (r + ray.length);
      const y2 = cy + Math.sin(ray.angle) * (r + ray.length);

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0,   rgba(color, op));
      grad.addColorStop(0.4, rgba(color, op * 0.4));
      grad.addColorStop(1,   'transparent');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = ray.width * pulse;
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawOuterAura() {
    // 4 шари ауры з різним радіусом і прозорістю
    const layers = [
      { r: r * 2.4, op: 0.22 },
      { r: r * 1.85, op: 0.32 },
      { r: r * 1.45, op: 0.40 },
      { r: r * 1.15, op: 0.30 },
    ];
    layers.forEach(l => {
      const ag = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, l.r);
      ag.addColorStop(0,   rgba(color, l.op));
      ag.addColorStop(0.4, rgba(color, l.op * 0.5));
      ag.addColorStop(1,   'transparent');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(cx, cy, l.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSparkles(t) {
    sparkles.forEach(sp => {
      sp.angle  += sp.speed;
      sp.twinkle += sp.twinkleSpeed;
      const brightness = sp.brightness * (0.5 + Math.sin(sp.twinkle) * 0.5);
      if (brightness < 0.05) return;

      const sx = cx + Math.cos(sp.angle) * sp.orbitR;
      const sy = cy + Math.sin(sp.angle) * sp.orbitR * 0.85;

      // Іскра — хрест із 4 ліній
      const len = sp.size * (1 + brightness * 1.5);
      ctx.save();
      ctx.globalAlpha = brightness;
      ctx.strokeStyle = `rgba(255,255,255,${brightness})`;
      ctx.lineWidth = sp.size * 0.5;
      ctx.lineCap = 'round';

      // Вертикальна
      ctx.beginPath();
      ctx.moveTo(sx, sy - len); ctx.lineTo(sx, sy + len);
      ctx.stroke();
      // Горизонтальна
      ctx.beginPath();
      ctx.moveTo(sx - len, sy); ctx.lineTo(sx + len, sy);
      ctx.stroke();
      // Діагональна (менша)
      ctx.lineWidth = sp.size * 0.25;
      ctx.beginPath();
      ctx.moveTo(sx - len * 0.5, sy - len * 0.5); ctx.lineTo(sx + len * 0.5, sy + len * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + len * 0.5, sy - len * 0.5); ctx.lineTo(sx - len * 0.5, sy + len * 0.5);
      ctx.stroke();

      // Ядро
      const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, sp.size * 2);
      core.addColorStop(0,   `rgba(255,255,255,${brightness * 0.9})`);
      core.addColorStop(0.3, rgba(color, brightness * 0.5));
      core.addColorStop(1,   'transparent');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(sx, sy, sp.size * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  function drawOrb(t) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // ── 1. Deep space base ──────────────────────────────────────
    const base = ctx.createRadialGradient(cx - r * 0.1, cy - r * 0.1, r * 0.02, cx, cy, r);
    const cr = color.r, cg = color.g, cb = color.b;
    base.addColorStop(0,    `rgba(${clamp(cr+80,0,255)|0},${clamp(cg+60,0,255)|0},255,1)`);
    base.addColorStop(0.35, `rgba(${cr|0},${cg|0},${cb|0},1)`);
    base.addColorStop(0.7,  `rgba(${clamp(cr-40,0,255)|0},${clamp(cg-20,0,255)|0},${clamp(cb-10,0,255)|0},1)`);
    base.addColorStop(1,    `rgba(${clamp(cr-90,0,255)|0},${clamp(cg-50,0,255)|0},${clamp(cb-30,0,255)|0},1)`);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // ── 2. Galaxy stars inside ──────────────────────────────────
    galaxyStars.forEach(s => {
      const tw = 0.5 + Math.sin(t * s.twinkleSpeed * 60 + s.twinkleOffset) * 0.5;
      const op = s.brightness * tw;
      if (op < 0.05) return;
      const sg = ctx.createRadialGradient(cx + s.x, cy + s.y, 0, cx + s.x, cy + s.y, s.size * 2);
      sg.addColorStop(0,   `rgba(255,255,255,${op})`);
      sg.addColorStop(0.5, `rgba(220,200,255,${op * 0.4})`);
      sg.addColorStop(1,   'transparent');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx + s.x, cy + s.y, s.size * 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── 3. Nebula blobs ─────────────────────────────────────────
    const blobColors = [
      [0, 212, 255],   // cyan
      [244, 63, 143],  // pink
      [255, 200, 80],  // gold
    ];
    blobs.forEach(b => {
      b.angle += b.speed;
      const bx = cx + Math.cos(b.angle) * b.orbitR;
      const by = cy + Math.sin(b.angle) * b.orbitR * 0.7;
      const pulse = 0.10 + Math.sin(t * 1.2 + b.angle) * 0.05;
      const bc = blobColors[b.type];
      const gb = ctx.createRadialGradient(bx, by, 0, bx, by, b.size);
      gb.addColorStop(0, `rgba(${bc[0]},${bc[1]},${bc[2]},${pulse})`);
      gb.addColorStop(0.5, `rgba(${bc[0]},${bc[1]},${bc[2]},${pulse * 0.3})`);
      gb.addColorStop(1, 'transparent');
      ctx.fillStyle = gb;
      ctx.fillRect(0, 0, size, size);
    });

    // ── 4. Energy veins ─────────────────────────────────────────
    veins.forEach(v => {
      v.angle += v.speed;
      const vx = cx + Math.cos(v.angle) * v.radius;
      const vy = cy + Math.sin(v.angle) * v.radius * 0.8;
      const vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, r * 0.3);
      vg.addColorStop(0, `rgba(255,255,255,${v.opacity})`);
      vg.addColorStop(1, 'transparent');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, size, size);
    });

    // ── 5. Caustic ring (яскравий край) ────────────────────────
    const caustic = ctx.createRadialGradient(cx, cy, r * 0.72, cx, cy, r);
    caustic.addColorStop(0,    'transparent');
    caustic.addColorStop(0.82, `rgba(${clamp(cr+40,0,255)|0},${clamp(cg+20,0,255)|0},255,0.08)`);
    caustic.addColorStop(0.92, `rgba(${clamp(cr+80,0,255)|0},${clamp(cg+50,0,255)|0},255,0.18)`);
    caustic.addColorStop(0.97, `rgba(255,255,255,0.22)`);
    caustic.addColorStop(1,    `rgba(${clamp(cr-60,0,255)|0},${clamp(cg-30,0,255)|0},${cb|0},0.5)`);
    ctx.fillStyle = caustic;
    ctx.fillRect(0, 0, size, size);

    // ── 6. Depth shadow ─────────────────────────────────────────
    const shadow = ctx.createRadialGradient(cx + r * 0.15, cy + r * 0.2, r * 0.3, cx, cy, r);
    shadow.addColorStop(0, 'transparent');
    shadow.addColorStop(1, `rgba(0,0,0,0.35)`);
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 0, size, size);

    // ── 7. Primary specular (головний відблиск) ─────────────────
    const hl1 = ctx.createRadialGradient(
      cx - r * 0.30, cy - r * 0.35, 0,
      cx - r * 0.12, cy - r * 0.18, r * 0.55
    );
    hl1.addColorStop(0,   'rgba(255,255,255,0.70)');
    hl1.addColorStop(0.15,'rgba(255,255,255,0.40)');
    hl1.addColorStop(0.4, 'rgba(255,255,255,0.07)');
    hl1.addColorStop(1,   'transparent');
    ctx.fillStyle = hl1;
    ctx.fillRect(0, 0, size, size);

    // ── 8. Secondary specular (менший, знизу) ──────────────────
    const hl2 = ctx.createRadialGradient(
      cx + r * 0.28, cy + r * 0.30, 0,
      cx + r * 0.28, cy + r * 0.30, r * 0.22
    );
    hl2.addColorStop(0,   'rgba(255,255,255,0.12)');
    hl2.addColorStop(0.5, 'rgba(255,255,255,0.04)');
    hl2.addColorStop(1,   'transparent');
    ctx.fillStyle = hl2;
    ctx.fillRect(0, 0, size, size);

    // ── 9. Glass iridescence (веселковий перелив по краю) ───────
    const ird = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r);
    ird.addColorStop(0,    'transparent');
    ird.addColorStop(0.5,  `rgba(0,212,255,${0.06 + Math.sin(t * 0.8) * 0.03})`);
    ird.addColorStop(0.75, `rgba(244,63,143,${0.04 + Math.cos(t * 0.6) * 0.02})`);
    ird.addColorStop(1,    `rgba(200,255,100,0.05)`);
    ctx.fillStyle = ird;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();
  }

  function draw() {
    const t = phase * 0.016;
    ctx.clearRect(0, 0, size, size);

    // Зовнішні ефекти (до кліпу)
    drawOuterAura();
    if (isMain) drawRays(t);

    // Сам шар
    drawOrb(t);

    // Іскри навколо (після шара)
    if (isMain) drawSparkles(t);
  }

  function tick() {
    phase++;
    color.r = lerp(color.r, targetColor.r, 0.030);
    color.g = lerp(color.g, targetColor.g, 0.030);
    color.b = lerp(color.b, targetColor.b, 0.030);
    draw();
    raf = requestAnimationFrame(tick);
  }

  function setColor(type) {
    if (type === 'yes')        targetColor = { r: 0,   g: 210, b: 130 };
    else if (type === 'no')    targetColor = { r: 210, g: 35,  b: 85  };
    else if (type === 'maybe') targetColor = { r: 210, g: 165, b: 15  };
    else                       targetColor = { r: 139, g: 61,  b: 255 };
  }

  tick();
  return { setColor, stop: () => cancelAnimationFrame(raf) };
}

const mainOrb   = OrbCanvas(document.getElementById('orb-canvas'), 280, true);
const answerOrb = OrbCanvas(document.getElementById('answer-orb-canvas'), 120, false);

// ─── Orbital Particles ──────────────────────────────────────────
function buildOrbParticles() {
  const wrap = document.querySelector('.orb-wrapper');
  const p = document.createElement('div');
  p.className = 'orb-particles';
  const positions = [
    { top: '0%',   left: '50%',  delay: '0s',    color: 'rgba(192,132,252,0.9)' },
    { top: '50%',  left: '100%', delay: '-2.7s', color: 'rgba(0,212,255,0.8)' },
    { top: '100%', left: '50%',  delay: '-5.3s', color: 'rgba(244,63,143,0.8)' },
    { top: '50%',  left: '0%',   delay: '-8s',   color: 'rgba(245,200,66,0.7)' },
  ];
  positions.forEach(pos => {
    const dot = document.createElement('div');
    dot.className = 'orb-particle';
    dot.style.cssText = `
      top: ${pos.top}; left: ${pos.left};
      margin-top: -1.5px; margin-left: -1.5px;
      background: ${pos.color};
      box-shadow: 0 0 8px ${pos.color};
      animation-delay: ${pos.delay};
    `;
    p.appendChild(dot);
  });
  wrap.appendChild(p);
}
buildOrbParticles();

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
    catAll:           'Все',
    catLove:          '💕 Любовь',
    catCareer:        '💼 Карьера',
    catMoney:         '💰 Деньги',
    catHealth:        '🌿 Здоровье',
    catPlaceholders:  { 'Любовь': '💕 Вопрос о любви...', 'Карьера': '💼 Вопрос о карьере...', 'Деньги': '💰 Вопрос о деньгах...', 'Здоровье': '🌿 Вопрос о здоровье...' },
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
    btnComeBack:      '🌙 Вернуться завтра (бесплатно)',
    langBtn:          '🌐 UA',
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
    catAll:           'Всі',
    catLove:          '💕 Кохання',
    catCareer:        "💼 Кар'єра",
    catMoney:         '💰 Гроші',
    catHealth:        "🌿 Здоров'я",
    catPlaceholders:  { 'Любовь': '💕 Питання про кохання...', 'Карьера': "💼 Питання про кар'єру...", 'Деньги': '💰 Питання про гроші...', 'Здоровье': "🌿 Питання про здоров'я..." },
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
    btnComeBack:      '🌙 Повернутись завтра (безкоштовно)',
    langBtn:          '🌐 RU',
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
  if (subtitle) subtitle.textContent = L.subtitle;

  const qi = document.getElementById('question-input');
  if (qi) qi.placeholder = selectedCategory ? (L.catPlaceholders[selectedCategory] || L.placeholder) : L.placeholder;

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

  const chipTexts = [L.catAll, L.catLove, L.catCareer, L.catMoney, L.catHealth];
  document.querySelectorAll('.cat-chip').forEach((chip, i) => {
    if (chipTexts[i] !== undefined) chip.textContent = chipTexts[i];
  });

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

  updateCounter();
}

function toggleLang() {
  currentLang = currentLang === 'ru' ? 'ua' : 'ru';
  localStorage.setItem('oracle_lang', currentLang);
  applyLang();
}

// ─── Category chips ────────────────────────────────────────────
let selectedCategory = '';
document.querySelectorAll('.cat-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedCategory = chip.dataset.cat || '';
    const L = LANGS[currentLang];
    document.getElementById('question-input').placeholder = selectedCategory
      ? (L.catPlaceholders[selectedCategory] || L.placeholder)
      : L.placeholder;
  });
});

// ─── User State ────────────────────────────────────────────────
const userId = tg?.initDataUnsafe?.user?.id ?? 'guest';
let userStatus = { canAsk: true, remaining: 2, isPremium: false };

async function fetchStatus() {
  if (userId === 'guest') return;
  try {
    const r = await fetch(`/api/user/${userId}/status`);
    userStatus = await r.json();
    updateCounter();
  } catch {}
}

function updateCounter() {
  const el  = document.getElementById('question-counter');
  const btn = document.getElementById('premium-btn');
  if (!el) return;
  const L = LANGS[currentLang];
  if (userStatus.isPremium) {
    el.textContent = L.counterPremium;
    el.className = 'question-counter premium';
    if (btn) { btn.textContent = L.premiumActive; btn.classList.add('is-premium'); }
  } else if (userStatus.remaining !== null) {
    const left = userStatus.remaining ?? 2;
    el.textContent = left > 0 ? L.counterLeft(left) : L.counterEmpty;
    el.className = `question-counter${left <= 1 ? ' low' : ''}`;
    if (btn) { btn.textContent = L.premiumDefault; btn.classList.remove('is-premium'); }
  }
}

// ─── Screen Switch ──────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

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
// Ховаємо кулю коли клавіатура відкрита, щоб кнопка була видна
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

// Fallback через focus/blur (для старих Telegram клієнтів)
input.addEventListener('focus', () => document.body.classList.add('keyboard-open'));
input.addEventListener('blur',  () => {
  setTimeout(() => {
    if (document.activeElement !== input) document.body.classList.remove('keyboard-open');
  }, 150);
});

// Кнопка ↓ закриває клавіатуру
document.getElementById('kbd-dismiss')?.addEventListener('mousedown', e => {
  e.preventDefault(); // не даємо інпуту отримати blur до кліку
  input.blur();
});

// Тап на хедер закриває клавіатуру
document.querySelector('.oracle-header')?.addEventListener('click', () => {
  if (document.body.classList.contains('keyboard-open')) input.blur();
});

// Тап на орб-зону (навіть коли вона collapsed) закриває клавіатуру
document.querySelector('.orb-section')?.addEventListener('click', () => input.blur());

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
  orbWrap.classList.add('asking');
  showLoading(true);

  // Запускаємо API паралельно з анімацією
  const apiPromise = fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, userId, category: selectedCategory || undefined })
  });

  // Драматична анімація "оракул думає"
  const phrases = LANGS[currentLang].thinking;
  for (let i = 0; i < phrases.length; i++) {
    orbStatus.textContent = phrases[i];
    await new Promise(r => setTimeout(r, 900));
  }

  try {
    const res = await apiPromise;
    if (res.status === 403) { showPaywall(); return; }
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.status) { userStatus = data.status; updateCounter(); }
    showAnswer(question, data.answer);
  } catch {
    orbStatus.textContent = LANGS[currentLang].orbError;
    setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 3000);
  } finally {
    askBtn.disabled = false;
    orbWrap.classList.remove('asking');
    showLoading(false);
  }
}

// ─── Paywall ────────────────────────────────────────────────────
function showPaywall() {
  showScreen('screen-paywall');
  if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
}

document.getElementById('btn-come-back').addEventListener('click', () => {
  showScreen('screen-home');
});


askBtn.addEventListener('click', askOracle);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askOracle(); }
});

// ─── Premium purchase flow ────────────────────────────────────────
async function buyPremiumFlow(btn, plan = 'month') {
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '⏳...';
  try {
    const r = await fetch(`/api/user/${userId}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const data = await r.json();
    if (!data.url) throw new Error(data.error || 'Ошибка');
    if (tg?.openInvoice) {
      tg.openInvoice(data.url, async (status) => {
        if (status === 'paid') {
          await fetchStatus();
          showScreen('screen-home');
          orbStatus.textContent = LANGS[currentLang].orbPremium;
          setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 3000);
        }
      });
    } else {
      window.open(data.url, '_blank');
    }
  } catch (e) {
    alert('Ошибка: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

// Header premium button
document.getElementById('premium-btn')?.addEventListener('click', function() {
  buyPremiumFlow(this, 'month');
});

// Paywall plan buttons
document.querySelectorAll('.plan-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    buyPremiumFlow(this, this.dataset.plan || 'month');
  });
});

// Referral button
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

// Завантажуємо статус при старті
fetchStatus();

// ─── Show Answer ────────────────────────────────────────────────
function showAnswer(question, answer) {
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
    orbGlow.style.background = `radial-gradient(circle, ${c}40 0%, transparent 70%)`;
  }

  const canvas = document.getElementById('orb-canvas');
  const glowMap = {
    yes:   'drop-shadow(0 0 35px rgba(0,245,160,0.7))',
    no:    'drop-shadow(0 0 35px rgba(255,77,109,0.7))',
    maybe: 'drop-shadow(0 0 35px rgba(245,200,66,0.7))',
  };
  canvas.style.filter = glowMap[answer.color] || 'drop-shadow(0 0 30px rgba(139,61,255,0.6))';

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
  // Якщо ліміт вичерпано — одразу paywall
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

  const canvas = document.getElementById('orb-canvas');
  canvas.style.filter = 'drop-shadow(0 0 30px rgba(139,61,255,0.6))';

  input.value = '';
  charCount.textContent = '0';
  orbStatus.textContent = LANGS[currentLang].orbDefault;

  const orbGlow = document.getElementById('orb-glow');
  if (orbGlow) orbGlow.style.background = '';

  showScreen('screen-home');
  setTimeout(() => input.focus(), 500);
});

// ─── Language switch ────────────────────────────────────────────
document.getElementById('lang-btn')?.addEventListener('click', toggleLang);
applyLang();

// ─── Share ─────────────────────────────────────────────────────
document.getElementById('btn-share').addEventListener('click', () => {
  const verdict  = document.getElementById('answer-verdict').textContent;
  const question = document.getElementById('answer-question').textContent;
  const L = LANGS[currentLang];
  const text = L.shareText(question, verdict);

  if (tg?.switchInlineQuery) {
    tg.switchInlineQuery(text);
  } else if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => {
      const btn = document.getElementById('btn-share');
      const orig = btn.textContent;
      btn.textContent = L.shareCopied;
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  }
});
