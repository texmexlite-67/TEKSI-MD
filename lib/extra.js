// ============================================
//  TEKSI-MD  •  TEKSI  —  Extra web tools + fun
//  All endpoints are free / no API key required
// ============================================
const axios = require('axios');
const crypto = require('crypto');
const { random, sleep } = require('./utils');

const UA = 'TEKSI-MD/1.0 (WhatsApp bot; https://github.com/texmexlite-67/TEKSI-MD; contact: teksi@example.com)';
async function get(url, opts = {}) {
  const config = {
    timeout: 20000,
    headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    ...opts,
  };
  try {
    return await axios.get(url, config);
  } catch (e) {
    // Public endpoints occasionally rate-limit — retry once.
    if ([403, 429, 503].includes(e.response?.status) || e.code === 'ECONNABORTED') {
      await sleep(900);
      return axios.get(url, config);
    }
    throw e;
  }
}

// ------------------------------- TOOLS -------------------------------
async function ipInfo() {
  try {
    const { data } = await get('https://ipapi.co/json/');
    return {
      ip: data.ip,
      city: data.city,
      region: data.region,
      country: data.country_name,
      isp: data.org,
      timezone: data.timezone,
    };
  } catch {
    const { data } = await get('https://api.ipify.org?format=json');
    return { ip: data.ip };
  }
}

async function whois(domain) {
  const host = String(domain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!host) throw new Error('Usage: .whois <domain>  (e.g. .whois example.com)');
  const { data } = await get(`https://rdap.org/domain/${encodeURIComponent(host)}`, { timeout: 25000 });
  const events = data.events || [];
  const date = (action) => events.find((e) => e.eventAction === action)?.eventDate || '';
  const nameservers = (data.nameservers || []).map((n) => n.ldhName).filter(Boolean);
  const emails = (data.entities || [])
    .flatMap((e) => (e.vcardArray || [])[1] || [])
    .filter((v) => v[0] === 'email')
    .map((v) => v[3]);
  return {
    domain: data.ldhName || host,
    registrar: data.entities?.[0]?.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3] || 'Unknown',
    created: date('registration'),
    updated: date('last changed'),
    expires: date('expiration'),
    status: (data.status || []).slice(0, 6),
    nameservers: nameservers.slice(0, 6),
    emails: [...new Set(emails)].slice(0, 3),
  };
}

async function extractWeb(url) {
  const clean = String(url || '').trim();
  if (!clean) throw new Error('Usage: .extractweb <url>');
  try {
    const { data } = await get(`https://r.jina.ai/${clean}`, { timeout: 45000, responseType: 'text' });
    const text = String(data || '').replace(/\n{3,}/g, '\n\n').slice(0, 6000);
    if (text.trim()) return text;
  } catch {}
  // Fallback: fetch the page directly and strip the markup.
  const { data } = await get(clean, { timeout: 30000, responseType: 'text' });
  const text = String(data || '')
    .replace(/<(script|style|nav|footer)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 6000);
  if (!text.trim()) throw new Error('No readable content found at that URL.');
  return text;
}

function encode64(text) {
  return Buffer.from(String(text || '')).toString('base64');
}

function decode64(text) {
  return Buffer.from(String(text || '').trim(), 'base64').toString('utf8');
}

function uuid() {
  return crypto.randomUUID();
}

async function shortlink(url) {
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) throw new Error('Usage: .shortlink <https://url>');
  const { data } = await get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(target)}`, { responseType: 'text' });
  return String(data).trim();
}

function hash(text, algo = 'sha256') {
  const name = String(algo || 'sha256').toLowerCase().replace(/[^a-z0-9]/g, '');
  const supported = crypto.getHashes();
  const chosen = supported.includes(name) ? name : 'sha256';
  const value = String(text || '');
  return {
    algo: chosen,
    hex: crypto.createHash(chosen).update(value).digest('hex'),
    base64: crypto.createHash(chosen).update(value).digest('base64'),
  };
}

// ------------------------------- STUDENT LAB -------------------------------
async function dictionary(word) {
  const q = String(word || '').trim();
  if (!q) throw new Error('Usage: .dictionary <word>');
  const { data } = await get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`);
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry) throw new Error(`No definition found for "${q}".`);
  const meanings = (entry.meanings || []).slice(0, 3).map((m) => {
    const defs = (m.definitions || []).slice(0, 2).map((d) => `• ${d.definition}${d.example ? `\n  _"${d.example}"_` : ''}`).join('\n');
    return `*${m.partOfSpeech}*\n${defs}`;
  }).join('\n\n');
  const phonetic = entry.phonetics?.find((p) => p.text)?.text || '';
  return { word: entry.word, phonetic, meanings };
}

async function wiki(query) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Usage: .wiki <topic>');
  const page = q.replace(/ /g, '_');
  try {
    const { data } = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`, { timeout: 25000 });
    if (data.type === 'disambiguation') throw new Error('That topic is ambiguous — try a more specific search.');
    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page)}`,
      thumbnail: data.thumbnail?.source || data.originalimage?.source || null,
    };
  } catch {
    // REST endpoint sometimes rate-limits — fall back to the action API.
    const { data } = await get(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(q)}`, { timeout: 25000 });
    const hit = Object.values(data?.query?.pages || {})[0];
    if (!hit || hit.missing != null) throw new Error('No Wikipedia article found for that topic.');
    return {
      title: hit.title,
      extract: String(hit.extract || '').slice(0, 2000),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent((hit.title || q).replace(/ /g, '_'))}`,
      thumbnail: null,
    };
  }
}

// ------------------------------- AI EXTRAS -------------------------------
async function currency(amount, from, to) {
  const { data } = await get(`https://open.er-api.com/v6/latest/${encodeURIComponent(String(from || 'USD').toUpperCase())}`);
  if (data.result !== 'success') throw new Error('Currency lookup failed.');
  const base = String(from || 'USD').toUpperCase();
  const target = String(to || 'KES').toUpperCase();
  const rate = data.rates?.[target];
  if (!rate) throw new Error(`Unknown currency: ${target}`);
  const value = Number(amount) || 1;
  return { base, target, rate, result: value * rate };
}

const COINS = {
  bitcoin: 'Bitcoin (BTC)', ethereum: 'Ethereum (ETH)', solana: 'Solana (SOL)',
  ripple: 'XRP', dogecoin: 'Dogecoin (DOGE)', cardano: 'Cardano (ADA)',
  binancecoin: 'BNB', polkadot: 'Polkadot (DOT)', litecoin: 'Litecoin (LTC)',
  tether: 'Tether (USDT)', usdcoin: 'USD Coin (USDC)', tron: 'TRON (TRX)',
};

async function cryptoPrices(symbol = 'bitcoin,ethereum,solana,dogecoin') {
  const q = String(symbol || '').trim().toLowerCase();
  const ids = COINS[q] ? q : q.includes(',') ? q.split(',').map((s) => s.trim()).filter((s) => COINS[s]).join(',') : 'bitcoin,ethereum,solana,dogecoin';
  const idList = ids || 'bitcoin,ethereum,solana,dogecoin';
  const { data } = await get(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(idList)}&vs_currencies=usd&include_24hr_change=true`, { timeout: 25000 });
  const rows = Object.entries(data).map(([id, v]) =>
    `• *${COINS[id] || id}*: $${Number(v.usd).toLocaleString()}${v.usd_24h_change != null ? ` (${v.usd_24h_change >= 0 ? '+' : ''}${v.usd_24h_change.toFixed(2)}%)` : ''}`
  );
  if (!rows.length) throw new Error('No crypto prices found.');
  return rows.join('\n');
}

// ------------------------------- FUN -------------------------------
async function meme() {
  const { data } = await get('https://meme-api.com/gimme');
  return { title: data.title, url: data.url, link: data.postLink || 'https://www.reddit.com/r/memes' };
}

async function fact() {
  const { data } = await get('https://uselessfacts.jsph.pl/random.json?language=en');
  return data.text;
}

async function advice() {
  const { data } = await get('https://api.adviceslip.com/advice');
  return data.slip?.advice;
}

async function truth() {
  const { data } = await get('https://api.truthordarebot.xyz/v1/truth');
  return data.question;
}

async function dare() {
  const { data } = await get('https://api.truthordarebot.xyz/v1/dare');
  return data.question;
}

async function roast() {
  const { data } = await get('https://insult.mattbas.org/api/insult.json');
  return data.insult || data.insult_text || 'You are the reason instructions have warnings.';
}

const PICKUPS = [
  'Are you a magician? Because every time I look at you, everyone else disappears.',
  'Do you have a map? I keep getting lost in your eyes.',
  'If you were a vegetable, you would be a cute-cumber.',
  'I must be a snowflake, because I have fallen for you.',
  'You must be made of copper and tellurium, because you are Cu-Te.',
  'Are you a camera? Because every time I look at you, I smile.',
  'I would tell you a chemistry joke, but I know I would not get a reaction.',
  'You are the reason I check my phone every five minutes.',
];

const COMPLIMENTS = [
  'Your smile could power a small village.',
  'You have the kind of energy that makes rooms brighter.',
  'Your brain is clearly running premium software.',
  'You make even ordinary days feel interesting.',
  'Your style is unapologetically you — and it works.',
  'If confidence were a currency, you would be a millionaire.',
];

const EMOJIS = ['😀', '😎', '🥰', '🔥', '✨', '🍕', '🐱', '🌈', '🚀', '🎩', '👑', '🍀', '🌊', '🎵', '🧠', '🦄', '🍩', '⚡'];
const PREFIXES = ['mood:', 'vibes:', 'rate:', 'energy:', 'status:'];

function pickup() { return random(PICKUPS); }
function compliment() { return random(COMPLIMENTS); }
function flip() { return random(['HEADS', 'TAILS']); }
function roll(sides = 6) {
  const n = Math.min(Math.max(Number(sides) || 6, 2), 1000);
  return { value: Math.floor(Math.random() * n) + 1, sides: n };
}
function emojimix() { return `${random(EMOJIS)} ${random(EMOJIS)} ${random(PREFIXES)} ${Math.floor(Math.random() * 100)}%`; }
function scoreFor(a, b, algo) {
  const hex = crypto.createHash(algo).update(`${String(a).toLowerCase()}:${String(b).toLowerCase()}`).digest('hex');
  return (parseInt(hex.slice(0, 8), 16) % 100) + 1;
}
function ship(a, b) {
  if (!a || !b) throw new Error('Usage: .ship <name1> <name2>');
  return { a, b, score: scoreFor(a, b, 'sha256') };
}
function lovemeter(a, b) {
  return { a: a || 'You', b: b || 'Them', score: scoreFor(a || 'you', b || 'them', 'md5') };
}
function aura() {
  const levels = [
    ['✨ THIN', 'Barely visible. Keep going.'],
    ['🌱 GROWING', 'Your aura is blooming nicely.'],
    ['🔥 BLAZING', 'People can feel your energy from across the room.'],
    ['👑 LEGENDARY', 'Your aura has its own fan club.'],
  ];
  return random(levels);
}
function king() {
  const lines = [
    '👑 You are the king of good decisions today.',
    '👑 The crown fits — you are ruling this chat.',
    '👑 Royal status: approved. Cowards bow.',
    '👑 You have the energy of a monarch with zero meetings.',
  ];
  return random(lines);
}

module.exports = {
  ipInfo, whois, extractWeb, encode64, decode64, uuid, shortlink, hash,
  dictionary, wiki, currency, crypto: cryptoPrices,
  meme, fact, advice, truth, dare, roast,
  pickup, compliment, flip, roll, emojimix, ship, lovemeter, aura, king,
};
