const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const app = read('app.js');
const sections = require('./site-content');
const licenses = `/* D3 library licenses\n${read('vendor/d3-array.LICENSE')}\n${read('vendor/d3-geo.LICENSE')}\n*/`;
const client = [licenses, read('vendor/d3-array.min.js'), read('vendor/d3-geo.min.js'), read('globe-land.js'), `const LIFE_DEFAULT_PLACES = ${read('places.seed.json')};`, `const LIFE_HIGHLIGHT_ICONS = ${read('highlight-icons.json')};`, read('place-utils.js'), read('site-content.js'), read('life.js'), app].join('\n');
// Compile the checked-in, trusted section templates into a visible initial page.
const home = sections.home;
const html = read('page.template.html')
  .replace('<link rel="stylesheet" href="/styles.css">', `<style>${read('styles.css')}</style>`)
  .replace('<div class="content" id="content" tabindex="-1"></div>', `<div class="content" id="content" tabindex="-1">${home}</div>`)
  .replace('<script src="/app.js"></script>', `<script>${client.replace(/<\/script/gi, '<\\/script')}</script>`);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('Built self-contained index.html with visible initial content.');
