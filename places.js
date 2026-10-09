const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const seed = require('./places.seed.json');
const highlightIcons = require('./highlight-icons.json');
const { createPhotoStore, validPhotoId, MAX_UPLOAD } = require('./photos');

function validCountry(value) { return typeof value === 'string' && /^[A-Z]{2}$/.test(value); }

function validatePlaces(places) {
  if (!Array.isArray(places) || places.length > 100) throw new Error('Use at most 100 places.');
  const ids = new Set();
  const date = value => value === null || typeof value === 'string' && /^(?:[1-9]\d{3})(?:-(?:0[1-9]|1[0-2]))?$/.test(value);
  return places.map(place => {
    if (!place || typeof place.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(place.id) || ids.has(place.id)) throw new Error('Each place needs a unique ID.');
    ids.add(place.id);
    if (typeof place.name !== 'string' || !place.name.trim() || place.name.length > 100 || typeof place.note !== 'string' || place.note.length > 1000) throw new Error('Check the location name and notes.');
    let highlights;
    if (place.highlights !== undefined) {
      if (!Array.isArray(place.highlights) || place.highlights.length > 5) throw new Error('Use up to five highlights.');
      highlights = place.highlights.map(item => {
        const text = typeof item === 'string' ? item : item?.text;
        const icon = typeof item === 'string' ? 'bullet' : item?.icon;
        if (typeof text !== 'string' || !text.trim() || text.length > 200 || !Object.hasOwn(highlightIcons, icon)) throw new Error('Each highlight needs 1–200 characters and an available icon.');
        return { text: text.trim(), icon };
      });
    }
    if (place.country !== undefined && !validCountry(place.country)) throw new Error('Check the country code.');
    if (place.photos !== undefined && (!Array.isArray(place.photos) || place.photos.length > 3 || new Set(place.photos).size !== place.photos.length || place.photos.some(id => !validPhotoId(id)))) throw new Error('Use up to three uploaded photos per place.');
    if (!Number.isFinite(place.lat) || Math.abs(place.lat) > 90 || !Number.isFinite(place.lon) || Math.abs(place.lon) > 180) throw new Error('Choose a location on the map.');
    if (!date(place.start) || !date(place.end) || typeof place.current !== 'boolean' || place.current && place.end !== null || place.start && place.end && place.end < place.start) throw new Error('Check the date range.');
    return { id: place.id, name: place.name.trim(), start: place.start, end: place.end, current: place.current, lat: place.lat, lon: place.lon, note: place.note.trim(), ...(highlights === undefined ? {} : { highlights }), ...(place.country === undefined ? {} : { country: place.country }), ...(place.photos === undefined ? {} : { photos: [...place.photos] }) };
  });
}

function createPlacesService(options = {}) {
  const requirePassword = options.requirePassword ?? process.env.MING_SITE_EDIT_PROTECTED === 'true';
  const directory = options.directory || process.env.MING_SITE_DATA_DIR || path.join(__dirname, '.data');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const keyPath = path.join(directory, 'owner-key.txt');
  let ownerKey = options.ownerKey || process.env.MING_SITE_EDIT_KEY;
  if (!ownerKey && requirePassword) {
    try { ownerKey = fs.readFileSync(keyPath, 'utf8').trim(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      ownerKey = crypto.randomBytes(24).toString('base64url');
      fs.writeFileSync(keyPath, ownerKey + '\n', { mode: 0o600, flag: 'wx' });
    }
  }
  const storagePath = path.join(directory, 'places.json');
  let state;
  try {
    state = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    if (!Number.isSafeInteger(state.revision) || state.revision < 0) throw new Error('Invalid saved place revision.');
    state.places = validatePlaces(state.places);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = { revision: 0, places: validatePlaces(seed) };
    fs.writeFileSync(storagePath, JSON.stringify(state, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  }
  const sessions = new Map();
  const photos = createPhotoStore(directory);
  const photoIds = list => new Set(list.flatMap(place => place.photos || []));
  photos.cleanup(photoIds(state.places));
  const attempts = new Map();
  const searches = new Map();
  const countries = new Map();
  const hash = value => crypto.createHash('sha256').update(value).digest();
  const ownerHash = hash(ownerKey || '');
  const send = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const session = req => {
    if (!requirePassword) return 'public-editing';
    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')?.[1] || /(?:^|;\s*)ming_owner=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    const expiry = sessions.get(token);
    if (!expiry || expiry <= Date.now()) { if (token) sessions.delete(token); return null; }
    return token;
  };
  const body = async req => {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 180000) throw new Error('Request too large.'); }
    try { return JSON.parse(raw); } catch { throw new Error('Invalid request.'); }
  };
  const cookie = (req, token, maxAge) => `ming_owner=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${req.socket.encrypted || req.headers.origin?.startsWith('https://') ? '; Secure' : ''}`;

  async function handle(req, res, url) {
    if (!/^\/api\/places(?:\/|$)/.test(url.pathname)) return false;
    // Browsers set this forbidden-to-script header from the public URL, even when
    // a preview proxy forwards a different Host. Same-site and cross-site stay blocked.
    if (req.headers.origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(req.headers.origin) && req.headers['sec-fetch-site'] !== 'same-origin') { send(res, 403, { error: 'Origin not allowed.' }); return true; }
    try {
      if (url.pathname === '/api/places/session') {
        if (req.method === 'GET') { send(res, 200, { canEdit: Boolean(session(req)), requiresPassword: requirePassword }); return true; }
        if (req.method === 'DELETE') {
          const token = session(req); if (token) sessions.delete(token);
          res.setHeader('Set-Cookie', cookie(req, '', 0)); send(res, 200, { canEdit: !requirePassword, requiresPassword: requirePassword }); return true;
        }
        if (req.method !== 'POST') { send(res, 405, { error: 'Method not allowed.' }); return true; }
        if (!requirePassword) { send(res, 200, { canEdit: true, requiresPassword: false }); return true; }
        const ip = req.socket.remoteAddress;
        const now = Date.now();
        for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
        const attempt = attempts.get(ip) || { count: 0, until: now + 900000 };
        if (++attempt.count > 10) { send(res, 429, { error: 'Please wait before trying again.' }); return true; }
        attempts.set(ip, attempt);
        const input = await body(req);
        if (typeof input.password !== 'string' || input.password.length > 256 || !crypto.timingSafeEqual(hash(input.password), ownerHash)) { send(res, 401, { error: 'Incorrect editing password.' }); return true; }
        attempts.delete(ip);
        for (const [token, expiry] of sessions) if (expiry <= now) sessions.delete(token);
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, now + 8 * 3600000);
        res.setHeader('Set-Cookie', cookie(req, token, 8 * 3600)); send(res, 200, { canEdit: true, token }); return true;
      }
      if (url.pathname === '/api/places' && req.method === 'GET') { send(res, 200, state); return true; }
      const photoRoute = /^\/api\/places\/photos\/([^/]+)$/.exec(url.pathname);
      if (photoRoute && ['GET', 'HEAD'].includes(req.method)) {
        const id = photoRoute[1];
        if (!photos.exists(id)) { send(res, 404, { error: 'Photo not found.' }); return true; }
        res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" });
        if (req.method === 'HEAD') res.end();
        else fs.createReadStream(photos.file(id)).on('error', () => res.destroy()).pipe(res);
        return true;
      }
      if (url.pathname === '/api/places/country' && req.method === 'GET') {
        const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
        if (!url.searchParams.has('lat') || !url.searchParams.has('lon') || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { send(res, 400, { error: 'Choose a valid location.' }); return true; }
        const known = seed.find(place => place.lat === lat && place.lon === lon);
        if (known?.country) { send(res, 200, { country: known.country }); return true; }
        const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        if (countries.has(key)) { send(res, 200, { country: countries.get(key) }); return true; }
        try {
          const endpoint = new URL('https://photon.komoot.io/reverse');
          endpoint.searchParams.set('lat', lat); endpoint.searchParams.set('lon', lon); endpoint.searchParams.set('limit', '1'); endpoint.searchParams.set('radius', '10');
          const response = await (options.fetch || fetch)(endpoint, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error('Country lookup unavailable.');
          const data = await response.json();
          const raw = data.features?.[0]?.properties?.countrycode;
          const code = typeof raw === 'string' ? raw.toUpperCase() : null;
          const country = validCountry(code) ? code : null;
          if (countries.size >= 500) countries.delete(countries.keys().next().value);
          countries.set(key, country); send(res, 200, { country }); return true;
        } catch { send(res, 503, { error: 'Country lookup unavailable.' }); return true; }
      }
      if (!session(req)) { send(res, 401, { error: 'Unlock editing first.' }); return true; }
      if (url.pathname === '/api/places/photos' && req.method === 'POST') {
        if (!/^image\/(jpeg|png|webp)(?:;|$)/i.test(req.headers['content-type'] || '')) { send(res, 415, { error: 'Choose a JPEG, PNG, or WebP photo.' }); return true; }
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_UPLOAD) { send(res, 413, { error: 'Choose a photo smaller than 10 MB.' }); return true; }
          chunks.push(chunk);
        }
        photos.cleanup(photoIds(state.places));
        send(res, 201, await photos.create(Buffer.concat(chunks))); return true;
      }
      if (photoRoute && req.method === 'DELETE') {
        const id = photoRoute[1];
        if (!validPhotoId(id)) { send(res, 400, { error: 'Invalid photo.' }); return true; }
        if (photoIds(state.places).has(id)) { send(res, 409, { error: 'Remove the photo from its place and save first.' }); return true; }
        photos.remove(id); send(res, 200, { removed: true }); return true;
      }
      if (url.pathname === '/api/places' && req.method === 'PUT') {
        const input = await body(req);
        const places = validatePlaces(input.places);
        if (input.revision !== state.revision) { send(res, 409, { error: 'Places changed in another window. Reload them and try again.' }); return true; }
        for (const id of photoIds(places)) if (!photos.exists(id)) throw new Error('An uploaded photo is no longer available. Upload it again.');
        const previousPhotos = photoIds(state.places);
        const next = { revision: state.revision + 1, places };
        const temporary = storagePath + '.tmp';
        // Synchronous atomic replacement also serializes competing writes in this process.
        fs.writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
        fs.renameSync(temporary, storagePath);
        state = next;
        // Publishing also refreshes the assistant's saved knowledge; editing drafts do not.
        try { options.onPublish?.(state); }
        catch { console.error('Could not persist assistant knowledge; current answers remain updated. Restart to retry.'); }
        const nextPhotos = photoIds(places);
        for (const id of previousPhotos) if (!nextPhotos.has(id)) photos.remove(id);
        send(res, 200, state); return true;
      }
      if (url.pathname === '/api/places/search' && req.method === 'GET') {
        const query = url.searchParams.get('q')?.trim();
        if (!query || query.length > 100) { send(res, 400, { error: 'Enter a location.' }); return true; }
        const cached = searches.get(query.toLowerCase());
        if (cached) { send(res, 200, cached); return true; }
        const known = seed.filter(place => place.name.toLowerCase().includes(query.toLowerCase()));
        if (known.length) { const result = { results: known.map(({ name, lat, lon, country }) => ({ name, lat, lon, country })) }; send(res, 200, result); return true; }
        try {
          const endpoint = new URL('https://photon.komoot.io/api/');
          endpoint.searchParams.set('q', query); endpoint.searchParams.set('limit', '5'); endpoint.searchParams.set('lang', 'en');
          const response = await (options.fetch || fetch)(endpoint, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error('Location search unavailable.');
          const data = await response.json();
          const results = (data.features || []).flatMap(feature => {
            const [lon, lat] = feature.geometry?.coordinates || [];
            const properties = feature.properties || {};
            const name = [properties.name, properties.city !== properties.name ? properties.city : null, properties.country].filter(Boolean).join(', ');
            const country = typeof properties.countrycode === 'string' ? properties.countrycode.toUpperCase() : null;
            return name && name.length <= 100 && Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180 ? [{ name, lat, lon, ...(validCountry(country) ? { country } : {}) }] : [];
          });
          const result = { results, attribution: 'OpenStreetMap' };
          if (searches.size > 100) searches.clear(); searches.set(query.toLowerCase(), result);
          send(res, 200, result); return true;
        } catch { send(res, 503, { error: 'Location search is unavailable. You can pick a point on the globe instead.' }); return true; }
      }
      send(res, 405, { error: 'Method not allowed.' }); return true;
    } catch (error) { send(res, 400, { error: error.message }); return true; }
  }
  return { handle, canEdit: req => Boolean(session(req)), read: () => ({ ...state, places: state.places.map(place => ({ ...place })) }) };
}
module.exports = { createPlacesService, validatePlaces };
