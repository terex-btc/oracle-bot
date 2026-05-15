'use strict';
const fs   = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../storage');
const FILE        = path.join(STORAGE_DIR, 'users.json');
const FREE_LIMIT  = 2;

// In-memory fallback if filesystem not writable (Railway ephemeral FS)
let memStore = {};
let useFile  = true;

try {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
} catch { useFile = false; }

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hydrate(userId) {
  const users = load();
  const id    = String(userId);
  if (!users[id]) {
    users[id] = { dailyCount: 0, lastReset: today(), premiumUntil: null, totalAsked: 0 };
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
  u.dailyCount   += 1;
  u.totalAsked    = (u.totalAsked || 0) + 1;
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

module.exports = { getStatus, increment, activatePremium };
