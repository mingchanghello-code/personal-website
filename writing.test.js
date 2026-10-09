const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const sharp = require('sharp');
const { createWritingService } = require('./writing');
const { validateWritingBlocks } = require('./writing-document');
const { compileKnowledge } = require('./assistant-knowledge');
const places = require('./places.seed.json');
async function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ming-writing-test-'));
  const service = createWritingService({ directory, ...options });
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res, new URL(req.url, 'http://localhost'))) { res.writeHead(404); res.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, {recursive:true,force:true}); });
  const request = (pathname = '', method = 'GET', payload, headers = {}) => new Promise((resolve, reject) => {
    const bytes = payload === undefined ? undefined : Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
    const req = http.request({ hostname:'127.0.0.1', port:server.address().port, path:'/api/writing'+pathname, method, headers: {...(bytes ? {'Content-Type':'application/json'} : {}), ...headers} }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => {
        const buffer = Buffer.concat(chunks); resolve({status:res.statusCode, headers:res.headers, body:res.headers['content-type']?.includes('json') ? JSON.parse(buffer) : buffer});
      });
    });
    req.on('error', reject); req.end(bytes);
  });
  return {directory,service,request};
}
const essay = {id:'test-essay',title:'A test essay',status:'draft',blocks:[{type:'paragraph',content:[{text:'A thoughtful paragraph.',bold:true,underline:true}]}]};
test('drafts publish with stable links, revisions, archive and restore, and persist across restarts', async t => {
  const {request,service,directory} = await fixture(t);
  const original = (await request()).body;
  const draft = await request('', 'POST', {revision:original.revision,essay});
  assert.equal(draft.status,200);
  assert.equal((await request('/essays/test-essay')).status,404);
  assert.equal((await request()).body.essays.length,1);
  assert.equal((await request('?manage=1')).body.essays.length,2);
  assert.equal((await request('', 'POST', {revision:original.revision,essay})).status,409);
  const published = await request('', 'POST', {revision:draft.body.revision,essay:{...essay,status:'published'}});
  assert.equal((await request('/essays/test-essay')).status,200);
  assert.equal(published.body.essay.id,'test-essay'); assert.ok(published.body.essay.publishedAt);
  const archived = await request('', 'POST', {revision:published.body.revision,essay:{...published.body.essay,status:'archived'}});
  assert.equal((await request('/essays/test-essay')).status,404);
  assert.equal(archived.body.essay.archivedStatus,'published');
  assert.ok(!compileKnowledge({revision:0,places},service.read()).facts.some(fact=>fact.essayId==='test-essay'));
  const restored = await request('', 'POST', {revision:archived.body.revision,essay:{...archived.body.essay,status:'published'}});
  assert.equal(restored.body.essay.publishedAt,published.body.essay.publishedAt);
  const restarted = createWritingService({directory});
  assert.deepEqual(restarted.read(),service.read());
  assert.ok(compileKnowledge({revision:0,places},service.read()).facts.some(fact=>fact.essayId==='test-essay'));
});
test('essay text is data, unsupported formatting and missing pictures are rejected, and edits are guarded', async t => {
  assert.throws(()=>validateWritingBlocks([{type:'html',html:'<script>alert(1)</script>'}]));
  assert.throws(()=>validateWritingBlocks([{type:'image',photoId:'../../secret'}]));
  const clean=validateWritingBlocks([{type:'paragraph',content:[{text:'<script>Text, not code</script>',bold:true,onclick:'alert(1)'}]}]);
  assert.equal(clean[0].content[0].onclick,undefined);
  const {request} = await fixture(t,{canEdit:req=>req.headers.authorization==='Bearer owner'});
  assert.equal((await request('?manage=1')).status,401);
  assert.equal((await request('', 'POST', {revision:0,essay})).status,401);
  assert.equal((await request('', 'POST', {revision:0,essay},{Authorization:'Bearer owner',Origin:'https://elsewhere.example'})).status,403);
  const missing={...essay,blocks:[{type:'image',photoId:'00000000-0000-4000-8000-000000000000'}]};
  assert.equal((await request('', 'POST', {revision:0,essay:missing},{Authorization:'Bearer owner'})).status,400);
});
test('pictures are processed, survive publication and archive, and removed pictures are cleaned up', async t => {
  const {request,directory} = await fixture(t);
  const bytes=await sharp({create:{width:1800,height:900,channels:3,background:'#fff'}}).jpeg().toBuffer();
  const photo=await request('/photos','POST',bytes,{'Content-Type':'image/jpeg'});
  assert.equal(photo.status,201);
  const metadata=await sharp(path.join(directory,'writing','photos',`${photo.body.id}.webp`)).metadata();
  assert.equal(metadata.width,1600); assert.equal(metadata.format,'webp');
  const item={...essay,status:'published',blocks:[...essay.blocks,{type:'image',photoId:photo.body.id}]};
  const saved=await request('','POST',{revision:0,essay:item});
  assert.equal(saved.status,200); assert.equal((await request(`/photos/${photo.body.id}`)).status,200);
  assert.equal((await request(`/photos/${photo.body.id}`,'DELETE')).status,409);
  const archived=await request('','POST',{revision:saved.body.revision,essay:{...saved.body.essay,status:'archived'}});
  assert.ok(fs.existsSync(path.join(directory,'writing','photos',`${photo.body.id}.webp`)));
  const removed=await request('','POST',{revision:archived.body.revision,essay:{...archived.body.essay,blocks:essay.blocks}});
  assert.equal(removed.status,200); assert.equal((await request(`/photos/${photo.body.id}`)).status,404);
  assert.equal((await request('/photos','POST',Buffer.from('not a picture'),{'Content-Type':'image/jpeg'})).status,400);
});
