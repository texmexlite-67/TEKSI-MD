// ============================================
//  TEKSI-MD  •  TEKSI  —  Downloader helpers
// ============================================
// Providers (no mandatory API keys):
//   • YouTube  : Invidious API + its /latest_version proxy (fallback: yt-dlp / ffmpeg)
//   • TikTok   : tikwm public API
//   • Socials  : Cobalt (optional API key) + public page metadata fallback
//   • Direct   : any direct image / video / audio / file URL
//   • Movies   : Wikipedia metadata + poster (no piracy sources)
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const config = require('../config');

const UA = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const MAX_BYTES = (Number(config.downloadMaxMB) || 4096) * 1024 * 1024;
// Files above this size are streamed to a temp file instead of being held in RAM.
const STREAM_THRESHOLD_BYTES = 64 * 1024 * 1024;

function extractUrl(text) {
  const m = String(text || '').match(/https?:\/\/[^\s<>"'`]+/i);
  return m ? m[0].replace(/[),.;]+$/, '') : null;
}

function youtubeId(input) {
  const s = String(input || '').trim();
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/|m\.youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

function hasBinary(name) {
  const r = spawnSync(name, ['--version'], { encoding: 'utf8', timeout: 5000 });
  return !r.error && r.status === 0;
}

// ------------------------- Invidious (YouTube) -------------------------
let instanceCache = { at: 0, bases: [] };

async function invidiousBases() {
  const now = Date.now();
  if (instanceCache.bases.length && now - instanceCache.at < 10 * 60 * 1000) return instanceCache.bases;
  const bases = ['https://yt.chocolatemoo53.com']; // known-good fallback
  try {
    const { data } = await axios.get('https://api.invidious.io/instances.json?sort_by=health', {
      timeout: 12000, headers: { 'User-Agent': UA },
    });
    for (const [host, meta] of data || []) {
      if (meta && meta.api && meta.type === 'https') bases.push(`https://${host}`);
    }
  } catch { /* use the fallback list */ }
  for (const custom of config.invidiousInstances || []) if (custom) bases.unshift(custom.replace(/\/$/, ''));
  instanceCache = { at: now, bases: [...new Set(bases)] };
  return instanceCache.bases;
}

async function invidiousGet(apiPath) {
  let lastError;
  for (const base of await invidiousBases()) {
    try {
      const { data } = await axios.get(base + apiPath, { timeout: 15000, headers: { 'User-Agent': UA } });
      return { data, base };
    } catch (e) { lastError = e; }
  }
  throw new Error(lastError?.response?.status === 429 ? 'YouTube service is rate-limited. Try again shortly.' : 'YouTube service is unavailable right now.');
}

async function invidiousStream(base, id, itag) {
  const url = `${base}/latest_version?id=${encodeURIComponent(id)}&itag=${itag}&local=true`;
  return download(url, { headers: { 'User-Agent': UA } });
}

async function youtubeSearch(query) {
  const { data } = await invidiousGet(`/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance`);
  return (Array.isArray(data) ? data : [])
    .filter((v) => v.videoId || v.type === 'video')
    .slice(0, 8)
    .map((v) => ({
      id: v.videoId,
      title: v.title,
      author: v.author,
      seconds: v.lengthSeconds,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
    }));
}

async function youtubeAudio(input, caption) {
  const id = youtubeId(input);
  if (!id) throw new Error('Invalid YouTube link or video ID.');

  // Optional yt-dlp gives the highest quality audio when available.
  if (hasBinary('yt-dlp')) {
    try {
      const r = spawnSync('yt-dlp', ['-f', 'bestaudio[ext=m4a]/bestaudio', '-o', '-', '--no-warnings', '--quiet', `https://www.youtube.com/watch?v=${id}`], {
        encoding: 'buffer', maxBuffer: MAX_BYTES, timeout: 180000,
      });
      if (!r.error && r.status === 0 && r.stdout?.length) {
        return { buffer: r.stdout, mime: 'audio/mpeg', name: `${id}.mp3`, caption };
      }
    } catch { /* fall through to Invidious */ }
  }

  const { data, base } = await invidiousGet(`/api/v1/videos/${id}`);
  const audios = (data.adaptiveFormats || []).filter((f) => /^audio\//i.test(f.type || f.mimeType || ''));
  if (!audios.length) throw new Error('No audio stream found for that video.');
  audios.sort((a, b) => {
    const ap = /audio\/mp4/.test(a.type || '') ? 1 : 0;
    const bp = /audio\/mp4/.test(b.type || '') ? 1 : 0;
    return bp - ap || Number(b.bitrate || 0) - Number(a.bitrate || 0);
  });
  const chosen = audios[0];
  const stream = await invidiousStream(base, id, chosen.itag || '140');
  const mime = /^audio\//i.test(stream.mime) ? stream.mime : 'audio/mp4';
  const name = `${safeName(data.title || id)}.m4a`;
  const finalCaption = caption || `*${data.title || ''}*\n_${config.botName}_`;
  if (!stream.buffer) return { ...stream, mime, name, caption: finalCaption, title: data.title };
  return { buffer: stream.buffer, mime, name, caption: finalCaption, title: data.title };
}

async function youtubeVideo(input, caption) {
  const id = youtubeId(input);
  if (!id) throw new Error('Invalid YouTube link or video ID.');
  const { data, base } = await invidiousGet(`/api/v1/videos/${id}`);
  const videos = (data.adaptiveFormats || []).filter((f) => /^video\//i.test(f.type || f.mimeType || ''));
  const progressive = (data.formatStreams || []).find((f) => f.itag === 18 || f.itag === 22);
  // Leave room for the audio track when ffmpeg is available.
  const budget = MAX_BYTES * (hasBinary('ffmpeg') ? 0.6 : 0.9);
  const estimatedSize = (f) => {
    if (f.clen) return Number(f.clen);
    return (Number(f.bitrate || 0) * (Number(data.lengthSeconds) || 300)) / 8;
  };
  const ranked = videos
    .filter((f) => /video\/mp4/.test(f.type || ''))
    .filter((f) => estimatedSize(f) <= budget)
    .sort((a, b) => codecScore(b) - codecScore(a) || scoreQuality(b) - scoreQuality(a) || Number(b.bitrate || 0) - Number(a.bitrate || 0));
  const chosen = progressive || ranked[0];
  if (!chosen) throw new Error('No video stream found for that video.');

  const video = await invidiousStream(base, id, chosen.itag || '18');
  const mime = /^video\//i.test(video.mime) ? video.mime : 'video/mp4';
  const name = `${safeName(data.title || id)}.mp4`;
  let note = !progressive ? '\n_(video-only stream — install ffmpeg for sound)_' : '';
  const finalCaption = (caption || `*${data.title || ''}*\n_${config.botName}_`) + note;

  // Very large streams are already on disk — send them as-is.
  if (!video.buffer) return { ...video, mime, name, caption: finalCaption, title: data.title };

  // Merge audio + video when ffmpeg is present and both fit in memory.
  if (!progressive && hasBinary('ffmpeg') && video.buffer.length <= STREAM_THRESHOLD_BYTES) {
    try {
      const audio = (data.adaptiveFormats || [])
        .filter((f) => /audio\/mp4/.test(f.type || ''))
        .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
      if (audio) {
        const sound = await invidiousStream(base, id, audio.itag || '140');
        if (sound.buffer) {
          const merged = await mergeWithFfmpeg(video.buffer, sound.buffer);
          sound.cleanup?.();
          video.cleanup?.();
          return {
            buffer: merged,
            mime: 'video/mp4',
            name,
            caption: caption || `*${data.title || ''}*\n_${config.botName}_`,
            title: data.title,
          };
        }
        sound.cleanup?.();
      }
    } catch (e) { note = '\n_(audio merge failed: ' + e.message.slice(0, 60) + ')_'; }
  }

  return {
    ...video,
    mime,
    name,
    caption: (caption || `*${data.title || ''}*\n_${config.botName}_`) + note,
    title: data.title,
  };
}

function scoreQuality(format) {
  const label = String(format.qualityLabel || format.resolution || '');
  const n = parseInt(label, 10);
  return Number.isFinite(n) ? n : 0;
}

// Prefer widely-playable H.264 over AV1 / VP9.
function codecScore(format) {
  const type = String(format.type || '');
  if (/avc1|h264/i.test(type)) return 3;
  if (/av01/i.test(type)) return 2;
  if (/vp9/i.test(type)) return 1;
  return 0;
}

async function mergeWithFfmpeg(videoBuf, audioBuf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teksi-'));
  const v = path.join(dir, 'video.mp4');
  const a = path.join(dir, 'audio.m4a');
  const out = path.join(dir, 'out.mp4');
  try {
    fs.writeFileSync(v, videoBuf);
    fs.writeFileSync(a, audioBuf);
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', v, '-i', a, '-c', 'copy', '-shortest', out], {
      encoding: 'utf8', timeout: 180000, maxBuffer: 10 * 1024 * 1024,
    });
    if (r.error || r.status !== 0) throw new Error(r.stderr?.slice(0, 120) || 'ffmpeg failed');
    const merged = fs.readFileSync(out);
    if (merged.length > MAX_BYTES) throw new Error('Merged file is too large');
    return merged;
  } finally {
    for (const f of [v, a, out]) { try { fs.unlinkSync(f); } catch {} }
    try { fs.rmdirSync(dir); } catch {}
  }
}

// ------------------------- TikTok -------------------------
async function tiktok(url) {
  const { data } = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, { timeout: 30000, headers: { 'User-Agent': UA } });
  const info = data?.data;
  if (!info) throw new Error('Could not read that TikTok link.');
  const mediaUrl = info.hdplay || info.play || info.images?.[0] || info.music;
  if (!mediaUrl) throw new Error('No media found in that TikTok.');
  const isImage = !info.play && !!info.images?.length;
  const file = await download(mediaUrl);
  const author = info.author?.unique_id || info.author?.nickname || 'TikTok';
  return {
    ...file,
    caption: `*${String(info.title || '').slice(0, 200)}*\nby @${author}\n_${config.botName}_`,
    image: isImage ? true : undefined,
  };
}

// ------------------------- Cobalt (IG / FB / others) -------------------------
async function cobalt(url) {
  const key = config.cobaltApiKey || process.env.COBALT_API_KEY;
  if (!key) throw new Error('No Cobalt API key configured. Add cobaltApiKey to config.js (or set COBALT_API_KEY).');
  const base = (config.cobaltInstance || 'https://api.cobalt.tools').replace(/\/$/, '');
  const { data } = await axios.post(`${base}/`, {
    url,
    videoQuality: '720',
    downloadMode: 'auto',
  }, {
    timeout: 60000,
    headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  });
  const picked = data?.picker?.find?.((p) => p.type === 'video' || p.type === 'photo') || data?.picker?.[0];
  const mediaUrl = data?.url || picked?.url || data?.tunnel;
  if (!mediaUrl) throw new Error(data?.error?.code || 'Cobalt could not fetch that link.');
  const file = await download(mediaUrl);
  return { ...file, caption: `*${config.botName}*\n_${new URL(url).hostname}_` };
}

// Public metadata fallback (works for many public Instagram/Facebook posts).
async function pageMedia(url) {
  const { data } = await axios.get(`https://r.jina.ai/${url}`, { timeout: 45000, headers: { 'User-Agent': UA } });
  const text = String(data || '');
  const candidates = text.match(/https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp|mp4)(?:\?[^\s)]*)?/gi) || [];
  if (!candidates.length) throw new Error('Could not extract media from that link.');
  const mediaUrl = candidates[0].replace(/\\/g, '');
  const file = await download(mediaUrl);
  return { ...file, caption: `*${config.botName}*\n_${new URL(url).hostname}_` };
}

async function facebookOrInstagram(url) {
  try { return await cobalt(url); } catch (e) {
    try { return await pageMedia(url); } catch { throw new Error('Could not download from ' + new URL(url).hostname + '. Set a Cobalt API key in config.js for reliable results.'); }
  }
}

// ------------------------- Mediafire / direct files -------------------------
async function mediafire(url) {
  try {
    const { data } = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': UA } });
    const html = String(data);
    const m = html.match(/https?:\\?\/\\?\/download[^"' ]+mediafire\.com[^"' ]+/i)
      || html.match(/https?:\/\/download[^"' ]+mediafire\.com[^"' ]+/i);
    if (m) return await download(m[0].replace(/\\\//g, '/'));
  } catch { /* fall through to direct download */ }
  return await download(url);
}

function fileNameFrom(headers, url) {
  const disp = headers['content-disposition'];
  if (disp) {
    const m = disp.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)/i);
    if (m) {
      try { return safeName(decodeURIComponent(m[1])) || 'download'; } catch {}
    }
  }
  try { return safeName(decodeURIComponent(path.basename(new URL(url).pathname))) || 'download'; } catch {}
  return 'download';
}

// Always write to disk first, then keep small files in memory.
async function streamToFile(url, opts = {}) {
  const res = await axios.get(url, {
    responseType: 'stream',
    timeout: 0,
    headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    maxContentLength: MAX_BYTES,
    maxBodyLength: MAX_BYTES,
  });
  const mime = res.headers['content-type'] || 'application/octet-stream';
  const name = fileNameFrom(res.headers, url);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teksi-dl-'));
  const target = path.join(dir, name);
  let size = 0;

  try {
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(target);
      res.data.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          res.data.destroy();
          out.destroy();
          reject(new Error(`File exceeds the ${config.downloadMaxMB} MB limit.`));
        }
      });
      res.data.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      res.data.pipe(out);
    });
  } catch (e) {
    cleanupTemp(target, dir);
    throw e;
  }

  return {
    path: target,
    mime,
    name,
    size,
    stream: () => fs.createReadStream(target),
    cleanup: () => cleanupTemp(target, dir),
  };
}

function cleanupTemp(target, dir) {
  try { fs.unlinkSync(target); } catch {}
  try { fs.rmdirSync(dir); } catch {}
}

async function download(url, opts = {}) {
  const file = await streamToFile(url, opts);
  if (file.size <= STREAM_THRESHOLD_BYTES) {
    const buffer = fs.readFileSync(file.path);
    file.cleanup();
    return { buffer, mime: file.mime, name: file.name, size: file.size };
  }
  return { ...file, buffer: null };
}

// ------------------------- Movies (metadata only) -------------------------
async function movieInfo(title) {
  // Preferred: REST summary includes a poster thumbnail.
  try {
    const { data } = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { timeout: 20000, headers: { 'User-Agent': UA } }
    );
    if (data?.title && data?.type !== 'disambiguation') {
      return {
        title: data.title,
        extract: String(data.extract || '').slice(0, 900),
        poster: data.thumbnail?.source || data.originalimage?.source,
        wikipedia: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title.replace(/ /g, '_'))}`,
        search: `https://www.youtube.com/results?search_query=${encodeURIComponent(data.title + ' official trailer')}`,
      };
    }
  } catch { /* fall back to the action API */ }

  const { data } = await axios.get('https://en.wikipedia.org/w/api.php', {
    timeout: 20000,
    params: {
      action: 'query', prop: 'extracts|pageimages', exintro: 1, explaintext: 1,
      piprop: 'thumbnail', pithumbsize: 800, format: 'json', redirects: 1, titles: title,
    },
    headers: { 'User-Agent': UA },
  });
  const page = Object.values(data?.query?.pages || {})[0];
  if (!page || page.missing !== undefined) throw new Error(`No movie found for "${title}".`);
  return {
    title: page.title,
    extract: String(page.extract || '').slice(0, 900),
    poster: page.thumbnail?.source,
    wikipedia: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    search: `https://www.youtube.com/results?search_query=${encodeURIComponent(page.title + ' official trailer')}`,
  };
}

function safeName(name) {
  return String(name || 'download').replace(/[^\w\-() ]+/g, '_').slice(0, 60);
}

// Turn a downloaded file into a WhatsApp message payload.
// Large files are passed as readable streams so 4 GB files do not fill RAM.
function payload(file, caption) {
  const source = file.buffer || (file.stream ? file.stream() : file.path);
  const mime = String(file.mime || '').split(';')[0].trim().toLowerCase();
  if (mime.startsWith('image/')) return { image: source, caption: caption || '' };
  if (mime.startsWith('video/')) return { video: source, mimetype: mime, caption: caption || '' };
  if (mime.startsWith('audio/')) return { audio: source, mimetype: mime, ptt: false };
  return { document: source, fileName: file.name || 'download.bin', mimetype: mime || 'application/octet-stream', caption: caption || '' };
}

module.exports = {
  extractUrl, youtubeId, youtubeSearch, youtubeAudio, youtubeVideo,
  tiktok, cobalt, facebookOrInstagram, mediafire, download, movieInfo, payload,
  hasBinary, MAX_BYTES,
};
