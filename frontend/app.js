/* ─── Oracle Bot — Cosmic Edition ───────────────────────────── */

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#03020f');
  tg.setBackgroundColor('#03020f');
  // Full screen mode (Telegram Bot API 8.0+)
  if (tg.requestFullscreen) tg.requestFullscreen();
  // Якщо вийшли з fullscreen — повертаємо
  tg.onEvent('fullscreenChanged', () => {
    if (!tg.isFullscreen && tg.requestFullscreen) tg.requestFullscreen();
  });
}

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

// ─── Orb Canvas ────────────────────────────────────────────────
function OrbCanvas(canvas, size = 240) {
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size * 0.44;
  let phase = 0;
  let color = { r: 139, g: 61, b: 255 };
  let targetColor = { ...color };
  let raf;

  // Nebula blobs inside the orb
  const blobs = Array.from({ length: 5 }, (_, i) => ({
    angle: (i / 5) * Math.PI * 2,
    speed: (Math.random() * 0.008 + 0.004) * (Math.random() > 0.5 ? 1 : -1),
    radius: r * (0.18 + Math.random() * 0.22),
    size: r * (0.28 + Math.random() * 0.22),
    hue: Math.random(),
  }));

  function lerp(a, b, t) { return a + (b - a) * t; }

  function draw() {
    ctx.clearRect(0, 0, size, size);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Base gradient
    const base = ctx.createRadialGradient(cx, cy - r * 0.15, r * 0.05, cx, cy, r);
    base.addColorStop(0, `rgba(${Math.min(255, color.r + 70)},${Math.min(255, color.g + 50)},255,1)`);
    base.addColorStop(0.45, `rgba(${color.r},${color.g},${color.b},0.95)`);
    base.addColorStop(1,    `rgba(${Math.max(0, color.r - 80)},${Math.max(0, color.g - 40)},${Math.max(0, color.b - 30)},1)`);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // Nebula blobs
    const t = phase * 0.018;
    blobs.forEach(b => {
      b.angle += b.speed;
      const bx = cx + Math.cos(b.angle) * b.radius;
      const by = cy + Math.sin(b.angle) * b.radius * 0.8;
      const gb = ctx.createRadialGradient(bx, by, 0, bx, by, b.size);
      const pulse = 0.12 + Math.sin(t + b.hue * 10) * 0.06;

      if (b.hue < 0.33) {
        gb.addColorStop(0, `rgba(0,212,255,${pulse})`);
      } else if (b.hue < 0.66) {
        gb.addColorStop(0, `rgba(244,63,143,${pulse})`);
      } else {
        gb.addColorStop(0, `rgba(255,255,255,${pulse * 0.7})`);
      }
      gb.addColorStop(1, 'transparent');
      ctx.fillStyle = gb;
      ctx.fillRect(0, 0, size, size);
    });

    // Swirl streaks
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(a) * r * 0.32;
      const sy = cy + Math.sin(a) * r * 0.28;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.45);
      sg.addColorStop(0, `rgba(255,255,255,${0.05 + Math.sin(t * 2 + i) * 0.025})`);
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, size, size);
    }

    // Depth rim shadow
    const rim = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
    rim.addColorStop(0, 'transparent');
    rim.addColorStop(1, `rgba(${Math.max(0,color.r-100)},${Math.max(0,color.g-50)},${Math.max(0,color.b-20)},0.5)`);
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, size, size);

    // Specular highlight
    const hl = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.32, 0, cx - r * 0.1, cy - r * 0.15, r * 0.5);
    hl.addColorStop(0,   'rgba(255,255,255,0.55)');
    hl.addColorStop(0.4, 'rgba(255,255,255,0.08)');
    hl.addColorStop(1,   'transparent');
    ctx.fillStyle = hl;
    ctx.fillRect(0, 0, size, size);

    // Small bottom reflection
    const rl = ctx.createRadialGradient(cx + r * 0.2, cy + r * 0.32, 0, cx + r * 0.2, cy + r * 0.32, r * 0.25);
    rl.addColorStop(0, 'rgba(255,255,255,0.07)');
    rl.addColorStop(1, 'transparent');
    ctx.fillStyle = rl;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();

    // Outer glow ring (outside clip)
    const og = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.3);
    og.addColorStop(0, `rgba(${color.r},${color.g},${color.b},0.18)`);
    og.addColorStop(1, 'transparent');
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function tick() {
    phase++;
    color.r = lerp(color.r, targetColor.r, 0.035);
    color.g = lerp(color.g, targetColor.g, 0.035);
    color.b = lerp(color.b, targetColor.b, 0.035);
    draw();
    raf = requestAnimationFrame(tick);
  }

  function setColor(type) {
    if (type === 'yes')        targetColor = { r: 0,   g: 220, b: 140 };
    else if (type === 'no')    targetColor = { r: 220, g: 40,  b: 90  };
    else if (type === 'maybe') targetColor = { r: 220, g: 175, b: 20  };
    else                       targetColor = { r: 139, g: 61,  b: 255 };
  }

  tick();
  return { setColor, stop: () => cancelAnimationFrame(raf) };
}

const mainOrb   = OrbCanvas(document.getElementById('orb-canvas'), 240);
const answerOrb = OrbCanvas(document.getElementById('answer-orb-canvas'), 110);

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

// ─── Ask ────────────────────────────────────────────────────────
async function askOracle() {
  const question = input.value.trim();
  if (!question) {
    input.focus();
    orbStatus.textContent = 'Сначала задай вопрос...';
    setTimeout(() => { orbStatus.textContent = 'Сосредоточься на вопросе...'; }, 2000);
    return;
  }

  askBtn.disabled = true;
  orbWrap.classList.add('asking');
  showLoading(true);
  orbStatus.textContent = 'Оракул читает нити судьбы...';

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    showAnswer(question, data.answer);
  } catch {
    orbStatus.textContent = '⚠️ Туман мешает Оракулу...';
    setTimeout(() => { orbStatus.textContent = 'Сосредоточься на вопросе...'; }, 3000);
  } finally {
    askBtn.disabled = false;
    orbWrap.classList.remove('asking');
    showLoading(false);
  }
}

askBtn.addEventListener('click', askOracle);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askOracle(); }
});

// ─── Show Answer ────────────────────────────────────────────────
function showAnswer(question, answer) {
  document.getElementById('answer-question').textContent = question;
  document.getElementById('answer-verdict').textContent  = answer.verdict;
  document.getElementById('answer-title').textContent    = answer.title;
  document.getElementById('answer-message').textContent  = answer.message;

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
document.getElementById('btn-again').addEventListener('click', () => {
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
  orbStatus.textContent = 'Сосредоточься на вопросе...';

  const orbGlow = document.getElementById('orb-glow');
  if (orbGlow) orbGlow.style.background = '';

  showScreen('screen-home');
  setTimeout(() => input.focus(), 500);
});

// ─── Share ─────────────────────────────────────────────────────
document.getElementById('btn-share').addEventListener('click', () => {
  const verdict  = document.getElementById('answer-verdict').textContent;
  const question = document.getElementById('answer-question').textContent;
  const text = `🔮 Оракул Судьбы ответил!\n\n❓ ${question}\n\n${verdict}\n\n✨ Спроси и ты: @oracle_666bot`;

  if (tg?.switchInlineQuery) {
    tg.switchInlineQuery(text);
  } else if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => {
      const btn = document.getElementById('btn-share');
      const orig = btn.textContent;
      btn.textContent = '✅ Скопировано!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  }
});
