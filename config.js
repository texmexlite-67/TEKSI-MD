// ============================================
//  TEKSI-MD  •  TEKSI  •  WhatsApp Bot Config
// ============================================

module.exports = {
  // Bot identity — edit these anytime
  botName: 'TEKSI-MD',
  botTitle: 'TEKSI',
  botVersion: '1.0.0',

  // OWNER — your phone number (country code + number, NO + sign, NO spaces)
  ownerNumber: '254715442684',
  ownerName: 'TEKSI OWNER',

  // Command prefix
  prefix: '.',

  // Session folder (keep this safe — it is your WhatsApp login)
  sessionFolder: './session',

  // Features
  autoReadStatus: false,   // auto-read WhatsApp statuses
  autoReadMessages: false, // mark messages as read
  antiLink: false,         // block links in groups (toggle with .antilink on/off)
  welcome: true,           // welcome new group members (toggle with .welcome on/off)
  selfMode: false,         // only owner can use bot (toggle with .self / .public)

  // Pairing code number — same as owner by default.
  // If you want the bot on a DIFFERENT number, put that number here.
  pairingNumber: '254715442684',

  // How long each QR code stays valid while pairing (milliseconds).
  // Default: 120000 (120s). Override remotely with TEKSI_QR_TIMEOUT_MS
  // or PAIR_TIMEOUT_MS, e.g. PAIR_TIMEOUT_MS=180000
  qrTimeoutMs: (() => {
    const value = Number(process.env.TEKSI_QR_TIMEOUT_MS || process.env.PAIR_TIMEOUT_MS);
    return Number.isFinite(value) && value > 0 ? value : 120000;
  })(),

  // QR display is OFF by default — we use the 8-digit pairing code instead.
  // Enable temporarily with TEKSI_SHOW_QR=1 if you really need a QR.
  showQr: (process.env.TEKSI_SHOW_QR || '').toLowerCase() === '1' ||
          (process.env.TEKSI_SHOW_QR || '').toLowerCase() === 'true',

  // ---------- Downloads ----------
  // Max file size the bot will try to send (in MB).
  downloadMaxMB: 4096, // 4 GB — large files stream to disk instead of memory

  // Extra Invidious instances for YouTube downloads (optional).
  // The bot fetches healthy public instances automatically.
  invidiousInstances: [],

  // Optional: a Cobalt API key makes Instagram / Facebook downloads reliable.
  // Leave empty to use the public metadata fallback. Can also be set via
  // the COBALT_API_KEY environment variable.
  cobaltApiKey: '',
  cobaltInstance: 'https://api.cobalt.tools',

  // ---------- Bot display picture ----------
  // Applied automatically on the first successful connection and can be
  // refreshed any time with the owner command ".setdp".
  botDp: true,
  botDpFile: './assets/TEKSI-MD_art.png',
};
