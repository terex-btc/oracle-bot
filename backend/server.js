require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { getOracleAnswer } = require('./config/oracleAnswers');

const app  = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Telegram Bot ─────────────────────────────────────────────────────────────
let bot;
if (BOT_TOKEN) {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const name   = msg.from?.first_name || 'Странник';
    const webAppUrl = process.env.WEBAPP_URL || `http://localhost:${PORT}`;

    const welcome = `🔮 *Добро пожаловать, ${name}!*

Я — *Оракул Судьбы* — древний дух, читающий нити будущего.

Задай мне вопрос, на который можно ответить *Да* или *Нет* — и я открою тебе правду, скрытую в туманах времени.

✨ *Как это работает:*
🌀 Сосредоточься на своём вопросе
🔮 Открой Оракул и напиши вопрос
⚡ Получи ответ из глубин судьбы

💫 Помни — Оракул видит то, что скрыто от обычных глаз.`;

    await bot.sendMessage(chatId, welcome, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔮 Открыть Оракул Судьбы', web_app: { url: webAppUrl } }]
        ]
      }
    });
  });

  // /ask — быстрый вопрос прямо в боте
  bot.onText(/\/ask (.+)/, async (msg, match) => {
    const chatId   = msg.chat.id;
    const question = match[1].trim();
    const answer   = getOracleAnswer();

    const colorEmoji = answer.color === 'yes' ? '🟢' : answer.color === 'no' ? '🔴' : '🟡';
    const webAppUrl  = process.env.WEBAPP_URL || `http://localhost:${PORT}`;

    await bot.sendMessage(chatId,
      `🔮 *Оракул слышит тебя...*\n\n❓ _${question}_\n\n${colorEmoji} *${answer.title}*\n${answer.verdict}\n\n_${answer.message}_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔮 Задать новый вопрос', web_app: { url: webAppUrl } }]
          ]
        }
      }
    );
  });

  // /ask без вопроса — подсказка
  bot.onText(/^\/ask$/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId,
      '🔮 Напиши свой вопрос так:\n`/ask Стоит ли мне сменить работу?`',
      { parse_mode: 'Markdown' }
    );
  });

  // /help
  bot.onText(/\/help/, async (msg) => {
    const chatId    = msg.chat.id;
    const webAppUrl = process.env.WEBAPP_URL || `http://localhost:${PORT}`;
    await bot.sendMessage(chatId,
      `🔮 *Оракул Судьбы — Помощь*\n\n*Команды:*\n/start — Открыть бота\n/ask [вопрос] — Быстрый вопрос прямо здесь\n/help — Эта справка\n\n*Пример:*\n\`/ask Будет ли у меня удача сегодня?\`\n\nИли открой полное приложение 👇`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔮 Открыть Оракул', web_app: { url: webAppUrl } }]
          ]
        }
      }
    );
  });

  bot.on('polling_error', (error) => {
    console.error('[Bot] Polling error:', error.message);
  });

  console.log('[Bot] Oracle Bot запущено');
}

// ─── API ──────────────────────────────────────────────────────────────────────
app.post('/api/ask', (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Вопрос не может быть пустым' });
  }
  const answer = getOracleAnswer();
  res.json({ question: question.trim(), answer });
});

app.get('/api/status', (req, res) => {
  res.json({ ok: true, version: '1.0.0', bot: !!bot });
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Oracle Bot запущено на http://localhost:${PORT}`);
});
