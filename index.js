// ============================================
//  TEKSI-MD  •  TEKSI  —  WhatsApp Multi-Device Bot
//  Owner: 254715442684
// ============================================
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const config = require('./config');
const settings = require('./lib/settings');
const { setBotProfilePicture } = require('./lib/profile');
const { handleCommand, handleControllerAction } = require('./plugins/commands');
const { normalizeNumber } = require('./lib/utils');

const logger = pino({ level: 'silent' });
const LINK_RE = /https?:\/\/[^\s]+/i;
const ALLOWED_LINK_RE = /(chat\.whatsapp\.com|wa\.me|api\.whatsapp\.com)/i;

const spamTracker = new Map();
const statusNotified = new Map();
let groupListCache = { at: 0, groups: [] };

function banner() {
  console.log('\n' + '='.repeat(50));
  console.log(`  ${config.botName}  •  ${config.botTitle}`);
  console.log('  WhatsApp Multi-Device Bot');
  console.log(`  Owner: ${config.ownerNumber}`);
  console.log('='.repeat(50) + '\n');
}

// Keep the last few messages per sender for anti-spam.
function spamHits(jid, sender, key) {
  const mapKey = `${jid}|${sender}`;
  const now = Date.now();
  let entries = (spamTracker.get(mapKey) || []).filter((x) => now - x.at < 10000);
  entries.push({ at: now, key });
  spamTracker.set(mapKey, entries);
  if (entries.length >= 5) {
    spamTracker.set(mapKey, []);
    return entries.map((x) => x.key);
  }
  return null;
}

async function participatingGroups(sock) {
  if (groupListCache.groups.length && Date.now() - groupListCache.at < 5 * 60 * 1000) return groupListCache.groups;
  try {
    const data = await sock.groupFetchAllParticipating();
    groupListCache = { at: Date.now(), groups: Object.values(data || {}) };
  } catch { /* keep the old cache */ }
  return groupListCache.groups;
}

async function startBot() {
  banner();

  if (!fs.existsSync(config.sessionFolder)) {
    fs.mkdirSync(config.sessionFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
  const { version } = await fetchLatestBaileysVersion();
  console.log(`[TEKSI-MD] Baileys version: ${version.join('.')}`);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: Browsers.windows(config.botName),
    markOnlineOnConnect: true,
    syncFullHistory: false,
    qrTimeout: config.qrTimeoutMs,
  });

  sock.ev.on('creds.update', saveCreds);

  // ---------- Connection ----------
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('[TEKSI-MD] Scan this QR with WhatsApp (Linked Devices):\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log(`\n[TEKSI-MD] ✅ Connected as ${sock.user?.id || config.pairingNumber}`);
      console.log(`[TEKSI-MD] Bot is ONLINE — send "${config.prefix}menu" in WhatsApp.\n`);

      // Apply the bundled display picture once per installation.
      if (config.botDp && !settings.getGlobal('botDpApplied', false)) {
        try {
          await setBotProfilePicture(sock, config.botDpFile);
          settings.setGlobal('botDpApplied', true);
          console.log('[TEKSI-MD] Bot display picture updated from assets.');
        } catch (e) {
          console.error('[TEKSI-MD] Bot DP update failed:', e.message);
        }
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`[TEKSI-MD] Connection closed (${code}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log('[TEKSI-MD] Logged out. Delete the "session" folder and restart to pair again.');
      }
    }
  });

  // Request pairing code if not registered
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const phone = config.pairingNumber.replace(/[^0-9]/g, '');
        console.log(`[TEKSI-MD] Requesting pairing code for +${phone} ...`);
        const code = await sock.requestPairingCode(phone);
        const pretty = code.match(/.{1,4}/g)?.join('-') || code;
        console.log('\n' + '='.repeat(50));
        console.log(`  PAIRING CODE:  ${pretty}`);
        console.log('  WhatsApp > Linked Devices > Link with phone number');
        console.log('  Enter the code above on your phone.');
        console.log('='.repeat(50) + '\n');
      } catch (e) {
        console.error('[TEKSI-MD] Pairing code error:', e.message);
      }
    }, 3000);
  }

  // ---------- Messages ----------
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg.message) continue;

        const remoteJid = msg.key.remoteJid || '';
        const isStatus = remoteJid === 'status@broadcast';
        const isGroup = remoteJid.endsWith('@g.us');
        const sender = isGroup ? (msg.key.participant || '') : remoteJid;
        const senderNum = normalizeNumber(sender);
        const isOwner = senderNum === config.ownerNumber;
        const pushName = msg.pushName || 'User';

        // ---- Interactive controller buttons ----
        const selected =
          msg.message.buttonsResponseMessage?.selectedButtonId ||
          msg.message.templateButtonReplyMessage?.selectedId ||
          msg.message.listResponseMessage?.singleSelectReply?.selectedRowId;
        if (selected && String(selected).startsWith('ctrl:')) {
          await handleControllerAction(sock, msg, String(selected));
          continue;
        }

        let isAdmin = false;
        let senderIsAdmin = false;
        if (isGroup) {
          const meta = await sock.groupMetadata(remoteJid).catch(() => null);
          const me = meta?.participants?.find((p) => normalizeNumber(p.id) === normalizeNumber(sock.user?.id));
          isAdmin = !!me?.admin;
          senderIsAdmin = !!meta?.participants?.find((p) => p.id === sender)?.admin;
        }

        // ---- Status handling (antistatus) ----
        if (isStatus) {
          if (config.autoReadStatus) await sock.readMessages([msg.key]).catch(() => {});
          if (settings.getGlobal('antistatus', false)) {
            const author = msg.key.participant || remoteJid;
            const num = normalizeNumber(author);
            const tag = `status:${num}`;
            const now = Date.now();
            if (num && now - (statusNotified.get(tag) || 0) > 60 * 60 * 1000) {
              statusNotified.set(tag, now);
              const mention = settings.getGlobal('antistatusMention', false);
              for (const group of await participatingGroups(sock)) {
                if (!group.participants?.some((p) => p.id === author)) continue;
                await sock.sendMessage(group.id, {
                  text: `📸 @${num} just posted a status.`,
                  ...(mention ? { mentions: [author] } : {}),
                }).catch(() => {});
              }
            }
          }
          continue;
        }

        if (config.autoReadMessages && !isStatus) {
          await sock.readMessages([msg.key]).catch(() => {});
        }

        // Extract text (normal, edited, quoted, button replies, etc.)
        const textMsg =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.buttonsResponseMessage?.selectedDisplayText ||
          msg.message.listResponseMessage?.title ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          '';
        const text = String(textMsg).trim();

        // ---- Anti-link (per group) ----
        if (isGroup && text && LINK_RE.test(text) && !ALLOWED_LINK_RE.test(text) && !isOwner && !senderIsAdmin) {
          const mode = settings.getGroup(remoteJid).antilink;
          if (mode === 'delete') {
            await sock.sendMessage(remoteJid, { delete: msg.key }).catch(() => {});
            await sock.sendMessage(remoteJid, {
              text: `@${senderNum} Links are not allowed here.`, mentions: [sender],
            }).catch(() => {});
            continue;
          }
          if (mode === 'warn') {
            await sock.sendMessage(remoteJid, {
              text: `@${senderNum} ⚠️ Links are not allowed here.`, mentions: [sender],
            }, { quoted: msg }).catch(() => {});
          }
        }

        // ---- Anti-spam (per group) ----
        if (isGroup && text && !isOwner && !senderIsAdmin && settings.getGroup(remoteJid).antispam) {
          const keys = spamHits(remoteJid, sender, msg.key);
          if (keys) {
            for (const key of keys) await sock.sendMessage(remoteJid, { delete: key }).catch(() => {});
            await sock.sendMessage(remoteJid, {
              text: `@${senderNum} 🛡 Anti-spam triggered — slow down.`, mentions: [sender],
            }).catch(() => {});
            continue;
          }
        }

        if (!text.startsWith(config.prefix)) continue;

        const withoutPrefix = text.slice(config.prefix.length).trim();
        if (!withoutPrefix) continue;

        const [commandRaw, ...args] = withoutPrefix.split(/\s+/);
        const command = commandRaw.toLowerCase();
        const argText = args.join(' ');

        // Self mode check
        if (config.selfMode && !isOwner) continue;

        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage
          ? {
              message: msg.message.extendedTextMessage.contextInfo.quotedMessage,
              key: {
                remoteJid,
                id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                participant: msg.message.extendedTextMessage.contextInfo.participant,
              },
              participant: msg.message.extendedTextMessage.contextInfo.participant,
            }
          : null;

        await handleCommand(sock, msg, {
          command,
          args,
          text: argText,
          quoted,
          isOwner,
          isAdmin,
          isGroup,
          sender,
          pushName,
        });
      } catch (err) {
        console.error('[TEKSI-MD] Message error:', err.message);
      }
    }
  });

  // ---------- Welcome / goodbye ----------
  sock.ev.on('group-participants.update', async (update) => {
    try {
      const { id: groupJid, participants, action } = update;
      const group = settings.getGroup(groupJid);
      if (action === 'add' && group.welcome) {
        for (const p of participants) {
          await sock.sendMessage(groupJid, {
            text: `*Karibu!* 👋 @${normalizeNumber(p)}\nWelcome to the group!\n\nType *${config.prefix}menu* to see what I can do.`,
            mentions: [p],
          });
        }
      }
      if (action === 'remove' && group.goodbye) {
        for (const p of participants) {
          await sock.sendMessage(groupJid, {
            text: `*Goodbye!* 👋 @${normalizeNumber(p)} left the group.`,
            mentions: [p],
          });
        }
      }
    } catch (e) {
      console.error('[TEKSI-MD] Welcome/goodbye error:', e.message);
    }
  });

  // ---------- Anti-call ----------
  sock.ev.on('call', async (calls) => {
    if (!settings.getGlobal('anticall', true)) return;
    for (const call of calls) {
      if (call.status === 'offer') {
        await sock.rejectCall(call.id, call.from).catch(() => {});
      }
    }
  });

  return sock;
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[TEKSI-MD] Shutting down...');
  process.exit(0);
});
process.on('SIGTERM', () => process.exit(0));

// Start
startBot().catch((err) => {
  console.error('[TEKSI-MD] Fatal error:', err);
  process.exit(1);
});
