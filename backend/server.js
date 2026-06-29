require('dotenv').config({ path: __dirname + '/.env' });
const express      = require('express');
const cors         = require('cors');
const compression  = require('compression');
const path         = require('path');
const https        = require('https');
const crypto       = require('crypto');
const TelegramBot  = require('node-telegram-bot-api');
const { getOracleAnswer } = require('./config/oracleAnswers');
const { buildAnswer, CATEGORY_KEYS } = require('./config/readings');
const { bm } = require('./config/botMessages');
let getStatus, increment, setUserInfo, activatePremium, revokePremium, addBonus, applyReferral, logQuestion,
    getUserQuestions, getStats, getUsers, getQuestions,
    createGift, redeemGift, logEvent, getFunnelStats, getABVariant,
    setSource, markPaid, startOffer, logPayment, getSourceStats, getLang, setLangIfUnset;
try {
  ({ getStatus, increment, setUserInfo, activatePremium, revokePremium, addBonus, applyReferral,
     logQuestion, getUserQuestions, getStats, getUsers, getQuestions,
     createGift, redeemGift, logEvent, getFunnelStats, getABVariant,
     setSource, markPaid, startOffer, logPayment, getSourceStats, getLang, setLangIfUnset } = require('./services/userService'));
} catch (e) {
  console.error('[userService] Load error:', e.message);
  getStatus        = () => ({ canAsk: true, remaining: 2, isPremium: false });
  increment        = () => ({ streak: 0, reward: 0 });
  setUserInfo      = () => {};
  activatePremium  = () => new Date().toISOString();
  revokePremium    = () => true;
  addBonus         = () => {};
  applyReferral    = () => false;
  logQuestion      = () => {};
  getUserQuestions = async () => [];
  getStats         = () => ({});
  getUsers         = () => [];
  getQuestions     = () => [];
  createGift       = () => 'DEMO';
  redeemGift       = async () => ({ ok: false, error: 'DB unavailable' });
  logEvent         = () => {};
  getFunnelStats   = () => ({ counts: {}, ab: {} });
  getABVariant     = () => 'A';
  setSource        = () => false;
  markPaid         = () => {};
  startOffer       = () => null;
  logPayment       = () => {};
  getSourceStats   = () => [];
  getLang          = () => null;
  setLangIfUnset   = () => null;
}

const app          = express();
const PORT         = process.env.PORT || 3000;
const BOT_TOKEN    = process.env.BOT_TOKEN;
const WEBAPP_URL   = process.env.WEBAPP_URL || `http://localhost:${PORT}`;
const ADMIN_SECRET = process.env.ADMIN_SECRET || (BOT_TOKEN ? BOT_TOKEN.slice(0, 12) : 'oracle_admin');
const sseClients     = new Set();
const limitNotifSent = new Set(); // userId_date — не спамити "ліміт" більше ніж раз на день

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(compression());
app.use(cors({ origin: ['https://web.telegram.org', 'https://t.me', WEBAPP_URL] }));
app.use(express.json({ limit: '16kb' }));

// ─── Sliding-window rate limiter ─────────────────────────────────────────────
const _rl = new Map();
function makeRL(max, windowMs) {
  return function(key) {
    const now = Date.now(), cutoff = now - windowMs;
    let a = _rl.get(key);
    if (!a) { a = []; _rl.set(key, a); }
    while (a.length && a[0] < cutoff) a.shift();
    if (a.length >= max) return false;
    a.push(now);
    if (_rl.size > 20000) {
      for (const [k, v] of _rl) if (!v.length || v[v.length - 1] < cutoff) _rl.delete(k);
    }
    return true;
  };
}
const rl = {
  askFast: makeRL(1,   1_500),  // 1 per 1.5s  — double-tap guard
  ask:     makeRL(30,  60_000), // 30 per min   — sustained spam
  invoice: makeRL(5,   60_000), // 5 per min    — invoice spam
  event:   makeRL(120, 60_000), // 120 per min  — analytics spam (silently drop)
};

function rateLimit(req, res, next) {
  const uid = String(req.body?.userId || req.ip || '?');
  if (!rl.askFast(uid)) return res.status(429).json({ error: 'Too fast' });
  if (!rl.ask(uid))     return res.status(429).json({ error: 'Rate limit' });
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emitQuestion() {
  for (const client of sseClients) {
    client.write('event: question\ndata: {}\n\n');
  }
}

function escMd(str) {
  return String(str || '').replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

function tgApi(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req  = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Telegram initData auth ────────────────────────────────────────────────────
// The ONLY trusted source of a user's identity. Never trust a client-supplied id.
let _initSecret = null;
function initDataSecret() {
  if (!_initSecret && BOT_TOKEN) {
    _initSecret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  }
  return _initSecret;
}

// Returns the verified Telegram user object if the initData HMAC matches the bot
// token (and is fresh), otherwise null.
function verifyInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  let params;
  try { params = new URLSearchParams(initData); } catch { return null; }
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const pairs = [];
  for (const [k, v] of params) pairs.push(`${k}=${v}`);
  pairs.sort();
  let computed;
  try {
    computed = crypto.createHmac('sha256', initDataSecret()).update(pairs.join('\n')).digest('hex');
  } catch { return null; }
  // timing-safe compare
  if (computed.length !== hash.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash))) return null;
  // Freshness: reject initData older than 24h (anti-replay). Telegram re-issues
  // it on every launch, so a live session never trips this.
  const authDate = Number(params.get('auth_date')) || 0;
  if (authDate && Date.now() / 1000 - authDate > 86_400) return null;
  try {
    const user = JSON.parse(params.get('user') || 'null');
    return user && user.id ? user : null;
  } catch { return null; }
}

// Attaches req.authUserId (string) when the request carries valid initData.
function tgAuth(req, res, next) {
  const initData = req.get('X-Telegram-Init-Data') || req.body?.initData || '';
  const user = verifyInitData(initData);
  if (user) {
    req.tgUser    = user;
    req.authUserId = String(user.id);
  }
  next();
}

// Normalize a question so the same intent maps to the same deterministic seed.
function normQuestion(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// ─── Language resolution ────────────────────────────────────────────────────────
// Ukrainian Telegram clients (uk*) default to UA; everyone else to RU. A stored
// per-user preference (set in-app or on first /start) always wins.
function codeToLang(tgCode) {
  return String(tgCode || '').toLowerCase().startsWith('uk') ? 'ua' : 'ru';
}
function langFor(userId, tgCode) {
  return (userId && getLang(userId)) || codeToLang(tgCode);
}
function fmtDate(d, lang, opts) {
  return new Date(d).toLocaleDateString(lang === 'ua' ? 'uk' : 'ru', opts);
}

// ─── Telegram Bot ─────────────────────────────────────────────────────────────
let bot;
const WEBHOOK_PATH = BOT_TOKEN ? `/webhook/${BOT_TOKEN}` : null;

if (BOT_TOKEN) {
  bot = new TelegramBot(BOT_TOKEN, { webHook: false });
  bot.setWebHook(`${WEBAPP_URL}${WEBHOOK_PATH}`).catch(e => console.error('[Bot] setWebHook error:', e.message));

  // Prevent crashes from Telegram API errors inside async handlers
  bot.on('error',         (err) => console.error('[Bot] error:',         err.message));
  bot.on('polling_error', (err) => console.error('[Bot] polling_error:', err.message));

  // Telegram pushes updates to this endpoint
  app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  const PLANS = {
    week:     { days: 7,     stars: 100,  label: '7 днів' },
    month:    { days: 30,    stars: 300,  label: '30 днів' },
    lifetime: { days: 36500, stars: 2500, label: 'Назавжди' },
  };

  // /start — підтримує реферали (?start=ref_USERID)
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId  = msg.chat.id;
    const userId  = msg.from?.id;
    const tgLang  = codeToLang(msg.from?.language_code);
    if (userId) setLangIfUnset(userId, tgLang); // remember the very first launch language
    const lang    = userId ? langFor(userId, msg.from?.language_code) : tgLang;
    const t       = bm(lang);
    const name    = msg.from?.first_name || t.defaultName;
    const param   = (match[1] || '').trim();

    // Джерело трафіку (first touch): ?start=src_назва_каналу
    if (userId && param.startsWith('src_')) {
      const src = param.slice(4).replace(/[^\w-]/g, '').slice(0, 32);
      if (src) setSource(userId, src);
    } else if (userId && param.startsWith('ref_')) {
      setSource(userId, 'referral');
    } else if (userId && param.startsWith('gift_')) {
      setSource(userId, 'gift');
    }

    // Подарунок: ?start=gift_CODE
    if (userId && param.startsWith('gift_')) {
      const code = param.slice(5).toUpperCase();
      const result = await redeemGift(code, userId);
      if (result.ok) {
        const until = fmtDate(result.until, lang, { day: 'numeric', month: 'long' });
        await bot.sendMessage(chatId, t.giftRedeemSuccess(result.days, until),
          { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: t.btnOpen, web_app: { url: WEBAPP_URL } }]] } }
        );
        try { await bot.sendMessage(result.fromUserId, bm(langFor(result.fromUserId)).giftToReferrer(result.days)); } catch {}
        return;
      } else {
        await bot.sendMessage(chatId, `❌ ${result.error}`);
      }
    }

    // Реферал
    if (userId && param.startsWith('ref_')) {
      const referrerId = param.replace('ref_', '');
      const applied = applyReferral(userId, referrerId);
      if (applied) {
        await bot.sendMessage(chatId, t.referralBonusSelf, { parse_mode: 'Markdown' });
        try { await bot.sendMessage(referrerId, bm(langFor(referrerId)).referralToReferrer, { parse_mode: 'MarkdownV2' }); } catch {}
      }
    }

    if (userId) setUserInfo(userId, { username: msg.from?.username, firstName: msg.from?.first_name });
    const status    = userId ? getStatus(userId) : null;
    const isPremium = status?.isPremium;
    const isNewUser = status && status.totalAsked === 0 && status.dailyCount === 0;

    if (isNewUser) {
      // Activate 2-day free trial for brand-new users
      if (userId) activatePremium(userId, 2);

      const refLink = `https://t.me/oracle_666bot?start=ref_${userId}`;
      await bot.sendMessage(chatId, t.welcomeNew(name),
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: t.btnOpenFull, web_app: { url: WEBAPP_URL } }],
              [{ text: t.btnInvite, url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}` }],
            ],
          },
        }
      );
      return;
    }

    // Returning user
    let statusBlock;
    if (isPremium) {
      const until = fmtDate(status.premiumUntil, lang, { day: 'numeric', month: 'long' });
      statusBlock = t.statusPremium(until);
    } else {
      statusBlock = t.statusFree(status?.bonusLeft || 0);
    }

    const keyboard = isPremium
      ? [[{ text: t.btnOpenFull, web_app: { url: WEBAPP_URL } }]]
      : [
          [{ text: t.btnOpenFull, web_app: { url: WEBAPP_URL } }],
          [{ text: t.btnPremiumFrom, callback_data: 'buy_premium' }],
          [{ text: t.btnInvite,      callback_data: 'get_ref' }],
        ];

    await bot.sendMessage(chatId, t.welcomeBack(name, statusBlock),
      { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: keyboard } }
    );
  });

  // /premium
  bot.onText(/\/premium/, async (msg) => {
    const chatId = msg.chat.id;
    const t = bm(langFor(msg.from?.id, msg.from?.language_code));
    await bot.sendMessage(chatId, t.premiumMenu,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: t.btnWeek,     callback_data: 'buy_week' }],
            [{ text: t.btnMonth,    callback_data: 'buy_month' }],
            [{ text: t.btnLifetime, callback_data: 'buy_lifetime' }],
          ]
        }
      }
    );
  });

  // /ref — реферальне посилання
  bot.onText(/\/ref/, async (msg) => {
    const userId = msg.from?.id;
    if (!userId) return;
    const t = bm(langFor(userId, msg.from?.language_code));
    const refLink = `https://t.me/oracle_666bot?start=ref_${userId}`;
    await bot.sendMessage(msg.chat.id, t.refInfo(refLink), { parse_mode: 'Markdown' });
  });

  // Callback query
  bot.on('callback_query', async (query) => {
    try {
      await bot.answerCallbackQuery(query.id).catch(() => {});
      if (query.from?.id) setUserInfo(query.from.id, { username: query.from.username, firstName: query.from.first_name });
      const data   = query.data;
      const chatId = query.message?.chat?.id;
      const userId = query.from?.id;
      const lang   = langFor(userId, query.from?.language_code);
      if (!chatId) return;
      if      (data === 'buy_premium' || data === 'buy_month') await sendPremiumInvoice(chatId, userId, 'month', lang);
      else if (data === 'buy_week')     await sendPremiumInvoice(chatId, userId, 'week', lang);
      else if (data === 'buy_lifetime') await sendPremiumInvoice(chatId, userId, 'lifetime', lang);
      else if (data === 'gift_7')       await sendGiftInvoice(chatId, userId, 'gift7', lang);
      else if (data === 'gift_30')      await sendGiftInvoice(chatId, userId, 'gift30', lang);
      else if (data === 'get_ref') {
        const refLink = `https://t.me/oracle_666bot?start=ref_${userId}`;
        await bot.sendMessage(chatId, bm(langFor(userId, query.from?.language_code)).refShort(refLink),
          { parse_mode: 'MarkdownV2' }
        );
      }
    } catch (e) { console.error('[callback_query]', e.message); }
  });

  // /ask
  bot.onText(/\/ask (.+)/, async (msg, match) => {
    try {
      const chatId   = msg.chat.id;
      const userId   = msg.from?.id;
      const t        = bm(langFor(userId, msg.from?.language_code));
      const question = match[1].trim();
      if (userId) {
        const status = getStatus(userId);
        if (!status.canAsk) {
          await bot.sendMessage(chatId, t.askLimit,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: t.btnBuyPremium, callback_data: 'buy_premium' }]] } }
          );
          return;
        }
        increment(userId);
      }
      const answer     = getOracleAnswer(`${userId || 'tg'}::${normQuestion(question)}`);
      const colorEmoji = answer.color === 'yes' ? '🟢' : answer.color === 'no' ? '🔴' : '🟡';
      const isUa       = langFor(userId, msg.from?.language_code) === 'ua';
      const title      = isUa ? answer.title_ua   : answer.title;
      const verdict    = isUa ? answer.verdict_ua : answer.verdict;
      const message    = isUa ? answer.message_ua : answer.message;
      await bot.sendMessage(chatId, t.askAnswer(question, colorEmoji, title, verdict, message),
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: t.btnAskNew, web_app: { url: WEBAPP_URL } }]] } }
      );
    } catch (e) { console.error('[/ask]', e.message); }
  });

  bot.onText(/^\/ask$/, async (msg) => {
    try { await bot.sendMessage(msg.chat.id, bm(langFor(msg.from?.id, msg.from?.language_code)).askUsage, { parse_mode: 'Markdown' }); }
    catch (e) { console.error('[/ask empty]', e.message); }
  });

  bot.onText(/\/help/, async (msg) => {
    try {
      const t = bm(langFor(msg.from?.id, msg.from?.language_code));
      await bot.sendMessage(msg.chat.id, t.helpText,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: t.btnOpen, web_app: { url: WEBAPP_URL } }]] } }
      );
    } catch (e) { console.error('[/help]', e.message); }
  });

  bot.onText(/\/terms|\/privacy/, async (msg) => {
    try {
      await bot.sendMessage(msg.chat.id, bm(langFor(msg.from?.id, msg.from?.language_code)).termsText(WEBAPP_URL),
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    } catch (e) { console.error('[/terms]', e.message); }
  });

  // /gift — gifting flow
  bot.onText(/\/gift/, async (msg) => {
    try {
      const t = bm(langFor(msg.from?.id, msg.from?.language_code));
      await bot.sendMessage(msg.chat.id, t.giftMenu,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: { inline_keyboard: [
            [{ text: t.btnGift7,  callback_data: 'gift_7'  }],
            [{ text: t.btnGift30, callback_data: 'gift_30' }],
          ]},
        }
      );
    } catch (e) { console.error('[/gift]', e.message); }
  });

  // Inline mode — @oracle_666bot питання
  bot.on('inline_query', async (query) => {
    const question = (query.query || '').trim();
    if (query.from?.id) setUserInfo(query.from.id, { username: query.from?.username, firstName: query.from?.first_name });
    const lang = langFor(query.from?.id, query.from?.language_code);
    const t    = bm(lang);
    const isUa = lang === 'ua';

    const buildResult = (id, q, a) => {
      const em      = a.color === 'yes' ? '🟢' : a.color === 'no' ? '🔴' : '🟡';
      const verdict = isUa ? a.verdict_ua : a.verdict;
      const message = isUa ? a.message_ua : a.message;
      return {
        type: 'article', id: String(id),
        title: `${em} ${verdict}`,
        description: q,
        input_message_content: {
          message_text: t.inlineResult(q, em, verdict, message),
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
        },
        reply_markup: { inline_keyboard: [[{ text: t.btnAsk, url: 'https://t.me/oracle_666bot/app' }]] },
      };
    };

    const results = [];
    if (question) {
      const uid = query.from?.id || 'inline';
      results.push(buildResult(1, question, getOracleAnswer(`${uid}::${normQuestion(question)}`)));
    } else {
      t.suggestions.forEach((q, i) => results.push(buildResult(i + 1, q, getOracleAnswer('suggest::' + normQuestion(q)))));
    }

    try { await bot.answerInlineQuery(query.id, results, { cache_time: 0, is_personal: true }); } catch {}
  });

  // ── Оплата Stars ────────────────────────────────────────────────
  bot.on('pre_checkout_query', async (query) => {
    try {
      const payload = query?.invoice_payload || '';
      if (!payload.startsWith('oracle_') || query.currency !== 'XTR') {
        await bot.answerPreCheckoutQuery(query.id, false, 'Невідомий платіж').catch(() => {});
        console.warn(`[PreCheckout] REJECTED payload=${payload} currency=${query.currency}`);
        return;
      }
      await bot.answerPreCheckoutQuery(query.id, true);
      console.log(`[PreCheckout] OK userId=${query.from?.id} payload=${payload} stars=${query.total_amount}`);
    } catch (e) { console.error('[pre_checkout_query]', e.message); }
  });

  bot.on('message', async (msg) => {
    if (!msg.successful_payment) return;
    const userId  = msg.from?.id;
    const stars   = msg.successful_payment.total_amount;
    const payload = msg.successful_payment.invoice_payload;

    console.log(`[Payment] userId=${userId} stars=${stars} payload=${payload}`);

    const lang = langFor(userId, msg.from?.language_code);
    const t    = bm(lang);

    try {
      if (userId) setUserInfo(userId, { username: msg.from?.username, firstName: msg.from?.first_name });
      if (!payload?.startsWith('oracle_')) return;

      // Лог платежу для статистики джерел + вимкнення офферу першої покупки
      logPayment(userId, stars, payload);
      markPaid(userId);

      // ── Подарунки: oracle_gift7_UID / oracle_gift30_UID ──
      if (payload.startsWith('oracle_gift')) {
        const giftPlanKey = Object.keys(GIFT_PLANS).find(k => payload.startsWith(`oracle_${k}_`));
        const gp = giftPlanKey ? GIFT_PLANS[giftPlanKey] : { days: 30 };
        const code = createGift(userId, gp.days);
        const shareUrl = `https://t.me/oracle_666bot?start=gift_${code}`;
        const shareText = lang === 'ua' ? '🔮 Тримай подарунок — Оракул Долі чекає тебе!' : '🔮 Держи подарок — Оракул Судьбы ждёт тебя!';
        try {
          await bot.sendMessage(msg.chat.id, t.giftReady(gp.days, code, shareUrl),
            { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[
              { text: t.btnShareGift, url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` }
            ]]} }
          );
        } catch (e) { console.error('[Gift] sendMessage failed:', e.message); }
        console.log(`[Gift] userId=${userId} code=${code} days=${gp.days} stars=${stars}`);
        return;
      }

      // ── Пакети питань: oracle_pack5_UID / oracle_pack20_UID ──
      if (payload.startsWith('oracle_pack')) {
        const packKey = Object.keys(PACK_CONFIG).find(k => payload.startsWith(`oracle_${k}_`));
        const pack = packKey ? PACK_CONFIG[packKey] : null;
        if (pack && Math.abs(stars - pack.stars) > 1) {
          console.warn(`[Pack] stars mismatch: expected=${pack.stars} got=${stars} userId=${userId}`);
        }
        const amount = pack ? pack.questions : 5;
        const newTotal = addBonus(userId, amount);
        try {
          await bot.sendMessage(msg.chat.id, t.packReceived(amount, newTotal),
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: t.btnOpen, web_app: { url: WEBAPP_URL } }]] } }
          );
        } catch (e) { console.error('[Pack] sendMessage failed:', e.message); }
        console.log(`[Pack] userId=${userId} pack=${packKey} amount=${amount} total=${newTotal} stars=${stars}`);
        return;
      }

      // ── Преміум плани: oracle_week_UID / oracle_month_UID / oracle_lifetime_UID / oracle_offerweek_UID ──
      const isOffer = payload.startsWith('oracle_offerweek_');
      let days = 30;
      if (payload.startsWith('oracle_week_'))     days = 7;
      if (isOffer)                                days = 7;
      if (payload.startsWith('oracle_lifetime_')) days = 36500;

      // Оффер має власну ціну (50★), тому перевірку зірок по PLAN_CONFIG пропускаємо
      const expectedPlan = isOffer ? null : Object.values(PLAN_CONFIG).find(p => p.days === days);
      if (expectedPlan && Math.abs(stars - expectedPlan.stars) > 1) {
        console.warn(`[Premium] stars mismatch: expected=${expectedPlan.stars} got=${stars} userId=${userId}`);
      }

      const until = activatePremium(userId, days);
      const date  = fmtDate(until, lang, { day: 'numeric', month: 'long', year: 'numeric' });
      const planLabel = t.planLabel(days);
      try {
        await bot.sendMessage(msg.chat.id, t.premiumWelcome(planLabel, date),
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: t.btnOpen, web_app: { url: WEBAPP_URL } }]] } }
        );
      } catch (e) { console.error('[Premium] sendMessage failed:', e.message); }
      console.log(`[Premium] userId=${userId} plan=${planLabel} until=${until} stars=${stars}`);
    } catch (e) {
      console.error('[Payment] handler error:', e.message);
    }
  });

  console.log('[Bot] Oracle Bot запущено (webhook mode)');

  // Автоматично встановлюємо команди при кожному запуску.
  // Default (RU) + окремий набір для українських клієнтів (language_code=uk).
  const CMDS_RU = [
    { command: 'start',   description: '🔮 Открыть Оракула Судьбы' },
    { command: 'ask',     description: '❓ Быстрый вопрос оракулу' },
    { command: 'premium', description: '⭐ Купить Премиум' },
    { command: 'gift',    description: '🎁 Подарить Премиум другу' },
    { command: 'ref',     description: '🔗 Реферальная ссылка (+3 вопроса)' },
    { command: 'help',    description: '📖 Помощь' },
  ];
  const CMDS_UA = [
    { command: 'start',   description: '🔮 Відкрити Оракул Долі' },
    { command: 'ask',     description: '❓ Швидке питання оракулу' },
    { command: 'premium', description: '⭐ Купити Преміум' },
    { command: 'gift',    description: '🎁 Подарувати Преміум другу' },
    { command: 'ref',     description: '🔗 Реферальне посилання (+3 питання)' },
    { command: 'help',    description: '📖 Допомога' },
  ];
  tgApi('setMyCommands', { commands: CMDS_RU }).catch(() => {});
  tgApi('setMyCommands', { commands: CMDS_UA, language_code: 'uk' }).catch(() => {});

  // ── Daily question scheduler (fires at 10:00 UTC = 13:00 Kyiv) ──
  // Question pools live in botMessages (RU/UA, parallel order). We pick one index
  // per day and translate it per recipient.
  const DAILY_COUNT = bm('ru').dailyQuestions.length;
  let lastDailyDate = null;

  let lastMidnightDate  = null;
  let lastPremExpDate   = null;
  let lastRetentionDate = null;

  setInterval(async () => {
    const now     = new Date();
    const utcH    = now.getUTCHours();
    const dateStr = now.toISOString().slice(0, 10);

    // ── 10:00 UTC — питання дня (13:00 Київ) ──
    if (utcH === 10 && lastDailyDate !== dateStr) {
      lastDailyDate = dateStr;
      const users  = getUsers();
      const active = users.filter(u => u.lastSeen && Date.now() - u.lastSeen < 30 * 86_400_000);
      const qIdx   = new Date().getDate() % DAILY_COUNT;
      console.log(`[Daily] Sending question to ${active.length} users`);
      for (const u of active) {
        const t = bm(u.lang || 'ua');
        const q = t.dailyQuestions[qIdx];
        try {
          await bot.sendMessage(u.userId, t.dailyQuestion(q),
            { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: t.btnGetAnswer, web_app: { url: `${WEBAPP_URL}?q=${encodeURIComponent(q)}` } }]] } }
          );
        } catch {}
        await new Promise(r => setTimeout(r, 80));
      }
    }

    // ── 12:00 UTC — нагадування про закінчення преміуму (15:00 Київ) ──
    if (utcH === 12 && lastPremExpDate !== dateStr) {
      lastPremExpDate = dateStr;
      const users = getUsers();
      const expiring = users.filter(u => {
        if (!u.isPremium || !u.premiumUntil) return false;
        const msLeft = new Date(u.premiumUntil) - Date.now();
        return msLeft > 0 && msLeft < 48 * 3_600_000;
      });
      console.log(`[PremExpiry] Notifying ${expiring.length} users`);
      for (const u of expiring) {
        const lang  = u.lang || 'ua';
        const t     = bm(lang);
        const until = fmtDate(u.premiumUntil, lang, { day: 'numeric', month: 'long' });
        try {
          await bot.sendMessage(u.userId, t.premExpiry(until),
            { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [
              [{ text: t.btnRenew, web_app: { url: WEBAPP_URL } }],
            ]}}
          );
        } catch {}
        await new Promise(r => setTimeout(r, 80));
      }
    }

    // ── 14:00 UTC — retention для неактивних 3 дні (17:00 Київ) ──
    if (utcH === 14 && lastRetentionDate !== dateStr) {
      lastRetentionDate = dateStr;
      const users = getUsers();
      const nowMs = Date.now();
      // Тільки ті, кого не бачили 72-96 годин (день 3 — один раз)
      const inactive = users.filter(u => {
        if (!u.lastSeen) return false;
        const h = (nowMs - u.lastSeen) / 3_600_000;
        return h >= 72 && h < 96;
      });
      console.log(`[Retention] Notifying ${inactive.length} users`);
      for (const u of inactive) {
        const t   = bm(u.lang || 'ua');
        const msg = t.retention[Math.floor(Math.random() * t.retention.length)];
        try {
          await bot.sendMessage(u.userId, msg, {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: [[{ text: t.btnAsk, web_app: { url: WEBAPP_URL } }]] },
          });
        } catch {}
        await new Promise(r => setTimeout(r, 80));
      }
    }

    // ── 21:00 UTC — reset нотифікація для тих хто вичерпав ліміт (00:00 Київ) ──
    if (utcH === 21 && lastMidnightDate !== dateStr) {
      lastMidnightDate = dateStr;
      // Очистити щоденний список "ліміт надіслано"
      limitNotifSent.clear();
      const users    = getUsers();
      // Тільки ті: не преміум, вичерпали ліміт, були активні останні 7 днів
      const limited  = users.filter(u =>
        !u.isPremium &&
        u.dailyCount >= 2 &&
        u.lastSeen  && Date.now() - u.lastSeen < 7 * 86_400_000
      );
      console.log(`[MidnightReset] Notifying ${limited.length} users`);
      for (const u of limited) {
        const t = bm(u.lang || 'ua');
        try {
          await bot.sendMessage(u.userId, t.midnightReset,
            { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: t.btnAsk, web_app: { url: WEBAPP_URL } }]] } }
          );
        } catch {}
        await new Promise(r => setTimeout(r, 80));
      }
    }
  }, 60_000);

  tgApi('setMyDescription', { description:
    'Оракул Судьбы — мистический бот, отвечающий на вопросы судьбы.\n\n' +
    'Задай вопрос Да/Нет — звёзды, луна и силы Вселенной дадут тебе ответ.\n\n' +
    '🆓 2 бесплатных вопроса каждый день\n' +
    '⭐ Безлимитно с Премиум\n' +
    '🔗 Приглашай друзей — получай бонусные вопросы'
  }).catch(() => {});
  tgApi('setMyDescription', { language_code: 'uk', description:
    'Оракул Долі — містичний бот, що відповідає на питання долі.\n\n' +
    'Постав питання Так/Ні — зірки, місяць і сили Всесвіту дадуть тобі відповідь.\n\n' +
    '🆓 2 безкоштовних питання щодня\n' +
    '⭐ Безлімітно з Преміум\n' +
    '🔗 Запрошуй друзів — отримуй бонусні питання'
  }).catch(() => {});

  tgApi('setMyShortDescription', { short_description:
    '🔮 Задай вопрос судьбе — получи ответ Вселенной. Да или Нет — Оракул знает.'
  }).catch(() => {});
  tgApi('setMyShortDescription', { language_code: 'uk', short_description:
    '🔮 Задай питання долі — отримай відповідь Всесвіту. Так або Ні — Оракул знає.'
  }).catch(() => {});
}

// ─── Плани та відправка інвойсу ───────────────────────────────────────────────
const PLAN_CONFIG = {
  week:     { days: 7,     stars: 100,  title: '⭐ Oracle Premium — 7 днів',   desc: '7 днів безлімітних питань Оракулу!' },
  month:    { days: 30,    stars: 300,  title: '⭐ Oracle Premium — 30 днів',  desc: '30 днів безлімітних питань Оракулу!' },
  lifetime: { days: 36500, stars: 2500, title: '⭐ Oracle Premium — Назавжди', desc: 'Безлімітні питання Оракулу назавжди!' },
};

// Оффер першої покупки: 7 днів за пів ціни, діє 24 год після першого пейволу
const OFFER_PLAN = { days: 7, stars: 50, title: '🎁 Oracle Premium — 7 днів (−50%)', desc: 'Спецпропозиція: тиждень безліміту за пів ціни!' };

const PACK_CONFIG = {
  pack5:  { questions: 5,  stars: 30, title: '🔮 Пакет +5 питань',  desc: '5 додаткових питань Оракулу — без строку дії!' },
  pack20: { questions: 20, stars: 80, title: '🔮 Пакет +20 питань', desc: '20 додаткових питань Оракулу — без строку дії!' },
};

const GIFT_PLANS = {
  gift7:  { days: 7,  stars: 80,  title: '🎁 Подарунок Oracle Premium 7 днів',  desc: '7 днів безлімітних питань Оракулу у подарунок' },
  gift30: { days: 30, stars: 250, title: '🎁 Подарунок Oracle Premium 30 днів', desc: '30 днів безлімітних питань Оракулу у подарунок' },
};

async function sendGiftInvoice(chatId, userId, plan, lang) {
  const p = GIFT_PLANS[plan];
  if (!p) return;
  const loc = bm(lang).inv[plan] || p;
  const invoiceData = {
    chat_id: chatId, title: loc.title, description: loc.desc,
    payload: `oracle_${plan}_${userId}`, currency: 'XTR',
    provider_token: '',
    prices: [{ label: loc.title, amount: p.stars }],
  };
  try { await tgApi('sendInvoice', { ...invoiceData, photo_url: WEBAPP_URL + '/preview.jpg' }); }
  catch { await tgApi('sendInvoice', invoiceData); }
}

async function sendPremiumInvoice(chatId, userId, plan = 'month', lang) {
  const p = PLAN_CONFIG[plan] || PLAN_CONFIG.month;
  const loc = bm(lang).inv[plan] || p;
  const invoiceData = {
    chat_id:        chatId,
    title:          loc.title,
    description:    loc.desc,
    payload:        `oracle_${plan}_${userId || chatId}`,
    currency:       'XTR',
    provider_token: '',
    prices:         [{ label: loc.title, amount: p.stars }],
  };
  try {
    await tgApi('sendInvoice', { ...invoiceData, photo_url: WEBAPP_URL + '/preview.jpg' });
  } catch {
    await tgApi('sendInvoice', invoiceData);
  }
}

// ─── API Router (монтується ДО статики) ──────────────────────────────────────
const api = express.Router();
api.use(tgAuth); // attaches req.authUserId from verified initData

api.get('/ping', (req, res) => res.json({ pong: true }));

api.get('/status', (req, res) => res.json({ ok: true, version: '2.4.0', bot: !!bot }));

api.get('/user/:userId/status', (req, res) => {
  try {
    const userId = req.authUserId;
    if (!userId) {
      return res.json({ canAsk: true, remaining: 2, isPremium: false, guest: true, variant: 'A' });
    }
    const status  = getStatus(userId);
    const variant = getABVariant(userId);
    res.json({ ...status, variant });
  } catch (e) {
    console.error('[status]', e.message);
    res.json({ canAsk: true, remaining: 2, isPremium: false, error: e.message, variant: 'A' });
  }
});

api.post('/user/:userId/invoice', async (req, res) => {
  const userId = req.authUserId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!rl.invoice(userId)) return res.status(429).json({ error: 'Too many requests' });
  const lang = langFor(userId, req.tgUser?.language_code);
  const plan = req.body?.plan || 'month';
  const isPack = plan.startsWith('pack');
  let p = isPack ? PACK_CONFIG[plan] : (PLAN_CONFIG[plan] || PLAN_CONFIG.month);
  if (plan === 'offerweek') {
    const st = getStatus(userId);
    if (!st.offer) return res.status(400).json({ error: lang === 'ua' ? 'Пропозиція вже не активна' : 'Предложение больше не активно' });
    p = OFFER_PLAN;
  }
  if (!p) return res.status(400).json({ error: 'Unknown plan' });
  const loc = bm(lang).inv[plan] || p;
  try {
    const result = await tgApi('createInvoiceLink', {
      title:          loc.title,
      description:    loc.desc,
      payload:        `oracle_${plan}_${userId}`,
      currency:       'XTR',
      provider_token: '',
      prices:         [{ label: loc.title, amount: p.stars }],
    });
    if (result.ok) {
      res.json({ url: result.result, plan, stars: p.stars, questions: p.questions, days: p.days });
    } else {
      res.status(500).json({ error: result.description });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/user/sync', (req, res) => {
  const userId = req.authUserId;
  const { username, firstName, lang } = req.body || {};
  if (userId) setUserInfo(userId, { username, firstName, lang });
  res.json({ ok: true });
});

api.post('/event', (req, res) => {
  const { event, variant } = req.body || {};
  const userId = req.authUserId || 'guest';
  if (event && rl.event(req.ip || '?')) logEvent(userId, event, variant || null);
  res.json({ ok: true });
});

api.get('/user/:userId/history', async (req, res) => {
  const userId = req.authUserId; // ignore the path id — serve only the caller's own history
  if (!userId) return res.json([]);
  try {
    const questions = await getUserQuestions(userId);
    res.json(questions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Імена для ритуалу сумісності: до двох, безпечне очищення.
function parseNames(raw) {
  let arr = raw.names;
  if (!Array.isArray(arr)) arr = [raw.nameA, raw.nameB];
  return arr
    .filter(Boolean)
    .map(n => String(n).trim().replace(/[<>]/g, '').slice(0, 24))
    .filter(Boolean)
    .slice(0, 2);
}

const CATEGORIES = CATEGORY_KEYS;

api.post('/ask', rateLimit, (req, res) => {
  const raw = req.body || {};
  const userId = req.authUserId || 'guest'; // identity comes only from verified initData
  const username  = req.tgUser?.username   || raw.username;
  const firstName = req.tgUser?.first_name || raw.firstName;
  let category = CATEGORIES.includes(raw.category) ? raw.category : 'general';
  const names = parseNames(raw);
  const question = raw.question;

  if (userId !== 'guest' && (username || firstName)) {
    setUserInfo(userId, { username, firstName });
  }
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Вопрос не может быть пустым' });
  }
  if (question.trim().length > 500) {
    return res.status(400).json({ error: 'Питання занадто довге (макс 500 символів)' });
  }

  if (userId === 'guest') category = 'general';
  const seed = `${userId}::${normQuestion(question)}`;

  if (userId !== 'guest') {
    try {
      let status = getStatus(userId);
      if (!status.canAsk) {
        // Перший пейвол запускає 24-годинний оффер першої покупки
        if (startOffer(userId)) status = getStatus(userId);
        // Надіслати нотифікацію в бот — один раз на день
        if (bot) {
          const notifKey = `${userId}_${new Date().toISOString().slice(0, 10)}`;
          if (!limitNotifSent.has(notifKey)) {
            limitNotifSent.add(notifKey);
            const t = bm(langFor(userId, req.tgUser?.language_code));
            bot.sendMessage(userId, t.limitNotif,
              { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [
                [{ text: t.btnGetPremium, web_app: { url: WEBAPP_URL } }],
              ]}}
            ).catch(() => {});
          }
        }
        return res.status(403).json({ error: 'limit', message: 'Лимит вопросов исчерпан', status });
      }
      const streakInfo = increment(userId);
      const answer = buildAnswer(seed, { category, premium: status.isPremium, names });
      logQuestion(userId, question.trim(), answer, answer.category);
      emitQuestion();
      // Кожен 7-й день стріку — бонус, повідомляємо в бот
      if (streakInfo.reward && bot) {
        bot.sendMessage(userId,
          bm(langFor(userId, req.tgUser?.language_code)).streakReward(streakInfo.streak, streakInfo.reward),
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
      return res.json({ question: question.trim(), answer, status: getStatus(userId), streak: streakInfo });
    } catch (e) {
      console.error('[ask/userService]', e.message || e);
      const answer = buildAnswer(seed, { category, premium: false, names });
      logQuestion(userId, question.trim(), answer, answer.category);
      emitQuestion();
      return res.json({ question: question.trim(), answer });
    }
  }

  const answer = buildAnswer(seed, { category, premium: false, names });
  logQuestion(userId, question.trim(), answer, answer.category);
  emitQuestion();
  res.json({ question: question.trim(), answer });
});

app.use('/api', api);

// ─── Admin panel ──────────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (key !== ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

const adminApi = express.Router();
adminApi.use(adminAuth);

adminApi.get('/stats', (req, res) => {
  try { res.json(getStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

adminApi.get('/users', (req, res) => {
  try { res.json(getUsers()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

adminApi.get('/questions', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
  try { res.json(getQuestions(limit)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

adminApi.post('/broadcast', async (req, res) => {
  if (!bot) return res.status(503).json({ error: 'Bot not available' });
  const { text, btn1Text, btn1Url, btn2Text, btn2Url, imageUrl } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Текст обовʼязковий' });

  const users = getUsers();
  const total = users.length;

  // Respond immediately — send in background via SSE progress
  res.json({ ok: true, total });

  let sent = 0, failed = 0;

  const keyboard = [];
  if (btn1Text && btn1Url) keyboard.push({ text: btn1Text, url: btn1Url });
  if (btn2Text && btn2Url) keyboard.push({ text: btn2Text, url: btn2Url });
  const opts = {
    parse_mode: 'Markdown',
    ...(keyboard.length ? { reply_markup: { inline_keyboard: [keyboard] } } : {}),
    disable_web_page_preview: true,
  };

  function emitProgress(done = false) {
    const payload = JSON.stringify({ sent, failed, total });
    const ev = done ? 'broadcast_done' : 'broadcast';
    for (const c of sseClients) c.write(`event: ${ev}\ndata: ${payload}\n\n`);
  }

  for (const u of users) {
    try {
      if (imageUrl?.trim()) {
        await bot.sendPhoto(u.userId, imageUrl.trim(), { caption: text, ...opts });
      } else {
        await bot.sendMessage(u.userId, text, opts);
      }
      sent++;
    } catch (e) {
      failed++;
      // 403 = user blocked bot, 400 = chat not found — expected, skip silently
    }
    const done = sent + failed;
    if (done % 20 === 0 || done === total) emitProgress(done === total);
    await new Promise(r => setTimeout(r, 50)); // ~20 msg/sec — safe for Telegram
  }

  console.log(`[Broadcast] ${sent} sent, ${failed} failed of ${total}`);
});

adminApi.get('/user/:userId/questions', async (req, res) => {
  try { res.json(await getUserQuestions(req.params.userId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

adminApi.post('/user/:userId/premium', (req, res) => {
  try {
    const days  = parseInt(req.body.days) || 36500;
    const until = activatePremium(req.params.userId, days);
    res.json({ ok: true, userId: req.params.userId, days, until });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminApi.post('/user/:userId/revoke-premium', (req, res) => {
  try {
    revokePremium(req.params.userId);
    res.json({ ok: true, userId: req.params.userId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminApi.post('/user/:userId/bonus', (req, res) => {
  try {
    const amount    = Math.min(parseInt(req.body.amount) || 5, 100);
    const freeBonus = addBonus(req.params.userId, amount);
    res.json({ ok: true, userId: req.params.userId, amount, freeBonus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminApi.get('/sources', (req, res) => {
  try { res.json(getSourceStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

adminApi.get('/funnel', (req, res) => {
  try { res.json(getFunnelStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

adminApi.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type':    'text/event-stream',
    'Cache-Control':   'no-cache',
    'Connection':      'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  sseClients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { sseClients.delete(res); clearInterval(ping); });
});

app.use('/admin/api', adminApi);

// ─── Static + SPA fallback (після /api та /admin) ────────────────────────────
// HTML — no cache (завжди свіжий)
// JS/CSS/images — 1 year cache (вміст міняється тільки при деплої)
app.use(express.static(path.join(__dirname, '../frontend'), {
  etag:     true,
  lastModified: true,
  setHeaders(res, filePath) {
    if (/\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
app.get('/{*path}', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[GlobalError]', err.message || err);
  if (!res.headersSent) res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Oracle Bot v2.3 on http://localhost:${PORT}`);
  console.log(`[Admin]  /admin | key: ${ADMIN_SECRET}`);
});
