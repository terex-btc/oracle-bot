'use strict';

const FREE_LIMIT = 2;
const Q_MAX      = 1000;

let pool;
let memUsers    = {};
let questionLog = [];
let dbReady     = false;

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── PostgreSQL Init ───────────────────────────────────────────────
async function initDb() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('[DB] No DATABASE_URL — using memory only'); return; }

  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: url,
      ssl: url.includes('railway.internal') ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id      TEXT PRIMARY KEY,
        daily_count  INTEGER NOT NULL DEFAULT 0,
        last_reset   TEXT    NOT NULL DEFAULT '${today()}',
        premium_until TEXT,
        total_asked  INTEGER NOT NULL DEFAULT 0,
        last_seen    BIGINT,
        free_bonus   INTEGER NOT NULL DEFAULT 0,
        referred_by  TEXT,
        username     TEXT,
        first_name   TEXT
      )
    `);

    // Migrate existing tables that may not have username/first_name columns
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT,
        question   TEXT,
        category   TEXT,
        color      TEXT,
        verdict    TEXT,
        ts         BIGINT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_q_ts  ON questions(ts DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_q_uid ON questions(user_id)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        code        TEXT PRIMARY KEY,
        from_user   TEXT,
        days        INTEGER NOT NULL DEFAULT 30,
        created_at  BIGINT,
        used_by     TEXT,
        used_at     BIGINT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id      SERIAL PRIMARY KEY,
        user_id TEXT,
        event   TEXT,
        variant TEXT,
        ts      BIGINT
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ev_ts  ON events(ts DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ev_evt ON events(event)`);

    const { rows: uRows } = await pool.query('SELECT * FROM users');
    for (const r of uRows) {
      memUsers[r.user_id] = {
        dailyCount:   r.daily_count,
        lastReset:    r.last_reset,
        premiumUntil: r.premium_until || null,
        totalAsked:   r.total_asked,
        lastSeen:     r.last_seen ? Number(r.last_seen) : null,
        freeBonus:    r.free_bonus,
        referredBy:   r.referred_by || null,
        username:     r.username    || null,
        firstName:    r.first_name  || null,
      };
    }

    const { rows: qRows } = await pool.query(
      'SELECT * FROM questions ORDER BY ts DESC LIMIT 1000'
    );
    questionLog = qRows.map(r => ({
      userId:   r.user_id,
      question: r.question,
      category: r.category,
      color:    r.color,
      verdict:  r.verdict,
      ts:       r.ts ? Number(r.ts) : Date.now(),
    }));

    // Load unredeemed gifts into memory
    const { rows: gRows } = await pool.query('SELECT * FROM gifts WHERE used_by IS NULL');
    for (const r of gRows) {
      giftMap.set(r.code, { fromUserId: r.from_user, days: r.days, createdAt: Number(r.created_at) });
    }

    dbReady = true;
    console.log(`[DB] PostgreSQL ready — ${uRows.length} users, ${qRows.length} questions, ${gRows.length} gifts`);

    // Keepalive: Railway proxy kills idle connections after ~5 min
    setInterval(() => {
      pool.query('SELECT 1').catch(() => {});
    }, 4 * 60_000);

  } catch (e) {
    console.error('[DB] Init failed:', e.message);
  }
}

initDb();

// ─── DB Write helpers ──────────────────────────────────────────────
const USER_SQL = `INSERT INTO users
  (user_id, daily_count, last_reset, premium_until, total_asked, last_seen, free_bonus, referred_by, username, first_name)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  ON CONFLICT (user_id) DO UPDATE SET
    daily_count=$2, last_reset=$3, premium_until=$4,
    total_asked=$5, last_seen=$6, free_bonus=$7, referred_by=$8,
    username=COALESCE($9, users.username),
    first_name=COALESCE($10, users.first_name)`;

function userParams(id, u) {
  return [id, u.dailyCount, u.lastReset, u.premiumUntil || null,
          u.totalAsked, u.lastSeen || null, u.freeBonus, u.referredBy || null,
          u.username || null, u.firstName || null];
}

function dbSaveUser(id, u) {
  if (!dbReady || !pool) return;
  pool.query(USER_SQL, userParams(id, u))
    .catch(() => {
      // Retry once after 3s — protects premium writes from transient DB errors
      setTimeout(() => {
        pool.query(USER_SQL, userParams(id, u))
          .catch(e => console.error('[DB] saveUser retry failed:', e.message));
      }, 3000);
    });
}

// Queue for failed question writes — retried every 30s
const writeQueue = [];
let writeQueueTimer = null;

async function flushWriteQueue() {
  writeQueueTimer = null;
  if (!dbReady || !pool || !writeQueue.length) return;
  const batch = writeQueue.splice(0, 50);
  for (const q of batch) {
    try {
      await pool.query(
        'INSERT INTO questions (user_id, question, category, color, verdict, ts) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
        [q.userId, q.question, q.category || null, q.color, q.verdict, q.ts]
      );
    } catch (e) {
      console.error('[DB] retryQuestion:', e.message);
      writeQueue.unshift(q);
      break; // стоп при помилці, решта залишається в черзі
    }
  }
  // якщо ще є — повторити через хвилину
  if (writeQueue.length && !writeQueueTimer) {
    writeQueueTimer = setTimeout(flushWriteQueue, 60_000);
  }
}

function dbSaveQuestion(q) {
  if (!dbReady || !pool) {
    writeQueue.push(q);
    return;
  }
  pool.query(
    'INSERT INTO questions (user_id, question, category, color, verdict, ts) VALUES ($1,$2,$3,$4,$5,$6)',
    [q.userId, q.question, q.category || null, q.color, q.verdict, q.ts]
  ).catch(e => {
    console.error('[DB] saveQuestion:', e.message);
    writeQueue.push(q);
    if (!writeQueueTimer) writeQueueTimer = setTimeout(flushWriteQueue, 30_000);
  });
}

// ─── User helpers ──────────────────────────────────────────────────
function hydrate(userId) {
  const id = String(userId);
  if (!memUsers[id]) {
    memUsers[id] = { dailyCount: 0, lastReset: today(), premiumUntil: null, totalAsked: 0, lastSeen: null, freeBonus: 0, referredBy: null, username: null, firstName: null };
  }
  const u = memUsers[id];
  if (u.lastReset !== today()) { u.dailyCount = 0; u.lastReset = today(); }
  if (!u.freeBonus) u.freeBonus = 0;
  return { u, id };
}

// ─── Public API ────────────────────────────────────────────────────
function getStatus(userId) {
  const { u } = hydrate(userId);
  const isPremium = !!(u.premiumUntil && new Date(u.premiumUntil) > new Date());
  if (isPremium) return { canAsk: true, remaining: null, isPremium: true, premiumUntil: u.premiumUntil, dailyCount: u.dailyCount, totalAsked: u.totalAsked || 0 };
  const dailyLeft = Math.max(0, FREE_LIMIT - u.dailyCount);
  const bonusLeft = u.freeBonus || 0;
  const remaining = dailyLeft + bonusLeft;
  return { canAsk: remaining > 0, remaining, dailyLeft, bonusLeft, isPremium: false, premiumUntil: null, dailyCount: u.dailyCount, limit: FREE_LIMIT, totalAsked: u.totalAsked || 0 };
}

function increment(userId) {
  const { u, id } = hydrate(userId);
  if (u.dailyCount < FREE_LIMIT)    u.dailyCount++;
  else if ((u.freeBonus || 0) > 0)  u.freeBonus--;
  else                               u.dailyCount++;
  u.totalAsked = (u.totalAsked || 0) + 1;
  u.lastSeen   = Date.now();
  dbSaveUser(id, u);
}

function setUserInfo(userId, { username, firstName } = {}) {
  try {
    const { u, id } = hydrate(userId);
    let changed = false;
    if (username  && u.username  !== username)  { u.username  = String(username);  changed = true; }
    if (firstName && u.firstName !== firstName) { u.firstName = String(firstName); changed = true; }
    if (changed) dbSaveUser(id, u);
  } catch {}
}

function activatePremium(userId, days = 30) {
  const { u, id } = hydrate(userId);
  const now  = new Date();
  const base = u.premiumUntil && new Date(u.premiumUntil) > now ? new Date(u.premiumUntil) : now;
  base.setDate(base.getDate() + days);
  u.premiumUntil = base.toISOString();
  u.lastSeen     = Date.now();
  dbSaveUser(id, u);
  return u.premiumUntil;
}

function addBonus(userId, amount) {
  try {
    const { u, id } = hydrate(userId);
    u.freeBonus = (u.freeBonus || 0) + amount;
    dbSaveUser(id, u);
    return u.freeBonus;
  } catch { return 0; }
}

function applyReferral(newUserId, referrerId) {
  try {
    const { u: newUser, id: newId } = hydrate(newUserId);
    if (newUser.referredBy) return false;
    if (String(newUserId) === String(referrerId)) return false;
    newUser.referredBy = String(referrerId);
    dbSaveUser(newId, newUser);
    addBonus(newUserId, 3);
    addBonus(referrerId, 3);
    return true;
  } catch { return false; }
}

function logQuestion(userId, question, answer, category) {
  const q = {
    userId:   userId ? String(userId) : 'guest',
    question,
    category: category || null,
    color:    answer.color,
    verdict:  answer.verdict,
    ts:       Date.now(),
  };
  questionLog.unshift(q);
  if (questionLog.length > Q_MAX) questionLog.length = Q_MAX;
  dbSaveQuestion(q);
}

// ─── All questions for a specific user ────────────────────────────
async function getUserQuestions(userId) {
  const id = String(userId);
  const memQ = questionLog.filter(q => q.userId === id);

  if (dbReady && pool) {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM questions WHERE user_id = $1 ORDER BY ts DESC',
        [id]
      );
      const dbQ = rows.map(r => ({
        userId:   r.user_id,
        question: r.question,
        category: r.category || null,
        color:    r.color,
        verdict:  r.verdict,
        ts:       r.ts ? Number(r.ts) : Date.now(),
      }));
      // Merge DB + in-memory, deduplicate by ts
      const seen = new Set(dbQ.map(q => q.ts));
      const extra = memQ.filter(q => !seen.has(q.ts));
      return [...dbQ, ...extra].sort((a, b) => b.ts - a.ts);
    } catch (e) {
      console.error('[DB] getUserQuestions:', e.message);
    }
  }
  return memQ;
}

function revokePremium(userId) {
  const { u, id } = hydrate(userId);
  u.premiumUntil = null;
  dbSaveUser(id, u);
  return true;
}

function getStats() {
  const todayStr = today();
  const now      = new Date();
  let totalUsers = 0, premiumUsers = 0, questionsToday = 0, totalQuestions = 0, activeTodayUsers = 0;
  for (const u of Object.values(memUsers)) {
    totalUsers++;
    if (u.premiumUntil && new Date(u.premiumUntil) > now) premiumUsers++;
    totalQuestions += (u.totalAsked || 0);
    if (u.lastReset === todayStr) {
      questionsToday += (u.dailyCount || 0);
      if (u.dailyCount > 0) activeTodayUsers++;
    }
  }
  const hourAgo           = Date.now() - 3_600_000;
  const questionsLastHour = questionLog.filter(q => q.ts > hourAgo).length;
  return { totalUsers, premiumUsers, questionsToday, questionsLastHour, totalQuestions, loggedQuestions: questionLog.length, activeTodayUsers, dbReady };
}

function getUsers() {
  const now = new Date();
  return Object.entries(memUsers).map(([id, u]) => ({
    userId:       id,
    totalAsked:   u.totalAsked  || 0,
    dailyCount:   u.dailyCount  || 0,
    freeBonus:    u.freeBonus   || 0,
    isPremium:    !!(u.premiumUntil && new Date(u.premiumUntil) > now),
    premiumUntil: u.premiumUntil || null,
    lastSeen:     u.lastSeen    || null,
    username:     u.username    || null,
    firstName:    u.firstName   || null,
  })).sort((a, b) => b.totalAsked - a.totalAsked);
}

function getQuestions(limit = 200) {
  return questionLog.slice(0, limit);
}

// ─── Gift system ───────────────────────────────────────────────
const giftMap = new Map();

function genCode() {
  return 'ORC' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createGift(fromUserId, days) {
  const code = genCode();
  const gift = { fromUserId: String(fromUserId), days, createdAt: Date.now() };
  giftMap.set(code, gift);
  if (dbReady && pool) {
    pool.query(
      'INSERT INTO gifts (code, from_user, days, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [code, gift.fromUserId, days, gift.createdAt]
    ).catch(e => console.error('[DB] createGift:', e.message));
  }
  return code;
}

async function redeemGift(code, toUserId) {
  const id = String(toUserId);
  let gift = giftMap.get(code);

  if (!gift && dbReady && pool) {
    try {
      const { rows } = await pool.query('SELECT * FROM gifts WHERE code = $1', [code]);
      if (rows[0]) {
        gift = { fromUserId: rows[0].from_user, days: rows[0].days, createdAt: Number(rows[0].created_at), usedBy: rows[0].used_by || null };
        giftMap.set(code, gift);
      }
    } catch {}
  }

  if (!gift)           return { ok: false, error: 'Подарунковий код не знайдено' };
  if (gift.usedBy)     return { ok: false, error: 'Цей код вже використано' };
  if (gift.fromUserId === id) return { ok: false, error: 'Не можна активувати власний подарунок' };

  gift.usedBy = id;
  const until = activatePremium(id, gift.days);

  if (dbReady && pool) {
    pool.query('UPDATE gifts SET used_by=$1, used_at=$2 WHERE code=$3', [id, Date.now(), code])
      .catch(e => console.error('[DB] redeemGift:', e.message));
  }
  return { ok: true, days: gift.days, fromUserId: gift.fromUserId, until };
}

// ─── Funnel events ────────────────────────────────────────────
const eventLog2 = [];
const EV_MAX    = 10_000;

function logEvent(userId, event, variant = null) {
  const e = { userId: userId ? String(userId) : 'guest', event, variant, ts: Date.now() };
  eventLog2.unshift(e);
  if (eventLog2.length > EV_MAX) eventLog2.length = EV_MAX;
  if (dbReady && pool) {
    pool.query('INSERT INTO events (user_id, event, variant, ts) VALUES ($1,$2,$3,$4)',
      [e.userId, e.event, e.variant, e.ts]
    ).catch(() => {});
  }
}

function getFunnelStats() {
  const week   = Date.now() - 7 * 86_400_000;
  const recent = eventLog2.filter(e => e.ts > week);
  const counts = {};
  const ab     = {};
  for (const e of recent) {
    counts[e.event] = (counts[e.event] || 0) + 1;
    if (e.variant) {
      if (!ab[e.variant]) ab[e.variant] = {};
      ab[e.variant][e.event] = (ab[e.variant][e.event] || 0) + 1;
    }
  }
  return { counts, ab, total: eventLog2.length };
}

// ─── A/B variant ──────────────────────────────────────────────
function getABVariant(userId) {
  const s = String(userId || '');
  const h = s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return h % 2 === 0 ? 'A' : 'B';
}

module.exports = {
  getStatus, increment, setUserInfo, activatePremium, revokePremium,
  addBonus, applyReferral, logQuestion, getUserQuestions,
  getStats, getUsers, getQuestions,
  createGift, redeemGift, logEvent, getFunnelStats, getABVariant,
};
