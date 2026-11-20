// ============================================
//  TEKSI-MD  •  TEKSI  —  Bot display picture
// ============================================
const fs = require('fs');
const path = require('path');
const sharp = require('./sharp');

function resolveFile(file) {
  if (!file) throw new Error('No DP file configured.');
  return path.isAbsolute(file)
    ? file
    : path.join(__dirname, '..', String(file).replace(/^\.\//, ''));
}

// Crop any image into the square JPEG WhatsApp uses for profile pictures.
async function prepareDp(file) {
  const abs = resolveFile(file);
  if (!fs.existsSync(abs)) throw new Error(`DP file not found: ${abs}`);
  return sharp(fs.readFileSync(abs))
    .resize(640, 640, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function setBotProfilePicture(sock, file) {
  const buffer = await prepareDp(file);
  const jid = sock.user?.id || sock.authState?.creds?.me?.id;
  if (!jid) throw new Error('Bot JID is not available yet.');
  await sock.updateProfilePicture(jid, { buffer });
  return true;
}

module.exports = { prepareDp, setBotProfilePicture, resolveFile };
