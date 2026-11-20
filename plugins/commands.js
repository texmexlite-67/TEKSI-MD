// ============================================
//  TEKSI-MD  •  TEKSI  —  Commands
// ============================================
const axios = require('axios');
const config = require('../config');
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

function buildMenu(pushName) {
  const { date, time } = getDateTime();
  return `*╭───「 ${config.botName} 」───*
*│*  *${config.botTitle}*  •  WhatsApp Multi-Device Bot
*╰────────────────────╯*

${getGreeting()}, *${pushName || 'User'}* 👋

*📅* ${date}
*🕐* ${time} EAT
*👑* Owner: @${config.ownerNumber}
*⚡* Prefix: *${config.prefix}*
*📱* Mode: ${config.selfMode ? 'Self (owner only)' : 'Public'}

*╭───「 MAIN 」───*
*│* ${config.prefix}menu / help
*│* ${config.prefix}ping
*│* ${config.prefix}runtime
*│* ${config.prefix}owner
*│* ${config.prefix}info
*│* ${config.prefix}speed
*╰───────────────*

*╭───「 TOOLS 」───*
*│* ${config.prefix}sticker  _(reply to image)_
*│* ${config.prefix}toimg  _(reply to sticker)_
*│* ${config.prefix}attp <text>
*│* ${config.prefix}calc <math>
*│* ${config.prefix}translate <text>
*│* ${config.prefix}weather <city>
*╰───────────────*

*╭───「 AI 」───*
*│* ${config.prefix}ai <question>
*│* ${config.prefix}imagine <prompt>  _(AI image)_
*╰───────────────*

*╭───「 FUN 」───*
*│* ${config.prefix}quote
*│* ${config.prefix}joke
*╰───────────────*

*╭───「 DOWNLOAD 」───*
*│* ${config.prefix}tiktok <url>
*│* ${config.prefix}play <song name>  _(search)_
*╰───────────────*

*╭───「 GROUP 」───*  _(admin only)_
*│* ${config.prefix}groupinfo
*│* ${config.prefix}tagall
*│* ${config.prefix}hidetag <text>
*│* ${config.prefix}kick  _(reply)_
*│* ${config.prefix}add <number>
*│* ${config.prefix}promote / demote  _(reply)_
*│* ${config.prefix}open / close  _(group)_
*│* ${config.prefix}revoke  _(reset invite link)_
*│* ${config.prefix}antilink on/off
*│* ${config.prefix}welcome on/off
*╰───────────────*

*╭───「 OWNER 」───*
*│* ${config.prefix}self / public
*│* ${config.prefix}restart
*│* ${config.prefix}eval <code>
*╰───────────────*

*${config.botName}*  •  *${config.botTitle}*
_Powered by TEKSI-MD_`;
}

// Main handler — called from index.js for every message
async function handleCommand(sock, msg, ctx) {
  const { command, args, text, quoted, isOwner, isAdmin, isGroup, sender, pushName } = ctx;
  const reply = (t, opts = {}) => sock.sendMessage(msg.key.remoteJid, { text: t, ...opts }, { quoted: msg });

  try {
    switch (command) {
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
        await sock.sendMessage(msg.key.remoteJid, { text: 'Testing speed...' }, { quoted: msg });
        return reply(`*Speed:* ${Date.now() - t0}ms`);
      }

      case 'owner':
      case 'creator':
      case 'contact':
        return reply(`*👑 OWNER*\n\nName: *${config.ownerName}*\nNumber: @${config.ownerNumber}\nBot: *${config.botName}* (${config.botTitle})`, {
          mentions: [`${config.ownerNumber}@s.whatsapp.net`]
        });

      case 'info':
      case 'botinfo':
        return reply(
`*╭───「 ${config.botName} 」───*
*│* Title: *${config.botTitle}*
*│* Version: *${config.botVersion}*
*│* Owner: @${config.ownerNumber}
*│* Prefix: *${config.prefix}*
*│* Uptime: *${formatUptime((Date.now() - startTime) / 1000)}*
*│* Type: WhatsApp Multi-Device
*╰────────────────────*
_Powered by TEKSI-MD_`,
          { mentions: [`${config.ownerNumber}@s.whatsapp.net`] }
        );

      // ---------- TOOLS ----------
      case 'sticker':
      case 's': {
        const q = quoted || msg;
        const mime = q.message?.imageMessage?.mimetype || q.message?.videoMessage?.mimetype || '';
        if (!mime.includes('image') && !mime.includes('video')) {
          return reply(`Reply to an *image* or *video* with ${config.prefix}sticker`);
        }
        await sock.sendMessage(msg.key.remoteJid, { react: { key: msg.key, text: '⏳' } });
        const stream = await sock.downloadMediaMessage(q);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const sticker = await imageToSticker(Buffer.concat(chunks));
        return sock.sendMessage(msg.key.remoteJid, { sticker }, { quoted: msg });
      }

      case 'toimg':
      case 'toimage': {
        const q = quoted || msg;
        if (!q.message?.stickerMessage) return reply(`Reply to a *sticker* with ${config.prefix}toimg`);
        const stream = await sock.downloadMediaMessage(q);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return sock.sendMessage(msg.key.remoteJid, { image: Buffer.concat(chunks), caption: `*${config.botName}*` }, { quoted: msg });
      }

      case 'attp': {
        if (!text) return reply(`Usage: ${config.prefix}attp <text>`);
        await sock.sendMessage(msg.key.remoteJid, { react: { key: msg.key, text: '⏳' } });
        const sticker = await textToSticker(text);
        return sock.sendMessage(msg.key.remoteJid, { sticker }, { quoted: msg });
      }

      case 'calc': {
        if (!text) return reply(`Usage: ${config.prefix}calc 12*8+5`);
        // Safe-ish math only: numbers and operators
        if (!/^[0-9+\-*/(). %^]+$/.test(text)) return reply('Only numbers and + - * / ( ) % are allowed.');
        const result = Function('"use strict";return (' + text.replace(/\^/g, '**') + ')')();
        return reply(`*${text} = ${result}*`);
      }

      case 'translate':
      case 'tr': {
        if (!text) return reply(`Usage: ${config.prefix}translate <text>\nExample: ${config.prefix}translate Habari yako`);
        const { data } = await axios.get(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|sw`,
          { timeout: 15000 }
        );
        const out = data?.responseData?.translatedText || 'Translation failed.';
        return reply(`*Translation (EN → SW):*\n${out}`);
      }

      case 'weather': {
        if (!text) return reply(`Usage: ${config.prefix}weather <city>\nExample: ${config.prefix}weather Nairobi`);
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
        await sock.sendMessage(msg.key.remoteJid, { react: { key: msg.key, text: '🤖' } });
        const answer = await askAI(text);
        return reply(answer.slice(0, 4000));
      }

      case 'imagine':
      case 'aiimg':
      case 'image': {
        if (!text) return reply(`Usage: ${config.prefix}imagine <describe the image>`);
        await sock.sendMessage(msg.key.remoteJid, { react: { key: msg.key, text: '🎨' } });
        const url = await generateImage(text);
        const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
        return sock.sendMessage(msg.key.remoteJid, {
          image: Buffer.from(data), caption: `*${text}*\n_${config.botName}_`
        }, { quoted: msg });
      }

      // ---------- FUN ----------
      case 'quote':
        return reply(`*💬 Quote*\n\n_${random(QUOTES)}_`);

      case 'joke':
        return reply(`*😂 Joke*\n\n${random(JOKES)}`);

      // ---------- DOWNLOAD ----------
      case 'tiktok':
      case 'tt': {
        if (!text) return reply(`Usage: ${config.prefix}tiktok <tiktok url>`);
        await sock.sendMessage(msg.key.remoteJid, { react: { key: msg.key, text: '⏳' } });
        try {
          const { data } = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(text)}`, { timeout: 30000 });
          const video = data?.data?.hdplay || data?.data?.play;
          if (!video) return reply('Could not download that TikTok. Check the link.');
          const { data: buf } = await axios.get(video, { responseType: 'arraybuffer', timeout: 60000 });
          return sock.sendMessage(msg.key.remoteJid, { video: Buffer.from(buf), caption: `*${config.botName}*` }, { quoted: msg });
        } catch {
          return reply('TikTok download failed. Try again later.');
        }
      }

      case 'play': {
        if (!text) return reply(`Usage: ${config.prefix}play <song name>\nExample: ${config.prefix}play Diamond Platnumz`);
        await sock.sendMessage(msg.key.remoteJid, { react: { key: msg.key, text: '🎵' } });
        try {
          const { data } = await axios.get(`https://api.popcat.xyz/search?q=${encodeURIComponent(text)}`, { timeout: 20000 });
          const results = data?.result || [];
          if (!results.length) return reply('No results found.');
          const top = results[0];
          return reply(`*🎵 Top result:*\n${top.title || top.name || text}\n\n${top.url || ''}\n\n_(Audio download needs yt-dlp on the server — link above)_`);
        } catch {
          return reply('Search failed. Try again later.');
        }
      }

      // ---------- GROUP ----------
      case 'groupinfo': {
        if (!isGroup) return reply('This command works in groups only.');
        const meta = await sock.groupMetadata(msg.key.remoteJid);
        const members = meta.participants.map(p => `@${normalizeNumber(p.id)}`).join('\n');
        return reply(
`*╭───「 GROUP INFO 」───*
*│* Name: *${meta.subject}*
*│* ID: ${meta.id}
*│* Size: ${meta.participants.length}
*│* Owner: @${normalizeNumber(meta.owner)}
*╰────────────────────*

*Members:*
${members}`,
          { mentions: meta.participants.map(p => p.id) }
        );
      }

      case 'tagall': {
        if (!isGroup) return reply('Groups only.');
        if (!isAdmin && !isOwner) return reply('Admin only.');
        const meta = await sock.groupMetadata(msg.key.remoteJid);
        const mentions = meta.participants.map(p => p.id);
        const list = mentions.map(m => `@${normalizeNumber(m)}`).join('\n');
        return reply(`*📢 TAG ALL*\n\n${list}`, { mentions });
      }

      case 'hidetag': {
        if (!isGroup) return reply('Groups only.');
        if (!isAdmin && !isOwner) return reply('Admin only.');
        const meta = await sock.groupMetadata(msg.key.remoteJid);
        const mentions = meta.participants.map(p => p.id);
        return reply(text || 'Hello everyone! 👋', { mentions });
      }

      case 'kick': {
        if (!isGroup) return reply('Groups only.');
        if (!isAdmin && !isOwner) return reply('Admin only.');
        const target = quoted?.participant || quoted?.key?.participant || quoted?.key?.remoteJid;
        if (!target) return reply(`Reply to a message with ${config.prefix}kick`);
        await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'remove');
        return reply(`@${normalizeNumber(target)} removed.`, { mentions: [target] });
      }

      case 'add': {
        if (!isGroup) return reply('Groups only.');
        if (!isAdmin && !isOwner) return reply('Admin only.');
        const num = text.replace(/[^0-9]/g, '');
        if (!num) return reply(`Usage: ${config.prefix}add 2547XXXXXXXX`);
        await sock.groupParticipantsUpdate(msg.key.remoteJid, [`${num}@s.whatsapp.net`], 'add');
        return reply(`Added @${num}`, { mentions: [`${num}@s.whatsapp.net`] });
      }

      case 'promote': {
        if (!isGroup) return reply('Groups only.');
        if (!isAdmin && !isOwner) return reply('Admin only.');
        const target = quoted?.participant || quoted?.key?.participant;
        if (!target) return reply(`Reply to a message with ${config.prefix}promote`);
        await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'promote');
        return reply(`@${normalizeNumber(target)} is now admin.`, { mentions: [target] });
      }

      case 'demote': {
        if (!isGroup) return reply('Groups only.');
        if (!isAdmin && !isOwner) return reply('Admin only.');
        const target = quoted?.participant || quoted?.key?.participant;
        if (!target) return reply(`Reply to a message with ${config.prefix}demote`);
        await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'demote');
        return reply(`@${normalizeNumber(target)} demoted.`, { mentions: [target] });
      }

      case 'open': {
        if (!isGroup) return reply('Groups only.');
        if (!isAdmin && !isOwner) return reply('Admin only.');
        await sock.groupUpdateAnnouncement(msg.key.remoteJid, 'not_announcement');
        return reply('Group opened — everyone can send messages.');
      }

      case 'close': {
        if (!isGroup) return reply('Groups only.');
        if (!isAdmin && !isOwner) return reply('Admin only.');
        await sock.groupUpdateAnnouncement(msg.key.remoteJid, 'announcement');
        return reply('Group closed — only admins can send messages.');
      }

      case 'revoke': {
        if (!isGroup) return reply('Groups only.');
        if (!isAdmin && !isOwner) return reply('Admin only.');
        const invite = await sock.groupRevokeInvite(msg.key.remoteJid);
        return reply(`Invite link reset:\nhttps://chat.whatsapp.com/${invite}`);
      }

      case 'antilink': {
        if (!isOwner) return reply('Owner only.');
        if (text === 'on') { config.antiLink = true; return reply('Anti-link *ON* — links will be removed.'); }
        if (text === 'off') { config.antiLink = false; return reply('Anti-link *OFF*.'); }
        return reply(`Usage: ${config.prefix}antilink on/off\nCurrent: ${config.antiLink ? 'ON' : 'OFF'}`);
      }

      case 'welcome': {
        if (!isOwner) return reply('Owner only.');
        if (text === 'on') { config.welcome = true; return reply('Welcome messages *ON*.'); }
        if (text === 'off') { config.welcome = false; return reply('Welcome messages *OFF*.'); }
        return reply(`Usage: ${config.prefix}welcome on/off\nCurrent: ${config.welcome ? 'ON' : 'OFF'}`);
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
        } catch (e) {
          return reply('Error: ' + e.message);
        }
      }

      default:
        return; // unknown command — ignore
    }
  } catch (err) {
    console.error('[TEKSI-MD] Command error:', err.message);
    try { await reply(`Error: ${err.message}`); } catch {}
  }
}

module.exports = { handleCommand, buildMenu };
