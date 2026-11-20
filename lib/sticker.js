// ============================================
//  TEKSI-MD  •  TEKSI  —  Sticker helpers
// ============================================
const sharp = require('./sharp');
const { escapeXml } = require('./utils');

// Image / video buffer -> WhatsApp sticker (webp 512x512)
async function imageToSticker(buffer) {
  const { data } = await sharp(buffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true });
  return data;
}

// Text -> sticker (ATTP style, simple version)
async function textToSticker(text) {
  const clean = String(text || 'TEKSI-MD').slice(0, 120);
  const words = clean.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 18) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());

  const fontSize = lines.length > 3 ? 42 : 52;
  const height = Math.max(512, lines.length * (fontSize + 14) + 80);
  const textEls = lines.map((l, i) =>
    `<text x="256" y="${120 + i * (fontSize + 14)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff">${escapeXml(l)}</text>`
  ).join('\n');

  const svg = `<svg width="512" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="${height}" fill="#111111"/>
    ${textEls}
    <text x="256" y="${height - 30}" text-anchor="middle" font-family="Arial" font-size="22" fill="#25D366">TEKSI-MD</text>
  </svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const webp = await sharp(png)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toBuffer();
  return webp;
}

module.exports = { imageToSticker, textToSticker };
