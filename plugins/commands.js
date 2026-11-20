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
const { askAI, generateImage } = require('../lib/ai');

const startTime = Date.now();

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
  // TOOLS
  'sticker', 'toimg', 'attp', 'calc', 'translate', 'weather',
  // AI
  'ai', 'imagine',
  // FUN
  'quote', 'joke',
  // DOWNLOAD
  'play', 'ytmp3', 'ytvideo', 'tiktok', 'instagram', 'facebook',
  'mediafire', 'image', 'video', 'dl', 'movie',
  // GROUP CONTROLLER
  'control', 'gclink', 'invite', 'tagall', 'hidetag', 'admins',
  'chatmute', 'chatunmute', 'pin', 'unpin', 'kick', 'add',
  'promote', 'demote', 'open', 'close', 'lock', 'unlock',
  'gprofile', 'gabout', 'groupname', 'gstatus', 'groupinfo', 'revoke',
  'welcome', 'goodbye',
  // GROUP GUARDS
  'antilink', 'antispam', 'anticall', 'antistatus', 'antistatusmention',
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
  lines.push('『 AI 』');
  lines.push(`${p}ai <question> • ${p}imagine <prompt>`);
  lines.push('');
  lines.push('『 TOOLS 』');
  lines.push(`${p}sticker • ${p}toimg • ${p}attp <text> • ${p}calc • ${p}translate • ${p}weather`);
  lines.push('');
  lines.push('『 FUN 』');
  lines.push(`${p}quote • ${p}joke`);
  lines.push('');
  lines.push('『 DOWNLOAD 』');
  lines.push(`${p}play / ${p}ytmp3 <song|url> • ${p}ytvideo <url>`);
  lines.push(`${p}tiktok • ${p}instagram • ${p}facebook • ${p}mediafire <url>`);
  lines.push(`${p}image • ${p}video • ${p}dl <url> • ${p}movie <title>`);
  lines.push('');
  lines.push('『 GROUP CONTROLLER 』 (Admin)');
  lines.push(`${p}control • ${p}gclink • ${p}invite • ${p}tagall • ${p}hidetag • ${p}admins`);
  lines.push(`${p}chatmute • ${p}chatunmute • ${p}pin • ${p}unpin • ${p}kick • ${p}add`);
  lines.push(`${p}promote • ${p}demote • ${p}open • ${p}close • ${p}lock • ${p}unlock`);
  lines.push(`${p}gprofile • ${p}gabout • ${p}groupname • ${p}gstatus • ${p}groupinfo • ${p}revoke`);
  lines.push(`${p}welcome • ${p}goodbye`);
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
  const sendFile = (file, caption) => sock.sendMessage(jid, dl.payload(file, caption), { quoted: msg });

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

      // ---------- AI ----------
      case 'ai':
      case 'gpt':
      case 'ask': {
        if (!text) return reply(`Usage: ${config.prefix}ai <your question>`);
        await react(sock, msg, '🤖');
        const answer = await askAI(text);
        return reply(answer.slice(0, 4000));
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
          return sock.sendMessage(jid, file.image
            ? { image: file.buffer, caption: file.caption }
            : { video: file.buffer, caption: file.caption }, { quoted: msg });
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
        return tagAdmins();

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
