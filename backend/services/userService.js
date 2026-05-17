'use strict';
const fs   = require('fs');
const path = require('path');

const STORAGE_DIR  = path.join(__dirname, '../storage');
const FILE         = path.join(STORAGE_DIR, 'users.json');
const Q_FILE       = path.join(STORAGE_DIR, 'questions.json');
const FREE_LIMIT   = 2;
const Q_MAX        = 1000;

let memStore   = {};
let questionLog = [];
let useFile    = true;

try {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
} catch { useFile = false; }

// load questions log on startup
try {
  if (useFile && fs.existsSync(Q_FILE)) {
    questionLog = JSON.parse(fs.readFileSync(Q_FILE, 'utf8'));
  }
} catch {}

function load() {
  if (!useFile) return { ...memStore };
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return {}; }
}

function save(data) {
  memStore = { ...data };
  if (!useFile) return;
  try { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
  catch { useFile = false; }
}

function saveQuestions() {
  if (!useFile) return;
  try { fs.writeFileSync(Q_FILE, JSON.stringify(questionLog)); }
  catch {}
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hydrate(userId) {
  const users = load();
  const id    = String(userId);
  if (!users[id]) {
    users[id] = { dailyCount: 0, lastReset: today(), premiumUntil: null, totalAsked: 0, lastSeen: null };
  }
  const u = users[id];
  if (u.lastReset !== today()) {
    u.dailyCount = 0;
    u.lastReset  = today();
  }
  users[id] = u;
  save(users);
  return { users, u, id };
}

function getStatus(userId) {
  const { u } = hydrate(userId);
  const isPremium = !!(u.premiumUntil && new Date(u.premiumUntil) > new Date());
  if (isPremium) {
    return { canAsk: true, remaining: null, isPremium: true, premiumUntil: u.premiumUntil, dailyCount: u.dailyCount };
  }
  const remaining = Math.max(0, FREE_LIMIT - u.dailyCount);
  return { canAsk: remaining > 0, remaining, isPremium: false, premiumUntil: null, dailyCount: u.dailyCount, limit: FREE_LIMIT };
}

function increment(userId) {
  const { users, u, id } = hydrate(userId);
  u.dailyCount = (u.dailyCount || 0) + 1;
  u.totalAsked = (u.totalAsked || 0) + 1;
  u.lastSeen   = Date.now();
  users[id] = u;
  save(users);
}

function activatePremium(userId, days = 30) {
  const { users, u, id } = hydrate(userId);
  const now  = new Date();
  const base = u.premiumUntil && new Date(u.premiumUntil) > now ? new Date(u.premiumUntil) : now;
  base.setDate(base.getDate() + days);
  u.premiumUntil = base.toISOString();
  users[id] = u;
  save(users);
  return u.premiumUntil;
}

function logQuestion(userId, question, answer) {
  questionLog.unshift({
    userId: userId ? String(userId) : 'guest',
    question,
    color:  answer.color,
    verdict: answer.verdict,
    ts: Date.now(),
  });
  if (questionLog.length > Q_MAX) questionLog.length = Q_MAX;
  saveQuestions();
}

function getStats() {
  const users   = load();
  const todayStr = today();
  const now     = new Date();
  let totalUsers = 0, premiumUsers = 0, questionsToday = 0, totalQuestions = 0;

  for (const u of Object.values(users)) {
    totalUsers++;
    if (u.premiumUntil && new Date(u.premiumUntil) > now) premiumUsers++;
    totalQuestions += (u.totalAsked || 0);
    if (u.lastReset === todayStr) questionsToday += (u.dailyCount || 0);
  }

  const hourAgo = Date.now() - 3600_000;
  const questionsLastHour = questionLog.filter(q => q.ts > hourAgo).length;

  return { totalUsers, premiumUsers, questionsToday, questionsLastHour, totalQuestions, loggedQuestions: questionLog.length };
}

function getUsers() {
  const users = load();
  const now   = new Date();
  return Object.entries(users).map(([id, u]) => ({
    userId:      id,
    totalAsked:  u.totalAsked  || 0,
    dailyCount:  u.dailyCount  || 0,
    isPremium:   !!(u.premiumUntil && new Date(u.premiumUntil) > now),
    premiumUntil: u.premiumUntil || null,
    lastSeen:    u.lastSeen    || null,
  })).sort((a, b) => b.totalAsked - a.totalAsked);
}

function getQuestions(limit = 200) {
  return questionLog.slice(0, limit);
}

module.exports = { getStatus, increment, activatePremium, logQuestion, getStats, getUsers, getQuestions };
