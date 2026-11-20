// ============================================
//  TEKSI-MD  •  TEKSI  —  Image / DP commands (LAB)
//  Free, key-free image APIs
// ============================================
const axios = require('axios');
const sharp = require('./sharp');
const dl = require('./downloader');
const { random } = require('./utils');

const UA = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const jsonGet = (url) => axios.get(url, { timeout: 20000, headers: { 'User-Agent': UA } });

async function imageFrom(url, label) {
  const file = await dl.download(url, { headers: { 'User-Agent': UA } });
  file.mime = String(file.mime || 'image/jpeg').split(';')[0];
  file.name = `${label}.${file.mime.includes('png') ? 'png' : 'jpg'}`;
  return file;
}

async function wallpaper() {
  try {
    const { data } = await jsonGet('https://wallhaven.cc/api/v1/search?categories=100&purity=100&sorting=random');
    const pick = random(data?.data || []);
    if (pick?.path) return imageFrom(pick.path, 'wallpaper');
  } catch {}
  // Fallback: Lorem Picsum always returns a real photo.
  const seed = Math.floor(Math.random() * 1000);
  return imageFrom(`https://picsum.photos/seed/${seed}/1080/1920`, 'wallpaper');
}

async function cat() {
  const { data } = await jsonGet('https://api.thecatapi.com/v1/images/search');
  if (!data?.[0]?.url) throw new Error('Cat image API returned nothing.');
  return imageFrom(data[0].url, 'cat');
}

async function dog() {
  const { data } = await jsonGet('https://api.thedogapi.com/v1/images/search');
  if (!data?.[0]?.url) throw new Error('Dog image API returned nothing.');
  return imageFrom(data[0].url, 'dog');
}

async function neko(kind = 'waifu') {
  const { data } = await jsonGet(`https://nekos.best/api/v2/${kind}`);
  const pick = random(data?.results || []);
  if (!pick?.url) throw new Error(`No ${kind} image found.`);
  const file = await imageFrom(pick.url, kind);
  file.caption = `*${kind === 'neko' ? 'Neko' : 'Anime Girl'} DP*\n_by ${pick.artist_name || 'unknown'}_\n${pick.source_url || ''}`;
  return file;
}

function girlDp() { return neko('waifu'); }
function animeDp() { return neko('neko'); }

async function randomDp() {
  const options = [cat, dog, girlDp, animeDp];
  return random(options)();
}

async function coupleDp() {
  const [one, two] = await Promise.all([girlDp(), girlDp()]);
  const size = 500;
  const left = await sharp(one.buffer || one.path).resize(size, size, { fit: 'cover' }).toBuffer();
  const right = await sharp(two.buffer || two.path).resize(size, size, { fit: 'cover' }).toBuffer();
  const joined = await sharp({
    create: { width: size * 2, height: size, channels: 3, background: '#101010' },
  }).composite([
    { input: left, left: 0, top: 0 },
    { input: right, left: size, top: 0 },
  ]).jpeg({ quality: 88 }).toBuffer();
  one.cleanup?.();
  two.cleanup?.();
  return { buffer: joined, mime: 'image/jpeg', name: 'couple-dp.jpg', caption: '*COUPLE DP* 💞' };
}

module.exports = { wallpaper, cat, dog, girlDp, animeDp, randomDp, coupleDp };
