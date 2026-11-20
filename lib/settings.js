// ============================================
//  TEKSI-MD  •  TEKSI  —  Persistent bot settings
// ============================================
// Settings are stored in data/settings.json so they survive restarts.
// WhatsApp login files stay in session/ and are never touched here.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'settings.json');

const GLOBAL_DEFAULTS = {
  anticall: true,          // reject incoming calls
  antistatus: false,       // notify groups when a member posts a status
  antistatusMention: false,// mention the member in that notification
  antilink: 'off',         // used in private chats (off | warn | delete)
};

const GROUP_DEFAULTS = {
  antilink: 'off',         // off | warn | delete
  antispam: false,         // delete burst spam
  welcome: true,           // welcome new members
  goodbye: false,          // notify when a member leaves
  muted: false,            // chat muted for this bot
  pinned: false,           // chat pinned for this bot
};

let cache = null;

function defaults() {
  return { global: { ...GLOBAL_DEFAULTS }, groups: {} };
}

function load() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    cache = {
      global: { ...GLOBAL_DEFAULTS, ...(parsed.global || {}) },
      groups: parsed.groups && typeof parsed.groups === 'object' ? parsed.groups : {},
    };
  } catch {
    cache = defaults();
  }
  return cache;
}

function save() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(load(), null, 2), 'utf8');
  } catch (e) {
    console.error('[TEKSI-MD] Could not save settings:', e.message);
  }
}

function getGlobal(key, fallback) {
  const value = load().global[key];
  return value === undefined ? fallback : value;
}

function setGlobal(key, value) {
  load().global[key] = value;
  save();
  return value;
}

function toggleGlobal(key) {
  return setGlobal(key, !getGlobal(key, false));
}

function getGroup(jid) {
  return { ...GROUP_DEFAULTS, ...(load().groups[jid] || {}) };
}

function setGroup(jid, patch) {
  const db = load();
  db.groups[jid] = { ...getGroup(jid), ...patch };
  save();
  return db.groups[jid];
}

function toggleGroup(jid, key) {
  return setGroup(jid, { [key]: !getGroup(jid)[key] })[key];
}

// off -> warn -> delete -> off
function cycleAntilink(jid) {
  const order = ['off', 'warn', 'delete'];
  const current = getGroup(jid).antilink;
  const next = order[(order.indexOf(current) + 1) % order.length];
  setGroup(jid, { antilink: next });
  return next;
}

function groupJids() {
  return Object.keys(load().groups);
}

function statusText(jid) {
  const g = getGroup(jid);
  const on = (v) => v ? 'ON' : 'OFF';
  const antilink = g.antilink === 'delete' ? 'DELETE' : g.antilink === 'warn' ? 'WARN' : 'OFF';
  return [
    `*╭──「 ${configBotName()} CONTROLLER 」──*`,
    `*│* 🔗 Antilink   : *${antilink}*`,
    `*│* 🛡 Antispam   : *${on(g.antispam)}*`,
    `*│* 📞 Anticall   : *${on(getGlobal('anticall', true))}*`,
    `*│* 📸 Antistatus : *${on(getGlobal('antistatus', false))}*`,
    `*│* 🧷 S. mention : *${on(getGlobal('antistatusMention', false))}*`,
    `*│* 👋 Welcome    : *${on(g.welcome)}*`,
    `*│* 👋 Goodbye    : *${on(g.goodbye)}*`,
    `*│* 🔇 Chat mute  : *${on(g.muted)}*`,
    `*│* 📌 Chat pin   : *${on(g.pinned)}*`,
    `*╰──────────────────────────*`,
    '_Tap a button below to change a setting._',
  ].join('\n');
}

// Avoid a circular require with config.js — read the name lazily.
function configBotName() {
  try { return require('../config').botName; } catch { return 'TEKSI-MD'; }
}

function resetGroup(jid) {
  const db = load();
  delete db.groups[jid];
  save();
}

module.exports = {
  getGlobal, setGlobal, toggleGlobal,
  getGroup, setGroup, toggleGroup, cycleAntilink,
  groupJids, statusText, resetGroup,
  GLOBAL_DEFAULTS, GROUP_DEFAULTS,
};
