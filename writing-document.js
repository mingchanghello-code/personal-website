// Plain text plus a small formatting vocabulary. No stored HTML, CSS, or executable URLs.
function writingPlainText(blocks) {
  return blocks.map(block => block.type === 'image' ? '' : block.items ? block.items.map(item => item.map(run => run.text).join('')).join('\n') : block.content.map(run => run.text).join('')).filter(Boolean).join('\n\n');
}
function writingPhotoIds(essays) { return new Set(essays.flatMap(essay => essay.blocks.filter(block => block.type === 'image').map(block => block.photoId))); }
function validateWritingBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length || blocks.length > 500) throw new Error('Write an essay with at most 500 paragraphs.');
  let total = 0, images = 0;
  const runs = values => {
    if (!Array.isArray(values) || values.length > 1000) throw new Error('Check the essay formatting.');
    return values.map(run => {
      if (!run || typeof run.text !== 'string' || run.text.length > 100000 || ['bold', 'italic', 'underline'].some(mark => run[mark] !== undefined && typeof run[mark] !== 'boolean')) throw new Error('Check the essay text.');
      total += run.text.length;
      return { text: run.text, ...(run.bold ? { bold: true } : {}), ...(run.italic ? { italic: true } : {}), ...(run.underline ? { underline: true } : {}) };
    });
  };
  const clean = blocks.map(block => {
    if (!block) throw new Error('Check the essay content.');
    if (['paragraph', 'heading', 'quote'].includes(block.type)) return { type: block.type, content: runs(block.content) };
    if (['unordered-list', 'ordered-list'].includes(block.type)) {
      if (!Array.isArray(block.items) || !block.items.length || block.items.length > 100) throw new Error('Use at most 100 items per list.');
      return { type: block.type, items: block.items.map(runs) };
    }
    if (block.type === 'image') {
      if (++images > 10 || typeof block.photoId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(block.photoId)) throw new Error('Use up to 10 uploaded pictures per essay.');
      return { type: 'image', photoId: block.photoId };
    }
    throw new Error('Unsupported essay formatting.');
  });
  if (total > 100000) throw new Error('Keep the essay under 100,000 characters.');
  if (!writingPlainText(clean).trim() && !images) throw new Error('Add some text or a picture.');
  return clean;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { writingPlainText, writingPhotoIds, validateWritingBlocks };
