const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPlacesService, validatePlaces } = require('./places');
const seed = require('./places.seed.json');

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
  return { directory, service, request, unlock };
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
  const tokyo = { id: 'place-tokyo', name: 'Tokyo', start: '2020-02', end: '2020-03', current: false, lat: 35.6762, lon: 139.6503, note: 'An owner-supplied entry.' };
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
