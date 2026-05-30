/* ─── Oracle Bot — Cosmic Edition ───────────────────────────── */

const tg = window.Telegram?.WebApp;

function applyTopInset() {
  const deviceTop  = tg?.safeAreaInset?.top        ?? 0;
  const contentTop = tg?.contentSafeAreaInset?.top ?? 0;
  const sum = deviceTop + contentTop;
  // В fullscreen сума може бути 0 до першого події — ставимо мінімум 62px
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

// Fallback: якщо Telegram не дав інсет — беремо з CSS env()
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

// ─── Plasma Orb Canvas ──────────────────────────────────────────
function OrbCanvas(canvas, size = 280, isMain = false) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2;
  const r  = size * 0.41;

  let phase = 0;
  let targetHue = 295;    // default: purple-pink
  let currentHue = 295;
  let raf;

  // ── Plasma streams (Lissajous curves that evolve over time) ───
  const streamCount = isMain ? 7 : 3;
  const streams = Array.from({ length: streamCount }, (_, i) => ({
    a:  1.5 + i * 0.6,
    b:  2.2 + i * 0.4,
    p:  Math.random() * Math.PI * 2,
    q:  Math.random() * Math.PI * 2,
    sp: (0.007 + Math.random() * 0.006) * (i % 2 ? 1 : -1),
    sq: (0.005 + Math.random() * 0.005) * (i % 2 ? -1 : 1),
    ri: 0.50 + Math.random() * 0.38,
    w:  isMain ? (3 + Math.random() * 5) : (1.5 + Math.random() * 2.5),
    hd: i * 22,
  }));

  // ── Smoke / energy particles ───────────────────────────────────
  const pCount = isMain ? 100 : 25;
  const particles = Array.from({ length: pCount }, () => {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r * 0.80;
    return {
      x:  cx + Math.cos(a) * d,
      y:  cy + Math.sin(a) * d,
      vx: (Math.random() - 0.5) * 0.70,
      vy: (Math.random() - 0.5) * 0.55,
      life: Math.random(),
      maxLife: 0.8 + Math.random() * 1.8,
      size: 1.5 + Math.random() * (isMain ? 4 : 2),
      hd:  Math.random() * 70 - 35,
    };
  });

  // ── Outer glow ─────────────────────────────────────────────────
  function drawOuterGlow(t) {
    const h   = currentHue;
    const pls = 0.75 + Math.sin(t * 1.4) * 0.25;
    // 4 concentric glow rings — neon saturated
    [
      { rr: r * 2.1,  op: 0.13 * pls },
      { rr: r * 1.65, op: 0.22 * pls },
      { rr: r * 1.28, op: 0.34 * pls },
      { rr: r * 1.08, op: 0.42 * pls },
    ].forEach(g => {
      const ag = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, g.rr);
      ag.addColorStop(0,   `hsla(${h},100%,68%,${g.op})`);
      ag.addColorStop(0.5, `hsla(${h},100%,60%,${g.op * 0.4})`);
      ag.addColorStop(1,   'transparent');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(cx, cy, g.rr, 0, Math.PI * 2);
      ctx.fill();
    });
    // Hot bright rim
    const rim = ctx.createRadialGradient(cx, cy, r * 0.90, cx, cy, r * 1.12);
    rim.addColorStop(0,   `hsla(${(h + 30) % 360},100%,85%,${0.55 * pls})`);
    rim.addColorStop(0.6, `hsla(${h},100%,70%,${0.20 * pls})`);
    rim.addColorStop(1,   'transparent');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Interior plasma ────────────────────────────────────────────
  function drawOrb(t) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // 1. Dark background (with subtle trail fade if no clearRect)
    ctx.fillStyle = 'rgba(4,2,22,1)';
    ctx.fillRect(0, 0, size, size);

    // 2. Deep inner color base (radial, sphere-like depth)
    const base = ctx.createRadialGradient(cx - r * 0.10, cy - r * 0.10, r * 0.02, cx, cy, r);
    base.addColorStop(0,    `hsla(${(currentHue + 40) % 360},60%,18%,1)`);
    base.addColorStop(0.45, `hsla(${currentHue},80%,10%,1)`);
    base.addColorStop(1,    `hsla(${currentHue},100%,4%,1)`);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // 3. Plasma streams (Lissajous + screen blend = neon glow)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    streams.forEach(s => {
      s.p += s.sp;
      s.q += s.sq;

      const N = 140;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const ang = (i / N) * Math.PI * 2;
        pts.push([
          cx + r * s.ri * Math.sin(s.a * ang + s.p),
          cy + r * s.ri * 0.80 * Math.sin(s.b * ang + s.q),
        ]);
      }

      const h1 = (currentHue + s.hd) % 360;
      const h2 = (currentHue + s.hd + 45) % 360;
      const mid = pts[N >> 1];
      const lg = ctx.createLinearGradient(pts[0][0], pts[0][1], mid[0], mid[1]);
      lg.addColorStop(0,   `hsla(${h1},100%,72%,0.0)`);
      lg.addColorStop(0.15,`hsla(${h1},100%,78%,0.55)`);
      lg.addColorStop(0.5, `hsla(${h2},100%,88%,0.85)`);
      lg.addColorStop(0.85,`hsla(${h1},100%,78%,0.55)`);
      lg.addColorStop(1,   `hsla(${h1},100%,72%,0.0)`);

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.strokeStyle = lg;
      ctx.lineWidth   = s.w;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.shadowColor = `hsla(${h1},100%,70%,0.9)`;
      ctx.shadowBlur  = s.w * 4;
      ctx.stroke();
      ctx.shadowBlur  = 0;
    });
    ctx.restore();

    // 4. Energy particles (screen blend)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    particles.forEach(p => {
      p.x  += p.vx + Math.sin(t * 0.55 + p.y * 0.014) * 0.30;
      p.y  += p.vy + Math.cos(t * 0.48 + p.x * 0.014) * 0.22;
      p.life += 0.007;
      const dx = p.x - cx, dy = p.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) > r * 0.87 || p.life > p.maxLife) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * r * 0.72;
        p.x = cx + Math.cos(a) * d;
        p.y = cy + Math.sin(a) * d;
        p.vx = (Math.random() - 0.5) * 0.70;
        p.vy = (Math.random() - 0.5) * 0.55;
        p.life = 0;
      }
      const alpha = Math.sin(p.life / p.maxLife * Math.PI) * 0.88;
      if (alpha < 0.05) return;
      const ph = (currentHue + p.hd) % 360;
      const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5);
      pg.addColorStop(0,    `hsla(${ph},100%,90%,${alpha})`);
      pg.addColorStop(0.35, `hsla(${ph},100%,68%,${alpha * 0.4})`);
      pg.addColorStop(1,    'transparent');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 5. Inner core pulse
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const corePulse = 0.12 + Math.sin(t * 2.2) * 0.06;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.55);
    cg.addColorStop(0,   `hsla(${(currentHue + 50) % 360},80%,85%,${corePulse})`);
    cg.addColorStop(0.5, `hsla(${currentHue},100%,65%,${corePulse * 0.4})`);
    cg.addColorStop(1,   'transparent');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    // 6. Caustic glass edge (bright hot rim at sphere boundary)
    const caus = ctx.createRadialGradient(cx, cy, r * 0.78, cx, cy, r);
    caus.addColorStop(0,    'transparent');
    caus.addColorStop(0.78, `hsla(${currentHue},100%,65%,0.06)`);
    caus.addColorStop(0.90, `hsla(${(currentHue + 25) % 360},100%,80%,0.16)`);
    caus.addColorStop(0.97, 'rgba(255,255,255,0.22)');
    caus.addColorStop(1,    'rgba(8,4,30,0.62)');
    ctx.fillStyle = caus;
    ctx.fillRect(0, 0, size, size);

    // 7. Depth shadow
    const sh = ctx.createRadialGradient(cx + r * 0.20, cy + r * 0.25, r * 0.12, cx, cy, r);
    sh.addColorStop(0, 'transparent');
    sh.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, size, size);

    // 8. Main glass specular — big bright top-left
    const hl1 = ctx.createRadialGradient(
      cx - r * 0.35, cy - r * 0.40, 0,
      cx - r * 0.10, cy - r * 0.16, r * 0.54
    );
    hl1.addColorStop(0,    'rgba(255,255,255,0.90)');
    hl1.addColorStop(0.08, 'rgba(255,255,255,0.62)');
    hl1.addColorStop(0.28, 'rgba(255,255,255,0.12)');
    hl1.addColorStop(1,    'transparent');
    ctx.fillStyle = hl1;
    ctx.fillRect(0, 0, size, size);

    // 9. Secondary specular bottom-right
    const hl2 = ctx.createRadialGradient(cx + r * 0.29, cy + r * 0.31, 0, cx + r * 0.29, cy + r * 0.31, r * 0.21);
    hl2.addColorStop(0,   'rgba(255,255,255,0.16)');
    hl2.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    hl2.addColorStop(1,   'transparent');
    ctx.fillStyle = hl2;
    ctx.fillRect(0, 0, size, size);

    // 10. Iridescent shimmer on edge
    const ird = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r);
    ird.addColorStop(0,    'transparent');
    ird.addColorStop(0.40, `hsla(${(currentHue - 40 + 360) % 360},100%,80%,${0.06 + Math.sin(t * 0.72) * 0.03})`);
    ird.addColorStop(0.72, `hsla(${(currentHue + 60) % 360},100%,85%,${0.04 + Math.cos(t * 0.52) * 0.02})`);
    ird.addColorStop(1,    'rgba(255,200,150,0.02)');
    ctx.fillStyle = ird;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();
  }

  // ── Outer sparkle stars ────────────────────────────────────────
  const sparkles = isMain ? Array.from({ length: 12 }, (_, i) => ({
    angle:  (i / 12) * Math.PI * 2 + Math.random() * 0.5,
    orbitR: r * (1.15 + Math.random() * 0.42),
    speed:  (Math.random() * 0.008 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
    size:   Math.random() * 2.5 + 0.8,
    twinkle:      Math.random() * Math.PI * 2,
    twinkleSpeed: Math.random() * 0.08 + 0.03,
    hd: Math.random() * 80 - 40,
  })) : [];

  function drawSparkles() {
    sparkles.forEach(sp => {
      sp.angle   += sp.speed;
      sp.twinkle += sp.twinkleSpeed;
      const bright = 0.5 + Math.sin(sp.twinkle) * 0.5;
      if (bright < 0.1) return;
      const sx = cx + Math.cos(sp.angle) * sp.orbitR;
      const sy = cy + Math.sin(sp.angle) * sp.orbitR * 0.85;
      const len = sp.size * (1.2 + bright * 1.6);
      const h = (currentHue + sp.hd) % 360;
      ctx.save();
      ctx.globalAlpha = bright;
      ctx.strokeStyle = `hsla(${h},100%,85%,1)`;
      ctx.lineWidth = sp.size * 0.5;
      ctx.lineCap   = 'round';
      ctx.shadowColor = `hsla(${h},100%,75%,0.9)`;
      ctx.shadowBlur = sp.size * 4;
      ctx.beginPath(); ctx.moveTo(sx, sy - len); ctx.lineTo(sx, sy + len); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - len, sy); ctx.lineTo(sx + len, sy); ctx.stroke();
      ctx.shadowBlur = 0;
      const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sp.size * 3);
      cg.addColorStop(0,   `hsla(${h},100%,95%,${bright})`);
      cg.addColorStop(0.4, `hsla(${h},100%,75%,${bright * 0.4})`);
      cg.addColorStop(1,   'transparent');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(sx, sy, sp.size * 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  function draw() {
    const t = phase * 0.016;
    ctx.clearRect(0, 0, size, size);
    drawOuterGlow(t);
    drawOrb(t);
    if (isMain) drawSparkles();
  }

  function tick() {
    phase++;
    currentHue += (targetHue - currentHue) * 0.018;
    draw();
    raf = requestAnimationFrame(tick);
  }

  function setColor(type) {
    if (type === 'yes')        targetHue = 145;  // green
    else if (type === 'no')    targetHue = 355;  // red
    else if (type === 'maybe') targetHue = 45;   // gold
    else                       targetHue = 295;  // purple-pink (default)
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
    { top: '0%',   left: '50%',  delay: '0s',    color: 'rgba(245,200,70,0.9)' },
    { top: '50%',  left: '100%', delay: '-2.7s', color: 'rgba(255,230,100,0.8)' },
    { top: '100%', left: '50%',  delay: '-5.3s', color: 'rgba(220,165,40,0.8)' },
    { top: '50%',  left: '0%',   delay: '-8s',   color: 'rgba(255,215,60,0.7)' },
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
