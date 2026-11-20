// ============================================
//  TEKSI-MD  •  TEKSI  —  Free AI (no API key)
//  Uses Pollinations AI — free, no signup needed
// ============================================
const axios = require('axios');

async function askAI(prompt) {
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`;
  const { data } = await axios.get(url, { timeout: 60000, responseType: 'text' });
  return typeof data === 'string' ? data.trim() : JSON.stringify(data);
}

async function generateImage(prompt) {
  // Returns a URL — caller downloads it as buffer
  const seed = Math.floor(Math.random() * 100000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;
}

module.exports = { askAI, generateImage };
