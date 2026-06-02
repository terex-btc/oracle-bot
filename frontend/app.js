/* ─── Oracle Bot — Cosmic Edition ───────────────────────────── */
import * as THREE from 'three';

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

// ─── 3D Plasma Orb (Three.js + GLSL) ───────────────────────────
function OrbCanvas(canvas, size = 280, isMain = false) {
  // ── WebGL Renderer ───────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.z = 3.2;

  // ── GLSL: Plasma shader (sine-wave based, no noise library) ──
  const VS = /* glsl */`
    varying vec3 vPos;
    varying vec3 vNormal;
    void main() {
      vPos    = position;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const FS = /* glsl */`
    precision highp float;
    uniform float uTime;
    uniform float uHue;
    varying vec3 vPos;
    varying vec3 vNormal;

    vec3 hsl2rgb(float h, float s, float l) {
      float c  = (1.0 - abs(2.0*l - 1.0)) * s;
      float h6 = h * 6.0;
      float x  = c * (1.0 - abs(mod(h6, 2.0) - 1.0));
      float m  = l - c * 0.5;
      vec3 rgb;
      if      (h6 < 1.0) rgb = vec3(c, x, 0.0);
      else if (h6 < 2.0) rgb = vec3(x, c, 0.0);
      else if (h6 < 3.0) rgb = vec3(0.0, c, x);
      else if (h6 < 4.0) rgb = vec3(0.0, x, c);
      else if (h6 < 5.0) rgb = vec3(x, 0.0, c);
      else               rgb = vec3(c, 0.0, x);
      return clamp(rgb + m, 0.0, 1.0);
    }

    float plasma(vec3 p, float t) {
      float v = 0.0;
      v += sin(p.x * 3.8 + t * 0.72);
      v += sin(p.y * 4.5 - t * 0.58 + p.x * 2.1);
      v += sin((p.x + p.z) * 3.2 + t * 0.65);
      v += sin(length(p.xy) * 5.5 - t * 0.90);
      v += sin(p.z * 4.0 + t * 0.44 + p.y * 1.7);
      v += sin((p.x - p.y + p.z * 0.6) * 4.2 - t * 0.36);
      return v / 6.0 * 0.5 + 0.5;
    }

    void main() {
      float v  = plasma(vPos * 1.7, uTime);
      float h1 = uHue;
      float h2 = fract(uHue + 0.08);
      float h3 = fract(uHue + 0.17);

      vec3 col = mix(hsl2rgb(h1, 1.0, 0.44), hsl2rgb(h2, 1.0, 0.60), v);
      col = mix(col, hsl2rgb(h3, 1.0, 0.80), pow(v, 2.6) * 0.60);

      // Core glow — brighter toward center
      float core = max(0.0, 1.0 - length(vPos) * 1.1);
      col += hsl2rgb(fract(h1 + 0.04), 0.85, 0.88) * core * core * 0.55;

      // Fresnel rim — neon edge glow
      float fres = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
      col += hsl2rgb(fract(h1 + 0.12), 1.0, 0.82) * fres * 1.0;

      gl_FragColor = vec4(col, 0.92);
    }
  `;

  const plasmaUniforms = { uTime: { value: 0.0 }, uHue: { value: 0.82 } };
  const plasmaInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.97, isMain ? 64 : 32, isMain ? 64 : 32),
    new THREE.ShaderMaterial({
      uniforms: plasmaUniforms, vertexShader: VS, fragmentShader: FS,
      side: THREE.BackSide, transparent: true,
    })
  );
  scene.add(plasmaInner);

  // ── Glass shell (barely-visible surface with sheen) ───────────
  const glassMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 64, 64),
    new THREE.MeshStandardMaterial({
      color: 0xddeeff, roughness: 0.0, metalness: 0.12,
      transparent: true, opacity: 0.07,
    })
  );
  scene.add(glassMesh);

  // ── Specular highlight blobs (key glass marker) ───────────────
  const hlMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 12), hlMat);
  hl1.position.set(-0.37, 0.43, 0.88);
  scene.add(hl1);
  const hl2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  hl2.position.set(0.30, -0.33, 0.90);
  scene.add(hl2);

  // ── Particle cloud (floating inside sphere) ───────────────────
  let pts = null, ptMat = null;
  if (isMain) {
    const N   = 380;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const rr = Math.cbrt(Math.random()) * 0.88;
      pos[i*3]   = rr * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = rr * Math.sin(ph) * Math.sin(th);
      pos[i*3+2] = rr * Math.cos(ph);
    }
    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ptMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.022, transparent: true, opacity: 0.70,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    pts = new THREE.Points(ptGeo, ptMat);
    scene.add(pts);
  }

  // ── Orbiting point lights inside sphere ───────────────────────
  const lightDefs = isMain
    ? [{ sp:  0.82, ph: 0,           tl: 0.40 },
       { sp: -0.58, ph: 2.09,        tl: -0.38 },
       { sp:  0.45, ph: 4.19,        tl:  0.72 }]
    : [{ sp: 0.70,  ph: 0,           tl: 0 }];
  const lights = lightDefs.map(d => {
    const l = new THREE.PointLight(0xff00ff, isMain ? 5 : 2.5, 5.5);
    scene.add(l);
    return { ...d, light: l };
  });
  scene.add(new THREE.AmbientLight(0x110011, 0.6));

  // ── Animation ─────────────────────────────────────────────────
  let currentHue = 0.82, targetHue = 0.82, raf;

  function tick() {
    raf = requestAnimationFrame(tick);
    const t = Date.now() * 0.001;

    currentHue += (targetHue - currentHue) * 0.018;
    plasmaUniforms.uTime.value = t;
    plasmaUniforms.uHue.value  = currentHue;

    lights.forEach((l, i) => {
      const ang = t * l.sp + l.ph;
      l.light.color.setHSL(currentHue + i * 0.06, 1.0, 0.68);
      l.light.position.set(Math.cos(ang) * 0.72, Math.sin(ang * 1.35 + l.tl) * 0.50, Math.sin(ang) * 0.72);
    });
    if (pts)   { pts.rotation.y = t * 0.10; pts.rotation.x = Math.sin(t * 0.08) * 0.14; }
    if (ptMat) { ptMat.color.setHSL(currentHue + 0.03, 0.75, 0.92); }

    glassMesh.rotation.y = Math.sin(t * 0.12) * 0.04;
    renderer.render(scene, camera);
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
const tgUser      = tg?.initDataUnsafe?.user;
const userId      = tgUser?.id      ?? 'guest';
const tgUsername  = tgUser?.username   ?? null;
const tgFirstName = tgUser?.first_name ?? null;

let userStatus = { canAsk: true, remaining: 2, isPremium: false };
let abVariant  = 'A';
let lastAnswer = null;

// Fire-and-forget funnel event
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
    body: JSON.stringify({
      question, userId,
      category:  selectedCategory || undefined,
      username:  tgUsername  || undefined,
      firstName: tgFirstName || undefined,
    })
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

// Завантажуємо статус при старті
fetchStatus();

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

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#03020f');
  bg.addColorStop(1, '#130625');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Glow blob
  const glowCol = answer.color === 'yes' ? '#00f5a0' : answer.color === 'no' ? '#ff4d6d' : '#f5c842';
  const glow = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, 220);
  glow.addColorStop(0, glowCol + '44');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Top badge
  ctx.font = 'bold 15px Inter, sans-serif';
  ctx.fillStyle = 'rgba(139,61,255,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText('🔮  ОРАКУЛ ДОЛІ', W / 2, 52);

  // Divider
  ctx.strokeStyle = 'rgba(139,61,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 68); ctx.lineTo(W - 60, 68); ctx.stroke();

  // Question label
  ctx.font = '13px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('питання', W / 2, 96);

  // Question text
  ctx.font = '600 17px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  wrapCanvasText(ctx, `"${question}"`, W / 2, 126, W - 80, 26);

  // Verdict glow
  const vGlow = ctx.createRadialGradient(W / 2, H * 0.52, 0, W / 2, H * 0.52, 130);
  vGlow.addColorStop(0, glowCol + '55');
  vGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = vGlow;
  ctx.fillRect(0, H * 0.38, W, H * 0.28);

  // Verdict
  const verdictText = (currentLang === 'ua' ? (answer.verdict_ua || answer.verdict) : answer.verdict) || '';
  ctx.font = 'bold 44px Cinzel, Inter, sans-serif';
  ctx.fillStyle = glowCol;
  ctx.shadowColor = glowCol;
  ctx.shadowBlur = 28;
  ctx.fillText(verdictText, W / 2, H * 0.50);
  ctx.shadowBlur = 0;

  // Message
  const msgText = (currentLang === 'ua' ? (answer.message_ua || answer.message) : answer.message) || '';
  ctx.font = '15px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  wrapCanvasText(ctx, msgText, W / 2, H * 0.62, W - 80, 24);

  // Bottom divider
  ctx.strokeStyle = 'rgba(139,61,255,0.25)';
  ctx.beginPath(); ctx.moveTo(60, H - 72); ctx.lineTo(W - 60, H - 72); ctx.stroke();

  // Bot link
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

  // Fallback — text share
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
