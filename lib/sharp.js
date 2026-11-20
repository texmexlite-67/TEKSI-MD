'use strict';

// Backend selector for image processing.
//
// Termux/arm32 cannot reliably load sharp (native or WASM), so use the
// Python + Pillow backend. Everywhere else keep using the real sharp package.

const arch = String(process.arch || '').toLowerCase();
const isArm = arch === 'arm' || arch === 'armv7l' || arch === 'armv6l' || arch === 'armv5tel';
const isTermux = Boolean(process.env.TERMUX_VERSION) ||
  Boolean(process.env.PREFIX && process.env.PREFIX.includes('com.termux'));

const usePillow =
  process.env.TEKSI_IMAGE_BACKEND === 'pillow' ||
  process.env.TEKSI_IMAGE_BACKEND === 'python' ||
  isArm ||
  isTermux;

let backend = null;
if (!usePillow) {
  try {
    backend = require('sharp');
  } catch (error) {
    backend = null;
  }
}
if (!backend) backend = require('./pillow-sharp');

module.exports = backend;
