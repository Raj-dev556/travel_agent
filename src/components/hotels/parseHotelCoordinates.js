export function parseHotelCoordinates(source) {
  if (!source) return null;

  // MongoDB GeoJSON coordinates are stored as [longitude, latitude].
  if (Array.isArray(source) && source.length >= 2) {
    return toCoordinates(source[1], source[0]);
  }
  if (typeof source !== 'object') return null;

  if (Array.isArray(source.coordinates)) return parseHotelCoordinates(source.coordinates);
  if (Array.isArray(source.geoCoordinates)) return parseHotelCoordinates(source.geoCoordinates);
  if (source.location && typeof source.location === 'object') {
    const nested = parseHotelCoordinates(source.location);
    if (nested) return nested;
  }
  if (source.geo && typeof source.geo === 'object') {
    const nested = parseHotelCoordinates(source.geo);
    if (nested) return nested;
  }

  return toCoordinates(
    source.latitude
    ?? source.lat
    ?? source.la
    ?? source.y,
    source.longitude
    ?? source.lng
    ?? source.lon
    ?? source.long
    ?? source.lo
    ?? source.x,
  );
}

function toCoordinates(latitude, longitude) {
  if (latitude == null || longitude == null || latitude === '' || longitude === '') return null;
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { latitude: lat, longitude: lng };
}

export function collectHotelCoordinates(...sources) {
  for (const source of sources) {
    const coords = parseHotelCoordinates(source);
    if (coords) return coords;
  }
  return null;
}
