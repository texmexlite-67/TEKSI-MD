// ============================================
//  TEKSI-MD  •  TEKSI  •  WhatsApp Bot Config
// ============================================

// Your real WhatsApp number, international format, NO + sign, NO spaces.
// Override remotely with TEKSI_OWNER_NUMBER or OWNER_NUMBER if it is wrong.
const OWNER_NUMBER = process.env.TEKSI_OWNER_NUMBER || process.env.OWNER_NUMBER || '254708335403';

module.exports = {
  // Bot identity — edit these anytime
  botName: 'TEKSI-MD',
  botTitle: 'TEKSI',
  botVersion: '1.0.0',

  // OWNER — your phone number (country code + number, NO + sign, NO spaces)
  ownerNumber: OWNER_NUMBER,
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
  // If WhatsApp rejects linking, this is probably NOT your real number.
  // Override remotely with TEKSI_PAIRING_NUMBER, e.g.:
  //   export TEKSI_PAIRING_NUMBER=2547XXXXXXX
  pairingNumber: process.env.TEKSI_PAIRING_NUMBER || OWNER_NUMBER,

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
