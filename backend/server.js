require('dotenv').config({ path: __dirname + '/.env' });
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const https      = require('https');
const TelegramBot = require('node-telegram-bot-api');
const { getOracleAnswer } = require('./config/oracleAnswers');
let getStatus, increment, activatePremium, addBonus, applyReferral, logQuestion,
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
const sseClients  = new Set();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
// Статика ПІСЛЯ всіх API маршрутів (Express 5 — порядок важливий)

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
    await bot.answerCallbackQuery(query.id);
    if (query.from?.id) setUserInfo(query.from.id, { username: query.from.username, firstName: query.from.first_name });
    const data   = query.data;
    const chatId = query.message.chat.id;
    const userId = query.from.id;
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
      `🔮 *Оракул Судьбы*\n\n/start — Відкрити бота\n/ask [питання] — Швидке питання\n/premium — Купити преміум\n/gift — Подарувати преміум другу\n/ref — Реферальне посилання\n/help — Довідка\n\n🆓 Безкоштовно: 2 питання / день\n⭐ Преміум від 100 ★`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔮 Відкрити Оракул', web_app: { url: WEBAPP_URL } }]] } }
    );
  });

  // /gift — gifting flow
  bot.onText(/\/gift/, async (msg) => {
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
    await bot.answerPreCheckoutQuery(query.id, true);
  });

  bot.on('message', async (msg) => {
    if (!msg.successful_payment) return;
    const userId  = msg.from?.id;
    if (userId) setUserInfo(userId, { username: msg.from?.username, firstName: msg.from?.first_name });
    const payload = msg.successful_payment.invoice_payload;
    if (!payload.startsWith('oracle_')) return;

    // Подарунки: oracle_gift7_UID / oracle_gift30_UID
    if (payload.startsWith('oracle_gift')) {
      const giftPlanKey = Object.keys(GIFT_PLANS).find(k => payload.startsWith(`oracle_${k}_`));
      const gp = giftPlanKey ? GIFT_PLANS[giftPlanKey] : { days: 30 };
      const code = createGift(userId, gp.days);
      const shareUrl = `https://t.me/oracle_666bot?start=gift_${code}`;
      await bot.sendMessage(msg.chat.id,
        `🎁 *Подарунок готовий\\!*\n\n*${escMd(gp.days + ' днів Преміум')}* — посилання для друга:\n\n\`${code}\`\n\n${escMd(shareUrl)}\n\n_Коли друг натисне посилання — він отримає Преміум автоматично\\!_`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: { inline_keyboard: [[
            { text: '🎁 Поділитись подарунком', url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('🔮 Тримай подарунок — Оракул Долі чекає тебе!')}` }
          ]]}
        }
      );
      console.log(`[Gift] userId=${userId} code=${code} days=${gp.days}`);
      return;
    }

    // Пакети питань: oracle_pack5_UID / oracle_pack20_UID
    if (payload.startsWith('oracle_pack')) {
      const packKey = Object.keys(PACK_CONFIG).find(k => payload.startsWith(`oracle_${k}_`));
      const pack = packKey ? PACK_CONFIG[packKey] : null;
      const amount = pack ? pack.questions : 5;
      const newTotal = addBonus(userId, amount);
      await bot.sendMessage(msg.chat.id,
        `🎁 *Пакет питань отримано!*\n\n🔮 *+${amount} питань* додано до твого балансу\n💫 Всього бонусних питань: *${newTotal}*\n\n_Задавай питання — доля чекає!_`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔮 Відкрити Оракул', web_app: { url: WEBAPP_URL } }]] } }
      );
      console.log(`[Pack] userId=${userId} pack=${packKey} amount=${amount} total=${newTotal}`);
      return;
    }

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

  setInterval(async () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    if (now.getUTCHours() !== 10 || lastDailyDate === dateStr) return;
    lastDailyDate = dateStr;

    const users = getUsers();
    const active = users.filter(u => u.lastSeen && Date.now() - u.lastSeen < 30 * 86_400_000);
    const q = DAILY_QUESTIONS[new Date().getDate() % DAILY_QUESTIONS.length];
    console.log(`[Daily] Sending question to ${active.length} users`);

    for (const u of active) {
      try {
        await bot.sendMessage(u.userId,
          `🔮 *Питання дня від Оракула:*\n\n_"${q}"_\n\nНатисни — і дізнайся відповідь долі\\.`,
          { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '🔮 Отримати відповідь', web_app: { url: WEBAPP_URL } }]] } }
        );
      } catch {}
      await new Promise(r => setTimeout(r, 80));
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
    prices: [{ label: p.title, amount: p.stars }],
  };
  try { await tgApi('sendInvoice', { ...invoiceData, photo_url: WEBAPP_URL + '/preview.jpg' }); }
  catch { await tgApi('sendInvoice', invoiceData); }
}

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
  const plan = req.body?.plan || 'month';
  const isPack = plan.startsWith('pack');
  const p = isPack ? PACK_CONFIG[plan] : (PLAN_CONFIG[plan] || PLAN_CONFIG.month);
  if (!p) return res.status(400).json({ error: 'Unknown plan' });
  try {
    const result = await tgApi('createInvoiceLink', {
      title:       p.title,
      description: p.desc,
      payload:     `oracle_${plan}_${userId}`,
      currency:    'XTR',
      prices:      [{ label: p.title, amount: p.stars }],
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
  if (event) logEvent(userId || 'guest', event, variant || null);
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

api.post('/ask', (req, res) => {
  const { question, userId, category, username, firstName } = req.body;
  if (userId && userId !== 'guest' && (username || firstName)) {
    setUserInfo(userId, { username, firstName });
  }
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
