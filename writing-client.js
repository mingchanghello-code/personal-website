let writingManageMode = false;
function mountWriting(root, requestedId = null) {
  const controller = new AbortController();
  const signal = controller.signal;
  const page = root.querySelector('.writing-page');
  let state = { revision: null, essays: LIFE_DEFAULT_ESSAYS };
  let canEdit = false, dirty = false, busy = false, editing = null, editor = null, title = null, bookmark = null;
  let currentRoute = location.hash || '#notes';
  const staged = new Set();
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const on = (element, event, fn, options = {}) => element.addEventListener(event, fn, { ...options, signal });
  const button = (text, action, className) => { const el = node('button', text, className); el.type = 'button'; on(el, 'click', action); return el; };
  const link = (text, hash) => { const el = node('a', text); el.href = hash; return el; };
  function status(text) {
    let el = page.querySelector('.writing-status');
    if (!el) { el = node('p', undefined, 'writing-status'); el.setAttribute('role', 'status'); page.append(el); }
    el.textContent = text; el.hidden = !text;
  }
  async function request(path = '', method = 'GET', data) {
    const binary = data instanceof Blob;
    const response = await fetch(`/api/writing${path}`, {
      method, credentials: 'same-origin', signal: AbortSignal.any([signal, AbortSignal.timeout(binary ? 30000 : 10000)]),
      headers: { ...(data === undefined ? {} : { 'Content-Type': binary ? data.type : 'application/json' }), ...(lifeOwnerToken ? { Authorization: `Bearer ${lifeOwnerToken}` } : {}) },
      ...(data === undefined ? {} : { body: binary ? data : JSON.stringify(data) })
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Couldn’t reach the writing server.');
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || 'Couldn’t save writing.'); error.status = response.status; throw error; }
    return result;
  }
  function dated(essay) {
    return essay.publishedAt ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(essay.publishedAt)) : '';
  }
  function appendRuns(parent, runs) {
    for (const run of runs) {
      let child = document.createTextNode(run.text);
      for (const [mark, tag] of [['bold', 'strong'], ['italic', 'em'], ['underline', 'u']]) if (run[mark]) { const wrapper = node(tag); wrapper.append(child); child = wrapper; }
      parent.append(child);
    }
  }
  function renderBlocks(container, blocks, editable = false) {
    for (const block of blocks) {
      if (block.type === 'image') {
        const figure = node('figure', undefined, 'essay-picture'); figure.dataset.photoId = block.photoId;
        const image = node('img'); image.src = `/api/writing/photos/${block.photoId}`; image.alt = 'Picture included in the essay';
        figure.append(image);
        if (editable) {
          figure.contentEditable = 'false';
          figure.append(button('Remove picture', () => { figure.remove(); dirty = true; editor.focus(); }));
        }
        container.append(figure); continue;
      }
      if (block.items) {
        const list = node(block.type === 'ordered-list' ? 'ol' : 'ul');
        for (const item of block.items) { const li = node('li'); appendRuns(li, item); list.append(li); }
        container.append(list); continue;
      }
      const el = node(block.type === 'heading' ? 'h2' : block.type === 'quote' ? 'blockquote' : 'p');
      appendRuns(el, block.content); if (!el.childNodes.length) el.append(node('br'));
      container.append(el);
    }
  }
  function header(titleText) { page.replaceChildren(); const heading = node('div', undefined, 'writing-heading'); heading.append(node('h1', titleText)); page.append(heading); return heading; }
  function actions(parent) { const bar = node('div', undefined, 'writing-actions'); parent.append(bar); return bar; }
  function showList() {
    editing = null; editor = null; dirty = false;
    const bar = actions(header('Writing'));
    if (canEdit) {
      bar.append(button('New essay', () => showEditor(null)));
      bar.append(button(writingManageMode ? 'Done editing' : 'Manage writing', async () => {
        writingManageMode = !writingManageMode;
        try { state = await request(writingManageMode ? '?manage=1' : ''); showList(); } catch (error) { status(error.message); }
      }));
    }
    const list = node('ul', undefined, 'essay-list');
    const essays = state.essays.filter(essay => writingManageMode || essay.status === 'published').sort((a, b) => (b.publishedAt || b.updatedAt || '').localeCompare(a.publishedAt || a.updatedAt || ''));
    for (const essay of essays) {
      const row = node('li', undefined, 'essay-row');
      const essayLink = link(essay.title, `#notes/${essay.id}`); essayLink.className = 'essay-link';
      const copy = node('div'); copy.append(node('h2', essay.title));
      const meta = [dated(essay), writingManageMode && essay.status !== 'published' ? essay.status : ''].filter(Boolean).join(' · ');
      if (meta) copy.append(node('span', meta, 'essay-meta'));
      const excerpt = writingPlainText(essay.blocks).replace(/\s+/g, ' ').trim();
      if (excerpt) copy.append(node('p', excerpt.length > 180 ? `${excerpt.slice(0, 180).trimEnd()}…` : excerpt, 'essay-excerpt'));
      // The title is repeated only inside the accessible link, never injected as HTML.
      essayLink.replaceChildren(copy); row.append(essayLink);
      if (canEdit && writingManageMode) {
        const controls = actions(row);
        controls.append(button('Edit', () => showEditor(essay)));
        controls.append(button(essay.status === 'archived' ? 'Restore' : 'Archive', () => changeStatus(essay, essay.status === 'archived' ? essay.archivedStatus || 'published' : 'archived')));
      }
      list.append(row);
    }
    page.append(list);
    if (!essays.length) page.append(node('p', 'No essays published yet.'));
  }
  function showEssay(essay) {
    header(essay.title);
    const bar = actions(page); bar.append(link('← Writing', '#notes'));
    if (essay.status === 'published') bar.append(button('Copy link', async () => {
      const url = new URL(location.href); url.hash = `notes/${essay.id}`;
      try { await navigator.clipboard.writeText(url.href); status('Link copied.'); }
      catch { const copy = node('input'); copy.type = 'text'; copy.readOnly = true; copy.value = url.href; copy.setAttribute('aria-label', 'Essay link'); page.append(copy); copy.select(); }
    }));
    if (canEdit) bar.append(button('Edit', () => showEditor(essay)));
    if (essay.publishedAt) page.append(node('time', dated(essay), 'essay-date'));
    if (essay.status !== 'published') page.append(node('p', essay.status, 'essay-meta'));
    const body = node('article', undefined, 'essay-body'); renderBlocks(body, essay.blocks); page.append(body);
  }
  function elementMarks(child, marks) {
    const next = { ...marks };
    if (['B', 'STRONG'].includes(child.tagName) || child.style.fontWeight === 'bold' || Number(child.style.fontWeight) >= 600) next.bold = true;
    if (['I', 'EM'].includes(child.tagName) || child.style.fontStyle === 'italic') next.italic = true;
    if (child.tagName === 'U' || child.style.textDecoration.includes('underline')) next.underline = true;
    return next;
  }
  function inlineRuns(parent, marks = {}) {
    const result = [];
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) { result.push({ text: child.textContent, ...marks }); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE', 'BUTTON', 'IMG'].includes(child.tagName)) continue;
      if (child.tagName === 'BR') { result.push({ text: '\n', ...marks }); continue; }
      const next = elementMarks(child, marks);
      result.push(...inlineRuns(child, next));
    }
    return result;
  }
  function serializeEditor() {
    const blocks = [];
    let pending = [];
    const flush = () => { if (pending.length) { blocks.push({type: 'paragraph', content: pending}); pending = []; } };
    function visit(element, marks = {}) {
      for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) { pending.push({text: child.textContent, ...marks}); continue; }
        if (child.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE', 'BUTTON'].includes(child.tagName)) continue;
        if (child.matches('figure[data-photo-id]')) { flush(); blocks.push({type: 'image', photoId: child.dataset.photoId}); continue; }
        if (child.querySelector('figure[data-photo-id]')) { flush(); visit(child, elementMarks(child, marks)); flush(); continue; }
        if (['UL', 'OL'].includes(child.tagName)) { flush(); blocks.push({type: child.tagName === 'UL' ? 'unordered-list' : 'ordered-list', items: [...child.children].filter(el => el.tagName === 'LI').map(el => inlineRuns(el))}); continue; }
        if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE'].includes(child.tagName)) {
          flush();
          if (child.querySelector('figure, p, div, ul, ol')) { visit(child); flush(); }
          else blocks.push({type: child.tagName.startsWith('H') ? 'heading' : child.tagName === 'BLOCKQUOTE' ? 'quote' : 'paragraph', content: inlineRuns(child)});
          continue;
        }
        pending.push(...inlineRuns({childNodes: [child]}, marks));
      }
    }
    visit(editor); flush();
    return validateWritingBlocks(blocks);
  }
  function rememberSelection() {
    const selection = window.getSelection();
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) bookmark = selection.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    editor.focus();
    if (bookmark && editor.contains(bookmark.commonAncestorContainer)) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(bookmark); }
  }
  function setBusy(value) {
    busy = value;
    for (const control of page.querySelectorAll('button, input')) control.disabled = value;
    if (editor) editor.contentEditable = value ? 'false' : 'true';
  }
  async function discardUploads() {
    const ids = [...staged]; staged.clear();
    await Promise.allSettled(ids.map(id => request(`/photos/${id}`, 'DELETE')));
  }
  async function save(statusValue) {
    if (busy) return;
    const essayTitle = title.value.trim();
    if (!essayTitle) { status('Add a title.'); title.focus(); return; }
    let blocks; try { blocks = serializeEditor(); } catch (error) { status(error.message); return; }
    setBusy(true); status('Saving…');
    try {
      const id = editing?.id || `${essayTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'essay'}-${crypto.randomUUID().slice(0, 8)}`;
      const result = await request('', 'POST', {revision: state.revision, essay: {id, title: essayTitle, blocks, status: statusValue}});
      state.revision = result.revision;
      state.essays = [...state.essays.filter(item => item.id !== id), result.essay];
      const used = writingPhotoIds([result.essay]);
      for (const photoId of used) staged.delete(photoId);
      await discardUploads(); dirty = false; busy = false;
      writingManageMode = true;
      if (location.hash === `#notes/${id}`) showEssay(result.essay); else location.hash = `notes/${id}`;
    } catch (error) {
      setBusy(false); status(error.message);
      if (error.status === 409 && !page.querySelector('.writing-reload')) {
        const reload = button('Reload saved version', async () => {
          if (dirty && !window.confirm('Discard unsaved text and load the latest saved version?')) return;
          try {
            const data = await request('?manage=1'); await discardUploads(); state = data; dirty = false;
            showEditor(state.essays.find(item => item.id === editing?.id) || null);
          } catch (error) { status(error.message); }
        }, 'writing-reload');
        page.querySelector('.writing-actions:last-of-type')?.append(reload);
      }
    }
  }
  async function changeStatus(essay, statusValue) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await request('', 'POST', {revision: state.revision, essay: {...essay, status: statusValue}});
      state.revision = result.revision; state.essays = state.essays.map(item => item.id === essay.id ? result.essay : item);
      busy = false; showList(); status(statusValue === 'archived' ? 'Archived.' : 'Restored.');
    } catch (error) { setBusy(false); status(error.message); }
  }
  async function uploadPicture(file) {
    if (busy) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { status('Choose a JPEG, PNG, or WebP picture under 10 MB.'); return; }
    let blocks; try { blocks = serializeEditor(); } catch { blocks = []; }
    if (blocks.filter(block => block.type === 'image').length >= 10) { status('Use up to 10 pictures per essay.'); return; }
    setBusy(true); status('Uploading picture…');
    try {
      const bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
      if (!blob) throw new Error('Couldn’t read that picture.');
      const uploaded = await request('/photos', 'POST', blob); staged.add(uploaded.id);
      setBusy(false); restoreSelection();
      const fragment = document.createDocumentFragment(); renderBlocks(fragment, [{type:'image', photoId:uploaded.id}], true);
      const following = node('p'); following.append(node('br')); fragment.append(following);
      const selection = window.getSelection();
      if (selection.rangeCount && editor.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        let block = range.endContainer;
        if (block === editor) block = editor.childNodes[Math.max(0, range.endOffset - 1)];
        while (block && block.parentNode !== editor) block = block.parentNode;
        if (block && block !== editor) block.after(fragment); else editor.append(fragment);
      } else editor.append(fragment);
      const caret = document.createRange(); caret.selectNodeContents(following); caret.collapse(true);
      selection.removeAllRanges(); selection.addRange(caret);
      dirty = true; rememberSelection(); status('');
    } catch (error) { setBusy(false); status(error.message); }
  }
  function showEditor(essay) {
    writingManageMode = true; editing = essay; dirty = false; bookmark = null;
    header(essay ? 'Edit essay' : 'New essay');
    const titleLabel = node('label', 'Title', 'essay-title-label');
    title = node('input'); title.id = 'essay-title'; title.type = 'text'; title.maxLength = 200; title.value = essay?.title || ''; titleLabel.append(title); page.append(titleLabel);
    const toolbar = node('div', undefined, 'essay-toolbar'); toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', 'Essay formatting');
    const formats = [['Bold', 'bold'], ['Italic', 'italic'], ['Underline', 'underline'], ['Heading', 'formatBlock', 'h2'], ['Paragraph', 'formatBlock', 'p'], ['Quote', 'formatBlock', 'blockquote'], ['Bullets', 'insertUnorderedList'], ['Numbered list', 'insertOrderedList']];
    for (const [label, command, argument] of formats) {
      const control = button(label, () => { if (busy) return; restoreSelection(); document.execCommand(command, false, argument); dirty = true; rememberSelection(); });
      on(control, 'mousedown', event => event.preventDefault()); toolbar.append(control);
    }
    const upload = node('input'); upload.type = 'file'; upload.accept = 'image/jpeg,image/png,image/webp'; upload.hidden = true; upload.id = 'essay-picture-input';
    on(upload, 'change', () => { const file = upload.files[0]; upload.value = ''; if (file) uploadPicture(file); });
    const pictureButton = button('Add picture', () => { rememberSelection(); upload.click(); });
    on(pictureButton, 'mousedown', event => event.preventDefault()); toolbar.append(pictureButton, upload); page.append(toolbar);
    editor = node('div', undefined, 'essay-body essay-editor'); editor.id = 'essay-editor'; editor.contentEditable = 'true'; editor.setAttribute('role', 'textbox'); editor.setAttribute('aria-multiline', 'true'); editor.setAttribute('aria-label', 'Essay text'); editor.spellcheck = true;
    renderBlocks(editor, essay?.blocks || [{type:'paragraph', content:[]}], true); page.append(editor);
    on(editor, 'input', () => { dirty = true; rememberSelection(); }); on(title, 'input', () => { dirty = true; });
    on(editor, 'paste', event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); dirty = true; });
    on(editor, 'drop', event => { event.preventDefault(); if (event.dataTransfer.files[0]) uploadPicture(event.dataTransfer.files[0]); else { document.execCommand('insertText', false, event.dataTransfer.getData('text/plain')); dirty = true; } });
    const controls = actions(page);
    controls.append(button('Save draft', () => save('draft')), button('Publish', () => save('published')));
    controls.append(button('Cancel', async () => {
      if (busy || dirty && !window.confirm('Discard your unsaved changes?')) return;
      await discardUploads(); dirty = false;
      if (essay) showEssay(essay); else showList();
    }));
    title.focus();
  }
  on(document, 'selectionchange', rememberSelection);
  on(window, 'beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
  if (location.protocol === 'file:') { showList(); status('Editing is available on the running website.'); }
  else Promise.all([request(writingManageMode ? '?manage=1' : ''), request('/session')]).then(([data, session]) => {
    if (signal.aborted) return;
    state = data; canEdit = session.canEdit;
    const essay = requestedId && state.essays.find(item => item.id === requestedId);
    if (essay) showEssay(essay);
    else { showList(); if (requestedId) status('This essay is not published.'); }
  }).catch(error => { if (!signal.aborted) { if (writingManageMode) writingManageMode = false; status(error.message); } });
  return {
    hasUnsavedChanges: () => dirty || busy,
    route: () => currentRoute,
    dispose() { if (staged.size) discardUploads().catch(() => {}); controller.abort(); }
  };
}
