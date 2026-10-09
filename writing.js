const fs = require('node:fs');
const path = require('node:path');
const seed = require('./writing.seed.json');
const { createPhotoStore, validPhotoId, MAX_UPLOAD } = require('./photos');
const { writingPhotoIds, validateWritingBlocks } = require('./writing-document');
const validEssayId = id => typeof id === 'string' && /^[a-z0-9-]{1,80}$/.test(id);
function validateEssays(essays) {
  if (!Array.isArray(essays) || essays.length > 200) throw new Error('Use at most 200 essays.');
  const ids = new Set();
  return essays.map(essay => {
    if (!essay || !validEssayId(essay.id) || ids.has(essay.id) || typeof essay.title !== 'string' || !essay.title.trim() || essay.title.length > 200 || !['draft', 'published', 'archived'].includes(essay.status)) throw new Error('Check the essay title and status.');
    ids.add(essay.id);
    const dates = {};
    for (const field of ['createdAt', 'updatedAt', 'publishedAt']) {
      if (essay[field] !== null && (typeof essay[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(essay[field]) || !Number.isFinite(Date.parse(essay[field])))) throw new Error('Check the essay dates.');
      dates[field] = essay[field];
    }
    if (essay.archivedStatus !== undefined && !['draft', 'published'].includes(essay.archivedStatus)) throw new Error('Check the archived essay status.');
    return { id: essay.id, title: essay.title.trim(), status: essay.status, ...dates, ...(essay.archivedStatus ? { archivedStatus: essay.archivedStatus } : {}), blocks: validateWritingBlocks(essay.blocks) };
  });
}
function createWritingService(options = {}) {
  const root = options.directory || process.env.MING_SITE_DATA_DIR || path.join(__dirname, '.data');
  const directory = path.join(root, 'writing');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'essays.json');
  let state;
  try {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Number.isSafeInteger(state.revision) || state.revision < 0) throw new Error('Invalid saved writing revision.');
    state.essays = validateEssays(state.essays);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = { revision: 0, essays: validateEssays(seed) };
    fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  }
  const photos = createPhotoStore(directory, { quotaDirectory: root });
  photos.cleanup(writingPhotoIds(state.essays));
  const canEdit = req => options.canEdit ? options.canEdit(req) : process.env.MING_SITE_EDIT_PROTECTED !== 'true';
  const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  const publicEssays = () => state.essays.filter(essay => essay.status === 'published');
  function commit(essays) {
    const next = { revision: state.revision + 1, essays: validateEssays(essays) };
    const oldPhotos = writingPhotoIds(state.essays), nextPhotos = writingPhotoIds(next.essays);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(`${file}.tmp`, file); state = next;
    try { options.onPublish?.(state); } catch { console.error('Could not persist assistant writing knowledge; restart to retry.'); }
    for (const id of oldPhotos) if (!nextPhotos.has(id)) photos.remove(id);
  }
  async function handle(req, res, url) {
    if (!/^\/api\/writing(?:\/|$)/.test(url.pathname)) return false;
    if (req.headers.origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(req.headers.origin) && req.headers['sec-fetch-site'] !== 'same-origin') { send(res, 403, { error: 'Origin not allowed.' }); return true; }
    const photoRoute = /^\/api\/writing\/photos\/([^/]+)$/.exec(url.pathname);
    try {
      if (url.pathname === '/api/writing/session' && req.method === 'GET') { send(res, 200, { canEdit: Boolean(canEdit(req)) }); return true; }
      if (url.pathname === '/api/writing' && req.method === 'GET') {
        const managing = url.searchParams.get('manage') === '1';
        if (managing && !canEdit(req)) { send(res, 401, { error: 'Unlock editing in Travel first.' }); return true; }
        send(res, 200, { revision: state.revision, essays: managing ? state.essays : publicEssays() }); return true;
      }
      const essayRoute = /^\/api\/writing\/essays\/([^/]+)$/.exec(url.pathname);
      if (essayRoute && req.method === 'GET') {
        const essay = publicEssays().find(item => item.id === essayRoute[1]);
        send(res, essay ? 200 : 404, essay || { error: 'This essay is not published.' }); return true;
      }
      if (photoRoute && ['GET', 'HEAD'].includes(req.method)) {
        const id = photoRoute[1];
        if (!validPhotoId(id) || !photos.exists(id) || !writingPhotoIds(publicEssays()).has(id) && !canEdit(req)) { send(res, 404, { error: 'Picture not found.' }); return true; }
        res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'" });
        if (req.method === 'HEAD') res.end(); else fs.createReadStream(photos.file(id)).pipe(res);
        return true;
      }
      if (!canEdit(req)) { send(res, 401, { error: 'Unlock editing in Travel first.' }); return true; }
      if (photoRoute && req.method === 'DELETE') {
        if (!validPhotoId(photoRoute[1])) throw new Error('Invalid picture.');
        if (writingPhotoIds(state.essays).has(photoRoute[1])) { send(res, 409, { error: 'Remove the picture from its essay and save first.' }); return true; }
        photos.remove(photoRoute[1]); send(res, 200, { removed: true }); return true;
      }
      if (url.pathname === '/api/writing/photos' && req.method === 'POST') {
        if (!/^image\/(jpeg|png|webp)(?:;|$)/i.test(req.headers['content-type'] || '')) { send(res, 415, { error: 'Choose a JPEG, PNG, or WebP picture.' }); return true; }
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > MAX_UPLOAD) { send(res, 413, { error: 'Choose a picture smaller than 10 MB.' }); return true; } chunks.push(chunk); }
        photos.cleanup(writingPhotoIds(state.essays));
        send(res, 201, await photos.create(Buffer.concat(chunks))); return true;
      }
      if (url.pathname === '/api/writing' && req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 1000000) { send(res, 413, { error: 'Essay is too large.' }); return true; } }
        let input; try { input = JSON.parse(raw); } catch { throw new Error('Invalid essay.'); }
        if (input.revision !== state.revision) { send(res, 409, { error: 'Writing changed in another window. Reload before saving; your text is still in the editor.' }); return true; }
        const existing = state.essays.find(essay => essay.id === input.essay?.id);
        const now = new Date().toISOString();
        const archivedStatus = input.essay?.status === 'archived' ? existing?.status === 'archived' ? existing.archivedStatus : existing?.status || 'draft' : undefined;
        const [essay] = validateEssays([{ ...input.essay, archivedStatus, createdAt: existing ? existing.createdAt : now, updatedAt: now, publishedAt: existing?.publishedAt || (input.essay?.status === 'published' ? now : null) }]);
        for (const id of writingPhotoIds([essay])) if (!photos.exists(id)) throw new Error('An uploaded picture is missing. Upload it again.');
        commit(existing ? state.essays.map(item => item.id === essay.id ? essay : item) : [...state.essays, essay]);
        send(res, 200, { revision: state.revision, essay }); return true;
      }
      send(res, 405, { error: 'Method not allowed.' }); return true;
    } catch (error) { send(res, 400, { error: error.message }); return true; }
  }
  return { handle, read: () => ({ revision: state.revision, essays: structuredClone(state.essays) }) };
}
module.exports = { createWritingService, validateEssays };
