require('dotenv').config({ path: __dirname + '/.env' });
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const https      = require('https');
const TelegramBot = require('node-telegram-bot-api');
const { getOracleAnswer } = require('./config/oracleAnswers');
let getStatus, increment, activatePremium, logQuestion, getStats, getUsers, getQuestions;
try {
  ({ getStatus, increment, activatePremium, logQuestion, getStats, getUsers, getQuestions } = require('./services/userService'));
} catch (e) {
  console.error('[userService] Load error:', e.message);
  getStatus    = () => ({ canAsk: true, remaining: 2, isPremium: false });
  increment    = () => {};
  activatePremium = () => new Date().toISOString();
  logQuestion  = () => {};
  getStats     = () => ({});
  getUsers     = () => [];
  getQuestions = () => [];
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

  // /start
  bot.onText(/\/start/, async (msg) => {
    const chatId  = msg.chat.id;
    const userId  = msg.from?.id;
    const name    = msg.from?.first_name || 'Странник';
    const status  = userId ? getStatus(userId) : null;

    let premiumLine = '';
    if (status?.isPremium) {
      const until = new Date(status.premiumUntil).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
      premiumLine = `\n⭐ *Премиум активен* до ${until}\n`;
    } else {
      premiumLine = `\n🆓 Бесплатно: *2 вопроса в день*\n⭐ Премиум: /premium\n`;
    }

    await bot.sendMessage(chatId,
      `🔮 *Добро пожаловать, ${name}!*\n\nЯ — *Оракул Судьбы* — древний дух, читающий нити будущего.\n\nЗадай вопрос, на который можно ответить *Да* или *Нет* — и я открою тебе правду.${premiumLine}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔮 Открыть Оракул Судьбы', web_app: { url: WEBAPP_URL } }],
            [{ text: '⭐ Получить Премиум', callback_data: 'buy_premium' }],
          ]
        }
      }
    );
  });

  // /premium
  bot.onText(/\/premium/, async (msg) => {
    await sendPremiumInvoice(msg.chat.id, msg.from?.id);
  });

  // Callback query — кнопка "Получить Премиум"
  bot.on('callback_query', async (query) => {
    await bot.answerCallbackQuery(query.id);
    if (query.data === 'buy_premium') {
      await sendPremiumInvoice(query.message.chat.id, query.from.id);
    }
  });

  // /ask вопрос прямо в боте
  bot.onText(/\/ask (.+)/, async (msg, match) => {
    const chatId  = msg.chat.id;
    const userId  = msg.from?.id;
    const question = match[1].trim();

    if (userId) {
      const status = getStatus(userId);
      if (!status.canAsk) {
        await bot.sendMessage(chatId,
          `🔮 Ты исчерпал *${2} бесплатных вопроса* на сегодня.\n\n⭐ Получи Премиум — задавай сколько угодно!`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '⭐ Купить Премиум — 300 ★', callback_data: 'buy_premium' }]] }
          }
        );
        return;
      }
      increment(userId);
    }

    const answer      = getOracleAnswer();
    const colorEmoji  = answer.color === 'yes' ? '🟢' : answer.color === 'no' ? '🔴' : '🟡';
    await bot.sendMessage(chatId,
      `🔮 *Оракул слышит тебя...*\n\n❓ _${question}_\n\n${colorEmoji} *${answer.title}*\n${answer.verdict}\n\n_${answer.message}_`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔮 Задать новый вопрос', web_app: { url: WEBAPP_URL } }]] }
      }
    );
  });

  bot.onText(/^\/ask$/, async (msg) => {
    await bot.sendMessage(msg.chat.id, '🔮 Напиши: `/ask Твой вопрос?`', { parse_mode: 'Markdown' });
  });

  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
      `🔮 *Оракул Судьбы*\n\n/start — Открыть бота\n/ask [вопрос] — Быстрый вопрос\n/premium — Купить премиум\n/help — Справка\n\n🆓 Бесплатно: 2 вопроса в день\n⭐ Премиум: 300 Telegram Stars / месяц`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔮 Открыть Оракул', web_app: { url: WEBAPP_URL } }]] }
      }
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
    if (!payload.startsWith('oracle_premium_')) return;

    const until = activatePremium(userId, 30);
    const date  = new Date(until).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
    await bot.sendMessage(msg.chat.id,
      `✨ *Добро пожаловать в Премиум!*\n\n⭐ Оракул теперь отвечает без ограничений\n📅 Активен до: *${date}*\n\n🔮 Задавай вопросы — судьба ждёт!`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔮 Открыть Оракул', web_app: { url: WEBAPP_URL } }]] }
      }
    );
    console.log(`[Premium] userId=${userId} active until ${until}`);
  });

  bot.on('polling_error', err => console.error('[Bot] Polling error:', err.message));
  console.log('[Bot] Oracle Bot запущено');
}

// ─── Функція відправки інвойсу ────────────────────────────────────────────────
async function sendPremiumInvoice(chatId, userId) {
  try {
    await tgApi('sendInvoice', {
      chat_id: chatId,
      title: '⭐ Oracle Premium',
      description: 'Безлімітні питання Оракулу на 30 днів. Дізнайся свою долю без обмежень!',
      payload: `oracle_premium_${userId || chatId}`,
      currency: 'XTR',
      prices: [{ label: 'Oracle Premium — 30 днів', amount: 300 }],
      photo_url: WEBAPP_URL + '/preview.jpg',
    });
  } catch (e) {
    // photo_url може не спрацювати — пробуємо без фото
    await tgApi('sendInvoice', {
      chat_id: chatId,
      title: '⭐ Oracle Premium',
      description: 'Безлімітні питання Оракулу на 30 днів. Дізнайся свою долю без обмежень!',
      payload: `oracle_premium_${userId || chatId}`,
      currency: 'XTR',
      prices: [{ label: 'Oracle Premium — 30 днів', amount: 300 }],
    });
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
  try {
    const result = await tgApi('createInvoiceLink', {
      title: '⭐ Oracle Premium',
      description: 'Безлімітні питання Оракулу на 30 днів!',
      payload: `oracle_premium_${userId}`,
      currency: 'XTR',
      prices: [{ label: 'Oracle Premium — 30 днів', amount: 300 }],
    });
    if (result.ok) {
      res.json({ url: result.result });
    } else {
      res.status(500).json({ error: result.description });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.post('/ask', (req, res) => {
  const { question, userId } = req.body;
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
      logQuestion(userId, question.trim(), answer);
      return res.json({ question: question.trim(), answer, status: getStatus(userId) });
    } catch (e) {
      console.error('[ask/userService]', e.message || e);
      const answer = getOracleAnswer();
      logQuestion(userId, question.trim(), answer);
      return res.json({ question: question.trim(), answer });
    }
  }

  const answer = getOracleAnswer();
  logQuestion(userId, question.trim(), answer);
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
