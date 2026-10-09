// An in-memory session also works in embedded previews that block third-party cookies.
// It is never persisted to browser storage or included in generated HTML.
let lifeOwnerToken = null;
function sortLifePlaces(places) {
  // Sort by arrival, so an ongoing home can coexist with more recent trips.
  // Keep undated entries after dated ones, preserving their saved order.
  return [...places].sort((a, b) => (b.start || '').localeCompare(a.start || ''));
}
function mountLife(root) {
  const controller = new AbortController();
  const signal = controller.signal;
  const $ = selector => root.querySelector(selector);
  const on = (element, event, callback, options = {}) => element.addEventListener(event, callback, { ...options, signal });
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const card = $('#life-places');
  const entries = $('#places-entries');
  const timeline = $('#places-timeline');
  const globe = $('#life-globe');
  const editor = $('#place-editor');
  const highlightFields = $('#place-highlight-fields');
  const addHighlight = $('#place-highlight-add');
  const login = $('#places-login');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const projection = d3.geoOrthographic().translate([140, 140]).scale(119).clipAngle(90);
  const geoPath = d3.geoPath(projection);
  const grid = d3.geoGraticule().step([45, 30])();
  let places = sortLifePlaces(LIFE_DEFAULT_PLACES.map(place => ({ ...place })));
  let revision = null;
  let editing = false;
  let requiresPassword = false;
  let saving = false;
  let editingId = null;
  let chosenLocation = null;
  let preview = null;
  let picking = false;
  let drag = null;
  let activeId = places[0]?.id;
  let rotation = [-places[0].lon, -places[0].lat, 0];
  let animation = null;
  let syncFrame = null;
  const countryLookups = new Map();

  function highlightIcon(value) {
    const definition = Object.hasOwn(LIFE_HIGHLIGHT_ICONS, value) ? LIFE_HIGHLIGHT_ICONS[value] : LIFE_HIGHLIGHT_ICONS.bullet;
    const icon = node('span', 'highlight-icon');
    icon.setAttribute('role', 'img'); icon.setAttribute('aria-label', definition.label);
    // Only checked-in SVG paths enter this markup; highlight text uses textContent.
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${definition.svg}</svg>`;
    return icon;
  }
  function countryFor(place) {
    const known = LIFE_DEFAULT_PLACES.find(item => item.lat === place.lat && item.lon === place.lon);
    if (place.country || known?.country) return Promise.resolve(place.country || known.country);
    const key = `${place.lat},${place.lon}`;
    if (!countryLookups.has(key)) countryLookups.set(key, request(`/country?lat=${place.lat}&lon=${place.lon}`).then(result => result.country).catch(() => null));
    return countryLookups.get(key);
  }
  function addPlaceFlag(heading, place) {
    countryFor(place).then(country => {
      if (!country || !/^[A-Z]{2}$/.test(country) || signal.aborted || !heading.isConnected) return;
      place.country = country;
      const flag = node('span', 'place-flag', String.fromCodePoint(...[...country].map(letter => 127397 + letter.charCodeAt(0))));
      flag.setAttribute('role', 'img');
      flag.setAttribute('aria-label', `${new Intl.DisplayNames(['en'], { type: 'region' }).of(country)} flag`);
      heading.append(flag);
    });
  }

  function message(element, text = '') { if (!element || signal.aborted) return; element.textContent = text; element.hidden = !text; }
  function dateLabel(value) {
    if (!value) return '';
    if (value.length === 4) return value;
    const [year, month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1)));
  }
  function period(place) {
    const from = dateLabel(place.start), to = place.current ? 'Present' : dateLabel(place.end);
    return from && to ? `${from} – ${to}` : from || to;
  }
  async function request(path, method = 'GET', data) {
    if (location.protocol === 'file:') throw new Error('Editing requires the running website. This HTML file isn’t connected to the editing server.');
    const pending = new AbortController();
    const cancel = () => pending.abort();
    signal.addEventListener('abort', cancel, { once: true });
    let timedOut = false;
    const deadline = setTimeout(() => { timedOut = true; pending.abort(); }, 10000);
    try {
      let response;
      try {
        response = await fetch(`/api/places${path}`, {
          method, credentials: 'same-origin', cache: 'no-store', signal: pending.signal,
          headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(lifeOwnerToken ? { Authorization: `Bearer ${lifeOwnerToken}` } : {}) },
          ...(data === undefined ? {} : { body: JSON.stringify(data) })
        });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new Error(timedOut ? 'The editing server took too long. Please try again.' : 'Couldn’t reach the editing server from this preview. Try reopening the running website.');
      }
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('This preview isn’t connected to the editing server. Open the running website to edit places.');
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) lifeOwnerToken = null;
        const error = new Error(result.error || 'Couldn’t save places.'); error.status = response.status; throw error;
      }
      return result;
    } finally { clearTimeout(deadline); signal.removeEventListener('abort', cancel); }
  }
  function drawGlobe() {
    projection.rotate(rotation);
    $('.globe-land').setAttribute('d', geoPath(LIFE_LAND));
    $('.globe-grid').setAttribute('d', geoPath(grid));
    const pinLayer = $('.globe-pins');
    pinLayer.replaceChildren();
    const displayed = preview ? [...places, { ...preview, id: 'preview' }] : places;
    const center = [-rotation[0], -rotation[1]];
    for (const place of displayed) {
      if (d3.geoDistance(center, [place.lon, place.lat]) > Math.PI / 2 - 0.02) continue;
      const point = projection([place.lon, place.lat]);
      const active = preview ? place.id === 'preview' : place.id === activeId;
      const pin = document.createElementNS('http://www.w3.org/2000/svg', active ? 'g' : 'circle');
      if (active) {
        pin.setAttribute('transform', `translate(${point[0]},${point[1]})`);
        const shape = document.createElementNS(pin.namespaceURI, 'path');
        shape.setAttribute('d', 'M0 0C-3-5-8-10-8-15a8 8 0 0 1 16 0C8-10 3-5 0 0Z');
        shape.setAttribute('class', 'globe-pin');
        const dot = document.createElementNS(pin.namespaceURI, 'circle');
        dot.setAttribute('cx', '0'); dot.setAttribute('cy', '-15'); dot.setAttribute('r', '2.5'); dot.setAttribute('class', 'globe-pin-dot');
        pin.append(shape, dot);
      } else {
        pin.setAttribute('cx', point[0]); pin.setAttribute('cy', point[1]); pin.setAttribute('r', '2.5'); pin.setAttribute('class', 'globe-other-pin');
      }
      pinLayer.append(pin);
    }
  }
  function turnTo(place, animate = true) {
    if (!place) { drawGlobe(); return; }
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
    $('#globe-place').textContent = place.name;
    $('#globe-dates').textContent = period(place);
    globe.setAttribute('aria-label', `Globe showing ${place.name}`);
    globe.dataset.place = place.id || 'preview';
    const destination = [-place.lon, -place.lat, 0];
    const from = [...rotation];
    const longitudeDelta = ((destination[0] - from[0] + 540) % 360) - 180;
    if (!animate || reducedMotion.matches || !card.open) { rotation = destination; drawGlobe(); return; }
    const start = performance.now();
    const frame = now => {
      const progress = Math.min(1, (now - start) / 420), eased = progress * (2 - progress);
      rotation = [from[0] + longitudeDelta * eased, from[1] + (destination[1] - from[1]) * eased, 0];
      drawGlobe();
      if (progress < 1) animation = requestAnimationFrame(frame); else { rotation = destination; animation = null; }
    };
    animation = requestAnimationFrame(frame);
  }
  function setActive(id, animate = true) {
    const changed = id !== activeId;
    activeId = id;
    for (const button of timeline.querySelectorAll('button')) {
      if (button.dataset.place === id) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    }
    for (const entry of entries.children) entry.classList.toggle('current-place', entry.dataset.place === id);
    if (!preview && !picking && (changed || !globe.dataset.place)) turnTo(places.find(place => place.id === id), animate);
    if (changed) {
      const selected = [...timeline.querySelectorAll('button')].find(button => button.dataset.place === id);
      if (selected) {
        const bounds = selected.getBoundingClientRect(), rail = timeline.getBoundingClientRect();
        if (bounds.left < rail.left) timeline.scrollLeft += bounds.left - rail.left;
        else if (bounds.right > rail.right) timeline.scrollLeft += bounds.right - rail.right;
        if (bounds.top < rail.top) timeline.scrollTop += bounds.top - rail.top;
        else if (bounds.bottom > rail.bottom) timeline.scrollTop += bounds.bottom - rail.bottom;
      }
    }
  }
  function syncPosition() {
    syncFrame = null;
    if (!card.open || !entries.children.length) return;
    const compact = window.matchMedia('(max-width: 1050px)').matches;
    root.style.setProperty('--places-anchor-offset', `${$('.places-rail').getBoundingClientRect().height + 22}px`);
    const margin = parseFloat(getComputedStyle(entries.firstElementChild).scrollMarginTop) || 0;
    const line = compact ? Math.max($('.places-rail').getBoundingClientRect().bottom + 20, margin + 2) : Math.max(180, margin + 2);
    let selected = entries.firstElementChild;
    for (const entry of entries.children) if (entry.getBoundingClientRect().top <= line) selected = entry;
    setActive(selected.dataset.place);
  }
  function scheduleSync() { if (syncFrame === null) syncFrame = requestAnimationFrame(syncPosition); }
  function jumpTo(id) {
    root.style.setProperty('--places-anchor-offset', `${$('.places-rail').getBoundingClientRect().height + 22}px`);
    const entry = [...entries.children].find(element => element.dataset.place === id);
    entry?.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    scheduleSync();
  }
  function renderPlaces() {
    entries.replaceChildren(); timeline.replaceChildren();
    for (const place of places) {
      const entry = node('li', 'place-entry');
      entry.id = `place-entry-${place.id}`; entry.dataset.place = place.id;
      const heading = node('h3', '', place.name); entry.append(heading); addPlaceFlag(heading, place);
      if (period(place)) entry.append(node('p', 'place-period', period(place)));
      if (place.note) entry.append(node('p', 'place-description', place.note));
      if (place.highlights?.length) {
        const highlights = node('ul', 'place-highlights');
        for (const highlight of place.highlights) {
          const item = node('li');
          item.append(highlightIcon(typeof highlight === 'string' ? 'bullet' : highlight.icon), node('span', '', typeof highlight === 'string' ? highlight : highlight.text));
          highlights.append(item);
        }
        entry.append(highlights);
      }
      if (editing) {
        const actions = node('div', 'place-entry-actions');
        const edit = node('button', '', 'Edit'); edit.type = 'button'; on(edit, 'click', () => showEditor(place));
        const remove = node('button', '', 'Remove'); remove.type = 'button'; on(remove, 'click', async () => {
          if (saving) return;
          try { await savePlaces(places.filter(item => item.id !== place.id)); message($('#places-status'), 'Place removed.'); }
          catch (error) { message($('#places-status'), error.message); }
        });
        actions.append(edit, remove); entry.append(actions);
      }
      entries.append(entry);
      const step = node('li'); const button = node('button'); button.type = 'button'; button.dataset.place = place.id;
      button.append(node('strong', '', place.name));
      if (period(place)) button.append(node('span', '', period(place)));
      on(button, 'click', () => jumpTo(place.id)); step.append(button); timeline.append(step);
    }
    if (!places.some(place => place.id === activeId)) activeId = places[0]?.id;
    setActive(activeId, false);
    if (!preview) turnTo(places.find(place => place.id === activeId), false);
    $('#places-edit').textContent = editing ? 'Done editing' : 'Edit places';
    $('#places-add').hidden = !editing;
    scheduleSync();
  }
  async function loadPlaces() {
    const result = await request('');
    if (signal.aborted) return;
    places = sortLifePlaces(result.places); revision = result.revision; renderPlaces();
  }
  async function savePlaces(next) {
    if (saving) return;
    saving = true;
    for (const button of root.querySelectorAll('.place-form-actions button, .place-entry-actions button, .places-toolbar button')) button.disabled = true;
    try {
      const result = await request('', 'PUT', { places: sortLifePlaces(next), revision });
      places = sortLifePlaces(result.places); revision = result.revision; renderPlaces();
    } catch (error) {
      if (error.status === 401) { editing = false; renderPlaces(); }
      if (error.status === 409) await loadPlaces();
      throw error;
    } finally {
      saving = false;
      for (const button of root.querySelectorAll('.place-form-actions button, .place-entry-actions button, .places-toolbar button')) button.disabled = false;
    }
  }
  function togglePicking(value) {
    if (value && animation !== null) { cancelAnimationFrame(animation); animation = null; }
    picking = value; globe.classList.toggle('picking', value);
    globe.setAttribute('tabindex', value ? '0' : '-1');
    $('#place-pick').textContent = value ? 'Cancel picking' : 'Pick on globe';
    if (value) globe.setAttribute('aria-label', 'Pick a location. Arrow keys rotate the globe; Enter selects its center.');
  }
  function closeEditor() {
    editor.hidden = true; editingId = null; chosenLocation = null; preview = null; togglePicking(false);
    message($('#place-form-status'));
    turnTo(places.find(place => place.id === activeId));
  }
  function syncHighlightFields() {
    [...highlightFields.children].forEach((row, index) => {
      row.querySelector('input').setAttribute('aria-label', `Highlight ${index + 1}`);
      row.querySelector('select').setAttribute('aria-label', `Icon for highlight ${index + 1}`);
      row.querySelector('button').setAttribute('aria-label', `Remove highlight ${index + 1}`);
    });
    addHighlight.disabled = highlightFields.children.length >= 5;
  }
  function appendHighlight(value = { text: '', icon: 'bullet' }, focus = false) {
    if (highlightFields.children.length >= 5) return;
    const row = node('li', 'place-highlight-field');
    const input = node('input'); input.type = 'text'; input.maxLength = 200; input.value = typeof value === 'string' ? value : value.text;
    const choice = node('div', 'place-highlight-choice');
    const select = node('select');
    for (const [key, definition] of Object.entries(LIFE_HIGHLIGHT_ICONS)) {
      const option = node('option', '', definition.label); option.value = key; select.append(option);
    }
    select.value = typeof value === 'string' ? 'bullet' : value.icon;
    choice.append(highlightIcon(select.value), select);
    on(select, 'change', () => choice.replaceChild(highlightIcon(select.value), choice.firstElementChild));
    const remove = node('button', '', 'Remove'); remove.type = 'button';
    on(remove, 'click', () => {
      if (saving) return;
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove(); syncHighlightFields();
      (next?.querySelector('input') || addHighlight).focus();
    });
    row.append(input, choice, remove); highlightFields.append(row); syncHighlightFields();
    if (focus) input.focus();
  }
  function showEditor(place = null) {
    editingId = place?.id || null; editor.reset();
    $('#place-editor-title').textContent = place ? 'Edit place' : 'Add place';
    $('#place-location').value = place?.name || '';
    $('#place-from').value = place?.start?.length === 7 ? place.start : '';
    $('#place-from').required = !place;
    $('#place-to').value = place?.end?.length === 7 ? place.end : '';
    $('#place-present').checked = place?.current || false;
    $('#place-to').disabled = $('#place-present').checked;
    $('#place-to').required = !place && !$('#place-present').checked;
    $('#place-note').value = place?.note || '';
    highlightFields.replaceChildren();
    for (const highlight of place?.highlights || []) appendHighlight(highlight);
    syncHighlightFields();
    chosenLocation = place ? { name: place.name, lat: place.lat, lon: place.lon, country: place.country } : null;
    preview = null; togglePicking(false);
    $('#place-search-results').replaceChildren(); $('#place-attribution').hidden = true;
    message($('#place-form-status')); editor.hidden = false;
    root.style.setProperty('--places-anchor-offset', `${$('.places-rail').getBoundingClientRect().height + 22}px`);
    editor.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    $('#place-location').focus({ preventScroll: true });
  }
  function chooseLocation(location, replaceName = true) {
    chosenLocation = { ...location };
    if (replaceName) $('#place-location').value = location.name;
    preview = { ...location, name: $('#place-location').value.trim() || 'Selected location', start: null, end: null, current: false };
    countryFor(location).then(country => {
      if (country && !signal.aborted && chosenLocation?.lat === location.lat && chosenLocation?.lon === location.lon) chosenLocation.country = country;
    });
    togglePicking(false); turnTo(preview);
    $('#place-search-results').replaceChildren();
    message($('#place-form-status'), 'Location selected.');
  }

  on($('#places-edit'), 'click', async () => {
    const button = $('#places-edit');
    button.disabled = true;
    button.textContent = editing ? 'Closing…' : 'Opening…';
    try {
    if (editing) {
      try { await request('/session', 'DELETE'); lifeOwnerToken = null; closeEditor(); editing = false; renderPlaces(); message($('#places-status')); }
      catch (error) { message($('#places-status'), error.message); }
    } else {
      try {
        const access = await request('/session');
        requiresPassword = access.requiresPassword === true;
        if (!requiresPassword || access.canEdit) {
          await loadPlaces(); editing = true; renderPlaces(); message($('#places-status'));
          $('.places-toolbar').scrollIntoView({ block: 'nearest', behavior: 'instant' });
          $('#places-add').focus({ preventScroll: true });
        } else { message($('#places-login-status')); login.hidden = false; $('#places-password').focus({ preventScroll: true }); }
      } catch (error) { message($('#places-status'), error.message); }
    }
    } finally { if (button.isConnected) { button.disabled = false; button.textContent = editing ? 'Done editing' : 'Edit places'; } }
  });
  on($('#places-login-cancel'), 'click', () => { login.hidden = true; login.reset(); message($('#places-login-status')); });
  on(login, 'submit', async event => {
    event.preventDefault(); const button = login.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Unlocking…'; login.setAttribute('aria-busy', 'true'); message($('#places-login-status'));
    try {
      const session = await request('/session', 'POST', { password: $('#places-password').value.trim() });
      lifeOwnerToken = session.token || null;
      await loadPlaces(); editing = true; login.reset(); login.hidden = true; renderPlaces(); message($('#places-status'));
      $('.places-toolbar').scrollIntoView({ block: 'nearest', behavior: 'instant' });
      $('#places-add').focus({ preventScroll: true });
    } catch (error) { message($('#places-login-status'), error.message); }
    finally { button.disabled = false; button.textContent = 'Unlock'; login.removeAttribute('aria-busy'); }
  });
  on($('#places-add'), 'click', () => showEditor());
  on(addHighlight, 'click', () => { if (!saving) appendHighlight(undefined, true); });
  on($('#place-cancel'), 'click', () => { closeEditor(); $('#places-add').focus({ preventScroll: true }); });
  on($('#place-present'), 'change', () => {
    $('#place-to').disabled = $('#place-present').checked;
    $('#place-to').required = !editingId && !$('#place-present').checked;
  });
  on($('#place-location'), 'input', () => { chosenLocation = null; preview = null; $('#place-search-results').replaceChildren(); });
  on($('#place-search'), 'click', async () => {
    const query = $('#place-location').value.trim();
    if (!query) { $('#place-location').reportValidity(); return; }
    $('#place-search').disabled = true; message($('#place-form-status'), 'Finding location…');
    try {
      const result = await request(`/search?q=${encodeURIComponent(query)}`);
      if ($('#place-location').value.trim() !== query || editor.hidden) return;
      const results = $('#place-search-results'); results.replaceChildren();
      for (const location of result.results) {
        const button = node('button', '', location.name); button.type = 'button'; on(button, 'click', () => chooseLocation(location)); results.append(button);
      }
      $('#place-attribution').hidden = !result.attribution;
      message($('#place-form-status'), result.results.length ? '' : 'No location found. You can pick a point on the globe.');
    } catch (error) { message($('#place-form-status'), error.message); }
    finally { $('#place-search').disabled = false; }
  });
  on($('#place-pick'), 'click', () => { togglePicking(!picking); if (picking) { $('.places-rail').scrollIntoView({ block: 'center', behavior: 'instant' }); globe.focus({ preventScroll: true }); } });
  on(globe, 'pointerdown', event => {
    if (!picking) return;
    event.preventDefault(); globe.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, rotation: [...rotation], moved: false };
  });
  on(globe, 'pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (animation !== null) { cancelAnimationFrame(animation); animation = null; }
    rotation = [drag.rotation[0] + dx * 0.6, Math.max(-85, Math.min(85, drag.rotation[1] - dy * 0.6)), 0]; drawGlobe();
  });
  on(globe, 'pointerup', event => {
    if (!drag) return;
    const moved = drag.moved; drag = null;
    if (moved) return;
    const rect = globe.getBoundingClientRect();
    const point = [(event.clientX - rect.left) * 280 / rect.width, (event.clientY - rect.top) * 280 / rect.height];
    if (Math.hypot(point[0] - 140, point[1] - 140) > 119) return;
    const [lon, lat] = projection.invert(point);
    chooseLocation({ name: $('#place-location').value.trim(), lat, lon }, false);
  });
  on(globe, 'pointercancel', () => { drag = null; });
  on(globe, 'keydown', event => {
    if (!picking) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(event.key)) event.preventDefault(); else return;
    if (event.key === 'Escape') { togglePicking(false); $('#place-pick').focus({ preventScroll: true }); return; }
    if (event.key === 'Enter') { const [lon, lat] = projection.invert([140, 140]); chooseLocation({ name: $('#place-location').value.trim(), lat, lon }, false); return; }
    rotation[0] += event.key === 'ArrowLeft' ? -15 : event.key === 'ArrowRight' ? 15 : 0;
    rotation[1] = Math.max(-85, Math.min(85, rotation[1] + (event.key === 'ArrowUp' ? 15 : event.key === 'ArrowDown' ? -15 : 0))); drawGlobe();
  });
  on(editor, 'submit', async event => {
    event.preventDefault();
    if (!chosenLocation) { message($('#place-form-status'), 'Find the location or pick a point on the globe.'); return; }
    const previous = places.find(place => place.id === editingId);
    const place = {
      id: editingId || `place-${crypto.randomUUID()}`, name: $('#place-location').value.trim(),
      start: $('#place-from').value || (previous?.start?.length === 4 ? previous.start : null),
      end: $('#place-present').checked ? null : $('#place-to').value || null, current: $('#place-present').checked,
      lat: chosenLocation.lat, lon: chosenLocation.lon, note: $('#place-note').value.trim(),
      highlights: [...highlightFields.children].map(row => ({ text: row.querySelector('input').value.trim(), icon: row.querySelector('select').value })).filter(item => item.text),
      ...(chosenLocation.country ? { country: chosenLocation.country } : {})
    };
    if (place.start && place.end && place.end < place.start) { message($('#place-form-status'), 'The end date must be after the start date.'); return; }
    const next = editingId ? places.map(item => item.id === editingId ? place : item) : [...places, place];
    try {
      await savePlaces(next); closeEditor(); message($('#places-status'), 'Saved.');
      jumpTo(place.id);
    } catch (error) { message($('#place-form-status'), error.message); }
  });
  on(card, 'toggle', () => { if (card.open) scheduleSync(); });
  on(window, 'scroll', scheduleSync, { passive: true });
  on(window, 'resize', scheduleSync, { passive: true });
  on(window, 'focus', () => { if (!editing) loadPlaces().catch(() => {}); });
  renderPlaces(); drawGlobe();
  Promise.all([loadPlaces(), request('/session')]).then(([, session]) => {
    requiresPassword = session.requiresPassword === true;
    if (!signal.aborted && requiresPassword && session.canEdit) { editing = true; renderPlaces(); }
  }).catch(() => {});
  return { dispose() { controller.abort(); if (animation !== null) cancelAnimationFrame(animation); if (syncFrame !== null) cancelAnimationFrame(syncFrame); } };
}
