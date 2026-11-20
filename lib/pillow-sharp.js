'use strict';

// Minimal sharp-compatible API backed by Python + Pillow.
// Used on Termux/arm32 where native and WASM sharp are unreliable.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const RUNNER = path.join(__dirname, 'pillow_runner.py');

let pythonBin = null;
function python() {
  if (pythonBin) return pythonBin;
  for (const candidate of ['python3', 'python']) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) {
      pythonBin = candidate;
      return pythonBin;
    }
  }
  throw new Error('Python not found. On Termux run: pkg install python pillow');
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'teksi-pillow-'));
}

function writeInput(value, dir, tag) {
  if (Buffer.isBuffer(value)) {
    const file = path.join(dir, `${tag}-${crypto.randomBytes(4).toString('hex')}.img`);
    fs.writeFileSync(file, value);
    return { type: 'file', path: file };
  }
  if (typeof value === 'string') {
    return { type: 'file', path: path.resolve(value) };
  }
  throw new Error(`Unsupported image input: ${typeof value}`);
}

function background(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value.r !== undefined) {
    return { r: value.r, g: value.g, b: value.b, alpha: value.alpha ?? 255 };
  }
  return undefined;
}

function runPython(payload) {
  const result = spawnSync(python(), [RUNNER], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 180000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`Pillow image backend failed: ${detail.slice(0, 400)}`);
  }
  return result;
}

class PillowImage {
  constructor(input) {
    this.input = input;
    this.ops = [];
    this.format = 'PNG';
    this.quality = 90;
  }

  resize(width, height, options = {}) {
    let opts;
    if (width && typeof width === 'object' && !Buffer.isBuffer(width)) {
      opts = width;
    } else {
      opts = { width, height, ...(height && typeof height === 'object' ? height : {}) };
    }
    this.ops.push({
      op: 'resize',
      width: opts.width,
      height: opts.height,
      fit: opts.fit || 'cover',
      background: background(opts.background),
      withoutEnlargement: Boolean(opts.withoutEnlargement),
    });
    return this;
  }

  composite(items = []) {
    this.ops.push({ op: 'composite', items });
    return this;
  }

  rotate() {
    this.ops.push({ op: 'rotate' });
    return this;
  }

  png() {
    this.format = 'PNG';
    return this;
  }

  jpeg(options = {}) {
    this.format = 'JPEG';
    this.quality = options.quality || 90;
    return this;
  }

  webp(options = {}) {
    this.format = 'WEBP';
    this.quality = options.quality || 90;
    return this;
  }

  async metadata() {
    const dir = makeTempDir();
    try {
      const input = this._prepareInput(dir);
      runPython({ mode: 'metadata', input });
      const probe = this._probeInput(input, dir);
      return probe;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  async toBuffer(options = {}) {
    const dir = makeTempDir();
    try {
      const input = this._prepareInput(dir);
      const outputPath = path.join(dir, 'out.img');
      const ops = this.ops.map((op) => {
        if (op.op !== 'composite') return op;
        return {
          op: 'composite',
          items: op.items.map((item, index) => ({
            left: item.left || 0,
            top: item.top || 0,
            ...writeInput(item.input, dir, `composite-${index}`),
          })),
        };
      });
      runPython({ mode: 'process', input, ops, output: { path: outputPath, format: this.format, quality: this.quality } });
      const data = fs.readFileSync(outputPath);
      if (!options.resolveWithObject) return data;
      const info = JSON.parse(fs.readFileSync(outputPath + '.json', 'utf8'));
      return { data, info: { ...info, channels: 4, size: data.length } };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  _prepareInput(dir) {
    const raw = this.input;
    if (raw && typeof raw === 'object' && raw.create) {
      const create = raw.create;
      return {
        type: 'create',
        width: create.width,
        height: create.height,
        background: background(create.background) || '#000000',
      };
    }
    return writeInput(raw, dir, 'input');
  }

  _probeInput(input, dir) {
    // Cheap metadata: run a normal PNG conversion, then read its .json info.
    const outputPath = path.join(dir, 'probe.png');
    runPython({ mode: 'process', input, ops: [], output: { path: outputPath, format: 'PNG' } });
    const info = JSON.parse(fs.readFileSync(outputPath + '.json', 'utf8'));
    return { width: info.width, height: info.height, format: info.format, size: info.size };
  }
}

function sharp(input) {
  return new PillowImage(input);
}

sharp.versions = { pillow: 'python-pillow' };
sharp.cache = () => {};
sharp.concurrency = () => 1;

module.exports = sharp;
