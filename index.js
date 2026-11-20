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
const path = require('path');

const config = require('./config');
const { handleCommand } = require('./plugins/commands');
const { normalizeNumber } = require('./lib/utils');

const logger = pino({ level: 'silent' });

function banner() {
  console.log('\n' + '='.repeat(50));
  console.log(`  ${config.botName}  •  ${config.botTitle}`);
  console.log('  WhatsApp Multi-Device Bot');
  console.log(`  Owner: ${config.ownerNumber}`);
  console.log('='.repeat(50) + '\n');
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

    // Pairing code (first run only)
    if (!sock.authState.creds.registered && connection === 'close' || (!sock.authState.creds.registered && qr)) {
      // handled below via pairing request
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

        // Auto-read status
        if (isStatus) {
          if (config.autoReadStatus) {
            await sock.readMessages([msg.key]).catch(() => {});
          }
          continue;
        }

        if (config.autoReadMessages) {
          await sock.readMessages([msg.key]).catch(() => {});
        }

        // Extract text (normal, edited, quoted, etc.)
        const textMsg =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          '';
        const text = String(textMsg).trim();
        if (!text) continue;

        // Anti-link (groups)
        if (isGroup && config.antiLink && !isOwner && /https?:\/\//i.test(text)) {
          const meta = await sock.groupMetadata(remoteJid).catch(() => null);
          const me = meta?.participants?.find(p => normalizeNumber(p.id) === normalizeNumber(sock.user?.id));
          if (me?.admin) {
            await sock.sendMessage(remoteJid, { delete: msg.key }).catch(() => {});
            await sock.sendMessage(remoteJid, { text: `@${senderNum} Links are not allowed here.`, mentions: [sender] });
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

        // Group admin check
        let isAdmin = false;
        if (isGroup) {
          const meta = await sock.groupMetadata(remoteJid).catch(() => null);
          const me = meta?.participants?.find(p => normalizeNumber(p.id) === normalizeNumber(sock.user?.id));
          isAdmin = !!me?.admin;
        }

        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage
          ? { message: msg.message.extendedTextMessage.contextInfo.quotedMessage, key: msg.message.extendedTextMessage.contextInfo.quotedMessage ? msg.message.extendedTextMessage.contextInfo : null, participant: msg.message.extendedTextMessage.contextInfo.participant }
          : null;

        // Better quoted object for downloadMediaMessage compatibility
        let quotedFull = null;
        if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
          quotedFull = {
            message: msg.message.extendedTextMessage.contextInfo.quotedMessage,
            key: {
              remoteJid: msg.message.extendedTextMessage.contextInfo.quotedMessage ? remoteJid : remoteJid,
              id: msg.message.extendedTextMessage.contextInfo.stanzaId,
              participant: msg.message.extendedTextMessage.contextInfo.participant,
            },
            participant: msg.message.extendedTextMessage.contextInfo.participant,
          };
        }

        await handleCommand(sock, msg, {
          command,
          args,
          text: argText,
          quoted: quotedFull,
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

  // ---------- Welcome new members ----------
  sock.ev.on('group-participants.update', async (update) => {
    try {
      if (!config.welcome) return;
      const { id: groupJid, participants, action } = update;
      if (action === 'add') {
        for (const p of participants) {
          await sock.sendMessage(groupJid, {
            text: `*Karibu!* 👋 @${normalizeNumber(p)}\nWelcome to the group!\n\nType *${config.prefix}menu* to see what I can do.`,
            mentions: [p],
          });
        }
      }
    } catch (e) {
      console.error('[TEKSI-MD] Welcome error:', e.message);
    }
  });

  // ---------- Auto-reject calls ----------
  sock.ev.on('call', async (calls) => {
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
