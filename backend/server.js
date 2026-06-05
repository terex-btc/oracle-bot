require('dotenv').config({ path: __dirname + '/.env' });
const express      = require('express');
const cors         = require('cors');
const compression  = require('compression');
const path         = require('path');
const https        = require('https');
const TelegramBot  = require('node-telegram-bot-api');
const { getOracleAnswer } = require('./config/oracleAnswers');
let getStatus, increment, setUserInfo, activatePremium, addBonus, applyReferral, logQuestion,
    getUserQuestions, getStats, getUsers, getQuestions,
    createGift, redeemGift, logEvent, getFunnelStats, getABVariant;
try {
  ({ getStatus, increment, setUserInfo, activatePremium, addBonus, applyReferral,
     logQuestion, getUserQuestions, getStats, getUsers, getQuestions,
     createGift, redeemGift, logEvent, getFunnelStats, getABVariant } = require('./services/userService'));
} catch (e) {
  console.error('[userService] Load error:', e.message);
  getStatus        = () => ({ canAsk: true, remaining: 2, isPremium: false });
  increment        = () => {};
  setUserInfo      = () => {};
  activatePremium  = () => new Date().toISOString();
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
    const name    = msg.from?.first_name || 'Мандрівнику';
    const param   = (match[1] || '').trim();

    // Подарунок: ?start=gift_CODE
    if (userId && param.startsWith('gift_')) {
      const code = param.slice(5).toUpperCase();
      const result = await redeemGift(code, userId);
      if (result.ok) {
        const until = new Date(result.until).toLocaleDateString('uk', { day: 'numeric', month: 'long' });
        await bot.sendMessage(chatId,
          `🎁 *Подарунок активовано\\!*\n\n⭐ Преміум на *${result.days} днів* активовано до *${escMd(until)}*\n\n🔮 Задавай питання без обмежень\\!`,
          { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '🔮 Відкрити Оракул', web_app: { url: WEBAPP_URL } }]] } }
        );
        try { await bot.sendMessage(result.fromUserId, `🎉 Твій подарунок активовано! Друг отримав Преміум на ${result.days} днів ✨`); } catch {}
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
        await bot.sendMessage(chatId, `🎁 *+3 бонусних питання* нараховано тобі за запрошення!`, { parse_mode: 'Markdown' });
        try { await bot.sendMessage(referrerId, `🎉 Хтось перейшов по твоєму посиланню\\! *+3 бонусних питання* тобі\\!`, { parse_mode: 'MarkdownV2' }); } catch {}
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
      await bot.sendMessage(chatId,
        `🔮 *Ласкаво просимо, ${escMd(name)}\\!*\n\n` +
        `Я — стародавній Оракул Долі\\.\n` +
        `Поклади серце в питання — і Всесвіт відповість\\.\n\n` +
        `🎁 *Тобі активовано 2 дні Преміум безкоштовно\\!*\n` +
        `Задавай питання без обмежень — подарунок від Оракула\\.\n\n` +
        `*Як це працює:*\n` +
        `🌐 Натисни кнопку нижче → відкриється магічна куля\n` +
        `💭 Напиши питання у форматі Так/Ні\n` +
        `🔮 Отримай відповідь зірок\n\n` +
        `_Доля чекає твого першого питання\\.\\.\\._`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔮 Відкрити Оракул Долі', web_app: { url: WEBAPP_URL } }],
              [{ text: '🔗 Запросити друга → +3 питання', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}` }],
            ],
          },
        }
      );
      return;
    }

    // Returning user
    let statusBlock;
    if (isPremium) {
      const until = new Date(status.premiumUntil).toLocaleDateString('uk', { day: 'numeric', month: 'long' });
      statusBlock = `⭐ *Преміум активний* до ${until}`;
    } else {
      const bonus = status?.bonusLeft > 0 ? ` \\+ ${status.bonusLeft} бонус` : '';
      statusBlock = `🆓 *2 безкоштовних питання* щодня${bonus}`;
    }

    const keyboard = isPremium
      ? [[{ text: '🔮 Відкрити Оракул Долі', web_app: { url: WEBAPP_URL } }]]
      : [
          [{ text: '🔮 Відкрити Оракул Долі', web_app: { url: WEBAPP_URL } }],
          [{ text: '⭐ Преміум від 100 ★',     callback_data: 'buy_premium' }],
          [{ text: '🔗 Запросити друга → +3 питання', callback_data: 'get_ref' }],
        ];

    await bot.sendMessage(chatId,
      `🔮 *${escMd(name)}, Оракул бачить тебе\\.\\.\\.*\n\n` +
      `Я — стародавній дух, що читає нитки долі\\.\n` +
      `Постав питання Так/Ні — і зірки відкриють тобі правду\\.\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `${statusBlock}\n` +
      `━━━━━━━━━━━━━━━`,
      { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: keyboard } }
    );
  });

  // /premium
  bot.onText(/\/premium/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId,
      `⭐ *Oracle Premium — вибери план:*\n\n📅 *7 днів* — 100 ★\n📅 *30 днів* — 300 ★\n♾️ *Назавжди* — 2500 ★`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 7 днів — 100 ★', callback_data: 'buy_week' }],
            [{ text: '📅 30 днів — 300 ★', callback_data: 'buy_month' }],
            [{ text: '♾️ Назавжди — 2500 ★', callback_data: 'buy_lifetime' }],
          ]
        }
      }
    );
  });

  // /ref — реферальне посилання
  bot.onText(/\/ref/, async (msg) => {
    const userId = msg.from?.id;
    if (!userId) return;
    const refLink = `https://t.me/oracle_666bot?start=ref_${userId}`;
    await bot.sendMessage(msg.chat.id,
      `🔗 *Твоє реферальне посилання:*\n\n${refLink}\n\n*Як це працює:*\nПоділись посиланням з другом. Коли він запустить бота — ви обидва отримаєте по *+3 безкоштовних питання*! 🎁`,
      { parse_mode: 'Markdown' }
    );
  });

  // Callback query
  bot.on('callback_query', async (query) => {
    try {
      await bot.answerCallbackQuery(query.id).catch(() => {});
      if (query.from?.id) setUserInfo(query.from.id, { username: query.from.username, firstName: query.from.first_name });
      const data   = query.data;
      const chatId = query.message?.chat?.id;
      const userId = query.from?.id;
      if (!chatId) return;
      if      (data === 'buy_premium' || data === 'buy_month') await sendPremiumInvoice(chatId, userId, 'month');
      else if (data === 'buy_week')     await sendPremiumInvoice(chatId, userId, 'week');
      else if (data === 'buy_lifetime') await sendPremiumInvoice(chatId, userId, 'lifetime');
      else if (data === 'gift_7')       await sendGiftInvoice(chatId, userId, 'gift7');
      else if (data === 'gift_30')      await sendGiftInvoice(chatId, userId, 'gift30');
      else if (data === 'get_ref') {
        const refLink = `https://t.me/oracle_666bot?start=ref_${userId}`;
        await bot.sendMessage(chatId,
          `🔗 *Твоє реферальне посилання:*\n\n${refLink}\n\nПоділись з другом — ви обидва отримаєте *\\+3 питання*\\! 🎁`,
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
      const question = match[1].trim();
      if (userId) {
        const status = getStatus(userId);
        if (!status.canAsk) {
          await bot.sendMessage(chatId,
            `🔮 Ти вичерпав ліміт питань на сьогодні.\n\n⭐ Отримай Преміум — питай скільки завгодно!`,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '⭐ Купити Преміум', callback_data: 'buy_premium' }]] } }
          );
          return;
        }
        increment(userId);
      }
      const answer     = getOracleAnswer();
      const colorEmoji = answer.color === 'yes' ? '🟢' : answer.color === 'no' ? '🔴' : '🟡';
      await bot.sendMessage(chatId,
        `🔮 *Оракул відповідає...*\n\n❓ _${question}_\n\n${colorEmoji} *${answer.title}*\n${answer.verdict}\n\n_${answer.message}_`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔮 Задати нове питання', web_app: { url: WEBAPP_URL } }]] } }
      );
    } catch (e) { console.error('[/ask]', e.message); }
  });

  bot.onText(/^\/ask$/, async (msg) => {
    try { await bot.sendMessage(msg.chat.id, '🔮 Напиши: `/ask Твоє питання?`', { parse_mode: 'Markdown' }); }
    catch (e) { console.error('[/ask empty]', e.message); }
  });

  bot.onText(/\/help/, async (msg) => {
    try {
      await bot.sendMessage(msg.chat.id,
        `🔮 *Оракул Долі*\n\n/start — Відкрити бота\n/ask [питання] — Швидке питання\n/premium — Купити Преміум ⭐\n/gift — Подарувати Преміум другу 🎁\n/ref — Реферальне посилання (+3 питання)\n/terms — Умови використання\n/help — Довідка\n\n🆓 Безкоштовно: 2 питання / день\n⭐ Преміум від 100 ★`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔮 Відкрити Оракул', web_app: { url: WEBAPP_URL } }]] } }
      );
    } catch (e) { console.error('[/help]', e.message); }
  });

  bot.onText(/\/terms|\/privacy/, async (msg) => {
    try {
      await bot.sendMessage(msg.chat.id,
        `📄 *Правові документи Оракул Долі*\n\n[Умови використання](${WEBAPP_URL}/terms.html)\n[Політика конфіденційності](${WEBAPP_URL}/terms.html#privacy)`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    } catch (e) { console.error('[/terms]', e.message); }
  });

  // /gift — gifting flow
  bot.onText(/\/gift/, async (msg) => {
    try {
      await bot.sendMessage(msg.chat.id,
        `🎁 *Подаруй Преміум другу\\!*\n\nОбери план — і ми надішлемо тобі посилання\\-подарунок, яким можна поділитись:`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: { inline_keyboard: [
            [{ text: '🎁 7 днів Преміум — 80 ★',  callback_data: 'gift_7'  }],
            [{ text: '🎁 30 днів Преміум — 250 ★', callback_data: 'gift_30' }],
          ]},
        }
      );
    } catch (e) { console.error('[/gift]', e.message); }
  });

  // Inline mode — @oracle_666bot питання
  bot.on('inline_query', async (query) => {
    const question = (query.query || '').trim();
    if (query.from?.id) setUserInfo(query.from.id, { username: query.from?.username, firstName: query.from?.first_name });

    const SUGGESTIONS = [
      'Чи принесе мені сьогодні удачу?',
      'Чи варто мені довіритись цій людині?',
      'Чи правильний шлях я обрав?',
      'Чи буде все добре?',
    ];

    const buildResult = (id, q, a) => {
      const em = a.color === 'yes' ? '🟢' : a.color === 'no' ? '🔴' : '🟡';
      return {
        type: 'article', id: String(id),
        title: `${em} ${a.verdict}`,
        description: q,
        input_message_content: {
          message_text: `🔮 *Оракул Долі відповів\\!*\n\n❓ _${escMd(q)}_\n\n${em} *${escMd(a.verdict)}*\n_${escMd(a.message)}_\n\n✨ [Запитай і ти](https://t.me/oracle_666bot/app)`,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
        },
        reply_markup: { inline_keyboard: [[{ text: '🔮 Запитати Оракул', url: 'https://t.me/oracle_666bot/app' }]] },
      };
    };

    const results = [];
    if (question) {
      results.push(buildResult(1, question, getOracleAnswer()));
    } else {
      SUGGESTIONS.forEach((q, i) => results.push(buildResult(i + 1, q, getOracleAnswer())));
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

    try {
      if (userId) setUserInfo(userId, { username: msg.from?.username, firstName: msg.from?.first_name });
      if (!payload?.startsWith('oracle_')) return;

      // ── Подарунки: oracle_gift7_UID / oracle_gift30_UID ──
      if (payload.startsWith('oracle_gift')) {
        const giftPlanKey = Object.keys(GIFT_PLANS).find(k => payload.startsWith(`oracle_${k}_`));
        const gp = giftPlanKey ? GIFT_PLANS[giftPlanKey] : { days: 30 };
        const code = createGift(userId, gp.days);
        const shareUrl = `https://t.me/oracle_666bot?start=gift_${code}`;
        try {
          await bot.sendMessage(msg.chat.id,
            `🎁 *Подарунок готовий\\!*\n\n*${escMd(gp.days + ' днів Преміум')}* — посилання для друга:\n\n\`${code}\`\n\n${escMd(shareUrl)}\n\n_Коли друг натисне посилання — він отримає Преміум автоматично\\!_`,
            { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[
              { text: '🎁 Поділитись подарунком', url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('🔮 Тримай подарунок — Оракул Долі чекає тебе!')}` }
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
          await bot.sendMessage(msg.chat.id,
            `🎁 *Пакет питань отримано!*\n\n🔮 *+${amount} питань* додано до твого балансу\n💫 Всього бонусних питань: *${newTotal}*\n\n_Задавай питання — доля чекає!_`,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔮 Відкрити Оракул', web_app: { url: WEBAPP_URL } }]] } }
          );
        } catch (e) { console.error('[Pack] sendMessage failed:', e.message); }
        console.log(`[Pack] userId=${userId} pack=${packKey} amount=${amount} total=${newTotal} stars=${stars}`);
        return;
      }

      // ── Преміум плани: oracle_week_UID / oracle_month_UID / oracle_lifetime_UID ──
      let days = 30;
      if (payload.startsWith('oracle_week_'))     days = 7;
      if (payload.startsWith('oracle_lifetime_')) days = 36500;

      const expectedPlan = Object.values(PLAN_CONFIG).find(p => p.days === days);
      if (expectedPlan && Math.abs(stars - expectedPlan.stars) > 1) {
        console.warn(`[Premium] stars mismatch: expected=${expectedPlan.stars} got=${stars} userId=${userId}`);
      }

      const until = activatePremium(userId, days);
      const date  = new Date(until).toLocaleDateString('uk', { day: 'numeric', month: 'long', year: 'numeric' });
      const planLabel = days === 7 ? '7 днів' : days === 36500 ? 'Назавжди ♾️' : '30 днів';
      try {
        await bot.sendMessage(msg.chat.id,
          `✨ *Ласкаво просимо до Преміум!*\n\n⭐ Оракул відповідає без обмежень\n📅 План: *${planLabel}*\n📅 Активний до: *${date}*\n\n🔮 Задавай питання — доля чекає!`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔮 Відкрити Оракул', web_app: { url: WEBAPP_URL } }]] } }
        );
      } catch (e) { console.error('[Premium] sendMessage failed:', e.message); }
      console.log(`[Premium] userId=${userId} plan=${planLabel} until=${until} stars=${stars}`);
    } catch (e) {
      console.error('[Payment] handler error:', e.message);
    }
  });

  console.log('[Bot] Oracle Bot запущено (webhook mode)');

  // Автоматично встановлюємо команди і опис при кожному запуску
  tgApi('setMyCommands', { commands: [
    { command: 'start',   description: '🔮 Відкрити Оракул Долі' },
    { command: 'ask',     description: '❓ Швидке питання оракулу' },
    { command: 'premium', description: '⭐ Купити Преміум' },
    { command: 'gift',    description: '🎁 Подарувати Преміум другу' },
    { command: 'ref',     description: '🔗 Реферальне посилання (+3 питання)' },
    { command: 'help',    description: '📖 Допомога' },
  ]}).catch(() => {});

  // ── Daily question scheduler (fires at 10:00 UTC = 13:00 Kyiv) ──
  const DAILY_QUESTIONS = [
    'Чи принесе мені сьогоднішній день успіх?',
    'Чи варто мені довіритись своєму серцю зараз?',
    'Чи наближаюсь я до своєї мети?',
    'Чи час відпустити минуле?',
    'Чи правильний шлях я обрав?',
    'Чи принесе цей тиждень мені удачу?',
    'Чи варто ризикнути заради великої мети?',
    'Чи щаслива доля зараз на моєму боці?',
    'Чи варто продовжувати те, що я почав?',
    'Чи зміниться моє становище на краще?',
  ];
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
      const q      = DAILY_QUESTIONS[new Date().getDate() % DAILY_QUESTIONS.length];
      console.log(`[Daily] Sending question to ${active.length} users`);
      for (const u of active) {
        try {
          await bot.sendMessage(u.userId,
            `🔮 *Питання дня від Оракула:*\n\n_"${q}"_\n\nНатисни — і дізнайся відповідь долі\\.`,
            { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '🔮 Отримати відповідь', web_app: { url: `${WEBAPP_URL}?q=${encodeURIComponent(q)}` } }]] } }
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
        const until = new Date(u.premiumUntil).toLocaleDateString('uk', { day: 'numeric', month: 'long' });
        try {
          await bot.sendMessage(u.userId,
            `⭐ *Твій Преміум закінчується скоро\\!*\n\n📅 Діє до: *${escMd(until)}*\n\n🔄 Продовж зараз — не втрать безліміт питань\\!`,
            { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [
              [{ text: '⭐ Продовжити Преміум', web_app: { url: WEBAPP_URL } }],
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
      const MSGS = [
        `🔮 *Оракул скучив за тобою\\.\\.\\.*\n\nДавно не задавав питань долі\\.\nПовертайся — зірки чекають\\!`,
        `✨ *Зірки говорять про тебе\\.\\.\\.*\n\nОракул бачить важливі зміни на твоєму шляху\\.\nЗадай питання — дізнайся, що готує доля\\!`,
        `🌙 *Місяць нагадує про тебе\\.\\.\\.*\n\nТи давно не питав Оракула\\.\n2 безкоштовних питання чекають\\!`,
      ];
      console.log(`[Retention] Notifying ${inactive.length} users`);
      for (const u of inactive) {
        const msg = MSGS[Math.floor(Math.random() * MSGS.length)];
        try {
          await bot.sendMessage(u.userId, msg, {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: [[{ text: '🔮 Запитати Оракул', web_app: { url: WEBAPP_URL } }]] },
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
        try {
          await bot.sendMessage(u.userId,
            `🌙 *Твій ліміт відновлено\\!*\n\n🔮 2 нових питання вже чекають тебе\\.\n\nЩо запитаєш у долі сьогодні?`,
            { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '🔮 Запитати Оракул', web_app: { url: WEBAPP_URL } }]] } }
          );
        } catch {}
        await new Promise(r => setTimeout(r, 80));
      }
    }
  }, 60_000);

  tgApi('setMyDescription', { description:
    'Оракул Долі — містичний бот, що відповідає на питання долі.\n\n' +
    'Постав питання Так/Ні — зірки, місяць і сили Всесвіту дадуть тобі відповідь.\n\n' +
    '🆓 2 безкоштовних питання щодня\n' +
    '⭐ Безлімітно з Преміум\n' +
    '🔗 Запрошуй друзів — отримуй бонусні питання'
  }).catch(() => {});

  tgApi('setMyShortDescription', { short_description:
    '🔮 Задай питання долі — отримай відповідь Всесвіту. Так або Ні — Оракул знає.'
  }).catch(() => {});
}

// ─── Плани та відправка інвойсу ───────────────────────────────────────────────
const PLAN_CONFIG = {
  week:     { days: 7,     stars: 100,  title: '⭐ Oracle Premium — 7 днів',   desc: '7 днів безлімітних питань Оракулу!' },
  month:    { days: 30,    stars: 300,  title: '⭐ Oracle Premium — 30 днів',  desc: '30 днів безлімітних питань Оракулу!' },
  lifetime: { days: 36500, stars: 2500, title: '⭐ Oracle Premium — Назавжди', desc: 'Безлімітні питання Оракулу назавжди!' },
};

const PACK_CONFIG = {
  pack5:  { questions: 5,  stars: 30, title: '🔮 Пакет +5 питань',  desc: '5 додаткових питань Оракулу — без строку дії!' },
  pack20: { questions: 20, stars: 80, title: '🔮 Пакет +20 питань', desc: '20 додаткових питань Оракулу — без строку дії!' },
};

const GIFT_PLANS = {
  gift7:  { days: 7,  stars: 80,  title: '🎁 Подарунок Oracle Premium 7 днів',  desc: '7 днів безлімітних питань Оракулу у подарунок' },
  gift30: { days: 30, stars: 250, title: '🎁 Подарунок Oracle Premium 30 днів', desc: '30 днів безлімітних питань Оракулу у подарунок' },
};

async function sendGiftInvoice(chatId, userId, plan) {
  const p = GIFT_PLANS[plan];
  if (!p) return;
  const invoiceData = {
    chat_id: chatId, title: p.title, description: p.desc,
    payload: `oracle_${plan}_${userId}`, currency: 'XTR',
    provider_token: '',
    prices: [{ label: p.title, amount: p.stars }],
  };
  try { await tgApi('sendInvoice', { ...invoiceData, photo_url: WEBAPP_URL + '/preview.jpg' }); }
  catch { await tgApi('sendInvoice', invoiceData); }
}

async function sendPremiumInvoice(chatId, userId, plan = 'month') {
  const p = PLAN_CONFIG[plan] || PLAN_CONFIG.month;
  const invoiceData = {
    chat_id:        chatId,
    title:          p.title,
    description:    p.desc,
    payload:        `oracle_${plan}_${userId || chatId}`,
    currency:       'XTR',
    provider_token: '',
    prices:         [{ label: p.title, amount: p.stars }],
  };
  try {
    await tgApi('sendInvoice', { ...invoiceData, photo_url: WEBAPP_URL + '/preview.jpg' });
  } catch {
    await tgApi('sendInvoice', invoiceData);
  }
}

// ─── API Router (монтується ДО статики) ──────────────────────────────────────
const api = express.Router();

api.get('/ping', (req, res) => res.json({ pong: true }));

api.get('/status', (req, res) => res.json({ ok: true, version: '2.4.0', bot: !!bot }));

api.get('/user/:userId/status', (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || userId === 'null' || userId === 'undefined') {
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
  const { userId } = req.params;
  if (!rl.invoice(userId)) return res.status(429).json({ error: 'Too many requests' });
  const plan = req.body?.plan || 'month';
  const isPack = plan.startsWith('pack');
  const p = isPack ? PACK_CONFIG[plan] : (PLAN_CONFIG[plan] || PLAN_CONFIG.month);
  if (!p) return res.status(400).json({ error: 'Unknown plan' });
  try {
    const result = await tgApi('createInvoiceLink', {
      title:          p.title,
      description:    p.desc,
      payload:        `oracle_${plan}_${userId}`,
      currency:       'XTR',
      provider_token: '',
      prices:         [{ label: p.title, amount: p.stars }],
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
  const { userId, username, firstName } = req.body;
  if (userId && userId !== 'guest') setUserInfo(userId, { username, firstName });
  res.json({ ok: true });
});

api.post('/event', (req, res) => {
  const { userId, event, variant } = req.body || {};
  if (event && rl.event(req.ip || '?')) logEvent(userId || 'guest', event, variant || null);
  res.json({ ok: true });
});

api.get('/user/:userId/history', async (req, res) => {
  const { userId } = req.params;
  if (!userId || userId === 'guest') return res.json([]);
  try {
    const questions = await getUserQuestions(userId);
    res.json(questions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/ask', rateLimit, (req, res) => {
  const raw = req.body;
  // Sanitize userId — null/undefined/'null'/'undefined' → guest
  const rawId = raw?.userId;
  const userId = (rawId && rawId !== 'null' && rawId !== 'undefined')
    ? String(rawId).trim().slice(0, 64)
    : 'guest';
  const { category, username, firstName } = raw;
  const question = raw?.question;

  if (userId !== 'guest' && (username || firstName)) {
    setUserInfo(userId, { username, firstName });
  }
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Вопрос не может быть пустым' });
  }
  if (question.trim().length > 500) {
    return res.status(400).json({ error: 'Питання занадто довге (макс 500 символів)' });
  }

  if (userId && userId !== 'guest') {
    try {
      const status = getStatus(userId);
      if (!status.canAsk) {
        // Надіслати нотифікацію в бот — один раз на день
        if (bot) {
          const notifKey = `${userId}_${new Date().toISOString().slice(0, 10)}`;
          if (!limitNotifSent.has(notifKey)) {
            limitNotifSent.add(notifKey);
            bot.sendMessage(userId,
              `🔮 *Оракул мовчить\\.\\.\\.*\n\nТи вичерпав денний ліміт питань\\.\n\n⭐ *Отримай Преміум* — безліміт питань щодня\\!\n🌙 Або повернись опівночі — ліміт оновиться\\.`,
              { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [
                [{ text: '⭐ Отримати Преміум', web_app: { url: WEBAPP_URL } }],
              ]}}
            ).catch(() => {});
          }
        }
        return res.status(403).json({ error: 'limit', message: 'Лимит вопросов исчерпан', status });
      }
      increment(userId);
      const answer = getOracleAnswer();
      logQuestion(userId, question.trim(), answer, category);
      emitQuestion();
      return res.json({ question: question.trim(), answer, status: getStatus(userId) });
    } catch (e) {
      console.error('[ask/userService]', e.message || e);
      const answer = getOracleAnswer();
      logQuestion(userId, question.trim(), answer, category);
      emitQuestion();
      return res.json({ question: question.trim(), answer });
    }
  }

  const answer = getOracleAnswer();
  logQuestion(userId, question.trim(), answer, category);
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
