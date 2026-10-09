const fs = require('node:fs');
const path = require('node:path');
const profile = require('./knowledge.json');
const sections = require('./site-content');
const seed = require('./places.seed.json');
const { sortLifePlaces, lifeDistinctPlaces, lifeTravelStats } = require('./place-utils');

// These are our own checked-in templates, never fetched HTML or user-authored markup.
function pageText(html) {
  return html.replace(/<(svg|button|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|h[1-6]|section|header|summary|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function dateLabel(value) {
  if (!value) return '';
  if (value.length === 4) return value;
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1)));
}
function placePeriod(place) {
  const start = dateLabel(place.start), end = place.current ? 'Present' : dateLabel(place.end);
  return start && end ? `${start} – ${end}` : start || end || 'Dates not supplied';
}
function compileKnowledge(state) {
  const facts = profile.facts.map(fact => ({ ...fact }));
  facts.push({ id: 'site-about', title: 'About me', section: 'about', text: `From Ming’s About me page:\n\n${pageText(sections.about)}` });
  for (const match of sections.work.matchAll(/<section class="experience" id="experience-([a-z]+)"[\s\S]*?<\/section>/g)) {
    const company = match[1];
    facts.push({ id: `site-work-${company}`, title: `${company === 'didi' ? 'DiDi' : company === 'linkedin' ? 'LinkedIn' : company[0].toUpperCase() + company.slice(1)} — Work`, section: 'work', text: `From Ming’s Work page:\n\n${pageText(match[0])}` });
  }
  facts.push({ id: 'site-writing', title: 'Writing', section: 'notes', text: `From Ming’s Writing page:\n\n${pageText(sections.notes)}` });
  const lifeCategories = [...sections.travel.matchAll(/<details class="project-card life-category"><summary>[\s\S]*?<\/details>/g)].map(match => pageText(match[0]));
  facts.push({ id: 'site-life', title: 'Life', section: 'travel', text: `From Ming’s Life page (besides Places):\n\n${lifeCategories.join('\n\n')}` });
  const places = sortLifePlaces(state.places.map(place => ({ ...place, country: place.country || seed.find(item => item.lat === place.lat && item.lon === place.lon)?.country })));
  const distinct = lifeDistinctPlaces(places);
  const stats = lifeTravelStats(places);
  const countries = [...new Set(places.map(place => place.country).filter(Boolean))].map(code => new Intl.DisplayNames(['en'], { type: 'region' }).of(code));
  facts.push({ id: 'places-overview', title: 'Places', section: 'travel', text: places.length ? `Ming’s published Places entries include ${distinct.map(place => place.name).join('; ')}. These are recorded locations, including places he has lived or studied and trips; the entries do not necessarily cover every place he has visited.` : 'No Places entries are currently published.' });
  facts.push({ id: 'places-stats', title: 'Places — stats', section: 'travel', text: `The published Places entries record ${stats.places} distinct places and ${stats.countries}${stats.unresolvedCountries ? '+ known' : ''} countries${countries.length ? ` (${countries.join(', ')})` : ''}. Estimated travel distance: ${stats.miles.toLocaleString('en-US')} miles. This is the sum of straight-line distances between dated entries in arrival order, excluding undated entries and unrecorded return trips; it is not actual mileage traveled.${stats.unresolvedCountries ? ' Some entries have no saved country information.' : ''}` });
  for (const place of places) {
    const highlights = (place.highlights || []).map(item => typeof item === 'string' ? item : item.text);
    const period = placePeriod(place);
    facts.push({ id: `place:${place.id}`, title: `${place.name} · ${period}`, section: 'travel', placeId: place.id, location: place.name, country: place.country ? new Intl.DisplayNames(['en'], { type: 'region' }).of(place.country) : '', keywords: (place.highlights || []).map(item => item.icon || '').join(' '),
      text: `${place.name}\n${period}${place.note ? `\n\nDescription from the Places entry:\n${place.note}` : ''}${highlights.length ? `\n\nHighlights:\n${highlights.map(text => `• ${text}`).join('\n')}` : ''}${place.photos?.length ? `\n\n${place.photos.length} published photo${place.photos.length === 1 ? '' : 's'}. No photo description has been supplied.` : ''}` });
  }
  return { updated: profile.updated, placesRevision: state.revision, source: 'Ming’s supplied profile, shared page content, and published Places entries', facts };
}
function createKnowledgeStore(directory) {
  const file = path.join(directory, 'assistant-knowledge.json');
  let knowledge;
  return {
    file,
    update(state) {
      const next = compileKnowledge(state);
      // Keep current answers in sync even if a disk write fails; a restart regenerates the file.
      knowledge = next;
      const temporary = `${file}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
      fs.renameSync(temporary, file);
    },
    read: () => knowledge
  };
}
module.exports = { compileKnowledge, createKnowledgeStore };
