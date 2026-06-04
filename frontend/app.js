/* ─── Oracle Bot — Cosmic Edition ───────────────────────────── */

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

// ─── Hand Color Control ─────────────────────────────────────────
function setHandColor(colorName) {
  const map = {
    yes:     { border: 'rgba(0,245,160,0.85)',  aura: 'rgba(0,245,160,0.55)',  eye: '#00f5a0' },
    no:      { border: 'rgba(255,77,109,0.85)', aura: 'rgba(255,77,109,0.55)', eye: '#ff4d6d' },
    maybe:   { border: 'rgba(245,200,66,0.85)', aura: 'rgba(245,200,66,0.55)', eye: '#f5c842' },
    default: { border: 'rgba(160,80,255,0.88)', aura: 'rgba(139,61,255,0.45)', eye: '#f5c842' },
  };
  const c = map[colorName] || map.default;

  const handBorder = document.getElementById('hand-border');
  const handAura   = document.getElementById('hand-aura');
  const eyeStop    = document.getElementById('eyeStop1');
  const mainIris   = document.getElementById('main-iris');
  const aeyeStop   = document.getElementById('aeye-stop');
  const aeyeIris   = document.getElementById('aeye-iris');
  const aeyeBorder = document.getElementById('aeye-border');
  const aeyeOutl   = document.getElementById('aeye-outline');
  const handSvg    = document.getElementById('oracle-hand');
  const answerEye  = document.getElementById('answer-eye');

  if (handBorder) handBorder.setAttribute('stroke', c.border);
  if (eyeStop)    eyeStop.setAttribute('stop-color', c.eye);
  if (mainIris)   mainIris.setAttribute('fill', c.eye);
  if (handAura)   handAura.style.background =
    `radial-gradient(circle, ${c.aura} 0%, transparent 70%)`;
  if (handSvg)    handSvg.style.filter =
    `drop-shadow(0 0 22px ${c.aura}) drop-shadow(0 0 8px ${c.border})`;

  if (aeyeStop)   aeyeStop.setAttribute('stop-color', c.eye);
  if (aeyeIris)   aeyeIris.setAttribute('fill', c.eye);
  if (aeyeBorder) aeyeBorder.setAttribute('stroke', c.border);
  if (aeyeOutl)   aeyeOutl.setAttribute('stroke', c.eye);
  if (answerEye)  answerEye.style.filter =
    `drop-shadow(0 0 14px ${c.aura})`;
}

// ─── Cosmic stars inside hand ───────────────────────────────────
function buildHandStars() {
  const g = document.getElementById('hand-stars-svg');
  if (!g) return;
  for (let i = 0; i < 55; i++) {
    const ns = 'http://www.w3.org/2000/svg';
    const c = document.createElementNS(ns, 'circle');
    const r = Math.random() * 1.5 + 0.3;
    c.setAttribute('cx', 40 + Math.random() * 120);
    c.setAttribute('cy', 70 + Math.random() * 185);
    c.setAttribute('r', String(r));
    c.setAttribute('fill', 'white');
    c.setAttribute('opacity', String(Math.random() * 0.5 + 0.1));
    c.style.animation = `twinkle ${(Math.random()*4+2).toFixed(1)}s ease-in-out ${(Math.random()*4).toFixed(1)}s infinite`;
    g.appendChild(c);
  }
}
buildHandStars();

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
  if (tgUsername || tgFirstName) {
    fetch('/api/user/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, username: tgUsername, firstName: tgFirstName }),
    }).catch(() => {});
  }
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
}

// ─── Loading ────────────────────────────────────────────────────
const overlay = document.getElementById('loading-overlay');
function showLoading(on) { overlay.classList.toggle('hidden', !on); }

// ─── Question Input ─────────────────────────────────────────────
const input     = document.getElementById('question-input');
const charCount = document.getElementById('char-count');
const askBtn    = document.getElementById('ask-btn');
const orbStatus = document.getElementById('orb-status');

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

document.querySelector('.hand-section')?.addEventListener('click', () => input.blur());

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
  showLoading(true);

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

// ─── Premium purchase flow ────────────────────────────────────────
async function buyPremiumFlow(btn, plan = 'month') {
  if (!btn || btn.disabled) return;
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
    if (!data.url) throw new Error(data.error || 'Ошибка');
    if (tg?.openInvoice) {
      tg.openInvoice(data.url, async (status) => {
        if (status === 'paid') {
          trackEvent('payment_success');
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

document.getElementById('premium-btn')?.addEventListener('click', function() {
  buyPremiumFlow(this, 'month');
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
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '⏳...';
  trackEvent('pack_click');
  try {
    const r = await fetch(`/api/user/${userId}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: pack }),
    });
    const data = await r.json();
    if (!data.url) throw new Error(data.error || 'Помилка');
    if (tg?.openInvoice) {
      tg.openInvoice(data.url, async (status) => {
        if (status === 'paid') {
          await fetchStatus();
          showScreen('screen-home');
          orbStatus.textContent = `🎁 +${data.questions} питань додано!`;
          setTimeout(() => { orbStatus.textContent = LANGS[currentLang].orbDefault; }, 3000);
        }
      });
    } else {
      window.open(data.url, '_blank');
    }
  } catch (e) {
    alert('Помилка: ' + e.message);
  } finally {
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
          <div class="history-item-q">${q.question || ''}</div>
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

  setHandColor(answer.color);

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

  setHandColor('default');

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
