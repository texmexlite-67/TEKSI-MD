// ============================================
//  TEKSI-MD  •  TEKSI  —  PDF / ZIP / file tools
// ============================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const AdmZip = require('adm-zip');

const UA = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

function pythonCmd() {
  for (const cmd of ['python', 'python3']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', timeout: 8000 });
    if (!r.error && r.status === 0) return cmd;
  }
  return null;
}

function tempDir(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `teksi-${tag}-`));
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function hasModule(moduleName) {
  const py = pythonCmd();
  if (!py) return false;
  const r = spawnSync(py, ['-c', `import importlib.util;print(1 if importlib.util.find_spec('${moduleName}') else 0)`], { encoding: 'utf8', timeout: 10000 });
  return r.stdout?.trim() === '1';
}

function hasBinary(name) {
  const r = spawnSync(name, ['--version'], { encoding: 'utf8', timeout: 8000 });
  // Some tools (zip/unzip) print usage instead of exiting 0 on --version.
  return !r.error;
}

// Accept either a raw Buffer or a file-like object { buffer, mime, name }.
function asBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input?.buffer) return Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer);
  return Buffer.from(input || []);
}

function mimeKind(mime = '', name = '') {
  const m = String(mime).toLowerCase();
  const n = String(name).toLowerCase();
  if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.includes('zip') || n.endsWith('.zip')) return 'zip';
  if (/\.(txt|md|json|js|ts|py|csv|log|xml|html|css|yml|yaml)$/.test(n) || m.startsWith('text/')) return 'text';
  return 'file';
}

// ------------------------------- PDF -------------------------------
async function pdfUnlock(buffer, password = '') {
  const bytes = asBuffer(buffer);
  // 1) Pure JS: reload ignoring permissions and copy pages into a fresh PDF.
  try {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    return { buffer: Buffer.from(await out.save({ useObjectStreams: true })), mime: 'application/pdf', name: 'unlocked.pdf' };
  } catch {}

  // 2) qpdf / pikepdf for user-password protected files.
  const dir = tempDir('pdfunlock');
  try {
    const src = path.join(dir, 'in.pdf');
    const dst = path.join(dir, 'out.pdf');
    fs.writeFileSync(src, bytes);
    if (hasBinary('qpdf')) {
      const r = spawnSync('qpdf', ['--decrypt', src, dst], { encoding: 'utf8', timeout: 120000 });
      if (r.status === 0) return { buffer: fs.readFileSync(dst), mime: 'application/pdf', name: 'unlocked.pdf' };
    }
    if (hasModule('pikepdf')) {
      const py = pythonCmd();
      const script = 'import pikepdf,sys\np=pikepdf.open(sys.argv[1], password=sys.argv[3])\np.save(sys.argv[2])';
      const r = spawnSync(py, ['-c', script, src, dst, password], { encoding: 'utf8', timeout: 120000 });
      if (r.status === 0) return { buffer: fs.readFileSync(dst), mime: 'application/pdf', name: 'unlocked.pdf' };
    }
  } finally {
    cleanupDir(dir);
  }
  throw new Error('Could not unlock this PDF. If it has a user password, use: .pdfunlock <password>. On Termux: pkg install qpdf');
}

async function pdfLock(buffer, password, ownerPassword) {
  const bytes = asBuffer(buffer);
  const dir = tempDir('pdflock');
  try {
    const src = path.join(dir, 'in.pdf');
    const dst = path.join(dir, 'out.pdf');
    fs.writeFileSync(src, bytes);
    if (hasBinary('qpdf')) {
      const owner = ownerPassword || password;
      const r = spawnSync('qpdf', ['--encrypt', password, owner, '256', '--', src, dst], { encoding: 'utf8', timeout: 120000 });
      if (r.status === 0) return { buffer: fs.readFileSync(dst), mime: 'application/pdf', name: 'locked.pdf', password };
    }
    if (!hasModule('pikepdf')) {
      throw new Error('PDF encryption needs qpdf or pikepdf. On Termux: pkg install qpdf');
    }
    const py = pythonCmd();
    const script = [
      'import pikepdf,sys',
      'with pikepdf.open(sys.argv[1]) as p:',
      '    p.save(sys.argv[2], encryption=pikepdf.Encryption(user=sys.argv[3], owner=sys.argv[4], R=6))',
    ].join('\n');
    const r = spawnSync(py, ['-c', script, src, dst, password, ownerPassword || password], { encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) throw new Error((r.stderr || '').trim().slice(0, 180) || 'pikepdf failed');
    return { buffer: fs.readFileSync(dst), mime: 'application/pdf', name: 'locked.pdf', password };
  } finally {
    cleanupDir(dir);
  }
}

async function pdfMerge(buffers) {
  if (!buffers?.length) throw new Error('No PDFs supplied.');
  const out = await PDFDocument.create();
  for (const buffer of buffers) {
    const src = await PDFDocument.load(asBuffer(buffer), { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return { buffer: Buffer.from(await out.save({ useObjectStreams: true })), mime: 'application/pdf', name: 'merged.pdf' };
}

async function pdfToImages(buffer, format = 'png') {
  const { pdf } = await import('pdf-to-img');
  const url = `data:application/pdf;base64,${asBuffer(buffer).toString('base64')}`;
  const doc = await pdf(url, { scale: 1.6, format });
  const images = [];
  try {
    let i = 1;
    for await (const page of doc) {
      if (i > 12) break;
      images.push({
        buffer: Buffer.from(page),
        mime: format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : 'image/png',
        name: `page-${i}.${format === 'png' ? 'png' : 'jpg'}`,
      });
      i++;
    }
  } finally {
    doc.destroy?.();
  }
  if (!images.length) throw new Error('No pages found in that PDF.');
  return images;
}

async function imgToPdf(inputs) {
  if (!inputs?.length) throw new Error('No images supplied.');
  const out = await PDFDocument.create();
  for (const input of inputs) {
    const source = Buffer.isBuffer(input) ? input : (input.buffer || input.path);
    const meta = await sharp(source).metadata();
    const png = await sharp(source).png().toBuffer();
    const img = await out.embedPng(png);
    const w = meta.width || img.width;
    const h = meta.height || img.height;
    const page = out.addPage([w, h]);
    page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  }
  return { buffer: Buffer.from(await out.save({ useObjectStreams: true })), mime: 'application/pdf', name: 'images.pdf' };
}

// ------------------------------- TEXT / FILE -------------------------------
function txtToFile(text, name = 'note.txt', mime = 'text/plain') {
  return { buffer: Buffer.from(String(text || '')), mime, name };
}

async function fileToText(input, name = '', mime = '') {
  const bytes = asBuffer(input);
  const kind = mimeKind(mime, name);
  if (kind === 'text') return bytes.toString('utf8').slice(0, 20000);
  if (kind === 'pdf') {
    const dir = tempDir('pdftotext');
    try {
      const src = path.join(dir, 'in.pdf');
      fs.writeFileSync(src, bytes);
      // Termux: pkg install poppler  → provides pdftotext
      if (hasBinary('pdftotext')) {
        const r = spawnSync('pdftotext', [src, '-'], { encoding: 'utf8', timeout: 120000 });
        if (r.status === 0 && r.stdout?.trim()) return r.stdout.trim().slice(0, 20000);
      }
      // Fallback: Python pypdf
      if (hasModule('pypdf')) {
        const py = pythonCmd();
        const script = 'import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint("\\n\\n".join((p.extract_text() or "") for p in r.pages))';
        const r = spawnSync(py, ['-c', script, src], { encoding: 'utf8', timeout: 120000 });
        if (r.status === 0 && r.stdout?.trim()) return r.stdout.trim().slice(0, 20000);
      }
    } finally {
      cleanupDir(dir);
    }
    return 'This PDF has no selectable text (it may be a scanned image). On Termux run: pkg install poppler';
  }
  if (kind === 'zip') {
    const zip = new AdmZip(bytes);
    return zip.getEntries().filter((e) => !e.isDirectory)
      .map((e) => `*${e.entryName}*\n${e.getData().toString('utf8').slice(0, 4000)}`).join('\n\n') || 'ZIP is empty.';
  }
  throw new Error('FILETOTXT supports text files, PDFs and ZIPs. Images need OCR (not installed).');
}

// ------------------------------- ZIP -------------------------------
async function zipLock(files, password) {
  if (!files?.length) throw new Error('No files to zip.');
  if (!password) throw new Error('Usage: .ziplock <password>  (reply to a file)');
  const dir = tempDir('ziplock');
  try {
    const out = path.join(dir, 'locked.zip');
    // Termux: pkg install zip  → zip -P supports password-protected archives
    if (!hasModule('pyzipper')) {
      if (!hasBinary('zip')) throw new Error('ZIP encryption needs pyzipper or the zip binary. On Termux run: pkg install zip');
      const names = [];
      for (const [i, f] of files.entries()) {
        const raw = Buffer.isBuffer(f) ? `file-${i + 1}.bin` : (f.name || `file-${i + 1}.bin`);
        const safeName = path.basename(raw).replace(/[^\w.\-]/g, '_') || `file-${i + 1}.bin`;
        fs.writeFileSync(path.join(dir, safeName), asBuffer(f));
        names.push(safeName);
      }
      const r = spawnSync('zip', ['-q', '-P', password, 'locked.zip', ...names], { cwd: dir, encoding: 'utf8', timeout: 180000 });
      if (r.status !== 0 || !fs.existsSync(out)) throw new Error((r.stderr || 'zip failed').trim().slice(0, 180));
      return { buffer: fs.readFileSync(out), mime: 'application/zip', name: 'locked.zip', password };
    }
    const py = pythonCmd();
    const script = [
      'import sys,json,base64,pyzipper',
      'files=json.loads(sys.stdin.read())',
      'with pyzipper.AESZipFile(sys.argv[1],"w",compression=pyzipper.ZIP_DEFLATED,encryption=pyzipper.WZ_AES) as z:',
      '    z.setpassword(sys.argv[2].encode())',
      '    for f in files:',
      '        z.writestr(f["name"], base64.b64decode(f["data"]))',
    ].join('\n');
    const payload = JSON.stringify(files.map((f) => ({
      name: Buffer.isBuffer(f) ? 'file.bin' : (f.name || 'file.txt'),
      data: asBuffer(f).toString('base64'),
    })));
    const r = spawnSync(py, ['-c', script, out, password], { input: payload, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 180000 });
    if (r.status !== 0) throw new Error((r.stderr || '').trim().slice(0, 200) || 'pyzipper failed');
    return { buffer: fs.readFileSync(out), mime: 'application/zip', name: 'locked.zip', password };
  } finally {
    cleanupDir(dir);
  }
}

async function zipUnlock(buffer, password) {
  if (!password) throw new Error('Usage: .zipunlock <password>  (reply to a locked ZIP)');
  const bytes = asBuffer(buffer);
  const dir = tempDir('zipunlock');
  try {
    const src = path.join(dir, 'in.zip');
    const outdir = path.join(dir, 'out');
    fs.writeFileSync(src, bytes);
    fs.mkdirSync(outdir);
    if (hasModule('pyzipper')) {
      const py = pythonCmd();
      const script = [
        'import sys,pyzipper,os',
        'with pyzipper.AESZipFile(sys.argv[1]) as z:',
        '    z.setpassword(sys.argv[2].encode())',
        '    z.extractall(sys.argv[3])',
      ].join('\n');
      const r = spawnSync(py, ['-c', script, src, password, outdir], { encoding: 'utf8', timeout: 180000 });
      if (r.status !== 0) throw new Error('Wrong password or unsupported ZIP encryption.');
    } else if (hasBinary('unzip')) {
      // Termux: pkg install unzip  → unzip -P handles ZipCrypto archives
      const r = spawnSync('unzip', ['-q', '-o', '-P', password, src, '-d', outdir], { encoding: 'utf8', timeout: 180000 });
      if (r.status !== 0) throw new Error('Wrong password or unsupported ZIP encryption.');
    } else {
      // Fallback for classic ZipCrypto archives.
      const zip = new AdmZip(bytes);
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const data = entry.getData(password);
        fs.writeFileSync(path.join(outdir, path.basename(entry.entryName)), data);
      }
    }
    const files = [];
    const walk = (folder) => {
      for (const entry of fs.readdirSync(folder)) {
        const full = path.join(folder, entry);
        if (fs.statSync(full).isDirectory()) walk(full);
        else files.push({ buffer: fs.readFileSync(full), name: entry, mime: 'application/octet-stream' });
      }
    };
    walk(outdir);
    if (!files.length) throw new Error('ZIP is empty.');
    return files;
  } finally {
    cleanupDir(dir);
  }
}

// ------------------------------- COMPRESS -------------------------------
async function compress(input, name = '', mime = '') {
  const bytes = asBuffer(input);
  const kind = mimeKind(mime, name);
  if (kind === 'image') {
    const buf = await sharp(bytes).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 68, mozjpeg: true }).toBuffer();
    return { buffer: buf, mime: 'image/jpeg', name: String(name).replace(/\.[^.]+$/, '') + '-compressed.jpg' };
  }
  if (kind === 'pdf') {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    return { buffer: Buffer.from(await out.save({ useObjectStreams: true })), mime: 'application/pdf', name: 'compressed.pdf' };
  }
  if (kind === 'video' || kind === 'audio') {
    if (!hasBinary('ffmpeg')) throw new Error('Compression needs ffmpeg. On Termux: pkg install ffmpeg');
    const dir = tempDir('compress');
    try {
      const src = path.join(dir, 'input');
      const dst = path.join(dir, kind === 'video' ? 'out.mp4' : 'out.mp3');
      fs.writeFileSync(src, bytes);
      const args = kind === 'video'
        ? ['-y', '-loglevel', 'error', '-i', src, '-c:v', 'libx264', '-crf', '28', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '96k', dst]
        : ['-y', '-loglevel', 'error', '-i', src, '-vn', '-b:a', '96k', dst];
      const r = spawnSync('ffmpeg', args, { encoding: 'utf8', timeout: 300000 });
      if (r.error || r.status !== 0) throw new Error((r.stderr || '').trim().slice(0, 180) || 'ffmpeg failed');
      return { buffer: fs.readFileSync(dst), mime: kind === 'video' ? 'video/mp4' : 'audio/mpeg', name: kind === 'video' ? 'compressed.mp4' : 'compressed.mp3' };
    } finally {
      cleanupDir(dir);
    }
  }
  const zip = new AdmZip();
  zip.addFile(name || 'file.bin', bytes);
  return { buffer: zip.toBuffer(), mime: 'application/zip', name: 'compressed.zip' };
}

module.exports = {
  mimeKind, pdfUnlock, pdfLock, pdfMerge, pdfToImages, imgToPdf,
  txtToFile, fileToText, zipLock, zipUnlock, compress,
};
