// ============================================
//  TEKSI-MD  •  TEKSI  —  Utility helpers
// ============================================

function formatUptime(seconds) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || !parts.length) parts.push(`${s}s`);
  return parts.join(' ');
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function getDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const time = now.toLocaleTimeString('en-KE', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  return { date, time };
}

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Convert 254715442684@s.whatsapp.net -> 254715442684
function normalizeNumber(jid) {
  if (!jid) return '';
  return jid.split('@')[0].replace(/[^0-9]/g, '');
}

// Escape XML for SVG text
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { formatUptime, getGreeting, getDateTime, random, sleep, normalizeNumber, escapeXml };
