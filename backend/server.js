require('dotenv').config({ path: __dirname + '/.env' });
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const https      = require('https');
const TelegramBot = require('node-telegram-bot-api');
const { getOracleAnswer } = require('./config/oracleAnswers');
let getStatus, increment, activatePremium, addBonus, applyReferral, logQuestion, getStats, getUsers, getQuestions;
try {
  ({ getStatus, increment, activatePremium, addBonus, applyReferral, logQuestion, getStats, getUsers, getQuestions } = require('./services/userService'));
} catch (e) {
  console.error('[userService] Load error:', e.message);
  getStatus     = () => ({ canAsk: true, remaining: 2, isPremium: false });
  increment     = () => {};
  activatePremium = () => new Date().toISOString();
  addBonus      = () => {};
  applyReferral = () => false;
  logQuestion   = () => {};
  getStats      = () => ({});
  getUsers      = () => [];
  getQuestions  = () => [];
}

const app          = express();
const PORT         = process.env.PORT || 3000;
const BOT_TOKEN    = process.env.BOT_TOKEN;
const WEBAPP_URL   = process.env.WEBAPP_URL || `http://localhost:${PORT}`;
const ADMIN_SECRET = process.env.ADMIN_SECRET || (BOT_TOKEN ? BOT_TOKEN.slice(0, 12) : 'oracle_admin');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
// Статика ПІСЛЯ всіх API маршрутів (Express 5 — порядок важливий)

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
if (BOT_TOKEN) {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });

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

    // Реферал
    if (userId && param.startsWith('ref_')) {
      const referrerId = param.replace('ref_', '');
      const applied = applyReferral(userId, referrerId);
      if (applied) {
        await bot.sendMessage(chatId, `🎁 *+3 бонусних питання* нараховано тобі за запрошення!`, { parse_mode: 'Markdown' });
        try { await bot.sendMessage(referrerId, `🎉 Хтось перейшов по твоєму посиланню\\! *+3 бонусних питання* тобі\\!`, { parse_mode: 'MarkdownV2' }); } catch {}
      }
    }

    const status = userId ? getStatus(userId) : null;
    const isPremium = status?.isPremium;

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
      `🔮 *${name}, Оракул бачить тебе\\.\\.\\.*\n\n` +
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
    await bot.answerCallbackQuery(query.id);
    const data   = query.data;
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    if      (data === 'buy_premium' || data === 'buy_month') await sendPremiumInvoice(chatId, userId, 'month');
    else if (data === 'buy_week')     await sendPremiumInvoice(chatId, userId, 'week');
    else if (data === 'buy_lifetime') await sendPremiumInvoice(chatId, userId, 'lifetime');
    else if (data === 'get_ref') {
      const refLink = `https://t.me/oracle_666bot?start=ref_${userId}`;
      await bot.sendMessage(chatId,
        `🔗 *Твоє реферальне посилання:*\n\n${refLink}\n\nПоділись з другом — ви обидва отримаєте *\\+3 питання*\\! 🎁`,
        { parse_mode: 'MarkdownV2' }
      );
    }
  });

  // /ask
  bot.onText(/\/ask (.+)/, async (msg, match) => {
    const chatId   = msg.chat.id;
    const userId   = msg.from?.id;
    const question = match[1].trim();
    if (userId) {
      const status = getStatus(userId);
      if (!status.canAsk) {
        await bot.sendMessage(chatId,
          `🔮 Ти вичерпав ліміт питань на сьогодні.\n\n⭐ Отримай Премиум — питай скільки завгодно!`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '⭐ Купити Премиум', callback_data: 'buy_premium' }]] } }
        );
        return;
      }
      increment(userId);
    }
    const answer     = getOracleAnswer();
    const colorEmoji = answer.color === 'yes' ? '🟢' : answer.color === 'no' ? '🔴' : '🟡';
    await bot.sendMessage(chatId,
      `🔮 *Оракул слышит тебя...*\n\n❓ _${question}_\n\n${colorEmoji} *${answer.title}*\n${answer.verdict}\n\n_${answer.message}_`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔮 Задать новый вопрос', web_app: { url: WEBAPP_URL } }]] } }
    );
  });

  bot.onText(/^\/ask$/, async (msg) => {
    await bot.sendMessage(msg.chat.id, '🔮 Напиши: `/ask Твой вопрос?`', { parse_mode: 'Markdown' });
  });

  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
      `🔮 *Оракул Судьбы*\n\n/start — Відкрити бота\n/ask [питання] — Швидке питання\n/premium — Купити преміум\n/ref — Реферальне посилання\n/help — Довідка\n\n🆓 Безкоштовно: 2 питання / день\n⭐ Преміум від 100 ★`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔮 Відкрити Оракул', web_app: { url: WEBAPP_URL } }]] } }
    );
  });

  // ── Оплата Stars ────────────────────────────────────────────────
  bot.on('pre_checkout_query', async (query) => {
    await bot.answerPreCheckoutQuery(query.id, true);
  });

  bot.on('message', async (msg) => {
    if (!msg.successful_payment) return;
    const userId  = msg.from?.id;
    const payload = msg.successful_payment.invoice_payload;
    if (!payload.startsWith('oracle_')) return;

    // Визначаємо план з payload: oracle_week_UID / oracle_month_UID / oracle_lifetime_UID
    let days = 30;
    if (payload.startsWith('oracle_week_'))     days = 7;
    if (payload.startsWith('oracle_lifetime_')) days = 36500;

    const until = activatePremium(userId, days);
    const date  = new Date(until).toLocaleDateString('uk', { day: 'numeric', month: 'long', year: 'numeric' });
    const planLabel = days === 7 ? '7 днів' : days === 36500 ? 'Назавжди ♾️' : '30 днів';
    await bot.sendMessage(msg.chat.id,
      `✨ *Ласкаво просимо до Премиум!*\n\n⭐ Оракул відповідає без обмежень\n📅 План: *${planLabel}*\n📅 Активний до: *${date}*\n\n🔮 Задавай питання — доля чекає!`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔮 Відкрити Оракул', web_app: { url: WEBAPP_URL } }]] } }
    );
    console.log(`[Premium] userId=${userId} plan=${planLabel} until=${until}`);
  });

  bot.on('polling_error', err => console.error('[Bot] Polling error:', err.message));
  console.log('[Bot] Oracle Bot запущено');

  // Автоматично встановлюємо команди і опис при кожному запуску
  tgApi('setMyCommands', { commands: [
    { command: 'start',   description: '🔮 Відкрити Оракул Долі' },
    { command: 'ask',     description: '❓ Швидке питання оракулу' },
    { command: 'premium', description: '⭐ Купити Преміум' },
    { command: 'ref',     description: '🔗 Реферальне посилання (+3 питання)' },
    { command: 'help',    description: '📖 Допомога' },
  ]}).catch(() => {});

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

async function sendPremiumInvoice(chatId, userId, plan = 'month') {
  const p = PLAN_CONFIG[plan] || PLAN_CONFIG.month;
  const invoiceData = {
    chat_id:  chatId,
    title:    p.title,
    description: p.desc,
    payload:  `oracle_${plan}_${userId || chatId}`,
    currency: 'XTR',
    prices:   [{ label: p.title, amount: p.stars }],
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

api.get('/status', (req, res) => res.json({ ok: true, version: '2.3.0', bot: !!bot }));

api.get('/user/:userId/status', (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || userId === 'null' || userId === 'undefined') {
      return res.json({ canAsk: true, remaining: 2, isPremium: false, guest: true });
    }
    res.json(getStatus(userId));
  } catch (e) {
    console.error('[status]', e.message);
    res.json({ canAsk: true, remaining: 2, isPremium: false, error: e.message });
  }
});

api.post('/user/:userId/invoice', async (req, res) => {
  const { userId } = req.params;
  const plan = req.body?.plan || 'month';
  const p = PLAN_CONFIG[plan] || PLAN_CONFIG.month;
  try {
    const result = await tgApi('createInvoiceLink', {
      title:       p.title,
      description: p.desc,
      payload:     `oracle_${plan}_${userId}`,
      currency:    'XTR',
      prices:      [{ label: p.title, amount: p.stars }],
    });
    if (result.ok) {
      res.json({ url: result.result, plan, stars: p.stars, days: p.days });
    } else {
      res.status(500).json({ error: result.description });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/ask', (req, res) => {
  const { question, userId, category } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Вопрос не может быть пустым' });
  }

  if (userId && userId !== 'guest') {
    try {
      const status = getStatus(userId);
      if (!status.canAsk) {
        return res.status(403).json({ error: 'limit', message: 'Лимит вопросов исчерпан', status });
      }
      increment(userId);
      const answer = getOracleAnswer();
      logQuestion(userId, question.trim(), answer, category);
      return res.json({ question: question.trim(), answer, status: getStatus(userId) });
    } catch (e) {
      console.error('[ask/userService]', e.message || e);
      const answer = getOracleAnswer();
      logQuestion(userId, question.trim(), answer, category);
      return res.json({ question: question.trim(), answer });
    }
  }

  const answer = getOracleAnswer();
  logQuestion(userId, question.trim(), answer, category);
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
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  try { res.json(getQuestions(limit)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.use('/admin/api', adminApi);

// ─── Static + SPA fallback (після /api та /admin) ────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/{*path}', (req, res) => {
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
