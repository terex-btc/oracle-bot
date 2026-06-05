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

  return { setColor, pause, resume, stop: () => { paused = true; cancelAnimationFrame(raf); } };
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

const mainOrb   = OrbCanvas(document.getElementById('orb-canvas'),        240, true);
const answerOrb = OrbCanvas(document.getElementById('answer-orb-canvas'),  90, false);

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
  showLoading(true);

  try {
    const apiPromise = fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question, userId,
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
    if (res.status === 403) { showPaywall(); return; }
    if (!res.ok) throw new Error('server error');
    const data = await res.json();
    if (data.status) { userStatus = data.status; updateCounter(); }
    showLoading(false);
    orbWrap?.classList.remove('asking');
    playOracleSound(data.answer.color);
    triggerOrbBurst(data.answer.color);
    await new Promise(r => setTimeout(r, 230));
    showAnswer(question, data.answer);
  } catch {
    orbStatus.textContent = LANGS[currentLang].orbError;
    setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 3000);
  } finally {
    askBtn.disabled = false;
    orbWrap?.classList.remove('asking');
    showLoading(false);
  }
}

// ─── Paywall ────────────────────────────────────────────────────
function showPaywall() {
  showScreen('screen-paywall');
  applyABVariant();
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
    orbGlow.style.background = `radial-gradient(circle, ${c}50 0%, transparent 70%)`;
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
