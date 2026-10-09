// Shared by the Places UI and the saved assistant knowledge.
function lifeDistanceMiles(a, b) {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians, dLon = (b.lon - a.lon) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h))) * 3958.7613;
}
function sortLifePlaces(places) {
  // Sort by arrival, so an ongoing home can coexist with more recent trips.
  // Keep undated entries after dated ones, preserving their saved order.
  return [...places].sort((a, b) => (b.start || '').localeCompare(a.start || ''));
}
function lifeDistinctPlaces(places) {
  const distance = (a, b) => lifeDistanceMiles(a, b);
  const name = place => place.name.split(',')[0].normalize('NFKD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const distinct = [];
  for (const place of places) {
    if (!distinct.some(other => distance(place, other) < 0.1 || name(place) === name(other) && distance(place, other) < 25)) distinct.push(place);
  }
  return distinct;
}
function lifeTravelStats(places) {
  const distance = (a, b) => lifeDistanceMiles(a, b);
  const dated = places.filter(place => place.start).sort((a, b) => a.start.localeCompare(b.start));
  const miles = dated.reduce((total, place, index) => total + (index ? distance(dated[index - 1], place) : 0), 0);
  const countries = new Set(places.map(place => place.country).filter(Boolean));
  return { places: lifeDistinctPlaces(places).length, countries: countries.size, unresolvedCountries: places.some(place => !place.country), miles: Math.round(miles) };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { sortLifePlaces, lifeDistinctPlaces, lifeTravelStats };
