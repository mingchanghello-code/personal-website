const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chat } = require('./agent');
const { createPlacesService } = require('./places');
const { createKnowledgeStore } = require('./assistant-knowledge');
const { createWritingService } = require('./writing');
const directory = process.env.MING_SITE_DATA_DIR || path.join(__dirname, '.data');
const knowledge = createKnowledgeStore(directory);
let places;
const refreshKnowledge = () => knowledge.update(places.read(), writing.read());
const writing = createWritingService({ directory, canEdit: req => places.canEdit(req), onPublish: refreshKnowledge });
places = createPlacesService({ directory, onPublish: refreshKnowledge });
refreshKnowledge();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const limits = new Map();
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const url = new URL(req.url, 'http://localhost');
  const name = url.pathname;
  if (await places.handle(req, res, url)) return;
  if (await writing.handle(req, res, url)) return;
  if (name === '/api/chat') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.writeHead(405); res.end(JSON.stringify({ error: 'POST required' })); return; }
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) { res.writeHead(403); res.end(JSON.stringify({ error: 'Origin not allowed' })); return; }
    const ip = req.socket.remoteAddress;
    const now = Date.now();
    for (const [key, entry] of limits) if (now - entry.time > 60000) limits.delete(key);
    const entry = limits.get(ip) || { time: now, count: 0 };
    if (++entry.count > 20) { res.writeHead(429); res.end(JSON.stringify({ error: 'Please wait before sending more questions' })); return; }
    limits.set(ip, entry);
    try {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16000) { res.writeHead(413); res.end(JSON.stringify({ error: 'Request too large' })); return; } }
      const { question, history = [] } = JSON.parse(raw);
      if (typeof question !== 'string' || !question.trim() || question.length > 1000 || !Array.isArray(history) || history.length > 6 || history.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 2000)) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid question or history' })); return; }
      res.end(JSON.stringify(await chat(question.trim(), history, { knowledge: knowledge.read() }))); return;
    } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); return; }
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end('Method not allowed'); return; }
  const files = { '/': 'index.html', '/index.html': 'index.html', '/styles.css': 'styles.css', '/app.js': 'app.js' };
  const file = files[name];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(__dirname, file), (err, data) => {
    if (err) { res.writeHead(500); res.end('Unable to load page'); return; }
    res.writeHead(200, { 'Content-Type': `${types[path.extname(file)]}; charset=utf-8` }); res.end(data);
  });
});
if (require.main === module) server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Website running on port ' + (process.env.PORT || 3000)));
module.exports = server;
