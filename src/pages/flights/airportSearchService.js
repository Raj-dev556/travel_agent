import api from '../../api';

export async function searchAirports(query, { signal, limit = 10 } = {}) {
  const trimmedQuery = String(query || '').trim();
  if (trimmedQuery.length < 2) return [];

  const res = await api.get('/v1/flights/airports', {
    params: { query: trimmedQuery, limit },
    signal,
  });

  return Array.isArray(res.data?.results) ? res.data.results : [];
}

export function deriveAirportSearchErrorMessage(error) {
  const status = error?.response?.status;
  if (status === 400 || status === 422) return 'Enter at least 2 characters to search.';
  if (status === 404) return 'Airport search service is unavailable.';
  if (status >= 500) return 'Airport search failed. Please try again.';
  return 'Unable to load airports right now.';
}
