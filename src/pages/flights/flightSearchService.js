import api from '../../api';

const CABIN_CLASS_VALUES = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];

function normalizeAirportCode(input) {
  const raw = typeof input === 'string' ? input : String(input?.code || '').trim();
  if (!raw) return '';
  return raw.toUpperCase();
}

function asDate(value) {
  if (!value) return '';
  return String(value).trim();
}

function getTodayLocalDate() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toApiRoute({ from, to, date }) {
  return {
    fromCityOrAirport: { code: from },
    toCityOrAirport: { code: to },
    travelDate: date,
  };
}

function hasValue(value) {
  return Boolean(String(value || '').trim());
}

function isValidISODate(value) {
  const v = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(v);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
}

function isDateInPast(value) {
  return value < getTodayLocalDate();
}

function validateAndNormalizeRoute({ from, to, date }, allowMissingDate = false) {
  const normalized = {
    from: normalizeAirportCode(from),
    to: normalizeAirportCode(to),
    date: asDate(date),
  };

  const errors = [];
  if (!hasValue(normalized.from)) errors.push('FROM airport is required.');
  if (!hasValue(normalized.to)) errors.push('TO airport is required.');
  if (normalized.from && normalized.to && normalized.from === normalized.to) {
    errors.push('From and to airport cannot be the same.');
  }

  if (!allowMissingDate) {
    if (!isValidISODate(normalized.date)) errors.push('Travel date is required.');
    else if (isDateInPast(normalized.date)) errors.push('Travel date cannot be in the past.');
  }

  return { normalized, errors };
}

export const VALID_CABIN_CLASSES = CABIN_CLASS_VALUES;

export function buildFlightSearchPayload(formState) {
  const {
    tripType = 'O',
    from,
    to,
    departDate,
    returnDate,
    legs = [],
    pax,
    cabin,
    directOnly = false,
  } = formState || {};

  const validationErrors = [];

  const adultCount = Number(pax?.adults ?? 0);
  const childCount = Number(pax?.children ?? 0);
  const infantCount = Number(pax?.infants ?? 0);

  if (!Number.isInteger(adultCount) || adultCount < 1 || adultCount > 9) {
    validationErrors.push('At least one adult (1-9) is required.');
  }
  if (!Number.isInteger(childCount) || childCount < 0 || childCount > 9) {
    validationErrors.push('Children count must be between 0 and 9.');
  }
  if (!Number.isInteger(infantCount) || infantCount < 0 || infantCount > 9) {
    validationErrors.push('Infants count must be between 0 and 9.');
  }
  if (infantCount > adultCount) {
    validationErrors.push('Infants cannot exceed adults.');
  }

  const normalizedCabin = hasValue(cabin) ? String(cabin).toUpperCase() : '';
  if (!CABIN_CLASS_VALUES.includes(normalizedCabin)) {
    validationErrors.push('Please select a valid cabin class.');
  }

  const routeInfos = [];

  if (tripType === 'M') {
    const primary = validateAndNormalizeRoute({ from, to, date: departDate });
    validationErrors.push(...primary.errors);

    if (primary.normalized.date && isDateInPast(primary.normalized.date)) {
      validationErrors.push('Travel date cannot be in the past.');
    }

    if (primary.normalized.from && primary.normalized.to && isValidISODate(primary.normalized.date)) {
      routeInfos.push(
        toApiRoute({
          from: primary.normalized.from,
          to: primary.normalized.to,
          date: primary.normalized.date,
        }),
      );
    }

    (legs || []).forEach((leg, idx) => {
      const validated = validateAndNormalizeRoute(leg, false);
      if (validated.errors.length) {
        validationErrors.push(`Leg ${idx + 1}: ${validated.errors[0]}`);
        return;
      }

      if (
        !validated.normalized.from ||
        !validated.normalized.to ||
        !isValidISODate(validated.normalized.date)
      ) {
        validationErrors.push(`Leg ${idx + 1}: complete from, to, and date are required.`);
        return;
      }

      if (isDateInPast(validated.normalized.date)) {
        validationErrors.push(`Leg ${idx + 1}: travel date cannot be in the past.`);
      }

      routeInfos.push(
        toApiRoute({
          from: validated.normalized.from,
          to: validated.normalized.to,
          date: validated.normalized.date,
        }),
      );
    });
  } else if (tripType === 'R') {
    const primary = validateAndNormalizeRoute({ from, to, date: departDate });
    const returnRoute = validateAndNormalizeRoute({ from: to, to: from, date: returnDate }, true);
    validationErrors.push(...primary.errors);
    validationErrors.push(...returnRoute.errors);

    if (!hasValue(returnDate)) {
      validationErrors.push('Return date is required for Round Trip.');
    } else if (!isValidISODate(returnDate)) {
      validationErrors.push('Return date is invalid.');
    } else if (isDateInPast(returnDate)) {
      validationErrors.push('Return date cannot be in the past.');
    } else if (departDate && returnDate < departDate) {
      validationErrors.push('Return date cannot be before departure date.');
    }

    if (isValidISODate(primary.normalized.date)) {
      routeInfos.push(toApiRoute({
        from: primary.normalized.from,
        to: primary.normalized.to,
        date: primary.normalized.date,
      }));
    }
    if (isValidISODate(returnRoute.normalized.date) && hasValue(returnRoute.normalized.from) && hasValue(returnRoute.normalized.to)) {
      routeInfos.push(toApiRoute({
        from: returnRoute.normalized.from,
        to: returnRoute.normalized.to,
        date: returnRoute.normalized.date,
      }));
    }
  } else {
    const primary = validateAndNormalizeRoute({ from, to, date: departDate });
    validationErrors.push(...primary.errors);
    if (isValidISODate(primary.normalized.date) && primary.normalized.from && primary.normalized.to) {
      routeInfos.push(toApiRoute(primary.normalized));
    }
  }

  const normalizedRouteInfos = routeInfos.filter(
    ({ fromCityOrAirport, toCityOrAirport, travelDate }) => Boolean(
      fromCityOrAirport?.code && toCityOrAirport?.code && travelDate,
    ),
  );

  if (tripType === 'R' && normalizedRouteInfos.length < 2) {
    validationErrors.push('Round Trip requires departure and return route details.');
  }

  if (!normalizedRouteInfos.length) {
    validationErrors.push('At least one complete route segment is required.');
  }

  const uniqueErrors = [...new Set(validationErrors)].filter(Boolean);

  return {
    payload: {
      searchQuery: {
        cabinClass: normalizedCabin || CABIN_CLASS_VALUES[0],
        paxInfo: {
          ADULT: adultCount,
          CHILD: childCount,
          INFANT: infantCount,
        },
        routeInfos: normalizedRouteInfos,
        searchModifiers: {
          isDirectFlight: Boolean(directOnly),
          isConnectingFlight: !Boolean(directOnly),
        },
      },
    },
    validationErrors: uniqueErrors,
  };
}

export async function searchFlights(payload) {
  const res = await api.post('/v1/search', payload);
  return res.data;
}

export function deriveSearchErrorMessage(error) {
  const status = error?.response?.status;
  const body = error?.response?.data || {};

  if (status === 401 || status === 403) {
    return 'Your session expired. Please sign in again to continue.';
  }

  if (status === 404) {
    return 'Search service unavailable. Please try again later.';
  }

  if (status === 400 || status === 422) {
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
    if (typeof body.error_code === 'string' && body.error_code === 'VALIDATION_ERROR') return 'Please correct your search details.';
    return body?.detail?.message || 'Search payload is invalid. Please check your inputs.';
  }

  if (body?.error_code || body?.message) {
    return `${body.error_code ? `${body.error_code}: ` : ''}${String(body.message)}`;
  }

  if (status >= 500) {
    return 'Flight search failed due to a server error. Please try again.';
  }

  if (error?.message === 'Network Error') {
    return 'Network error. Please check your connection.';
  }

  return 'Search failed. Please try again.';
}
