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
        referred_by  TEXT
      )
    `);

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

    // Завантажуємо всіх користувачів у пам'ять
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
      };
    }

    // Завантажуємо останні 1000 питань
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

    dbReady = true;
    console.log(`[DB] PostgreSQL ready — ${uRows.length} users, ${qRows.length} questions`);
  } catch (e) {
    console.error('[DB] Init failed:', e.message);
  }
}

initDb();

// ─── DB Write helpers (fire-and-forget) ───────────────────────────
function dbSaveUser(id, u) {
  if (!dbReady || !pool) return;
  pool.query(
    `INSERT INTO users (user_id, daily_count, last_reset, premium_until, total_asked, last_seen, free_bonus, referred_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id) DO UPDATE SET
       daily_count=$2, last_reset=$3, premium_until=$4,
       total_asked=$5, last_seen=$6, free_bonus=$7, referred_by=$8`,
    [id, u.dailyCount, u.lastReset, u.premiumUntil || null,
     u.totalAsked, u.lastSeen || null, u.freeBonus, u.referredBy || null]
  ).catch(e => console.error('[DB] saveUser:', e.message));
}

function dbSaveQuestion(q) {
  if (!dbReady || !pool) return;
  pool.query(
    'INSERT INTO questions (user_id, question, category, color, verdict, ts) VALUES ($1,$2,$3,$4,$5,$6)',
    [q.userId, q.question, q.category || null, q.color, q.verdict, q.ts]
  ).catch(e => console.error('[DB] saveQuestion:', e.message));
}

// ─── User helpers ──────────────────────────────────────────────────
function hydrate(userId) {
  const id = String(userId);
  if (!memUsers[id]) {
    memUsers[id] = { dailyCount: 0, lastReset: today(), premiumUntil: null, totalAsked: 0, lastSeen: null, freeBonus: 0, referredBy: null };
  }
  const u = memUsers[id];
  if (u.lastReset !== today()) { u.dailyCount = 0; u.lastReset = today(); }
  if (!u.freeBonus) u.freeBonus = 0;
  return { u, id };
}

// ─── Public API (синхронний — читає з пам'яті, пише в DB асинхронно) ─
function getStatus(userId) {
  const { u } = hydrate(userId);
  const isPremium = !!(u.premiumUntil && new Date(u.premiumUntil) > new Date());
  if (isPremium) return { canAsk: true, remaining: null, isPremium: true, premiumUntil: u.premiumUntil, dailyCount: u.dailyCount };
  const dailyLeft = Math.max(0, FREE_LIMIT - u.dailyCount);
  const bonusLeft = u.freeBonus || 0;
  const remaining = dailyLeft + bonusLeft;
  return { canAsk: remaining > 0, remaining, dailyLeft, bonusLeft, isPremium: false, premiumUntil: null, dailyCount: u.dailyCount, limit: FREE_LIMIT };
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

function getStats() {
  const todayStr = today();
  const now      = new Date();
  let totalUsers = 0, premiumUsers = 0, questionsToday = 0, totalQuestions = 0;
  for (const u of Object.values(memUsers)) {
    totalUsers++;
    if (u.premiumUntil && new Date(u.premiumUntil) > now) premiumUsers++;
    totalQuestions += (u.totalAsked || 0);
    if (u.lastReset === todayStr) questionsToday += (u.dailyCount || 0);
  }
  const hourAgo          = Date.now() - 3_600_000;
  const questionsLastHour = questionLog.filter(q => q.ts > hourAgo).length;
  return { totalUsers, premiumUsers, questionsToday, questionsLastHour, totalQuestions, loggedQuestions: questionLog.length, dbReady };
}

function getUsers() {
  const now = new Date();
  return Object.entries(memUsers).map(([id, u]) => ({
    userId:      id,
    totalAsked:  u.totalAsked  || 0,
    dailyCount:  u.dailyCount  || 0,
    freeBonus:   u.freeBonus   || 0,
    isPremium:   !!(u.premiumUntil && new Date(u.premiumUntil) > now),
    premiumUntil: u.premiumUntil || null,
    lastSeen:    u.lastSeen    || null,
  })).sort((a, b) => b.totalAsked - a.totalAsked);
}

function getQuestions(limit = 200) {
  return questionLog.slice(0, limit);
}

module.exports = { getStatus, increment, activatePremium, addBonus, applyReferral, logQuestion, getStats, getUsers, getQuestions };
