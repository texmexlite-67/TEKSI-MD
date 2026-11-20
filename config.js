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
