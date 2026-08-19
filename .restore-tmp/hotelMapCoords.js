import api from '../../api';
import { buildAddressLine, firstResult } from '../../pages/hotels/hotelTripjackHelpers';
import { collectHotelCoordinates, parseHotelCoordinates } from './parseHotelCoordinates';

const staticCoordCache = new Map();

export function readInlineHotelCoordinates(hotel = {}) {
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
  if (staticCoordCache.has(key)) return staticCoordCache.get(key);

  const res = await api.post('/hotels/hotel-details/static', { tjHotelId: key });
  const record = firstResult(res.data);
  const staticContent = record?.staticContent || res.data?.staticContent || {};
  const coords = collectHotelCoordinates(
    staticContent.coordinates,
    record?.coordinates,
    record?.geolocation,
    staticContent.locale?.coordinates,
    record?.locale?.coordinates,
  );

  if (!coords) return null;

  const next = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    address: buildAddressLine(staticContent.address || record?.address || {}, staticContent.address?.city || ''),
  };
  staticCoordCache.set(key, next);
  return next;
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

  for (let index = 0; index < pending.length; index += 6) {
    const chunk = pending.slice(index, index + 6);
    const fetched = await Promise.all(chunk.map(async (hotel) => {
      const hotelId = String(hotel.hotelId || hotel.id || '').trim();
      if (!hotelId) return null;

      try {
        const coords = await fetchStaticHotelCoordinates(hotelId);
        if (!coords) return null;
        return {
          id: hotelId,
          hotelId,
          name: hotel.name,
          latitude: coords.latitude,
          longitude: coords.longitude,
          address: coords.address || hotel.address || '',
        };
      } catch {
        return null;
      }
    }));

    points.push(...fetched.filter(Boolean));
    if (onProgress) onProgress([...points]);
  }

  return points;
}

export async function geocodeCityCenter(cityName, countryCode = 'IN') {
  const city = String(cityName || '').trim();
  if (!city) return null;

  const countryLabel = String(countryCode || 'IN').toUpperCase() === 'IN' ? 'India' : countryCode;
  const query = encodeURIComponent(`${city}, ${countryLabel}`);
  const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) return null;

  const rows = await response.json();
  const first = Array.isArray(rows) ? rows[0] : null;
  return parseHotelCoordinates(first);
}
