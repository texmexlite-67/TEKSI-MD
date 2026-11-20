// ============================================
//  TEKSI-MD  •  TEKSI  —  Commands & Group Controller
// ============================================
const axios = require('axios');
const config = require('../config');
const settings = require('../lib/settings');
const dl = require('../lib/downloader');
const { setBotProfilePicture } = require('../lib/profile');
const { formatUptime, getGreeting, getDateTime, random, normalizeNumber } = require('../lib/utils');
const { imageToSticker, textToSticker } = require('../lib/sticker');
const { askAI, generateImage, MODEL_LABELS } = require('../lib/ai');
const extra = require('../lib/extra');
const docs = require('../lib/docs');
const images = require('../lib/images');
const audio = require('../lib/audio');

const startTime = Date.now();

// Multi-step converters: .pdfmerge / .img2pdf accept several quoted files.
const pendingFiles = new Map();
function pendingFor(sender) {
  const key = String(sender || 'unknown');
  const entry = pendingFiles.get(key);
  if (entry && Date.now() - entry.ts > 5 * 60 * 1000) pendingFiles.delete(key);
  return pendingFiles.get(key);
}

const QUOTES = [
  'The best way to predict the future is to create it.',
  'Simplicity is the soul of efficiency.',
  'Stay hungry, stay foolish.',
  'Code is like humor. When you have to explain it, it\'s bad.',
  'First, solve the problem. Then, write the code.',
  'TEKSI-MD — built to work for you, every day.',
];

const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'I told my computer I needed a break, and now it won\'t stop sending me KitKat ads.',
  'Why did the developer go broke? He used up all his cache.',
  'There are only 10 types of people: those who understand binary and those who don\'t.',
];

// ------------------------------- helpers -------------------------------
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const digits = (s) => String(s || '').replace(/[^0-9]/g, '');
const jidOf = (num) => `${num}@s.whatsapp.net`;
const targetOf = (q) => q?.participant || q?.key?.participant || q?.key?.remoteJid;
const uniqueJids = (arr) => [...new Set((arr || []).filter(Boolean))];

async function react(sock, msg, emoji) {
  await sock.sendMessage(msg.key.remoteJid, { react: { key: msg.key, text: emoji } }).catch(() => {});
}

async function isGroupAdmin(sock, jid, participant) {
  const meta = await sock.groupMetadata(jid).catch(() => null);
  const p = meta?.participants?.find((x) => x.id === participant);
  return !!p?.admin;
}

const ALL_COMMANDS = [
  // MAIN
  'menu', 'ping', 'runtime', 'speed', 'owner', 'info',
  // STUDENT LAB
  'pdfunlock', 'zipunlock', 'ziplock', 'txttofile', 'pdfmerge', 'pdfmergedone',
  'pdf2img', 'compress', 'filetotxt', 'dictionary', 'wiki', 'img2pdf', 'img2pdfdone', 'pdflock',
  // TOOLS
  'ip', 'whois', 'extractweb', 'base64', 'decode64', 'uuid', 'shortlink', 'hash',
  'sticker', 'toimg', 'attp', 'calc', 'translate', 'weather',
  // LAB
  'wallpaper', 'cat', 'dog', 'girldp', 'animedp', 'randomdp', 'coupledp',
  // AI
  'gpt', 'gpt1', 'gpt2', 'gpt3', 'gpt4', 'imagine', 'ask', 'gemini', 'ai',
  'currency', 'crypto',
  // FUN
  'meme', 'fact', 'ship', 'aura', 'advice', 'pickup', 'roast', 'roll',
  'lovemeter', 'truth', 'dare', 'compliment', 'flip', 'emojimix', 'king',
  'quote', 'joke',
  // DOWNLOAD
  'play', 'ytmp3', 'ytvideo', 'tiktok', 'instagram', 'facebook',
  'mediafire', 'image', 'video', 'dl', 'movie',
  // GROUP
  'listadmin', 'setwelcome', 'setgoodbye', 'poll', 'announce', 'warn',
  // GROUP CONTROLLER
  'control', 'gclink', 'invite', 'tagall', 'hidetag', 'admins',
  'chatmute', 'chatunmute', 'pin', 'unpin', 'kick', 'add',
  'promote', 'demote', 'open', 'close', 'lock', 'unlock',
  'gprofile', 'gabout', 'groupname', 'gstatus', 'groupinfo', 'revoke',
  'welcome', 'goodbye',
  // GROUP GUARDS
  'antilink', 'antispam', 'anticall', 'antistatus', 'antistatusmention',
  // AUDIO EDIT TOOLS
  'tomp3', 'to8daudio', 'tobass', 'toslowed',
  // OWNER
  'self', 'public', 'restart', 'eval', 'setdp',
];

function countCommands() {
  return ALL_COMMANDS.length;
}

function buildMenu(pushName) {
  const { date, time } = getDateTime();
  const p = config.prefix;
  const uptime = formatUptime((Date.now() - startTime) / 1000);
  const mode = config.selfMode ? 'Self (Owner Only)' : 'Public';
  const cmdCount = countCommands();

  const lines = [];
  lines.push(`╭┈───〔 ${config.botName} 〕┈───⊷`);
  lines.push(`├✦ Owner: ${config.ownerName} @${config.ownerNumber}`);
  lines.push(`├✦ Commands: ${cmdCount}`);
  lines.push(`├✦ Runtime: ${uptime}`);
  lines.push(`├✦ Prefix: ${p}`);
  lines.push(`├✦ Mode: ${mode}`);
  lines.push(`├✦ Version: ${config.botVersion} Beta`);
  lines.push(`╰─────────────────────⊷`);
  lines.push('');
  lines.push('『 MAIN 』');
  lines.push(`${p}menu • ${p}ping • ${p}runtime • ${p}speed • ${p}owner • ${p}info`);
  lines.push('');
  lines.push('『 STUDENT LAB 』');
  lines.push(`${p}pdfunlock • ${p}zipunlock • ${p}ziplock • ${p}txttofile • ${p}pdfmerge`);
  lines.push(`${p}pdf2img • ${p}calc • ${p}compress • ${p}filetotxt • ${p}dictionary • ${p}wiki`);
  lines.push(`${p}img2pdf • ${p}pdflock • ${p}translate`);
  lines.push('');
  lines.push('『 TOOLS 』');
  lines.push(`${p}ip • ${p}whois • ${p}extractweb • ${p}ping • ${p}runtime`);
  lines.push(`${p}base64 • ${p}decode64 • ${p}uuid • ${p}shortlink • ${p}hash`);
  lines.push(`${p}sticker • ${p}toimg • ${p}attp • ${p}weather`);
  lines.push('');
  lines.push('『 LAB 』');
  lines.push(`${p}wallpaper • ${p}cat • ${p}dog • ${p}girldp • ${p}animedp • ${p}randomdp • ${p}coupledp`);
  lines.push('');
  lines.push('『 AI 』');
  lines.push(`${p}gpt • ${p}gpt1 • ${p}gpt2 • ${p}gpt3 • ${p}gpt4 • ${p}imagine`);
  lines.push(`${p}weather • ${p}ask • ${p}gemini • ${p}ai • ${p}currency • ${p}crypto`);
  lines.push('');
  lines.push('『 FUN 』');
  lines.push(`${p}meme • ${p}fact • ${p}ship • ${p}aura • ${p}advice • ${p}pickup • ${p}roast • ${p}roll`);
  lines.push(`${p}lovemeter • ${p}truth • ${p}dare • ${p}compliment • ${p}flip • ${p}emojimix • ${p}king`);
  lines.push(`${p}quote • ${p}joke`);
  lines.push('');
  lines.push('『 DOWNLOAD 』');
  lines.push(`${p}play / ${p}ytmp3 <song|url> • ${p}ytvideo <url>`);
  lines.push(`${p}tiktok • ${p}instagram • ${p}facebook • ${p}mediafire <url>`);
  lines.push(`${p}image • ${p}video • ${p}dl <url> • ${p}movie <title>`);
  lines.push('');
  lines.push('『 GROUP 』 (Admin)');
  lines.push(`${p}welcome • ${p}goodbye • ${p}promote • ${p}demote • ${p}listadmin • ${p}setwelcome`);
  lines.push(`${p}setgoodbye • ${p}setdesc • ${p}revoke • ${p}poll • ${p}announce • ${p}warn`);
  lines.push('');
  lines.push('『 AUDIO EDIT TOOLS 』');
  lines.push(`${p}tomp3 • ${p}to8daudio • ${p}tobass • ${p}toslowed  _(reply to audio)_`);
  lines.push('');
  lines.push('『 GROUP CONTROLLER 』 (Admin)');
  lines.push(`${p}control • ${p}gclink • ${p}invite • ${p}tagall • ${p}hidetag • ${p}admins`);
  lines.push(`${p}chatmute • ${p}chatunmute • ${p}pin • ${p}unpin • ${p}kick • ${p}add`);
  lines.push(`${p}open • ${p}close • ${p}lock • ${p}unlock`);
  lines.push(`${p}gprofile • ${p}gabout • ${p}groupname • ${p}gstatus • ${p}groupinfo`);
  lines.push('');
  lines.push('『 GROUP GUARDS 』 (Admin)');
  lines.push(`${p}antilink on|warn|delete|off • ${p}antispam on/off`);
  lines.push(`${p}anticall on/off • ${p}antistatus on/off • ${p}antistatusmention on/off`);
  lines.push('');
  lines.push('『 OWNER 』 (Owner Only)');
  lines.push(`${p}self • ${p}public • ${p}restart • ${p}eval <code> • ${p}setdp`);
  lines.push('');
  lines.push(`_Powered by ${config.botName} • ${config.botTitle}_`);
  lines.push(`_${getGreeting()}, ${pushName || 'User'} • ${date} ${time} EAT_`);

  return lines.join('\n');
}

// ------------------------------- controller -------------------------------
const CTRL_BUTTONS = [
  ['ctrl:antilink', '🔗 Antilink'],
  ['ctrl:antispam', '🛡 Antispam'],
  ['ctrl:anticall', '📞 Anticall'],
  ['ctrl:antistatus', '📸 Antistatus'],
  ['ctrl:welcome', '👋 Welcome'],
  ['ctrl:goodbye', '👋 Goodbye'],
  ['ctrl:mute', '🔇 Chat mute'],
  ['ctrl:pin', '📌 Chat pin'],
  ['ctrl:refresh', '🔄 Refresh'],
  ['ctrl:close', '❌ Close'],
];

async function sendController(sock, jid, quotedMsg) {
  const buttons = CTRL_BUTTONS.map(([id, label]) => ({
    buttonId: id,
    buttonText: { displayText: label },
    type: 1,
  }));
  const opts = quotedMsg ? { quoted: quotedMsg } : {};
  return sock.sendMessage(jid, { text: settings.statusText(jid), buttons }, opts);
}

async function handleControllerAction(sock, msg, id) {
  const jid = msg.key.remoteJid;
  if (!jid?.endsWith('@g.us')) return;
  const participant = msg.key.participant || jid;
  const owner = normalizeNumber(participant) === config.ownerNumber;
  const admin = await isGroupAdmin(sock, jid, participant);
  if (!owner && !admin) {
    return sock.sendMessage(jid, { text: 'Admin only.' }, { quoted: msg });
  }

  const action = id.replace(/^ctrl:/, '');
  const g = settings.getGroup(jid);

  switch (action) {
    case 'antilink': settings.cycleAntilink(jid); break;
    case 'antispam': settings.toggleGroup(jid, 'antispam'); break;
    case 'anticall': settings.toggleGlobal('anticall'); break;
    case 'antistatus': settings.toggleGlobal('antistatus'); break;
    case 'welcome': settings.toggleGroup(jid, 'welcome'); break;
    case 'goodbye': settings.toggleGroup(jid, 'goodbye'); break;
    case 'mute': {
      const muted = !g.muted;
      settings.setGroup(jid, { muted });
      await sock.chatModify({ mute: muted ? Date.now() + 8 * 60 * 60 * 1000 : null }, jid).catch(() => {});
      break;
    }
    case 'pin': {
      const pinned = !g.pinned;
      settings.setGroup(jid, { pinned });
      await sock.chatModify({ pin: pinned }, jid).catch(() => {});
      break;
    }
    case 'refresh': return sendController(sock, jid, msg);
    case 'close': return sock.sendMessage(jid, { delete: msg.key }).catch(() => {});
    default: return;
  }

  return sendController(sock, jid, msg);
}

// ------------------------------- main handler -------------------------------
async function handleCommand(sock, msg, ctx) {
  const { command, args, text, quoted, isOwner, isAdmin, isGroup, sender, pushName } = ctx;
  const cmd = norm(command);
  const jid = msg.key.remoteJid;
  const reply = (t, opts = {}) => sock.sendMessage(jid, { text: t, ...opts }, { quoted: msg });
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const first = words[0] || '';
  const rest = words.slice(1).join(' ');

  const needGroup = () => {
    if (!isGroup) { reply('This command works in groups only.'); return false; }
    return true;
  };
  const needAdmin = async () => {
    if (!needGroup()) return false;
    if (!isAdmin && !isOwner) { reply('Admin only.'); return false; }
    return true;
  };
  const meta = async () => sock.groupMetadata(jid);
  const sendFile = async (file, caption) => {
    try {
      return await sock.sendMessage(jid, dl.payload(file, caption), { quoted: msg });
    } finally {
      file?.cleanup?.();
    }
  };

  const sendFiles = async (files, caption = '') => {
    for (const [i, file] of files.entries()) {
      await sendFile(file, files.length > 1 ? `${caption}\n_(${i + 1}/${files.length})_` : caption);
    }
  };

  // Read the attachment on a replied-to message (or the command message).
  const getQuotedMedia = async () => {
    const q = quoted || msg;
    const m = q.message || {};
    const media = m.imageMessage || m.videoMessage || m.audioMessage || m.documentMessage || m.stickerMessage;
    if (!media) return null;
    const stream = await sock.downloadMediaMessage(q);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return {
      buffer: Buffer.concat(chunks),
      mime: media.mimetype || '',
      name: media.fileName || '',
    };
  };

  // ---------- reusable group actions ----------
  const tagAll = async () => {
    if (!await needAdmin()) return;
    const m = await meta();
    const mentions = uniqueJids(m.participants.map((p) => p.id));
    return reply(`*📢 TAG ALL*\n\n${mentions.map((x) => `@${normalizeNumber(x)}`).join('\n')}`, { mentions });
  };

  const tagAdmins = async () => {
    if (!await needAdmin()) return;
    const m = await meta();
    const mentions = uniqueJids(m.participants.filter((p) => p.admin).map((p) => p.id));
    if (!mentions.length) return reply('No admins found in this group.');
    return reply(`*👑 GROUP ADMINS*\n\n${mentions.map((x) => `@${normalizeNumber(x)}`).join('\n')}`, { mentions });
  };

  const hideTag = async (message) => {
    if (!await needAdmin()) return;
    const m = await meta();
    const mentions = uniqueJids(m.participants.map((p) => p.id));
    return reply(message || 'Hello everyone! 👋', { mentions });
  };

  const groupLink = async (toNumber) => {
    if (!needGroup()) return;
    if (!isAdmin && !isOwner) return reply('Admin only.');
    const m = await meta();
    const code = await sock.groupInviteCode(jid).catch(() => null);
    if (!code) return reply('Could not get the invite link.');
    const link = `https://chat.whatsapp.com/${code}`;
    if (toNumber) {
      await sock.sendMessage(jidOf(toNumber), { text: `*${m.subject || 'Group'} invite:*\n${link}` }).catch(() => {});
      return reply(`Invite link sent to @${toNumber}`, { mentions: [jidOf(toNumber)] });
    }
    return reply(`*🔗 GROUP LINK*\n\n${link}`);
  };

  const chatMute = async (hours) => {
    if (!needGroup()) return;
    if (!isAdmin && !isOwner) return reply('Admin only.');
    const h = Math.min(Math.max(Number(hours) || 8, 1), 168);
    await sock.chatModify({ mute: Date.now() + h * 60 * 60 * 1000 }, jid);
    settings.setGroup(jid, { muted: true });
    return reply(`🔇 Chat muted for *${h} hour(s)*.`);
  };

  const chatUnmute = async () => {
    if (!needGroup()) return;
    if (!isAdmin && !isOwner) return reply('Admin only.');
    await sock.chatModify({ mute: null }, jid);
    settings.setGroup(jid, { muted: false });
    return reply('🔊 Chat unmuted.');
  };

  const pin = async (value) => {
    if (!needGroup()) return;
    if (!isAdmin && !isOwner) return reply('Admin only.');
    await sock.chatModify({ pin: value }, jid);
    settings.setGroup(jid, { pinned: value });
    return reply(value ? '📌 Chat pinned.' : '📌 Chat unpinned.');
  };

  const groupProfile = async () => {
    if (!needGroup()) return;
    const m = await meta();
    const url = await sock.profilePictureUrl(jid, 'image').catch(() => null);
    if (!url) return reply('This group has no profile picture.');
    const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    return sock.sendMessage(jid, {
      image: Buffer.from(data),
      caption: `*${m.subject}*\n${m.desc || ''}\n_${config.botName}_`,
    }, { quoted: msg });
  };

  const groupAbout = async (value) => {
    if (!needGroup()) return;
    if (!isAdmin && !isOwner) return reply('Admin only.');
    if (value) {
      await sock.groupUpdateDescription(jid, value);
      return reply('Group description updated.');
    }
    const m = await meta();
    return reply(`*GABOUT*\n\n${m.desc || 'No description set.'}`);
  };

  const groupName = async (value) => {
    if (!needGroup()) return;
    if (!isAdmin && !isOwner) return reply('Admin only.');
    if (!value) return reply(`Usage: ${config.prefix}groupname <new name>`);
    await sock.groupUpdateSubject(jid, value);
    return reply('Group name updated.');
  };

  const statusMention = async (value) => {
    if (!needGroup()) return;
    if (!isAdmin && !isOwner) return reply('Admin only.');
    const m = await meta();
    const mentions = uniqueJids(m.participants.map((p) => p.id));
    await sock.sendMessage('status@broadcast', {
      text: value || `📢 *${m.subject}* says hello!`,
      mentions,
    }).catch((e) => reply('Could not post to status: ' + e.message));
    return reply('Status posted with mentions. ✅');
  };

  const setGuard = async (key, value, where) => {
    const on = /^(on|true|1|enable)$/i.test(value);
    const off = /^(off|false|0|disable)$/i.test(value);
    if (!on && !off) {
      return reply(`Usage: ${config.prefix}${key} on/off\nCurrent: ${(where === 'global' ? settings.getGlobal(key, false) : settings.getGroup(jid)[key]) ? 'ON' : 'OFF'}`);
    }
    if (where === 'global') settings.setGlobal(key, on);
    else settings.setGroup(jid, { [key]: on });
    return reply(`${key} is now *${on ? 'ON' : 'OFF'}*.`);
  };

  try {
    switch (cmd) {
      // ---------- MAIN ----------
      case 'menu':
      case 'help':
      case 'start':
        return reply(buildMenu(pushName));

      case 'ping':
      case 'p':
        return reply(`*Pong!* 🏓\nUptime: ${formatUptime((Date.now() - startTime) / 1000)}`);

      case 'runtime':
      case 'uptime':
        return reply(`*${config.botName}* has been running for:\n*${formatUptime((Date.now() - startTime) / 1000)}*`);

      case 'speed':
      case 'test': {
        const t0 = Date.now();
        await sock.sendMessage(jid, { text: 'Testing speed...' }, { quoted: msg });
        return reply(`*Speed:* ${Date.now() - t0}ms`);
      }

      case 'owner':
      case 'creator':
      case 'contact':
        return reply(`*👑 OWNER*\n\nName: *${config.ownerName}*\nNumber: @${config.ownerNumber}\nBot: *${config.botName}* (${config.botTitle})`, {
          mentions: [jidOf(config.ownerNumber)],
        });

      case 'info':
      case 'botinfo':
        return reply(
          `*╭───「 ${config.botName} 」───*
*│* Title: *${config.botTitle}*
*│* Version: *${config.botVersion} Beta*
*│* Owner: @${config.ownerNumber}
*│* Prefix: *${config.prefix}*
*│* Uptime: *${formatUptime((Date.now() - startTime) / 1000)}*
*│* Type: WhatsApp Multi-Device
*╰────────────────────*
_Powered by TEKSI-MD_`,
          { mentions: [jidOf(config.ownerNumber)] }
        );

      // ---------- TOOLS ----------
      case 'sticker':
      case 's': {
        const q = quoted || msg;
        const mimeType = q.message?.imageMessage?.mimetype || q.message?.videoMessage?.mimetype || '';
        if (!mimeType.includes('image') && !mimeType.includes('video')) {
          return reply(`Reply to an *image* or *video* with ${config.prefix}sticker`);
        }
        await react(sock, msg, '⏳');
        const stream = await sock.downloadMediaMessage(q);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const sticker = await imageToSticker(Buffer.concat(chunks));
        return sock.sendMessage(jid, { sticker }, { quoted: msg });
      }

      case 'toimg':
      case 'toimage': {
        const q = quoted || msg;
        if (!q.message?.stickerMessage) return reply(`Reply to a *sticker* with ${config.prefix}toimg`);
        const stream = await sock.downloadMediaMessage(q);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return sock.sendMessage(jid, { image: Buffer.concat(chunks), caption: `*${config.botName}*` }, { quoted: msg });
      }

      case 'attp': {
        if (!text) return reply(`Usage: ${config.prefix}attp <text>`);
        await react(sock, msg, '⏳');
        const sticker = await textToSticker(text);
        return sock.sendMessage(jid, { sticker }, { quoted: msg });
      }

      case 'calc': {
        if (!text) return reply(`Usage: ${config.prefix}calc 12*8+5`);
        if (!/^[0-9+\-*/(). %^]+$/.test(text)) return reply('Only numbers and + - * / ( ) % are allowed.');
        const result = Function('"use strict";return (' + text.replace(/\^/g, '**') + ')')();
        return reply(`*${text} = ${result}*`);
      }

      case 'translate':
      case 'tr': {
        if (!text) return reply(`Usage: ${config.prefix}translate <text>`);
        const { data } = await axios.get(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|sw`,
          { timeout: 15000 }
        );
        return reply(`*Translation (EN → SW):*\n${data?.responseData?.translatedText || 'Translation failed.'}`);
      }

      case 'weather': {
        if (!text) return reply(`Usage: ${config.prefix}weather <city>`);
        const { data } = await axios.get(`https://wttr.in/${encodeURIComponent(text)}?format=j1`, { timeout: 15000 });
        const c = data.current_condition?.[0];
        if (!c) return reply('City not found.');
        return reply(
          `*🌤 Weather — ${data.nearest_area?.[0]?.areaName?.[0] || text}*
Temp: *${c.temp_C}°C* (feels ${c.FeelsLikeC}°C)
Condition: ${c.weatherDesc?.[0]?.value}
Humidity: ${c.humidity}%
Wind: ${c.windspeedKmph} km/h ${c.winddir16Point}`
        );
      }

      // ---------- STUDENT LAB ----------
      case 'pdfunlock': {
        const file = await getQuotedMedia();
        if (!file || docs.mimeKind(file.mime, file.name) !== 'pdf') return reply(`Reply to a *PDF* with ${config.prefix}pdfunlock`);
        await react(sock, msg, '⏳');
        try {
          const out = await docs.pdfUnlock(file.buffer, first || '');
          return sock.sendMessage(jid, { document: out.buffer, mimetype: 'application/pdf', fileName: out.name, caption: '*PDF unlocked* ✅' }, { quoted: msg });
        } catch (e) { return reply('PDF unlock failed: ' + e.message); }
      }

      case 'pdflock': {
        const file = await getQuotedMedia();
        if (!file || docs.mimeKind(file.mime, file.name) !== 'pdf') return reply(`Reply to a *PDF* with ${config.prefix}pdflock <password>`);
        const password = first || 'teksi123';
        await react(sock, msg, '🔒');
        try {
          const out = await docs.pdfLock(file.buffer, password);
          return sock.sendMessage(jid, { document: out.buffer, mimetype: 'application/pdf', fileName: out.name, caption: `*PDF locked* 🔒\nPassword: \`${password}\`` }, { quoted: msg });
        } catch (e) { return reply('PDF lock failed: ' + e.message); }
      }

      case 'pdfmerge':
      case 'pdfmergedone': {
        const key = sender;
        const pending = pendingFor(key) || { files: [], type: 'pdf' };
        if (cmd === 'pdfmerge') {
          const file = await getQuotedMedia();
          if (file && docs.mimeKind(file.mime, file.name) === 'pdf') {
            pending.files.push({ ...file, name: file.name || `document-${pending.files.length + 1}.pdf` });
            pending.type = 'pdf';
            pending.ts = Date.now();
            pendingFiles.set(key, pending);
            return reply(`📄 PDF added (${pending.files.length}). Reply to another PDF with ${config.prefix}pdfmerge, or send ${config.prefix}pdfmergedone when done.`);
          }
          if (!pending.files.length) return reply(`Reply to a PDF with ${config.prefix}pdfmerge. Repeat for more PDFs, then ${config.prefix}pdfmergedone.`);
        }
        if (pending.files.length < 2) return reply('Add at least 2 PDFs before merging.');
        await react(sock, msg, '⏳');
        try {
          const out = await docs.pdfMerge(pending.files.map((f) => f.buffer));
          pendingFiles.delete(key);
          return sock.sendMessage(jid, { document: out.buffer, mimetype: 'application/pdf', fileName: out.name, caption: `*Merged ${pending.files.length} PDFs* ✅` }, { quoted: msg });
        } catch (e) { return reply('PDF merge failed: ' + e.message); }
      }

      case 'pdf2img':
      case 'pdftoimg': {
        const file = await getQuotedMedia();
        if (!file || docs.mimeKind(file.mime, file.name) !== 'pdf') return reply(`Reply to a *PDF* with ${config.prefix}pdf2img`);
        await react(sock, msg, '⏳');
        try {
          const pages = await docs.pdfToImages(file.buffer, /jpe?g/i.test(first) ? 'jpg' : 'png');
          return await sendFiles(pages, '*PDF → Images* 🖼');
        } catch (e) { return reply('PDF to image failed: ' + e.message); }
      }

      case 'img2pdf':
      case 'img2pdfdone': {
        const key = sender;
        const pending = pendingFor(key) || { files: [], type: 'image' };
        if (cmd === 'img2pdf') {
          const file = await getQuotedMedia();
          if (file && (docs.mimeKind(file.mime, file.name) === 'image' || file.mime.startsWith('image/'))) {
            pending.files.push({ ...file, name: file.name || `image-${pending.files.length + 1}.jpg` });
            pending.type = 'image';
            pending.ts = Date.now();
            pendingFiles.set(key, pending);
            return reply(`🖼 Image added (${pending.files.length}). Reply to another image with ${config.prefix}img2pdf, or send ${config.prefix}img2pdfdone when done.`);
          }
          if (!pending.files.length) return reply(`Reply to an image with ${config.prefix}img2pdf. Repeat for more images, then ${config.prefix}img2pdfdone.`);
        }
        if (!pending.files.length) return reply('Add at least 1 image first.');
        await react(sock, msg, '⏳');
        try {
          const out = await docs.imgToPdf(pending.files);
          pendingFiles.delete(key);
          return sock.sendMessage(jid, { document: out.buffer, mimetype: 'application/pdf', fileName: out.name, caption: `*Created PDF from ${pending.files.length} image(s)* ✅` }, { quoted: msg });
        } catch (e) { return reply('Image to PDF failed: ' + e.message); }
      }

      case 'ziplock': {
        const password = first || 'teksi123';
        const media = await getQuotedMedia();
        const files = media
          ? [{ ...media, name: media.name || `file-${Date.now()}.bin` }]
          : [docs.txtToFile(rest || text || 'Created by TEKSI-MD', first.includes('.') ? first : 'note.txt')];
        await react(sock, msg, '🔒');
        try {
          const out = await docs.zipLock(files, password);
          return sock.sendMessage(jid, { document: out.buffer, mimetype: 'application/zip', fileName: out.name, caption: `*ZIP locked* 🔒\nPassword: \`${password}\`` }, { quoted: msg });
        } catch (e) { return reply('ZIP lock failed: ' + e.message); }
      }

      case 'zipunlock': {
        if (!first) return reply(`Usage: ${config.prefix}zipunlock <password>  (reply to the ZIP)`);
        const file = await getQuotedMedia();
        if (!file || !/\bzip\b|\.zip/i.test(`${file.mime} ${file.name}`)) return reply(`Reply to a *ZIP* file with ${config.prefix}zipunlock <password>`);
        await react(sock, msg, '⏳');
        try {
          const files = await docs.zipUnlock(file.buffer, first);
          return await sendFiles(files, '*ZIP unlocked* ✅');
        } catch (e) { return reply('ZIP unlock failed: ' + e.message); }
      }

      case 'txttofile': {
        if (!text) return reply(`Usage: ${config.prefix}txttofile <filename> <text>\nExample: ${config.prefix}txttofile notes.txt Hello world`);
        const named = /\.[a-z0-9]{1,5}$/i.test(first);
        const name = named ? first : 'note.txt';
        const content = named ? (rest || text) : text;
        await react(sock, msg, '📝');
        const out = docs.txtToFile(content, name);
        return sock.sendMessage(jid, { document: out.buffer, mimetype: 'text/plain', fileName: name, caption: '*Text → File* ✅' }, { quoted: msg });
      }

      case 'filetotxt': {
        const file = await getQuotedMedia();
        if (!file) return reply(`Reply to a *text file, PDF or ZIP* with ${config.prefix}filetotxt`);
        await react(sock, msg, '⏳');
        try {
          const result = await docs.fileToText(file.buffer, file.name, file.mime);
          if (result.length > 3500) {
            const out = docs.txtToFile(result, 'extracted.txt');
            return sock.sendMessage(jid, { document: out.buffer, mimetype: 'text/plain', fileName: 'extracted.txt', caption: '*FILE → TXT* ✅' }, { quoted: msg });
          }
          return reply(`*FILE → TXT*\n\n${result}`);
        } catch (e) { return reply('FILETOTXT failed: ' + e.message); }
      }

      case 'compress': {
        const file = await getQuotedMedia();
        if (!file) return reply(`Reply to a *file* with ${config.prefix}compress`);
        await react(sock, msg, '⏳');
        try {
          const out = await docs.compress(file.buffer, file.name, file.mime);
          const before = file.buffer.length;
          const after = out.buffer.length;
          const saved = before > after ? `${Math.round((1 - after / before) * 100)}% smaller` : 'done';
          return await sendFile(out, `*Compressed* ✅ (${saved})`);
        } catch (e) { return reply('Compress failed: ' + e.message); }
      }

      case 'dictionary':
      case 'define': {
        if (!text) return reply(`Usage: ${config.prefix}dictionary <word>`);
        await react(sock, msg, '📖');
        try {
          const r = await extra.dictionary(first);
          return reply(`*📖 ${r.word}* ${r.phonetic ? `\n_${r.phonetic}_` : ''}\n\n${r.meanings}`);
        } catch (e) { return reply('Dictionary lookup failed: ' + e.message); }
      }

      case 'wiki':
      case 'wikipedia': {
        if (!text) return reply(`Usage: ${config.prefix}wiki <topic>`);
        await react(sock, msg, '📚');
        try {
          const r = await extra.wiki(text);
          const caption = `*📚 ${r.title}*\n\n${r.extract}\n\n🔗 ${r.url}`;
          if (r.thumbnail) {
            try {
              const { data } = await axios.get(r.thumbnail, {
                responseType: 'arraybuffer', timeout: 30000,
                headers: { 'User-Agent': 'TEKSI-MD/1.0 (https://github.com/texmexlite-67/TEKSI-MD)' },
              });
              return sock.sendMessage(jid, { image: Buffer.from(data), caption }, { quoted: msg });
            } catch {}
          }
          return reply(caption);
        } catch (e) { return reply('Wiki lookup failed: ' + e.message); }
      }

      // ---------- TOOLS ----------
      case 'ip':
      case 'myip': {
        await react(sock, msg, '🌍');
        try {
          const r = await extra.ipInfo();
          return reply(`*🌍 IP INFO*\n\nIP: *${r.ip}*${r.city ? `\nCity: ${r.city}` : ''}${r.region ? `\nRegion: ${r.region}` : ''}${r.country ? `\nCountry: ${r.country}` : ''}${r.isp ? `\nISP: ${r.isp}` : ''}${r.timezone ? `\nTimezone: ${r.timezone}` : ''}`);
        } catch (e) { return reply('IP lookup failed: ' + e.message); }
      }

      case 'whois': {
        if (!first) return reply(`Usage: ${config.prefix}whois <domain>`);
        await react(sock, msg, '🔎');
        try {
          const r = await extra.whois(first);
          return reply(`*🔎 WHOIS — ${r.domain}*\n\nRegistrar: ${r.registrar}\nCreated: ${r.created || '-'}\nUpdated: ${r.updated || '-'}\nExpires: ${r.expires || '-'}\nStatus: ${r.status.join(', ') || '-'}\nNameservers: ${r.nameservers.join(', ') || '-'}${r.emails.length ? `\nEmails: ${r.emails.join(', ')}` : ''}`);
        } catch (e) { return reply('WHOIS failed: ' + e.message); }
      }

      case 'extractweb':
      case 'readweb': {
        const url = dl.extractUrl(text) || first;
        if (!url) return reply(`Usage: ${config.prefix}extractweb <url>`);
        await react(sock, msg, '⏳');
        try {
          const result = await extra.extractWeb(url);
          return reply(`*🌐 EXTRACTED WEB*\n\n${result}`);
        } catch (e) { return reply('Web extraction failed: ' + e.message); }
      }

      case 'base64':
      case 'encode64': {
        if (!text) return reply(`Usage: ${config.prefix}base64 <text>`);
        return reply(`*BASE64*\n\n\`${extra.encode64(text)}\``);
      }

      case 'decode64':
      case 'b64decode': {
        if (!text) return reply(`Usage: ${config.prefix}decode64 <encoded text>`);
        try { return reply(`*DECODED*\n\n${extra.decode64(text)}`); }
        catch (e) { return reply('Invalid Base64 input.'); }
      }

      case 'uuid':
        return reply(`*UUID*\n\n\`${extra.uuid()}\``);

      case 'shortlink':
      case 'shorten': {
        const url = dl.extractUrl(text) || first;
        if (!url) return reply(`Usage: ${config.prefix}shortlink <https://url>`);
        await react(sock, msg, '🔗');
        try { return reply(`*SHORT LINK*\n\n${await extra.shortlink(url)}`); }
        catch (e) { return reply('Shortlink failed: ' + e.message); }
      }

      case 'hash': {
        const value = /^(md5|sha1|sha224|sha256|sha384|sha512)$/i.test(first) ? rest : text;
        const algo = /^(md5|sha1|sha224|sha256|sha384|sha512)$/i.test(first) ? first : 'sha256';
        if (!value) return reply(`Usage: ${config.prefix}hash [md5|sha1|sha256] <text>`);
        const r = extra.hash(value, algo);
        return reply(`*HASH (${r.algo.toUpperCase()})*\n\nHex: \`${r.hex}\`\nBase64: \`${r.base64}\``);
      }

      // ---------- LAB ----------
      case 'wallpaper': {
        await react(sock, msg, '🖼');
        try { return await sendFile(await images.wallpaper(), `*WALLPAPER* 🌄\n_${config.botName}_`); }
        catch (e) { return reply('Wallpaper failed: ' + e.message); }
      }

      case 'cat': {
        await react(sock, msg, '🐱');
        try { return await sendFile(await images.cat(), '*CAT* 🐱'); }
        catch (e) { return reply('Cat image failed: ' + e.message); }
      }

      case 'dog': {
        await react(sock, msg, '🐶');
        try { return await sendFile(await images.dog(), '*DOG* 🐶'); }
        catch (e) { return reply('Dog image failed: ' + e.message); }
      }

      case 'girldp':
      case 'waifu': {
        await react(sock, msg, '🌸');
        try { const f = await images.girlDp(); return await sendFile(f, f.caption || '*GIRL DP* 🌸'); }
        catch (e) { return reply('Girl DP failed: ' + e.message); }
      }

      case 'animedp':
      case 'neko': {
        await react(sock, msg, '🎀');
        try { const f = await images.animeDp(); return await sendFile(f, f.caption || '*ANIME DP* 🎀'); }
        catch (e) { return reply('Anime DP failed: ' + e.message); }
      }

      case 'randomdp': {
        await react(sock, msg, '🎲');
        try { const f = await images.randomDp(); return await sendFile(f, f.caption || '*RANDOM DP* 🎲'); }
        catch (e) { return reply('Random DP failed: ' + e.message); }
      }

      case 'coupledp':
      case 'couple': {
        await react(sock, msg, '💞');
        try { return await sendFile(await images.coupleDp(), '*COUPLE DP* 💞'); }
        catch (e) { return reply('Couple DP failed: ' + e.message); }
      }

      // ---------- AI ----------
      case 'ai':
      case 'ask':
      case 'gpt':
      case 'gpt1':
      case 'gpt2':
      case 'gpt3':
      case 'gpt4':
      case 'gemini': {
        if (!text) return reply(`Usage: ${config.prefix}${cmd} <your question>`);
        await react(sock, msg, '🤖');
        try {
          const answer = await askAI(text, cmd);
          const label = MODEL_LABELS[cmd] || 'AI';
          return reply(`*${label}*\n\n${answer.slice(0, 4000)}`);
        } catch (e) { return reply('AI request failed: ' + e.message); }
      }

      case 'currency': {
        const amount = first || '1';
        const from = words[1] || 'USD';
        const to = words[2] || 'KES';
        if (!/^[0-9.,]+$/.test(amount)) return reply(`Usage: ${config.prefix}currency <amount> <FROM> <TO>\nExample: ${config.prefix}currency 100 USD KES`);
        await react(sock, msg, '💱');
        try {
          const r = await extra.currency(Number(amount.replace(/,/g, '')), from, to);
          return reply(`*💱 CURRENCY*\n\n${Number(amount).toLocaleString()} ${r.base} = *${r.result.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.target}*\n_Rate: 1 ${r.base} = ${r.rate} ${r.target}_`);
        } catch (e) { return reply('Currency lookup failed: ' + e.message); }
      }

      case 'crypto': {
        await react(sock, msg, '📈');
        try { return reply(`*📈 CRYPTO PRICES*\n\n${await extra.crypto(rest || 'bitcoin,ethereum,solana,dogecoin')}`); }
        catch (e) { return reply('Crypto lookup failed: ' + e.message); }
      }

      case 'imagine':
      case 'aiimg':
      case 'aiimage': {
        if (!text) return reply(`Usage: ${config.prefix}imagine <describe the image>`);
        await react(sock, msg, '🎨');
        const url = await generateImage(text);
        const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
        return sock.sendMessage(jid, {
          image: Buffer.from(data), caption: `*${text}*\n_${config.botName}_`
        }, { quoted: msg });
      }

      // ---------- FUN ----------
      case 'quote': return reply(`*💬 Quote*\n\n_${random(QUOTES)}_`);
      case 'joke': return reply(`*😂 Joke*\n\n${random(JOKES)}`);

      case 'meme': {
        await react(sock, msg, '😂');
        try {
          const m = await extra.meme();
          const { data } = await axios.get(m.url, { responseType: 'arraybuffer', timeout: 30000 });
          return sock.sendMessage(jid, { image: Buffer.from(data), caption: `*${m.title}*\n🔗 ${m.link}` }, { quoted: msg });
        } catch (e) { return reply('Meme failed: ' + e.message); }
      }

      case 'fact': {
        try { return reply(`*🧠 FACT*\n\n${await extra.fact()}`); }
        catch (e) { return reply('Fact failed: ' + e.message); }
      }

      case 'advice': {
        try { return reply(`*💡 ADVICE*\n\n${await extra.advice()}`); }
        catch (e) { return reply('Advice failed: ' + e.message); }
      }

      case 'truth': {
        try { return reply(`*🙊 TRUTH*\n\n${await extra.truth()}`); }
        catch (e) { return reply('Truth failed: ' + e.message); }
      }

      case 'dare': {
        try { return reply(`*😈 DARE*\n\n${await extra.dare()}`); }
        catch (e) { return reply('Dare failed: ' + e.message); }
      }

      case 'roast': {
        try { return reply(`*🔥 ROAST*\n\n${await extra.roast()}`); }
        catch (e) { return reply('Roast failed: ' + e.message); }
      }

      case 'pickup': {
        return reply(`*😘 PICKUP LINE*\n\n${extra.pickup()}`);
      }

      case 'compliment': {
        return reply(`*🥰 COMPLIMENT*\n\n${extra.compliment()}`);
      }

      case 'ship': {
        try {
          const r = extra.ship(first, words[1]);
          const bar = '█'.repeat(Math.round(r.score / 10)) + '░'.repeat(10 - Math.round(r.score / 10));
          return reply(`*💘 SHIP*\n\n@${r.a}  💞  @${r.b}\n\`${bar}\` *${r.score}%*\n\n_${r.score > 75 ? 'A perfect match!' : r.score > 45 ? 'There is something here...' : 'Keep looking!'}_`);
        } catch (e) { return reply(e.message); }
      }

      case 'lovemeter':
      case 'love': {
        const r = extra.lovemeter(first, words[1]);
        return reply(`*💖 LOVEMETER*\n\n${r.a}  ❤️  ${r.b}\n*${r.score}%* ${r.score > 80 ? '💞 SOULMATES' : r.score > 50 ? '💕 Promising' : '💔 Needs work'}`);
      }

      case 'aura': {
        const [level, note] = extra.aura();
        return reply(`*✨ AURA*\n\n${level}\n_${note}_`);
      }

      case 'roll':
      case 'dice': {
        const r = extra.roll(first);
        return reply(`*🎲 ROLL*\n\nYou rolled a *${r.value}* (1–${r.sides})`);
      }

      case 'flip':
      case 'coin': {
        return reply(`*🪙 FLIP*\n\nIt landed on *${extra.flip()}*`);
      }

      case 'emojimix': {
        return reply(`*🔀 EMOJIMIX*\n\n${extra.emojimix()}`);
      }

      case 'king': {
        return reply(extra.king());
      }

      // ---------- DOWNLOADS ----------
      case 'play':
      case 'song':
      case 'ytmusic':
      case 'ytmp3': {
        if (!text) return reply(`Usage: ${config.prefix}play <song name or YouTube url>`);
        await react(sock, msg, '🎵');
        try {
          if (dl.youtubeId(text)) {
            const file = await dl.youtubeAudio(text);
            return await sendFile(file, file.caption);
          }
          const results = await dl.youtubeSearch(text);
          if (!results.length) return reply('No results found.');
          const top = results[0];
          const list = results.slice(0, 5).map((r, i) => `${i + 1}. ${r.title} — ${r.author || ''}`).join('\n');
          const file = await dl.youtubeAudio(top.url, `*${top.title}*\nby ${top.author || 'YouTube'}\n_${config.botName}_\n\n_Top results:_\n${list}`);
          return await sendFile(file, file.caption);
        } catch (e) { return reply('Audio download failed: ' + e.message); }
      }

      case 'youtube':
      case 'yt':
      case 'ytvideo':
      case 'ytv':
      case 'ytd': {
        const url = dl.extractUrl(text) || (dl.youtubeId(text) ? text : null);
        if (!url) return reply(`Usage: ${config.prefix}ytvideo <YouTube url or video id>\nFor audio use ${config.prefix}play`);
        await react(sock, msg, '⏳');
        try {
          const file = await dl.youtubeVideo(url);
          return await sendFile(file, file.caption);
        } catch (e) { return reply('Video download failed: ' + e.message); }
      }

      case 'tiktok':
      case 'tt': {
        const url = dl.extractUrl(text);
        if (!url) return reply(`Usage: ${config.prefix}tiktok <tiktok url>`);
        await react(sock, msg, '⏳');
        try {
          const file = await dl.tiktok(url);
          if (file.image) file.mime = `image/${String(file.mime).split('/')[1] || 'jpeg'}`;
          return await sendFile(file, file.caption);
        } catch (e) { return reply('TikTok download failed: ' + e.message); }
      }

      case 'instagram':
      case 'ig':
      case 'facebook':
      case 'fb': {
        const url = dl.extractUrl(text);
        if (!url) return reply(`Usage: ${config.prefix}${cmd} <${cmd === 'ig' || cmd === 'instagram' ? 'Instagram' : 'Facebook'} url>`);
        await react(sock, msg, '⏳');
        try {
          const file = await dl.facebookOrInstagram(url);
          return await sendFile(file, file.caption);
        } catch (e) { return reply('Download failed: ' + e.message); }
      }

      case 'mediafire':
      case 'mf': {
        const url = dl.extractUrl(text);
        if (!url) return reply(`Usage: ${config.prefix}mediafire <mediafire url>`);
        await react(sock, msg, '⏳');
        try {
          const file = await dl.mediafire(url);
          return await sendFile(file, `*${config.botName}*\n_${file.name}_`);
        } catch (e) { return reply('Mediafire download failed: ' + e.message); }
      }

      case 'image':
      case 'img':
      case 'pic': {
        const q = quoted;
        if (q?.message?.imageMessage) {
          const stream = await sock.downloadMediaMessage(q);
          const chunks = [];
          for await (const c of stream) chunks.push(c);
          return sock.sendMessage(jid, { image: Buffer.concat(chunks), caption: `*${config.botName}*` }, { quoted: msg });
        }
        const url = dl.extractUrl(text);
        if (!url) return reply(`Usage: ${config.prefix}image <image url>  (or reply to an image)`);
        await react(sock, msg, '🖼');
        try {
          const file = await dl.download(url);
          return await sendFile(file, `*${config.botName}*`);
        } catch (e) { return reply('Image download failed: ' + e.message); }
      }

      case 'video':
      case 'vid': {
        const q = quoted;
        if (q?.message?.videoMessage) {
          const stream = await sock.downloadMediaMessage(q);
          const chunks = [];
          for await (const c of stream) chunks.push(c);
          return sock.sendMessage(jid, { video: Buffer.concat(chunks), caption: `*${config.botName}*` }, { quoted: msg });
        }
        const url = dl.extractUrl(text);
        if (!url) return reply(`Usage: ${config.prefix}video <video url>  (or reply to a video)`);
        await react(sock, msg, '⏳');
        try {
          const file = await dl.download(url);
          return await sendFile(file, `*${config.botName}*`);
        } catch (e) { return reply('Video download failed: ' + e.message); }
      }

      case 'file':
      case 'download':
      case 'dl': {
        const url = dl.extractUrl(text);
        if (!url) return reply(`Usage: ${config.prefix}dl <direct file url>`);
        await react(sock, msg, '⏳');
        try {
          const file = await dl.download(url);
          return await sendFile(file, `*${config.botName}*\n_${file.name}_`);
        } catch (e) { return reply('Download failed: ' + e.message); }
      }

      case 'movie':
      case 'film': {
        if (!text) return reply(`Usage: ${config.prefix}movie <title>\nExample: ${config.prefix}movie Inception`);
        const url = dl.extractUrl(text);
        if (url) {
          await react(sock, msg, '⏳');
          try {
            const file = await dl.download(url);
            return await sendFile(file, `*${config.botName}*`);
          } catch (e) { return reply('Download failed: ' + e.message); }
        }
        await react(sock, msg, '🎬');
        try {
          const info = await dl.movieInfo(text);
          const caption = `*🎬 ${info.title}*\n\n${info.extract}\n\n📖 ${info.wikipedia}\n▶️ Trailer search: ${info.search}`;
          if (info.poster) {
            const { data } = await axios.get(info.poster, { responseType: 'arraybuffer', timeout: 30000 });
            return sock.sendMessage(jid, { image: Buffer.from(data), caption }, { quoted: msg });
          }
          return reply(caption);
        } catch (e) { return reply('Movie lookup failed: ' + e.message); }
      }

      // ---------- GROUP CONTROLLER ----------
      case 'control':
      case 'controller':
      case 'panel':
      case 'settings':
      case 'gc': {
        if (!await needAdmin()) return;
        return sendController(sock, jid, msg);
      }

      case 'gclink':
      case 'grouplink':
      case 'invitelink':
        return groupLink(digits(text) || null);

      case 'invite': {
        if (!needGroup()) return;
        if (!isAdmin && !isOwner) return reply('Admin only.');
        const code = await sock.groupInviteCode(jid).catch(() => null);
        if (!code) return reply('Could not get the invite link.');
        const link = `https://chat.whatsapp.com/${code}`;
        const num = digits(text);
        if (num) {
          await sock.sendMessage(jidOf(num), { text: `Join my group: ${link}` }).catch(() => {});
          return reply(`Invite sent to @${num}`, { mentions: [jidOf(num)] });
        }
        return reply(`*INVITE LINK*\n\n${link}`);
      }

      case 'tag':
      case 'tagall':
      case 'everyone':
        return tagAll();

      case 'hidetag':
      case 'hide':
        return hideTag(text);

      case 'admins':
      case 'tagadmins':
      case 'tagadmin':
      case 'listadmin':
      case 'listadmins':
        return tagAdmins();

      case 'setwelcome': {
        if (!await needAdmin()) return;
        return setGuard('welcome', first || 'on', 'group');
      }

      case 'setgoodbye': {
        if (!await needAdmin()) return;
        return setGuard('goodbye', first || 'on', 'group');
      }

      case 'poll': {
        if (!await needAdmin()) return;
        const options = String(rest || '').split(/[,|]/).map((s) => s.trim()).filter(Boolean).slice(0, 10);
        if (!first || options.length < 2) {
          return reply(`Usage: ${config.prefix}poll <question> <option1> | <option2> | <option3>`);
        }
        try {
          await sock.sendMessage(jid, {
            poll: { name: first, values: options, selectableCount: 1 },
          }, { quoted: msg });
          return reply('📊 Poll created.');
        } catch (e) { return reply('Could not create poll: ' + e.message); }
      }

      case 'announce': {
        if (!await needAdmin()) return;
        if (!text) return reply(`Usage: ${config.prefix}announce <message>`);
        const m = await meta();
        const mentions = uniqueJids(m.participants.map((p) => p.id));
        return reply(`*📢 ANNOUNCEMENT*\n\n${text}`, { mentions });
      }

      case 'warn': {
        if (!await needAdmin()) return;
        const target = targetOf(quoted);
        if (!target) return reply(`Reply to a member's message with ${config.prefix}warn`);
        return reply(`⚠️ @${normalizeNumber(target)} — official warning from the group admins.\n${text ? `\n_${text}_` : ''}`, { mentions: [target] });
      }

      case 'chatmute':
      case 'mutegroup':
        return chatMute(first);

      case 'chatunmute':
      case 'unmutegroup':
      case 'chatinmute':
        return chatUnmute();

      case 'pin': return pin(true);
      case 'unpin': return pin(false);

      case 'gstatus':
      case 'statusmention':
      case 'mentionstatus':
        return statusMention(text);

      case 'gprofile':
      case 'gpic':
      case 'gicon':
        return groupProfile();

      case 'gabout':
      case 'groupdesc':
      case 'setdesc':
        return groupAbout(text);

      case 'groupname':
      case 'setname':
        return groupName(text);

      case 'groupinfo': {
        if (!needGroup()) return;
        const m = await meta();
        const members = m.participants.map((p) => `@${normalizeNumber(p.id)}`).join('\n');
        return reply(
          `*╭───「 GROUP INFO 」───*
*│* Name: *${m.subject}*
*│* ID: ${m.id}
*│* Size: ${m.participants.length}
*│* Owner: @${normalizeNumber(m.owner)}
*│* About: ${m.desc || '_none_'}
*╰────────────────────*

*Members:*
${members}`,
          { mentions: m.participants.map((p) => p.id) }
        );
      }

      case 'kick':
      case 'remove': {
        if (!await needAdmin()) return;
        const target = targetOf(quoted);
        if (!target) return reply(`Reply to a message with ${config.prefix}kick`);
        await sock.groupParticipantsUpdate(jid, [target], 'remove');
        return reply(`@${normalizeNumber(target)} removed.`, { mentions: [target] });
      }

      case 'add': {
        if (!await needAdmin()) return;
        const num = digits(text);
        if (!num) return reply(`Usage: ${config.prefix}add 2547XXXXXXXX`);
        await sock.groupParticipantsUpdate(jid, [jidOf(num)], 'add');
        return reply(`Added @${num}`, { mentions: [jidOf(num)] });
      }

      case 'promote':
      case 'demote': {
        if (!await needAdmin()) return;
        const target = targetOf(quoted);
        if (!target) return reply(`Reply to a message with ${config.prefix}${cmd}`);
        await sock.groupParticipantsUpdate(jid, [target], cmd);
        return reply(`@${normalizeNumber(target)} is now ${cmd === 'promote' ? 'an admin' : 'a member'}.`, { mentions: [target] });
      }

      case 'open':
      case 'close': {
        if (!await needAdmin()) return;
        await sock.groupUpdateAnnouncement(jid, cmd === 'open' ? 'not_announcement' : 'announcement');
        return reply(cmd === 'open' ? 'Group opened — everyone can send messages.' : 'Group closed — only admins can send messages.');
      }

      case 'lock':
      case 'unlock': {
        if (!await needAdmin()) return;
        await sock.groupSettingUpdate(jid, cmd === 'lock' ? 'locked' : 'unlocked');
        return reply(cmd === 'lock' ? '🔒 Group settings locked to admins.' : '🔓 Group settings unlocked.');
      }

      case 'revoke': {
        if (!await needAdmin()) return;
        const code = await sock.groupRevokeInvite(jid);
        return reply(`Invite link reset:\nhttps://chat.whatsapp.com/${code}`);
      }

      // ---------- GROUP GUARDS ----------
      case 'antilink':
      case 'antilinkwarn': {
        if (!await needAdmin()) return;
        if (cmd === 'antilinkwarn') {
          settings.setGroup(jid, { antilink: 'warn' });
          return reply('Anti-link set to *WARN*.');
        }
        const v = first.toLowerCase();
        if (v === 'on' || v === 'delete') { settings.setGroup(jid, { antilink: 'delete' }); return reply('Anti-link *ON* — links will be deleted.'); }
        if (v === 'warn') { settings.setGroup(jid, { antilink: 'warn' }); return reply('Anti-link *WARN* — links get a warning.'); }
        if (v === 'off') { settings.setGroup(jid, { antilink: 'off' }); return reply('Anti-link *OFF*.'); }
        const cur = settings.getGroup(jid).antilink;
        return reply(`Usage: ${config.prefix}antilink on|warn|delete|off\nCurrent: *${cur.toUpperCase()}*`);
      }

      case 'antispam': return setGuard('antispam', first, 'group');
      case 'welcome': return setGuard('welcome', first, 'group');
      case 'goodbye': return setGuard('goodbye', first, 'group');
      case 'anticall': return setGuard('anticall', first, 'global');
      case 'antistatus': return setGuard('antistatus', first, 'global');
      case 'antistatusmention': return setGuard('antistatusMention', first, 'global');

      // ---------- compound aliases: ".g link", ".chat mute", ".admin tag" ----------
      case 'g':
      case 'group': {
        const sub = norm(first);
        if (['link', 'clink', 'invite'].includes(sub)) return groupLink(digits(rest) || null);
        if (['profile', 'pic', 'icon'].includes(sub)) return groupProfile();
        if (['about', 'desc', 'description'].includes(sub)) return groupAbout(rest);
        if (['name', 'subject'].includes(sub)) return groupName(rest);
        if (sub === 'status' || sub === 'statusmention') return statusMention(rest);
        if (sub === 'info') { ctx.command = 'groupinfo'; return handleCommand(sock, msg, ctx); }
        if (sub === 'mute') return chatMute(norm(rest.split(' ')[0]) || '8');
        if (sub === 'unmute') return chatUnmute();
        if (['control', 'panel', 'settings'].includes(sub)) return sendController(sock, jid, msg);
        return reply(`Unknown group option. Try ${config.prefix}control`);
      }

      case 'chat': {
        const sub = norm(first);
        if (sub === 'mute') return chatMute(norm(rest.split(' ')[0]) || '8');
        if (sub === 'unmute' || sub === 'inmute') return chatUnmute();
        if (sub === 'pin') return pin(true);
        if (sub === 'unpin') return pin(false);
        return reply(`Usage: ${config.prefix}chat mute|unmute|pin|unpin`);
      }

      case 'admin': {
        if (norm(first) === 'tag' || norm(first) === 'tagall' || !first) return tagAdmins();
        return reply(`Usage: ${config.prefix}admins`);
      }

      case 'anti': {
        const sub = norm(first);
        const value = rest || 'on';
        if (sub === 'link') {
          if (!await needAdmin()) return;
          settings.setGroup(jid, { antilink: value === 'warn' ? 'warn' : value === 'off' ? 'off' : 'delete' });
          return reply(`Antilink set to *${settings.getGroup(jid).antilink.toUpperCase()}*.`);
        }
        if (sub === 'call') return setGuard('anticall', value, 'global');
        if (sub === 'spam') return setGuard('antispam', value, 'group');
        if (sub === 'status') return setGuard('antistatus', value, 'global');
        if (sub === 'statusmention') return setGuard('antistatusMention', value, 'global');
        return reply(`Usage: ${config.prefix}anti link|call|spam|status on/off`);
      }

      // ---------- AUDIO EDIT TOOLS ----------
      case 'tomp3':
      case 'to8daudio':
      case 'tobass':
      case 'toslowed': {
        const q = quoted || msg;
        const m = q.message || {};
        const media = m.audioMessage || m.videoMessage || m.documentMessage;
        if (!media) return reply(`Reply to an *audio / voice note* with ${config.prefix}${cmd}`);
        await react(sock, msg, '🎧');
        try {
          const stream = await sock.downloadMediaMessage(q);
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          const input = { buffer: Buffer.concat(chunks), mime: media.mimetype || 'audio/mpeg', name: media.fileName || '' };
          const out = cmd === 'tomp3' ? await audio.toMp3(input)
            : cmd === 'to8daudio' ? await audio.to8d(input)
            : cmd === 'tobass' ? await audio.toBass(input)
            : await audio.toSlowed(input);
          return sock.sendMessage(jid, { audio: out.buffer, mimetype: 'audio/mpeg', fileName: out.name, ptt: false, caption: `*${cmd.toUpperCase()}* ✅` }, { quoted: msg });
        } catch (e) { return reply(`${cmd.toUpperCase()} failed: ` + e.message); }
      }

      // ---------- OWNER ----------
      case 'self': {
        if (!isOwner) return reply('Owner only.');
        config.selfMode = true;
        return reply('Bot is now in *SELF* mode — only you can use it.');
      }

      case 'public': {
        if (!isOwner) return reply('Owner only.');
        config.selfMode = false;
        return reply('Bot is now *PUBLIC* — everyone can use it.');
      }

      case 'setdp':
      case 'dp':
      case 'botpic':
      case 'setprofile': {
        if (!isOwner) return reply('Owner only.');
        await react(sock, msg, '⏳');
        try {
          await setBotProfilePicture(sock, config.botDpFile);
          settings.setGlobal('botDpApplied', true);
          return reply('Bot display picture updated. ✅');
        } catch (e) {
          return reply('Could not update DP: ' + e.message);
        }
      }

      case 'restart': {
        if (!isOwner) return reply('Owner only.');
        await reply('Restarting bot...');
        setTimeout(() => process.exit(0), 1000);
        return;
      }

      case 'eval': {
        if (!isOwner) return reply('Owner only.');
        if (!text) return reply(`Usage: ${config.prefix}eval <code>`);
        try {
          const result = await Function('sock', 'msg', 'return (' + text + ')')(sock, msg);
          return reply('```' + String(result).slice(0, 3000) + '```');
        } catch (e) { return reply('Error: ' + e.message); }
      }

      default:
        return;
    }
  } catch (err) {
    console.error('[TEKSI-MD] Command error:', err.message);
    try { await reply(`Error: ${err.message}`); } catch {}
  }
}

module.exports = { handleCommand, handleControllerAction, sendController, buildMenu };
