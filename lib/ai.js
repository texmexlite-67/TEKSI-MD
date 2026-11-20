// ============================================
//  TEKSI-MD  •  TEKSI  —  Free AI (no API key)
//  Uses Pollinations AI — free, no signup needed
// ============================================
const axios = require('axios');

// Pollinations currently exposes one anonymous model ("openai-fast").
// The GPT/Gemini command names are friendly aliases for it.
const MODEL_ALIASES = {
  ai: 'openai-fast',
  ask: 'openai-fast',
  gpt: 'openai-fast',
  gpt1: 'openai-fast',
  gpt2: 'openai-fast',
  gpt3: 'openai-fast',
  gpt4: 'openai-fast',
  gemini: 'openai-fast',
  openai: 'openai-fast',
};

const MODEL_LABELS = {
  ai: 'TEKSI AI',
  ask: 'ASK',
  gpt: 'GPT',
  gpt1: 'GPT-1',
  gpt2: 'GPT-2',
  gpt3: 'GPT-3',
  gpt4: 'GPT-4',
  gemini: 'Gemini',
};

async function askAI(prompt, model = 'ai') {
  const key = String(model || 'ai').toLowerCase().replace(/[^a-z0-9]/g, '');
  const modelName = MODEL_ALIASES[key] || 'openai-fast';
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${encodeURIComponent(modelName)}`;
  const { data } = await axios.get(url, { timeout: 60000, responseType: 'text' });
  return typeof data === 'string' ? data.trim() : JSON.stringify(data);
}

async function generateImage(prompt) {
  // Returns a URL — caller downloads it as buffer
  const seed = Math.floor(Math.random() * 100000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;
}

module.exports = { askAI, generateImage, MODEL_ALIASES, MODEL_LABELS };
