// ============================================
//  TEKSI-MD  •  TEKSI  —  Audio edit tools
//  Powered by ffmpeg (required — clear error if absent)
// ============================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function ffmpegAvailable() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', timeout: 10000 });
  return !r.error && r.status === 0;
}

function extFor(mime = '') {
  if (/ogg|opus/.test(mime)) return 'ogg';
  if (/mpeg|mp3/.test(mime)) return 'mp3';
  if (/mp4|m4a|aac/.test(mime)) return 'm4a';
  if (/webm/.test(mime)) return 'webm';
  if (/wav/.test(mime)) return 'wav';
  return 'audio';
}

async function convert(input, args, outputName, label) {
  if (!ffmpegAvailable()) {
    throw new Error(`${label} needs ffmpeg installed on the bot host.`);
  }
  if (!input || !(input.buffer?.length || input.path)) throw new Error('No audio found. Reply to an audio/voice message.');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teksi-audio-'));
  const src = path.join(dir, `input.${extFor(input.mime)}`);
  const out = path.join(dir, outputName);
  try {
    fs.writeFileSync(src, input.buffer);
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, ...args, out], {
      encoding: 'utf8', timeout: 300000, maxBuffer: 10 * 1024 * 1024,
    });
    if (r.error || r.status !== 0) {
      throw new Error((r.stderr || '').trim().slice(0, 180) || 'ffmpeg failed');
    }
    return { buffer: fs.readFileSync(out), mime: 'audio/mpeg', name: outputName };
  } finally {
    try { fs.unlinkSync(src); } catch {}
    try { fs.unlinkSync(out); } catch {}
    try { fs.rmdirSync(dir); } catch {}
  }
}

function toMp3(input) {
  return convert(input, ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'], 'converted.mp3', 'TOMP3');
}

function to8d(input) {
  // apulsator sweeps the stereo field — the classic "8D" effect.
  return convert(input, ['-af', 'apulsator=hz=0.09:amount=1', '-c:a', 'libmp3lame', '-q:a', '2'], '8d-audio.mp3', 'TO8DAUDIO');
}

function toBass(input) {
  return convert(input, ['-af', 'bass=g=14:f=65:w=0.7,alimiter=limit=0.95', '-c:a', 'libmp3lame', '-q:a', '2'], 'bass-boosted.mp3', 'TOBASS');
}

function toSlowed(input) {
  return convert(input, ['-af', 'asetrate=44100*0.85,aresample=44100,atempo=0.95', '-c:a', 'libmp3lame', '-q:a', '2'], 'slowed.mp3', 'TOSLOWED');
}

module.exports = { ffmpegAvailable, toMp3, to8d, toBass, toSlowed };
