/* ─── Oracle Bot — Frontend App ─────────────────────────────── */

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#06061a');
  tg.setBackgroundColor('#06061a');
}

// ─── Stars ─────────────────────────────────────────────────────
function createStars(container, count = 60) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    s.style.cssText = [
      `width:${size}px`, `height:${size}px`,
      `left:${Math.random() * 100}%`, `top:${Math.random() * 100}%`,
      `--d:${(Math.random() * 4 + 2).toFixed(1)}s`,
      `--delay:${(Math.random() * 4).toFixed(1)}s`,
      `--min-op:${(Math.random() * 0.15 + 0.05).toFixed(2)}`,
      `--max-op:${(Math.random() * 0.5 + 0.4).toFixed(2)}`
    ].join(';');
    container.appendChild(s);
  }
}

document.querySelectorAll('.stars-bg').forEach(c => createStars(c));

// ─── Orb Canvas ────────────────────────────────────────────────
function OrbCanvas(canvas, size = 260) {
  const ctx = canvas.getContext('2d');
  let phase = 0;
  let color = { r: 124, g: 58, b: 237 };
  let targetColor = { ...color };
  let raf;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function draw() {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, r = size * 0.44;

    // Outer glow
    const og = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.2);
    og.addColorStop(0, `rgba(${color.r},${color.g},${color.b},0.12)`);
    og.addColorStop(1, 'transparent');
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Main orb gradient
    const mg = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx, cy, r);
    mg.addColorStop(0, `rgba(${Math.min(255, color.r + 80)},${Math.min(255, color.g + 60)},255,0.95)`);
    mg.addColorStop(0.4, `rgba(${color.r},${color.g},${color.b},0.9)`);
    mg.addColorStop(1, `rgba(${Math.max(0, color.r - 60)},${Math.max(0, color.g - 30)},${Math.max(0, color.b - 40)},0.95)`);
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Nebula swirls
    const time = phase * 0.02;
    for (let i = 0; i < 3; i++) {
      const angle = time + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(angle) * r * 0.35;
      const sy = cy + Math.sin(angle) * r * 0.35;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.55);
      sg.addColorStop(0, `rgba(255,255,255,${0.07 + Math.sin(time + i) * 0.03})`);
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Specular highlight
    const hl = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx - r * 0.15, cy - r * 0.2, r * 0.45);
    hl.addColorStop(0, 'rgba(255,255,255,0.5)');
    hl.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    hl.addColorStop(1, 'transparent');
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function tick() {
    phase++;
    color.r = lerp(color.r, targetColor.r, 0.04);
    color.g = lerp(color.g, targetColor.g, 0.04);
    color.b = lerp(color.b, targetColor.b, 0.04);
    draw();
    raf = requestAnimationFrame(tick);
  }

  function setColor(type) {
    if (type === 'yes')   targetColor = { r: 16, g: 185, b: 129 };
    else if (type === 'no')    targetColor = { r: 239, g: 68, b: 68 };
    else if (type === 'maybe') targetColor = { r: 245, g: 158, b: 11 };
    else                       targetColor = { r: 124, g: 58, b: 237 };
  }

  tick();
  return { setColor, stop: () => cancelAnimationFrame(raf) };
}

const mainOrb   = OrbCanvas(document.getElementById('orb-canvas'), 260);
const answerOrb = OrbCanvas(document.getElementById('answer-orb-canvas'), 120);

// ─── Screen Switch ──────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── Loading ────────────────────────────────────────────────────
const overlay = document.getElementById('loading-overlay');
function showLoading(on) {
  overlay.classList.toggle('hidden', !on);
}

// ─── Question Input ─────────────────────────────────────────────
const input     = document.getElementById('question-input');
const charCount = document.getElementById('char-count');
const askBtn    = document.getElementById('ask-btn');
const orbStatus = document.getElementById('orb-status');
const orbWrap   = document.getElementById('orb-wrapper');

input.addEventListener('input', () => {
  charCount.textContent = input.value.length;
});

// ─── Ask ────────────────────────────────────────────────────────
async function askOracle() {
  const question = input.value.trim();
  if (!question) {
    input.focus();
    orbStatus.textContent = '🔮 Сначала задай свой вопрос...';
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

    if (!res.ok) throw new Error('Сервер не ответил');
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

  const orbGlow = document.getElementById('orb-glow');
  if (orbGlow) {
    const colors = { yes: '#10b981', no: '#ef4444', maybe: '#f59e0b' };
    orbGlow.style.background = `radial-gradient(circle, ${colors[answer.color] || '#7c3aed'}33 0%, transparent 70%)`;
  }

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
  document.getElementById('answer-orb-mini').classList.remove('visible');
  document.getElementById('answer-card').classList.remove('visible');
  mainOrb.setColor('default');
  answerOrb.setColor('default');
  input.value = '';
  charCount.textContent = '0';
  orbStatus.textContent = 'Сосредоточься на вопросе...';
  const orbGlow = document.getElementById('orb-glow');
  if (orbGlow) orbGlow.style.background = '';
  showScreen('screen-home');
  setTimeout(() => input.focus(), 400);
});

// ─── Share ─────────────────────────────────────────────────────
document.getElementById('btn-share').addEventListener('click', () => {
  const verdict  = document.getElementById('answer-verdict').textContent;
  const question = document.getElementById('answer-question').textContent;
  const text = `🔮 Оракул Судьбы ответил!\n\n❓ ${question}\n\n${verdict}\n\nСпроси и ты: @OracleFateBot`;

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
