import api from '../../api';
import { buildAddressLine, firstResult } from '../../pages/hotels/hotelTripjackHelpers';
import { collectHotelCoordinates, parseHotelCoordinates } from './parseHotelCoordinates';

const staticCoordCache = new Map();
const staticInFlight = new Map();
const staticBulkInFlight = new Map();
const geocodeCache = new Map();
const geocodeInFlight = new Map();
const STATIC_COORD_MISS = Symbol('static-coord-miss');
const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE ?? 'true').toLowerCase() !== 'false';
const DEMO_CITY_COORDS = {
  BENGALURU: { latitude: 12.9716, longitude: 77.5946 },
  BANGALORE: { latitude: 12.9716, longitude: 77.5946 },
  MUMBAI: { latitude: 19.076, longitude: 72.8777 },
  DELHI: { latitude: 28.6139, longitude: 77.209 },
  SINGAPORE: { latitude: 1.3521, longitude: 103.8198 },
};

export function readInlineHotelCoordinates(hotel = {}) {
  if (hotel.latitude != null && hotel.longitude != null) {
    const direct = parseHotelCoordinates(hotel);
    if (direct) return direct;
  }

  return collectHotelCoordinates(
    hotel,
    hotel.coordinates,
    hotel.geolocation,
    hotel.locale?.coordinates,
    hotel.staticContent?.coordinates,
  );
}

export async function fetchStaticHotelCoordinates(tjHotelId) {
  const key = String(tjHotelId || '').trim();
  if (!key) return null;

  if (staticCoordCache.has(key)) {
    const cached = staticCoordCache.get(key);
    return cached === STATIC_COORD_MISS ? null : cached;
  }
  if (staticInFlight.has(key)) return staticInFlight.get(key);

  const request = (async () => {
    try {
      const res = await api.post('/hotels/hotel-details/static', { tjHotelId: key });
      const record = firstResult(res.data) || res.data?.hotel || res.data || {};
      const staticContent = record?.staticContent || res.data?.staticContent || record || {};
      const coords = collectHotelCoordinates(
        staticContent.coordinates,
        staticContent.location,
        staticContent.geo,
        record?.coordinates,
        record?.location,
        record?.geo,
        record?.geolocation,
        staticContent.locale?.coordinates,
        record?.locale?.coordinates,
      );

      if (!coords) {
        staticCoordCache.set(key, STATIC_COORD_MISS);
        return null;
      }

      const next = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: buildAddressLine(staticContent.address || record?.address || {}, staticContent.address?.city || ''),
      };
      staticCoordCache.set(key, next);
      return next;
    } catch {
      staticCoordCache.set(key, STATIC_COORD_MISS);
      return null;
    } finally {
      staticInFlight.delete(key);
    }
  })();

  staticInFlight.set(key, request);
  return request;
}

export async function fetchStaticHotelCoordinatesBulk(tjHotelIds = []) {
  const keys = [...new Set(tjHotelIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!keys.length) return new Map();

  const result = new Map();
  const missing = [];

  keys.forEach((key) => {
    if (!staticCoordCache.has(key)) {
      missing.push(key);
      return;
    }
    const cached = staticCoordCache.get(key);
    if (cached !== STATIC_COORD_MISS) result.set(key, cached);
  });

  if (!missing.length) return result;

  const requestKey = missing.slice().sort().join('|');
  if (staticBulkInFlight.has(requestKey)) {
    const fetched = await staticBulkInFlight.get(requestKey);
    fetched.forEach((value, key) => result.set(key, value));
    return result;
  }

  const request = (async () => {
    const fetched = new Map();
    try {
      const res = await api.post('/hotels/hotel-details/static/map', { tjHotelIds: missing });
      const rows = Array.isArray(res.data?.results) ? res.data.results : [];
      const found = new Set();

      rows.forEach((record) => {
        const key = String(record?.tjHotelId || '').trim();
        if (!key) return;

        const coords = collectHotelCoordinates(
          record?.coordinates,
          record?.location,
          record?.geo,
          record?.staticContent?.coordinates,
        );

        if (!coords) return;

        const next = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          address: buildAddressLine(record.address || record.staticContent?.address || {}, record.address?.cityName || ''),
        };
        found.add(key);
        staticCoordCache.set(key, next);
        fetched.set(key, next);
      });

      missing.forEach((key) => {
        if (!found.has(key)) staticCoordCache.set(key, STATIC_COORD_MISS);
      });
    } catch {
      missing.forEach((key) => staticCoordCache.set(key, STATIC_COORD_MISS));
    } finally {
      staticBulkInFlight.delete(requestKey);
    }
    return fetched;
  })();

  staticBulkInFlight.set(requestKey, request);
  const fetched = await request;
  fetched.forEach((value, key) => result.set(key, value));
  return result;
}

export async function resolveHotelMapPoints(hotels = [], { onProgress } = {}) {
  const points = [];
  const pending = [];

  for (const hotel of hotels) {
    const hotelId = String(hotel.hotelId || hotel.id || '').trim();
    const inline = readInlineHotelCoordinates(hotel);
    if (inline) {
      points.push({
        id: hotelId,
        hotelId,
        name: hotel.name,
        latitude: inline.latitude,
        longitude: inline.longitude,
        address: hotel.address || '',
      });
      continue;
    }
    pending.push(hotel);
  }

  if (onProgress) onProgress([...points]);

  const pendingIds = pending.map((hotel) => hotel.hotelId || hotel.id);
  const fetched = await fetchStaticHotelCoordinatesBulk(pendingIds);

  pending.forEach((hotel) => {
    const hotelId = String(hotel.hotelId || hotel.id || '').trim();
    const coords = fetched.get(hotelId);
    if (!coords) return;
    points.push({
      id: hotelId,
      hotelId,
      name: hotel.name,
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: coords.address || hotel.address || '',
    });
    if (onProgress) onProgress([...points]);
  });

  return points;
}

export async function geocodeCityCenter(cityName, countryCode = 'IN') {
  const city = String(cityName || '').trim();
  if (!city) return null;

  const cacheKey = `${city.toUpperCase()}|${String(countryCode || 'IN').toUpperCase()}`;
  if (DEMO_MODE) return DEMO_CITY_COORDS[city.toUpperCase()] || null;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);
  if (geocodeInFlight.has(cacheKey)) return geocodeInFlight.get(cacheKey);

  const countryLabel = String(countryCode || 'IN').toUpperCase() === 'IN' ? 'India' : countryCode;
  const query = encodeURIComponent(`${city}, ${countryLabel}`);

  const request = fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'CorporateTravelBookingPortal/1.0',
    },
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const rows = await response.json();
      const first = Array.isArray(rows) ? rows[0] : null;
      const coords = parseHotelCoordinates(first);
      if (coords) geocodeCache.set(cacheKey, coords);
      return coords;
    })
    .catch(() => null)
    .finally(() => {
      geocodeInFlight.delete(cacheKey);
    });

  geocodeInFlight.set(cacheKey, request);
  return request;
}
