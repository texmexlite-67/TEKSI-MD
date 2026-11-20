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
};
