import api from '../../api';

const DEFAULT_LIMIT = 10;
const SUGGESTION_CACHE_TTL_MS = 5 * 60 * 1000;
const suggestionCache = new Map();
const inFlightSuggestions = new Map();

function rowsFromResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.data?.hotels)) return payload.data.hotels;
  if (Array.isArray(payload?.suggestions)) return payload.suggestions;
  if (Array.isArray(payload?.cities)) return payload.cities;
  if (Array.isArray(payload?.hotels)) return payload.hotels;
  return [];
}

function upper(value) {
  return String(value || '').trim().toUpperCase();
}

function isHotelSuggestion(item) {
  return item?.type === 'HOTEL' || item?.regionType === 'HOTEL';
}

export function isValidListingDestinationId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function pickBestDestinationSuggestion(suggestions, cityName) {
  if (!Array.isArray(suggestions) || !suggestions.length) return null;

  const q = upper(cityName);

  const exactCity = suggestions.find(
    (item) => !isHotelSuggestion(item)
      && item.cityRegionId
      && (item.name === q || item.displayName === q),
  );
  if (exactCity) return exactCity;

  const exactRegion = suggestions.find(
    (item) => !isHotelSuggestion(item)
      && item.cityRegionId
      && upper(item.raw?.regionName) === q,
  );
  if (exactRegion) return exactRegion;

  const exactAny = suggestions.find((item) => item.name === q || item.displayName === q);
  if (exactAny) return exactAny;

  const cityWithId = suggestions.find((item) => !isHotelSuggestion(item) && item.cityRegionId);
  if (cityWithId) return cityWithId;

  return suggestions.find((item) => item.cityRegionId || item.hotelId) || suggestions[0];
}

export async function resolveDestinationFromCityName(cityName, options = {}) {
  const q = String(cityName || '').trim();
  if (q.length < 2) return null;

  const suggestions = await fetchHotelCitySuggestions(q, { limit: 10, ...options });
  return pickBestDestinationSuggestion(suggestions, q);
}

export function normalizeHotelCitySuggestion(item) {
  const suggestionType = upper(item?.type || item?.regionType || (item?.hotelName || item?.hid || item?.hotelId || item?.tjHotelId || item?.tjid ? 'HOTEL' : 'CITY'));
  const name = upper(item?.hotelName || item?.name || item?.displayName || item?.regionName || item?.label);
  const country = upper(item?.countryName || item?.country || item?.countryCode);
  const fullRegionName = String(item?.fullRegionName || item?.subtitle || '').trim();

  let state = upper(item?.state || item?.regionName);
  if (!state && fullRegionName) {
    const parts = fullRegionName.split(',').map(upper).filter(Boolean);
    state = parts.filter((part) => part !== name && part !== country).join(', ');
  }

  const cityName = upper(item?.cityName || (suggestionType === 'HOTEL' ? item?.name : ''));
  const subtitle =
    fullRegionName ||
    [cityName && cityName !== name ? cityName : '', state, country].filter(Boolean).join(', ');

  return {
    code: String(item?.cityRegionId || item?.regionId || item?.id || item?.hid || item?.hotelId || item?.tjHotelId || item?.tjid || item?.code || name),
    id: String(item?.id || item?.cityRegionId || item?.regionId || item?.hid || item?.hotelId || item?.tjHotelId || item?.tjid || item?.code || name),
    name,
    displayName: upper(item?.displayName || name),
    state,
    country,
    subtitle,
    cityName,
    cityRegionId: item?.cityRegionId || item?.regionId,
    hotelId: item?.hid || item?.hotelId || item?.tjHotelId || item?.tjid || (suggestionType === 'HOTEL' ? item?.id : ''),
    regionType: suggestionType,
    type: suggestionType,
    fullRegionName: fullRegionName || subtitle,
    raw: item,
  };
}

export async function fetchHotelCitySuggestions(query, options = {}) {
  const q = String(query || '').trim();
  const limit = options.limit || DEFAULT_LIMIT;

  if (q.length < 2) return [];

  const cacheKey = `${q.toLowerCase()}|${limit}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SUGGESTION_CACHE_TTL_MS) {
    return cached.rows;
  }

  if (!options.signal && inFlightSuggestions.has(cacheKey)) {
    return inFlightSuggestions.get(cacheKey);
  }

  const apiKey = import.meta.env.VITE_BACKEND_API_KEY;
  const headers = apiKey ? { apikey: apiKey } : undefined;

  async function searchByTerm(term) {
    const params = {
      q: term,
      limit,
    };

    const response = await api.get('/cities/autocomplete', {
      params,
      headers,
      signal: options.signal,
    });

    return rowsFromResponse(response.data)
      .map(normalizeHotelCitySuggestion)
      .filter((city) => city.name);
  }

  const terms = [q];

  if (q.includes(' ')) {
    const parts = q.split(/\s+/).filter((part) => part.length >= 3);

    terms.push(...parts);

    const lastWord = parts[parts.length - 1];
    if (lastWord) terms.push(lastWord);
  }

  const uniqueTerms = [...new Set(terms)];

  function matchesAllWords(item) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);

    if (words.length <= 1) return true;

    const haystack = [
      item.name,
      item.displayName,
      item.cityName,
      item.state,
      item.country,
      item.subtitle,
      item.fullRegionName,
    ].filter(Boolean).join(' ').toLowerCase();

    return words.every((word) => haystack.includes(word));
  }
  const request = (async () => {
    const allResults = [];

    for (const term of uniqueTerms) {
      const results = await searchByTerm(term);
      allResults.push(...results);

      if (allResults.length >= limit) break;
    }

    const seen = new Set();
    const rows = allResults
      .filter(matchesAllWords)
      .filter((item) => {
        const key = [
          item.type,
          item.hotelId,
          item.cityRegionId,
          item.code,
          item.name,
        ].filter(Boolean).join('|');

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);

    suggestionCache.set(cacheKey, { at: Date.now(), rows });
    return rows;
  })();

  if (!options.signal) {
    inFlightSuggestions.set(cacheKey, request);
    request.finally(() => inFlightSuggestions.delete(cacheKey));
  }

  return request;
}
