const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

sharp.cache({ memory: 16 });
sharp.concurrency(1);
const validPhotoId = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
const MAX_UPLOAD = 10 * 1024 * 1024;
let photoQueue = Promise.resolve();

function createPhotoStore(directory, options = {}) {
  const folder = path.join(directory, 'photos');
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  const file = id => validPhotoId(id) ? path.join(folder, `${id}.webp`) : null;
  const exists = id => Boolean(file(id) && fs.existsSync(file(id)));
  const remove = id => { if (file(id)) fs.rmSync(file(id), { force: true }); };
  function usedBytes(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
      const target = path.join(directory, entry.name);
      return total + (entry.isDirectory() ? usedBytes(target) : entry.isFile() && entry.name.endsWith('.webp') ? fs.statSync(target).size : 0);
    }, 0);
  }
  async function encode(bytes) {
    if (!bytes.length || bytes.length > MAX_UPLOAD) throw new Error('Choose a photo smaller than 10 MB.');
    let output;
    try {
      const metadata = await sharp(bytes, { limitInputPixels: 20000000 }).metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('Unsupported format.');
      output = await sharp(bytes, { limitInputPixels: 20000000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    } catch { throw new Error('Choose a valid JPEG, PNG, or WebP photo.'); }
    if (output.length > 2 * 1024 * 1024) throw new Error('This photo is too large after resizing. Try a smaller image.');
    const used = usedBytes(options.quotaDirectory || directory);
    if (used + output.length > 800 * 1024 * 1024) throw new Error('Photo storage is full. Remove some photos before uploading more.');
    const id = crypto.randomUUID();
    try { fs.writeFileSync(file(id), output, { flag: 'wx', mode: 0o600 }); }
    catch { throw new Error('Couldn’t store this photo. Please try again.'); }
    return { id };
  }
  function create(bytes) {
    const task = photoQueue.then(() => encode(bytes));
    photoQueue = task.catch(() => {});
    return task;
  }
  function cleanup(referenced) {
    for (const name of fs.readdirSync(folder)) {
      const id = name.replace(/\.webp$/, '');
      if (validPhotoId(id) && !referenced.has(id) && Date.now() - fs.statSync(file(id)).mtimeMs > 86400000) remove(id);
    }
  }
  return { create, file, exists, remove, cleanup };
}
module.exports = { createPhotoStore, validPhotoId, MAX_UPLOAD };
