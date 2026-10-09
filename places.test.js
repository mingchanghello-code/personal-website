const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPlacesService, validatePlaces } = require('./places');
const seed = require('./places.seed.json');
const sharp = require('sharp');

async function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ming-places-test-'));
  const service = createPlacesService({ directory, requirePassword: true, ownerKey: 'test-owner-password', ...options });
  const server = http.createServer(async (req, res) => {
    if (!await service.handle(req, res, new URL(req.url, 'http://localhost'))) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  const request = (url, method = 'GET', payload, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: '/api/places' + url, method, headers: { ...headers, ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) } }, res => {
      let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }));
    });
    req.on('error', reject); req.end(payload === undefined ? undefined : JSON.stringify(payload));
  });
  const unlock = async () => {
    const result = await request('/session', 'POST', { password: 'test-owner-password' });
    assert.equal(result.status, 200);
    return { Cookie: result.headers['set-cookie'][0].split(';')[0] };
  };
  return { directory, service, request, unlock, base: `http://127.0.0.1:${server.address().port}/api/places` };
}

test('visitors can read places but cannot publish or search locations', async t => {
  const { request } = await fixture(t);
  const publicData = await request('');
  assert.equal(publicData.status, 200); assert.equal(publicData.body.places.length, 3);
  assert.equal(publicData.body.places[0].start, null);
  assert.equal(publicData.body.places[2].start, '2013');
  assert.equal((await request('', 'PUT', publicData.body)).status, 401);
  assert.equal((await request('/search?q=Tokyo')).status, 401);
  assert.deepEqual((await request('/session')).body, { canEdit: false, requiresPassword: true });
  assert.doesNotMatch(JSON.stringify(publicData.body), /password|owner-key/);
});

test('owner sessions reject wrong passwords and cross-origin writes, and can be locked', async t => {
  const { request, unlock } = await fixture(t);
  assert.equal((await request('/session', 'POST', { password: 'wrong' })).status, 401);
  assert.equal((await request('/session', 'POST', { password: 'test-owner-password' }, { Origin: 'https://other.example' })).status, 403);
  const headers = await unlock();
  assert.equal((await request('/session', 'GET', undefined, headers)).body.canEdit, true);
  const logout = await request('/session', 'DELETE', undefined, headers);
  assert.match(logout.headers['set-cookie'][0], /HttpOnly; SameSite=Strict; Max-Age=0/);
  assert.equal((await request('/session', 'GET', undefined, headers)).body.canEdit, false);
});

test('published entries are shared with visitors and survive a service restart', async t => {
  const { request, unlock, directory } = await fixture(t);
  const headers = await unlock();
  const state = (await request('')).body;
  const tokyo = { id: 'place-tokyo', name: 'Tokyo', start: '2020-02', end: '2020-03', current: false, lat: 35.6762, lon: 139.6503, country: 'JP', note: 'An owner-supplied entry.', highlights: [{ text: 'A walk through the city.', icon: 'outdoors' }, { text: '<script>Text, never code.</script>', icon: 'bullet' }] };
  const result = await request('', 'PUT', { revision: state.revision, places: [...state.places, tokyo] }, headers);
  assert.equal(result.status, 200); assert.equal(result.body.revision, 1);
  const visitor = await request('');
  assert.deepEqual(visitor.body.places.at(-1), tokyo);
  const restarted = createPlacesService({ directory, requirePassword: true, ownerKey: 'test-owner-password' });
  assert.deepEqual(restarted.read(), visitor.body);
});

test('concurrent editors cannot silently overwrite each other', async t => {
  const { request, unlock } = await fixture(t);
  const headers = await unlock(); const state = (await request('')).body;
  const competing = await Promise.all(['First', 'Second'].map(note => request('', 'PUT', { revision: state.revision, places: state.places.map((place, i) => i ? place : { ...place, note }) }, headers)));
  assert.deepEqual(competing.map(result => result.status).sort(), [200, 409]);
  assert.equal((await request('')).body.revision, 1);
});

test('invalid dates, coordinates, duplicate IDs, and unsupported payloads are rejected', () => {
  for (const change of [{ start: '2024-13' }, { lat: 91 }, { lon: -181 }, { start: '2024-02', end: '2024-01' }, { current: true, end: '2024-04' }, { note: null }, { id: '../private' }]) assert.throws(() => validatePlaces([{ ...seed[0], ...change }]));
  assert.throws(() => validatePlaces([seed[0], seed[0]]));
  assert.throws(() => validatePlaces({ places: seed }));
  assert.deepEqual(validatePlaces(seed), seed);
  for (const highlights of [null, 'one highlight', Array(6).fill('Too many'), [''], ['   '], [1], ['a'.repeat(201)], [{ text: 'Hello', icon: '<svg>' }], [{ text: 'Hello', icon: '__proto__' }]]) assert.throws(() => validatePlaces([{ ...seed[0], highlights }]));
  assert.deepEqual(validatePlaces([{ ...seed[0], highlights: ['Older plain-text highlight'] }])[0].highlights, [{ text: 'Older plain-text highlight', icon: 'bullet' }]);
});

test('location search handles provider results and failures without inventing coordinates', async t => {
  let calls = 0;
  const { request, unlock } = await fixture(t, { fetch: async () => { calls++; return { ok: true, json: async () => ({ features: [{ geometry: { coordinates: [139.65, 35.67] }, properties: { name: 'Tokyo', country: 'Japan' } }, { geometry: { coordinates: [null, 999] }, properties: { name: 'Invalid' } }] }) }; } });
  const headers = await unlock();
  const result = await request('/search?q=Tokyo', 'GET', undefined, headers);
  assert.deepEqual(result.body.results, [{ name: 'Tokyo, Japan', lat: 35.67, lon: 139.65 }]);
  await request('/search?q=Tokyo', 'GET', undefined, headers); assert.equal(calls, 1);
  assert.equal((await request('/search?q=Beijing', 'GET', undefined, headers)).body.results[0].name, 'Beijing');
  const failed = await fixture(t, { fetch: async () => { throw new Error('Unavailable'); } });
  assert.equal((await failed.request('/search?q=Tokyo', 'GET', undefined, await failed.unlock())).status, 503);
});

test('country flags resolve for existing and manually chosen locations without editing access', async t => {
  let calls = 0;
  const { request } = await fixture(t, { fetch: async endpoint => {
    calls++;
    assert.equal(endpoint.pathname, '/reverse');
    if (endpoint.searchParams.get('lon') === '0') throw new Error('Offline');
    return { ok: true, json: async () => ({ features: endpoint.searchParams.get('lon') === '1' ? [] : [{ properties: { countrycode: 'jp' } }] }) };
  } });
  assert.deepEqual((await request('/country?lat=39.9042&lon=116.4074')).body, { country: 'CN' });
  assert.equal(calls, 0);
  assert.deepEqual((await request('/country?lat=35.67&lon=139.65')).body, { country: 'JP' });
  assert.deepEqual((await request('/country?lat=35.67&lon=139.65')).body, { country: 'JP' });
  assert.equal(calls, 1);
  assert.deepEqual((await request('/country?lat=0&lon=1')).body, { country: null });
  assert.equal((await request('/country?lat=0&lon=0')).status, 503);
  assert.equal((await request('/country?lat=91&lon=0')).status, 400);
  assert.equal((await request('/country?lat=0')).status, 400);
});

test('generated editing passwords stay private and persist across restarts', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ming-owner-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  createPlacesService({ directory, requirePassword: true });
  const keyPath = path.join(directory, 'owner-key.txt');
  const before = fs.readFileSync(keyPath, 'utf8');
  assert.equal(fs.statSync(keyPath).mode & 0o777, 0o600);
  createPlacesService({ directory, requirePassword: true });
  assert.equal(fs.readFileSync(keyPath, 'utf8'), before);
});

test('open editing saves shared entries without a password and preserves validation', async t => {
  const { request } = await fixture(t, { requirePassword: false });
  assert.deepEqual((await request('/session')).body, { canEdit: true, requiresPassword: false });
  const state = (await request('')).body;
  const changed = { revision: state.revision, places: state.places.map((place, i) => i ? place : { ...place, note: 'An edit made without signing in.' }) };
  assert.equal((await request('', 'PUT', changed)).status, 200);
  assert.equal((await request('')).body.places[0].note, 'An edit made without signing in.');
  assert.equal((await request('', 'PUT', { revision: 1, places: [{ ...state.places[0], lat: 999 }] })).status, 400);
  assert.equal((await request('', 'PUT', changed, { Origin: 'https://other.example', 'Sec-Fetch-Site': 'cross-site' })).status, 403);
});

test('same-origin preview requests work when a proxy forwards an internal Host', async t => {
  const { request } = await fixture(t);
  const response = await request('/session', 'POST', { password: 'test-owner-password' }, { Origin: 'https://preview.example', 'Sec-Fetch-Site': 'same-origin' });
  assert.equal(response.status, 200);
  assert.match(response.body.token, /^[a-f0-9]{64}$/);
  const headers = { Origin: 'https://preview.example', 'Sec-Fetch-Site': 'same-origin', Authorization: `Bearer ${response.body.token}` };
  assert.equal((await request('/session', 'GET', undefined, headers)).body.canEdit, true);
  await request('/session', 'DELETE', undefined, headers);
  assert.equal((await request('/session', 'GET', undefined, headers)).body.canEdit, false);
});

test('photo uploads are resized, private metadata is stripped, and attachments persist across restarts', async t => {
  const { base, request, unlock, directory } = await fixture(t);
  const input = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#123456' } }).jpeg().withMetadata().toBuffer();
  assert.equal((await fetch(base + '/photos', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: input })).status, 401);
  const headers = await unlock();
  const upload = await fetch(base + '/photos', { method: 'POST', headers: { ...headers, 'Content-Type': 'image/jpeg' }, body: input });
  assert.equal(upload.status, 201); const { id } = await upload.json();
  const file = await fetch(base + '/photos/' + id); assert.equal(file.status, 200); assert.equal(file.headers.get('content-type'), 'image/webp');
  const metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
  assert.equal(metadata.width, 1600); assert.equal(metadata.height, 800); assert.equal(metadata.exif, undefined);
  const state = (await request('')).body; state.places[0].photos = [id];
  assert.equal((await request('', 'PUT', state, headers)).status, 200);
  assert.deepEqual((await request('')).body.places[0].photos, [id]);
  assert.deepEqual(createPlacesService({ directory, ownerKey: 'test-owner-password', requirePassword: true }).read().places[0].photos, [id]);
  assert.equal((await request('/photos/' + id, 'DELETE', undefined, headers)).status, 409);
  const latest = (await request('')).body; latest.places[0].photos = [];
  assert.equal((await request('', 'PUT', latest, headers)).status, 200);
  assert.equal((await fetch(base + '/photos/' + id)).status, 404);
});

test('photos enforce limits, validate real images, reject missing files, and discard staged uploads', async t => {
  const { base, request } = await fixture(t, { requirePassword: false });
  assert.equal((await fetch(base + '/photos', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: 'not an image' })).status, 400);
  assert.equal((await fetch(base + '/photos', { method: 'POST', headers: { 'Content-Type': 'image/svg+xml' }, body: '<svg/>' })).status, 415);
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
  const ids = [];
  for (let i = 0; i < 4; i++) {
    const response = await fetch(base + '/photos', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: image });
    assert.equal(response.status, 201); ids.push((await response.json()).id);
  }
  const state = (await request('')).body;
  state.places[0].photos = ids;
  assert.equal((await request('', 'PUT', state)).status, 400);
  state.places[0].photos = ids.slice(0, 3);
  assert.equal((await request('', 'PUT', state)).status, 200);
  assert.equal((await request('/photos/' + ids[3], 'DELETE')).status, 200);
  assert.equal((await fetch(base + '/photos/' + ids[3])).status, 404);
  const latest = (await request('')).body; latest.places[1].photos = [ids[3]];
  assert.equal((await request('', 'PUT', latest)).status, 400);
  assert.equal((await request('/photos/' + ids[0], 'DELETE', undefined, { Origin: 'https://other.example' })).status, 403);
  assert.throws(() => validatePlaces([{ ...seed[0], photos: ['../../owner-key.txt'] }]));
  assert.throws(() => validatePlaces([{ ...seed[0], photos: [ids[0], ids[0]] }]));
});
