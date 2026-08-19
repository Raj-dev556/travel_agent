import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Briefcase,
  PlaneTakeoff,
  PlaneLanding,
  Mic,
  X,
  RefreshCw,
  SlidersHorizontal,
  Share2,
  MessageCircle,
  Mail,
  Eye,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Zap,
} from 'lucide-react';
import api from '../../api';
import {
  TripTab,
  AirportField,
  DateField,
  PaxField,
  AirlineSelector,
  FARE_TYPES,
} from './FlightSearch';

const SORT_OPTIONS = [
  { key: 'cheapest', label: 'Price' },
  { key: 'earliest', label: 'Departure' },
  { key: 'arrival', label: 'Arrival' },
  { key: 'fastest', label: 'Duration' },
];

const TIME_BUCKETS = [
  { id: '00-06', label: '00-06', start: 0, end: 6 },
  { id: '06-12', label: '06-12', start: 6, end: 12 },
  { id: '12-18', label: '12-18', start: 12, end: 18 },
  { id: '18-24', label: '18-24', start: 18, end: 24 },
];

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

const fmtClock = (iso) => {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });
};

const fmtDateBar = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return { dow: '--', short: '--' };
  return {
    dow: date.toLocaleDateString('en-IN', { weekday: 'short' }),
    short: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
  };
};

function addDays(baseIso, days) {
  const base = baseIso ? new Date(baseIso) : new Date();
  if (Number.isNaN(base.getTime())) return new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

const fmtDuration = (mins) => {
  const safe = Math.max(0, Number(mins || 0));
  return `${Math.floor(safe / 60)}h ${safe % 60}m`;
};

const dayOffsetLabel = (depIso, arrIso) => {
  if (!depIso || !arrIso) return '';
  const dep = new Date(depIso);
  const arr = new Date(arrIso);
  const depMidnight = new Date(dep.getFullYear(), dep.getMonth(), dep.getDate());
  const arrMidnight = new Date(arr.getFullYear(), arr.getMonth(), arr.getDate());
  const diff = Math.round((arrMidnight - depMidnight) / 86400000);
  return diff > 0 ? `Flight Arrives after ${diff} Day(s)` : '';
};

function hourOf(iso) {
  if (!iso) return 0;
  return new Date(iso).getHours();
}

function inSelectedBucket(hour, selectedBuckets) {
  if (!selectedBuckets.size) return true;
  return TIME_BUCKETS.some((b) => selectedBuckets.has(b.id) && hour >= b.start && hour < b.end);
}

function getStopsBucket(stops) {
  const s = Number(stops || 0);
  if (s <= 0) return '0';
  if (s === 1) return '1';
  if (s === 2) return '2';
  return '3+';
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseWeightKg(value) {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function firstSegment(flight) {
  return flight?.segments?.[0] || {};
}

function lastSegment(flight) {
  const segs = flight?.segments || [];
  return segs[segs.length - 1] || segs[0] || {};
}

function matchesRouteEndpoints(flight, targetFrom, targetTo) {
  const first = firstSegment(flight);
  const last = lastSegment(flight);
  const fromCode = normalizeAirportInput(first.from);
  const toCode = normalizeAirportInput(last.to);
  return (!targetFrom || fromCode === targetFrom) && (!targetTo || toCode === targetTo);
}

function totalDurationMinutes(flight) {
  const first = firstSegment(flight);
  const last = lastSegment(flight);
  const dep = new Date(first.departureTime || 0).getTime();
  const arr = new Date(last.arrivalTime || 0).getTime();

  if (Number.isNaN(dep) || Number.isNaN(arr) || arr <= dep) {
    return Number(first.durationMinutes || 0);
  }
  return Math.round((arr - dep) / 60000);
}

function layoverDurationMinutes(flight) {
  const journey = totalDurationMinutes(flight);
  const flying = (flight?.segments || []).reduce((sum, seg) => sum + Number(seg.durationMinutes || 0), 0);
  return Math.max(0, journey - flying);
}

function layoverAirportCodes(flight) {
  const segs = flight?.segments || [];
  if (segs.length <= 1) return [];
  return segs.slice(0, -1).map((seg) => seg.to).filter(Boolean);
}

function sortFlights(list, sortBy) {
  return [...list].sort((a, b) => {
    const sa = a.segments?.[0] || {};
    const sb = b.segments?.[0] || {};

    if (sortBy === 'fastest') return Number(sa.durationMinutes || 0) - Number(sb.durationMinutes || 0);
    if (sortBy === 'earliest') return new Date(sa.departureTime || 0) - new Date(sb.departureTime || 0);
    if (sortBy === 'arrival') return new Date(sa.arrivalTime || 0) - new Date(sb.arrivalTime || 0);
    return Number(a.totalPriceINR || 0) - Number(b.totalPriceINR || 0);
  });
}

function toggleSet(prev, key) {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function badgeClass(airline) {
  if ((airline || '').toLowerCase().includes('air india')) return 'bg-red-700 text-white';
  if ((airline || '').toLowerCase().includes('indigo')) return 'bg-blue-900 text-white';
  if ((airline || '').toLowerCase().includes('spice')) return 'bg-red-500 text-white';
  if ((airline || '').toLowerCase().includes('akasa')) return 'bg-purple-700 text-white';
  return 'bg-orange-500 text-white';
}

function buildFareOptions(flight) {
  const liveOptions = Array.isArray(flight?.fareOptions) ? flight.fareOptions : [];
  const normalize = (fare, index) => ({
    ...fare,
    id: fare.id || fare.priceId || `${flight.id || 'fare'}-${index}`,
    priceId: fare.priceId || fare.id || flight.priceId,
    name: fare.name || fare.fareIdentifier || flight.fareIdentifier || 'Published',
    amount: Number(fare.amount ?? fare.totalPriceINR ?? flight.totalPriceINR ?? 0),
  });
  if (liveOptions.length) return liveOptions.map(normalize);
  if (!flight) return [];
  return [normalize({ id: flight.priceId || flight.id, amount: flight.totalPriceINR, name: flight.fareIdentifier }, 0)];
}

function normalizeTripType(value) {
  return ({ O: 'ONEWAY', R: 'ROUNDTRIP', M: 'MULTICITY' }[String(value || 'O').toUpperCase()] || value || 'ONEWAY');
}

function normalizeFareType(value) {
  return ({ regular: 'REGULAR', student: 'STUDENT', senior: 'SENIOR_CITIZEN', senior_citizen: 'SENIOR_CITIZEN', soto: 'SOTO', ndc: 'NDC' }[String(value || 'regular').toLowerCase()] || String(value || 'REGULAR').toUpperCase());
}

function buildRouteInfo(from, to, travelDate) {
  return { fromCityOrAirport: { code: normalizeAirportInput(from) }, toCityOrAirport: { code: normalizeAirportInput(to) }, travelDate };
}

function buildFlightSearchPayload(query) {
  const tripType = normalizeTripType(query.tripType);
  const directOnly = Boolean(query.directOnly);
  const routeInfos = tripType === 'MULTICITY'
    ? (query.legs || []).map((leg) => buildRouteInfo(leg.from, leg.to, leg.date)).filter((r) => r.fromCityOrAirport.code && r.toCityOrAirport.code && r.travelDate)
    : [buildRouteInfo(query.from, query.to, query.departDate), ...(tripType === 'ROUNDTRIP' && query.returnDate ? [buildRouteInfo(query.to, query.from, query.returnDate)] : [])];
  return {
    searchQuery: {
      cabinClass: query.cabinClass || 'ECONOMY',
      paxInfo: { ADULT: Number(query.adults || 1), CHILD: Number(query.children || 0), INFANT: Number(query.infants || 0) },
      routeInfos,
      searchModifiers: {
        isDirectFlight: directOnly,
        isConnectingFlight: !directOnly,
      },
    },
  };
}

function addMinutes(iso, minutes) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  date.setMinutes(date.getMinutes() + Number(minutes || 0));
  return date.toISOString();
}

function normalizeV1SearchResponse(data, query) {
  const options = Array.isArray(data?.options) ? data.options : [];
  // determine route info per option: prefer annotated __route on option, else fall back to first route in query
  const firstRoute = query.searchQuery?.routeInfos?.[0] || {};
  const defaultFrom = firstRoute.fromCityOrAirport?.code || '';
  const defaultTo = firstRoute.toCityOrAirport?.code || '';
  const defaultTravelDate = firstRoute.travelDate || new Date().toISOString().slice(0, 10);

  const results = options.map((option, index) => {
    const stops = Number(option.stops || 0);
    const durationMinutes = 120 + stops * 75;
    const optRoute = option.__route || {};
    const from = optRoute.from || defaultFrom;
    const to = optRoute.to || defaultTo;
    const travelDate = optRoute.travelDate || defaultTravelDate;
    const departureTime = `${travelDate}T08:${String((index * 7) % 60).padStart(2, '0')}:00`;
    const totalPriceINR = Number(option.total_fare || option.totalFare || 0);
    const id = String(option.result_index || option.resultIndex || `flight-${index}`);

    return {
      id,
      priceId: id,
      totalPriceINR,
      refundable: Boolean(option.is_refundable ?? option.isRefundable),
      fareIdentifier: 'Published',
      fareOptions: [
        {
          id,
          priceId: id,
          name: 'Published',
          amount: totalPriceINR,
        },
      ],
      segments: [
        {
          from,
          to,
          fromCity: from,
          toCity: to,
          airline: option.airline || 'Airline',
          airlineCode: option.airline || '',
          flightNumber: option.flight_number || option.flightNumber || '',
          cabinClass: option.cabin_class || option.cabinClass || query.searchQuery?.cabinClass || 'ECONOMY',
          departureTime,
          arrivalTime: addMinutes(departureTime, durationMinutes),
          durationMinutes,
          checkInBaggage: '15kg',
          cabinBaggage: '7kg',
        },
      ],
    };
  });

  if (options.length) {
    return {
      searchId: data?.search_id || data?.searchId || '',
      results,
      returnResults: [],
      pagination: { page: 1, limit: results.length || 20, totalPages: 1 },
    };
  }

  const tripInfos = data?.searchResult?.tripInfos || data?.searchResult || {};
  const indexedTripBuckets = Object.entries(tripInfos)
    .filter(([key, value]) => /^\d+$/.test(String(key)) && Array.isArray(value))
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  const onwardTrips = Array.isArray(tripInfos?.ONWARD)
    ? tripInfos.ONWARD
    : (
      Array.isArray(tripInfos?.onward)
        ? tripInfos.onward
        : indexedTripBuckets.flatMap(([routeKey, trips]) =>
          trips.map((itinerary) => ({ ...itinerary, __routeKey: routeKey })),
        )
    );

  const returnTrips = Array.isArray(tripInfos?.RETURN)
    ? tripInfos.RETURN
    : (Array.isArray(tripInfos?.return) ? tripInfos.return : []);

  function normalizeFarePrice(fare = {}) {
    const adultFare = fare?.fd?.ADULT || fare?.adultFare || {};
    const fareCost = adultFare?.fC || {};
    return Number(
      fareCost?.NF ??
      fareCost?.TF ??
      fareCost?.totalFare ??
      adultFare?.totalFare ??
      0,
    );
  }

  function normalizeTripOption(itinerary = {}, directionIndex = 0, fareIndex = 0, fare = {}, defaultAirlineCode = '') {
    const segments = Array.isArray(itinerary.sI) ? itinerary.sI : [];
    const seg = segments[0] || {};
    const from = seg.da?.code || defaultFrom;
    const to = seg.aa?.code || defaultTo;
    const departureTime = seg.dt || '';
    const arrivalTime = seg.at || '';
    const stopCount = segments.length > 1 ? segments.length - 1 : Number(seg?.sN || 0);
    const totalDuration = Number(seg?.duration || 0)
      + segments.slice(1).reduce((sum, s) => sum + Number(s.duration || 0), 0);
    const durationMinutes = totalDuration || Number(seg?.cT || 0) || 120;
    const routeKey = itinerary?.__routeKey ?? directionIndex;
    const fareId = fare?.id || fare?.priceId || `${routeKey}-${directionIndex}-${fareIndex}`;
    const baggage = fare?.fd?.ADULT?.bI || {};

    const normalizedSegments = segments.map((segment) => ({
      from: segment?.da?.code || '',
      to: segment?.aa?.code || '',
      fromCity: segment?.da?.city || segment?.da?.code || '',
      toCity: segment?.aa?.city || segment?.aa?.code || '',
      airline: segment?.fD?.aI?.name || segment?.fD?.aI?.code || defaultAirlineCode || 'Airline',
      airlineCode: segment?.fD?.aI?.code || defaultAirlineCode || '',
      flightNumber: segment?.fD?.fN || '',
      cabinClass: fare?.fd?.ADULT?.cc || query.searchQuery?.cabinClass || 'ECONOMY',
      departureTime: segment?.dt || '',
      arrivalTime: segment?.at || '',
      durationMinutes: Number(segment?.duration || 0),
      checkInBaggage: baggage.iB || '15 Kg',
      cabinBaggage: baggage.cB || '7 Kg',
      stops: Number(segment?.stops || 0),
    }));

    return {
      id: String(fareId),
      priceId: String(fareId),
      routeKey: String(routeKey),
      totalPriceINR: normalizeFarePrice(fare),
      refundable: Boolean(fare?.fd?.ADULT?.rT === 1 || fare?.fd?.ADULT?.isRefundable),
      fareIdentifier: fare?.fareIdentifier || 'Published',
      fareOptions: [
        {
          id: String(fareId),
          priceId: String(fareId),
          name: fare?.fareIdentifier || 'Published',
          amount: normalizeFarePrice(fare),
        },
      ],
      segments: normalizedSegments.length ? normalizedSegments : [
        {
          from,
          to,
          fromCity: from,
          toCity: to,
          airline: defaultAirlineCode || seg?.fD?.aI?.name || 'Airline',
          airlineCode: defaultAirlineCode || seg?.fD?.aI?.code || '',
          flightNumber: seg?.fD?.fN || '',
          cabinClass: fare?.fd?.ADULT?.cc || query.searchQuery?.cabinClass || 'ECONOMY',
          departureTime,
          arrivalTime,
          durationMinutes,
          checkInBaggage: baggage.iB || '15 Kg',
          cabinBaggage: baggage.cB || '7 Kg',
          stops: stopCount,
        },
      ],
    };
  }

  function normalizeTripResults(trips = []) {
    const list = [];
    (trips || []).forEach((itinerary, itineraryIndex) => {
      const fares = Array.isArray(itinerary?.totalPriceList) && itinerary.totalPriceList.length > 0
        ? itinerary.totalPriceList
        : [{ id: `${itineraryIndex}-fallback` }];
      fares.forEach((fare, fareIndex) => {
        list.push(
          normalizeTripOption(
            itinerary,
            itineraryIndex,
            fareIndex,
            fare,
            itinerary?.sI?.[0]?.fD?.aI?.code || '',
          ),
        );
      });
    });
    return list;
  }

  const mappedResults = normalizeTripResults(onwardTrips);
  const mappedReturn = normalizeTripResults(returnTrips);

  return {
    searchId: data?.['x-search-id'] || data?.search_id || data?.searchId || '',
    results: mappedResults,
    returnResults: mappedReturn,
    pagination: { page: 1, limit: mappedResults.length || 20, totalPages: 1 },
  };
}
function mergeFlights(existing, incoming) {
  const map = new Map();
  [...(existing || []), ...(incoming || [])].forEach((flight) => {
    const key = flight?.id || flight?.priceId;
    if (key) map.set(key, flight);
  });
  return [...map.values()];
}
function normalizeAirportInput(value) {
  if (value && typeof value === 'object' && value.code) return String(value.code).toUpperCase();
  const raw = String(value || '').trim();
  if (!raw) return '';

  const inBrackets = raw.match(/\(([A-Za-z]{3})\)/);
  if (inBrackets) return inBrackets[1].toUpperCase();

  const firstToken = raw.split(/\s+/)[0];
  if (firstToken.length === 3) return firstToken.toUpperCase();
  return raw.toUpperCase();
}

function resolveAirport(value, fallbackCode) {
  const code = normalizeAirportInput(value || fallbackCode);
  return {
    code,
    city: code,
    name: code,
    country: '',
  };
}

function initModifyForm(query, params) {
  const today = new Date().toISOString().slice(0, 10);
  let legs = [{ from: resolveAirport(query.from, 'PNQ'), to: resolveAirport(query.to, 'BLR'), date: query.departDate || today }];

  if ((query.tripType || 'O') === 'M') {
    try {
      const raw = JSON.parse(params.get('legs') || '[]');
      if (Array.isArray(raw) && raw.length) {
        legs = raw.map((leg) => ({
          from: resolveAirport(leg.from, query.from || 'PNQ'),
          to: resolveAirport(leg.to, query.to || 'BLR'),
          date: leg.date || today,
        }));
      }
    } catch (_) {
      // fall back to single default leg
    }
  }

  return {
    tripType: query.tripType || 'O',
    from: resolveAirport(query.from, 'PNQ'),
    to: resolveAirport(query.to, 'BLR'),
    departDate: query.departDate || today,
    returnDate: query.returnDate || '',
    legs,
    adults: Math.max(1, Number(query.adults || 1)),
    children: Math.max(0, Number(query.children || 0)),
    infants: Math.max(0, Number(query.infants || 0)),
    cabinClass: query.cabinClass || 'ECONOMY',
    directOnly: !!query.directOnly,
    CreditShell: !!query.creditShell,
    airline: params.get('airline') || 'Any airline',
    fareType: params.get('fareType') || 'regular',
    creditShell: params.get('creditShell') === '1',
  };
}

export default function FlightResults() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const paramsKey = params.toString();
  const query = useMemo(
    () => {
      let legs = [];
      try {
        const raw = JSON.parse(params.get('legs') || '[]');
        if (Array.isArray(raw)) {
          legs = raw
            .map((leg) => ({
              from: normalizeAirportInput(leg?.from),
              to: normalizeAirportInput(leg?.to),
              date: leg?.date,
            }))
            .filter((leg) => leg.from && leg.to && leg.date);
        }
      } catch (_) {
        legs = [];
      }

      return {
        tripType: params.get('tripType') || 'O',
        from: params.get('from') || 'PNQ',
        to: params.get('to') || 'BLR',
        departDate: params.get('departDate'),
        returnDate: params.get('returnDate'),
        adults: Number(params.get('adults') || 1),
        children: Number(params.get('children') || 0),
        infants: Number(params.get('infants') || 0),
        cabinClass: params.get('cabinClass') || 'ECONOMY',
        directOnly: params.get('directOnly') === '1',
        CreditShell: params.get('creditShell') === '1',
        creditShell: params.get('creditShell') === '1',
        airline: params.get('airline') || '',
        fareType: params.get('fareType') || 'regular',
        legs,
      };
    },
    [paramsKey],
  );

  const [showModifyPanel, setShowModifyPanel] = useState(false);
  const [modify, setModify] = useState(() => initModifyForm(query, params));
  const [modifyPaxOpen, setModifyPaxOpen] = useState(false);

  useEffect(() => {
    if (!showModifyPanel) return;
    setModify(initModifyForm(query, params));
  }, [showModifyPanel, query, paramsKey]);

  const isRoundTrip = query.tripType === 'R';
  const isMultiCity = query.tripType === 'M';
  const multiLegs = useMemo(() => {
    if (isMultiCity && query.legs?.length) return query.legs;
    return [{ from: query.from, to: query.to, date: query.departDate }];
  }, [isMultiCity, query.legs, query.from, query.to, query.departDate]);
  const [activeMultiLegIdx, setActiveMultiLegIdx] = useState(0);

  useEffect(() => {
    setActiveMultiLegIdx(0);
  }, [isMultiCity, multiLegs.length]);

  const baseFlightSearchPayload = useMemo(() => buildFlightSearchPayload(query), [query]);
  const [searchPage, setSearchPage] = useState(1);
  const [loadedSearch, setLoadedSearch] = useState({ results: [], returnResults: [], pagination: null });

  const location = useLocation();
  const initialResponse = location.state?.searchResponse || null;
  const initialSearchKey = location.state?.searchKey || null;
  const shouldUseInitialResponse = Boolean(initialResponse && initialSearchKey && params.toString() === initialSearchKey);

  useEffect(() => {
    setSearchPage(1);
    setLoadedSearch({ results: [], returnResults: [], pagination: null });
  }, [baseFlightSearchPayload]);

  const flightSearchPayload = useMemo(() => ({
    ...baseFlightSearchPayload,
  }), [baseFlightSearchPayload, searchPage]);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['flight-search-results-grid', flightSearchPayload],
    queryFn: () => api.post('/v1/search', flightSearchPayload).then((r) => normalizeV1SearchResponse(r.data, flightSearchPayload)),
    retry: false,
    keepPreviousData: true,
    enabled: !shouldUseInitialResponse,
  });

  useEffect(() => {
    if (!data) return;
    setLoadedSearch((prev) => {
      const isFirstPage = Number(data.pagination?.page || searchPage) <= 1;
      const base = isFirstPage ? { results: [], returnResults: [] } : prev;
      return {
        results: mergeFlights(base.results, data.results),
        returnResults: mergeFlights(base.returnResults, data.returnResults),
        pagination: data.pagination || prev.pagination,
      };
    });
  }, [data, searchPage]);

  // If navigated with a pre-fetched response, use it once to populate results
  useEffect(() => {
    if (!shouldUseInitialResponse || !initialResponse) return;
    try {
      const normalized = normalizeV1SearchResponse(initialResponse, flightSearchPayload);
      setLoadedSearch({ results: normalized.results, returnResults: normalized.returnResults, pagination: normalized.pagination });
    } catch (_) {
      // ignore
    }
    // clear location state so back/refresh won't reuse it unintentionally
    if (location.state && location.state.searchResponse) {
      window.history.replaceState({}, document.title);
    }
  }, [initialResponse]);


  const onwardSource = useMemo(() => loadedSearch.results || [], [loadedSearch.results]);
  const returnSource = useMemo(() => loadedSearch.returnResults || [], [loadedSearch.returnResults]);
  const hasMorePages = Boolean(loadedSearch.pagination && loadedSearch.pagination.page < loadedSearch.pagination.totalPages);
  const initialLoading = isLoading && !onwardSource.length && !returnSource.length;
  const isLoadingNextPage = isFetching && !initialLoading;
  const loadNextPage = useCallback(() => {
    if (!hasMorePages || isFetching) return;
    setSearchPage((page) => page + 1);
  }, [hasMorePages, isFetching]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      if (doc.scrollHeight - (window.innerHeight + window.scrollY) < 700) loadNextPage();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadNextPage]);



  const [sortBy, setSortBy] = useState('cheapest');
  const [selectedStops, setSelectedStops] = useState(new Set());
  const [selectedAirlines, setSelectedAirlines] = useState(new Set());
  const [refundableOnly, setRefundableOnly] = useState(false);
  const [onwardDepartBuckets, setOnwardDepartBuckets] = useState(new Set());
  const [onwardArrivalBuckets, setOnwardArrivalBuckets] = useState(new Set());
  const [returnDepartBuckets, setReturnDepartBuckets] = useState(new Set());
  const [returnArrivalBuckets, setReturnArrivalBuckets] = useState(new Set());
  const [showIncvOnly, setShowIncvOnly] = useState(false);
  const [showNetOnly, setShowNetOnly] = useState(false);
  const [showCheckInBaggage, setShowCheckInBaggage] = useState(false);
  const [showHandBaggageOnly, setShowHandBaggageOnly] = useState(false);
  const [selectedFareIdentifiers, setSelectedFareIdentifiers] = useState(new Set());
  const [fareIdentifierExpanded, setFareIdentifierExpanded] = useState(false);
  const [flightNumberQuery, setFlightNumberQuery] = useState('');
  const [airlineSearch, setAirlineSearch] = useState('');
  const [selectedDepartureTerminals, setSelectedDepartureTerminals] = useState(new Set());
  const [selectedArrivalTerminals, setSelectedArrivalTerminals] = useState(new Set());
  const [selectedDepartureAirports, setSelectedDepartureAirports] = useState(new Set());
  const [selectedArrivalAirports, setSelectedArrivalAirports] = useState(new Set());
  const [selectedLayoverAirports, setSelectedLayoverAirports] = useState(new Set());

  const oneWayFilterSource = useMemo(() => {
    if (!isMultiCity) return onwardSource;
    const active = multiLegs[Math.min(activeMultiLegIdx, Math.max(0, multiLegs.length - 1))] || {};
    const targetFrom = normalizeAirportInput(active.from);
    const targetTo = normalizeAirportInput(active.to);
    return onwardSource.filter((f) => matchesRouteEndpoints(f, targetFrom, targetTo));
  }, [onwardSource, isMultiCity, multiLegs, activeMultiLegIdx]);

  const globalFilterSource = useMemo(
    () => (isRoundTrip ? [...onwardSource, ...returnSource] : oneWayFilterSource),
    [isRoundTrip, onwardSource, returnSource, oneWayFilterSource],
  );

  const allAirlines = useMemo(() => {
    const names = globalFilterSource.map((x) => x.segments?.[0]?.airline).filter(Boolean);
    return [...new Set(names)].sort();
  }, [globalFilterSource]);

  const fareIdentifierStats = useMemo(() => {
    const counts = new Map();
    for (const flight of oneWayFilterSource) {
      const name = flight.fareIdentifier || 'Published';
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [oneWayFilterSource]);

  const airlineStats = useMemo(() => {
    const map = new Map();
    for (const flight of oneWayFilterSource) {
      const seg = firstSegment(flight);
      const name = seg.airline || 'Unknown';
      const row = map.get(name) || { name, count: 0, minPrice: Infinity };
      row.count += 1;
      row.minPrice = Math.min(row.minPrice, Number(flight.totalPriceINR || 0));
      map.set(name, row);
    }

    return [...map.values()]
      .map((item) => ({ ...item, minPrice: Number.isFinite(item.minPrice) ? item.minPrice : 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [oneWayFilterSource]);

  const filteredAirlineStats = useMemo(() => {
    const q = airlineSearch.trim().toLowerCase();
    if (!q) return airlineStats;
    return airlineStats.filter((item) => item.name.toLowerCase().includes(q));
  }, [airlineStats, airlineSearch]);

  const terminalOptions = useMemo(() => {
    const departure = new Map();
    const arrival = new Map();
    for (const flight of oneWayFilterSource) {
      const first = firstSegment(flight);
      const last = lastSegment(flight);
      if (first.fromTerminal) departure.set(first.fromTerminal, (departure.get(first.fromTerminal) || 0) + 1);
      if (last.toTerminal) arrival.set(last.toTerminal, (arrival.get(last.toTerminal) || 0) + 1);
    }
    return {
      departure: [...departure.entries()].map(([name, count]) => ({ name, count })),
      arrival: [...arrival.entries()].map(([name, count]) => ({ name, count })),
    };
  }, [oneWayFilterSource]);

  const airportOptions = useMemo(() => {
    const departure = new Map();
    const arrival = new Map();
    for (const flight of oneWayFilterSource) {
      const first = firstSegment(flight);
      const last = lastSegment(flight);

      if (first.from) {
        departure.set(first.from, {
          code: first.from,
          name: first.fromCity ? `${first.from} - ${first.fromCity}` : first.from,
          count: (departure.get(first.from)?.count || 0) + 1,
        });
      }

      if (last.to) {
        arrival.set(last.to, {
          code: last.to,
          name: last.toCity ? `${last.to} - ${last.toCity}` : last.to,
          count: (arrival.get(last.to)?.count || 0) + 1,
        });
      }
    }

    return {
      departure: [...departure.values()].sort((a, b) => a.name.localeCompare(b.name)),
      arrival: [...arrival.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [oneWayFilterSource]);

  const layoverOptions = useMemo(() => {
    const map = new Map();
    for (const flight of oneWayFilterSource) {
      const segs = flight.segments || [];
      for (const seg of segs.slice(0, -1)) {
        if (!seg.to) continue;
        const row = map.get(seg.to) || {
          code: seg.to,
          name: seg.toCity ? `${seg.to} - ${seg.toCity}` : seg.to,
          count: 0,
        };
        row.count += 1;
        map.set(seg.to, row);
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [oneWayFilterSource]);

  const bounds = useMemo(() => {
    const prices = globalFilterSource.map((x) => Number(x.totalPriceINR || 0));
    return {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 30000,
    };
  }, [globalFilterSource]);

  const durationBounds = useMemo(() => {
    const values = oneWayFilterSource.map((x) => totalDurationMinutes(x));
    return {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 1800,
    };
  }, [oneWayFilterSource]);

  const layoverBounds = useMemo(() => {
    const values = oneWayFilterSource.map((x) => layoverDurationMinutes(x));
    return {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 1440,
    };
  }, [oneWayFilterSource]);

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [draftMinPrice, setDraftMinPrice] = useState(0);
  const [draftMaxPrice, setDraftMaxPrice] = useState(0);
  const [maxDurationMinutes, setMaxDurationMinutes] = useState(0);
  const [maxLayoverMinutes, setMaxLayoverMinutes] = useState(0);

  useEffect(() => {
    setMinPrice(bounds.min);
    setMaxPrice(bounds.max);
    setDraftMinPrice(bounds.min);
    setDraftMaxPrice(bounds.max);
  }, [bounds.min, bounds.max]);

  useEffect(() => {
    setMaxDurationMinutes(durationBounds.max);
  }, [durationBounds.max]);

  useEffect(() => {
    setMaxLayoverMinutes(layoverBounds.max);
  }, [layoverBounds.max]);

  const applyPriceRange = () => {
    const rawMin = Number(draftMinPrice || bounds.min);
    const rawMax = Number(draftMaxPrice || bounds.max);
    const safeMin = Math.max(bounds.min, Math.min(rawMin, bounds.max));
    const safeMax = Math.min(bounds.max, Math.max(rawMax, safeMin));
    setMinPrice(safeMin);
    setMaxPrice(safeMax);
    setDraftMinPrice(safeMin);
    setDraftMaxPrice(safeMax);
  };

  const toggleAirlineByName = (label) => {
    const lookup = allAirlines.find((name) => normalizeKey(name) === normalizeKey(label));
    const key = lookup || label;
    setSelectedAirlines((prev) => toggleSet(prev, key));
  };

  const updateModifyLeg = (idx, patch) => {
    setModify((prev) => ({
      ...prev,
      legs: (prev.legs || []).map((leg, legIdx) => (legIdx === idx ? { ...leg, ...patch } : leg)),
    }));
  };

  const addModifyLeg = () => {
    setModify((prev) => {
      const current = prev.legs || [];
      if (current.length >= 4) return prev;
      const last = current[current.length - 1] || { from: prev.from, to: prev.to, date: prev.departDate };
      return {
        ...prev,
        legs: [...current, { from: last.to, to: null, date: last.date || prev.departDate }],
      };
    });
  };

  const removeModifyLeg = (idx) => {
    setModify((prev) => {
      const current = prev.legs || [];
      if (current.length <= 1) return prev;
      return { ...prev, legs: current.filter((_, legIdx) => legIdx !== idx) };
    });
  };

  const runModifiedSearch = () => {
    const from = normalizeAirportInput(modify.from);
    const to = normalizeAirportInput(modify.to);
    if (!from || !to) return;

    const next = {
      tripType: modify.tripType,
      from,
      to,
      departDate: modify.departDate,
      adults: String(Math.max(1, Number(modify.adults || 1))),
      children: String(Math.max(0, Number(modify.children || 0))),
      infants: String(Math.max(0, Number(modify.infants || 0))),
      cabinClass: modify.cabinClass,
      directOnly: modify.directOnly ? '1' : '0',
      CreditShell: modify.creditShell ? '1' : '0',
      airline: modify.airline?.code || '',
      airlineName: modify.airline?.name || modify.airline || '',
      fareType: modify.fareType || 'regular',
      creditShell: modify.creditShell ? '1' : '0',
    };

    if (modify.tripType === 'R' && modify.returnDate) {
      next.returnDate = modify.returnDate;
    }

    if (modify.tripType === 'M') {
      const legs = (modify.legs || [])
        .map((leg) => ({
          from: normalizeAirportInput(leg.from),
          to: normalizeAirportInput(leg.to),
          date: leg.date,
        }))
        .filter((leg) => leg.from && leg.to && leg.date);

      if (!legs.length) return;
      next.from = legs[0].from;
      next.to = legs[0].to;
      next.departDate = legs[0].date;
      next.legs = JSON.stringify(legs);
      delete next.returnDate;
    }

    setParams(next);
    setShowModifyPanel(false);
  };

  const applyFilters = (list, kind) =>
    list.filter((f) => {
      const seg = firstSegment(f);
      const last = lastSegment(f);
      const depHour = hourOf(seg.departureTime);
      const arrHour = hourOf(last.arrivalTime || seg.arrivalTime);
      const airline = seg.airline || '';
      const fareIdentifier = (f.fareIdentifier || 'Published').toLowerCase();

      // Existing fare identifiers:
      const isPublished = fareIdentifier.includes('published');
      const isPromo = fareIdentifier.includes('promo');
      const isCorporate = fareIdentifier.includes('corporate');
      const isNdc = fareIdentifier.includes('ndc');
      const isSme = fareIdentifier.includes('sme');
      const numberNeedle = normalizeKey(flightNumberQuery);

      const depBuckets = kind === 'onward' ? onwardDepartBuckets : returnDepartBuckets;
      const arrBuckets = kind === 'onward' ? onwardArrivalBuckets : returnArrivalBuckets;
      const activeLeg = multiLegs[Math.min(activeMultiLegIdx, Math.max(0, multiLegs.length - 1))] || {};

      if (Number(f.totalPriceINR || 0) < minPrice || Number(f.totalPriceINR || 0) > maxPrice) return false;
      if (selectedStops.size && !selectedStops.has(getStopsBucket(seg.stops))) return false;
      if (selectedAirlines.size && !selectedAirlines.has(airline)) return false;
      if (selectedFareIdentifiers.size && !selectedFareIdentifiers.has(fareIdentifier)) return false;
      if (refundableOnly && !f.refundable) return false;
      if (showIncvOnly) {
        const incvFare = isPublished || isPromo;
        if (!incvFare) {// keep visible
        }
      }

      if (showNetOnly) {
        const netFare = isCorporate || isNdc || isSme;

        if (!netFare) {
          // keep visible
        }
      }
      if (showCheckInBaggage && parseWeightKg(seg.checkInBaggage) <= 0) return false;
      if (showHandBaggageOnly && parseWeightKg(seg.checkInBaggage) > 0) return false;
      if (numberNeedle && !normalizeKey(seg.flightNumber).includes(numberNeedle)) return false;
      if (!inSelectedBucket(depHour, depBuckets)) return false;
      if (!inSelectedBucket(arrHour, arrBuckets)) return false;

      if (isMultiCity && kind === 'onward') {
        const targetFrom = normalizeAirportInput(activeLeg.from);
        const targetTo = normalizeAirportInput(activeLeg.to);
        if (!matchesRouteEndpoints(f, targetFrom, targetTo)) return false;
      }

      if (!isRoundTrip) {
        if (selectedDepartureTerminals.size && !selectedDepartureTerminals.has(seg.fromTerminal)) return false;
        if (selectedArrivalTerminals.size && !selectedArrivalTerminals.has(last.toTerminal)) return false;
        if (selectedDepartureAirports.size && !selectedDepartureAirports.has(seg.from)) return false;
        if (selectedArrivalAirports.size && !selectedArrivalAirports.has(last.to)) return false;

        if (selectedLayoverAirports.size) {
          const layovers = layoverAirportCodes(f);
          if (!layovers.some((code) => selectedLayoverAirports.has(code))) return false;
        }

        if (totalDurationMinutes(f) > maxDurationMinutes) return false;
        if (layoverDurationMinutes(f) > maxLayoverMinutes) return false;
      }

      return true;
    });

  const filteredOnward = useMemo(() => sortFlights(applyFilters(onwardSource, 'onward'), sortBy), [
    onwardSource,
    sortBy,
    minPrice,
    maxPrice,
    selectedStops,
    selectedAirlines,
    selectedFareIdentifiers,
    refundableOnly,
    showIncvOnly,
    showNetOnly,
    showCheckInBaggage,
    showHandBaggageOnly,
    flightNumberQuery,
    onwardDepartBuckets,
    onwardArrivalBuckets,
    returnDepartBuckets,
    returnArrivalBuckets,
    selectedDepartureTerminals,
    selectedArrivalTerminals,
    selectedDepartureAirports,
    selectedArrivalAirports,
    selectedLayoverAirports,
    maxDurationMinutes,
    maxLayoverMinutes,
    isRoundTrip,
    isMultiCity,
    multiLegs,
    activeMultiLegIdx,
  ]);

  const filteredReturn = useMemo(() => sortFlights(applyFilters(returnSource, 'return'), sortBy), [
    returnSource,
    sortBy,
    minPrice,
    maxPrice,
    selectedStops,
    selectedAirlines,
    selectedFareIdentifiers,
    refundableOnly,
    showIncvOnly,
    showNetOnly,
    showCheckInBaggage,
    showHandBaggageOnly,
    flightNumberQuery,
    onwardDepartBuckets,
    onwardArrivalBuckets,
    returnDepartBuckets,
    returnArrivalBuckets,
    selectedDepartureTerminals,
    selectedArrivalTerminals,
    selectedDepartureAirports,
    selectedArrivalAirports,
    selectedLayoverAirports,
    maxDurationMinutes,
    maxLayoverMinutes,
    isRoundTrip,
    isMultiCity,
    multiLegs,
    activeMultiLegIdx,
  ]);

  const [selectedOnwardId, setSelectedOnwardId] = useState(null);
  const [selectedReturnId, setSelectedReturnId] = useState(null);
  const [selectedMultiLegFlights, setSelectedMultiLegFlights] = useState({});
  const [selectedOnwardFareId, setSelectedOnwardFareId] = useState(null);
  const [selectedReturnFareId, setSelectedReturnFareId] = useState(null);

  useEffect(() => {
    if (!filteredOnward.length) {
      setSelectedOnwardId(null);
      return;
    }
    if (!filteredOnward.some((x) => x.id === selectedOnwardId)) {
      const first = filteredOnward[0];
      setSelectedOnwardId(first.id);
      if (!selectedOnwardFareId) setSelectedOnwardFareId(buildFareOptions(first)[0]?.id || null);
    }
  }, [filteredOnward, selectedOnwardId, selectedOnwardFareId]);

  useEffect(() => {
    if (!isMultiCity || !filteredOnward.length) return;
    const fallback = filteredOnward[0];
    setSelectedMultiLegFlights((prev) => {
      const current = prev[activeMultiLegIdx];
      if (current && filteredOnward.some((f) => f.id === current.id)) return prev;
      return { ...prev, [activeMultiLegIdx]: fallback };
    });
  }, [isMultiCity, filteredOnward, activeMultiLegIdx]);

  useEffect(() => {
    if (!isRoundTrip) return;
    if (!filteredReturn.length) {
      setSelectedReturnId(null);
      return;
    }
    if (!filteredReturn.some((x) => x.id === selectedReturnId)) {
      const first = filteredReturn[0];
      setSelectedReturnId(first.id);
      if (!selectedReturnFareId) setSelectedReturnFareId(buildFareOptions(first)[0]?.id || null);
    }
  }, [filteredReturn, selectedReturnId, isRoundTrip, selectedReturnFareId]);

  const selectedOnward = isMultiCity
    ? selectedMultiLegFlights[activeMultiLegIdx] || null
    : filteredOnward.find((x) => x.id === selectedOnwardId) || null;
  const selectedReturn = filteredReturn.find((x) => x.id === selectedReturnId) || null;
  const selectedOnwardFares = selectedOnward ? buildFareOptions(selectedOnward) : [];
  const selectedReturnFares = selectedReturn ? buildFareOptions(selectedReturn) : [];
  const selectedOnwardFare = selectedOnwardFares.find((f) => f.id === selectedOnwardFareId) || null;
  const selectedReturnFare = selectedReturnFares.find((f) => f.id === selectedReturnFareId) || null;
  const [bookingFlightId, setBookingFlightId] = useState(null);
  const activeMultiLeg = multiLegs[Math.min(activeMultiLegIdx, Math.max(0, multiLegs.length - 1))] || {};
  const activeFrom = isMultiCity ? activeMultiLeg.from || query.from : query.from;
  const activeTo = isMultiCity ? activeMultiLeg.to || query.to : query.to;
  const activeDate = isMultiCity ? activeMultiLeg.date || query.departDate : query.departDate;
  const handleDateSelect = useCallback((idx) => {
    // idx is 0..6 where index-1 is offset from baseDate in OneWayDateBar
    const offset = Number(idx || 0) - 1;
    const newDate = addDays(activeDate, offset).toISOString().slice(0, 10);
    if (isMultiCity) {
      const legs = (multiLegs || []).map((leg, i) => (i === activeMultiLegIdx ? { ...leg, date: newDate } : leg));
      const next = Object.fromEntries(params.entries());
      next.tripType = 'M';
      next.legs = JSON.stringify(legs);
      // keep canonical from/to/departDate synced to first leg
      if (legs[0]) {
        next.from = legs[0].from;
        next.to = legs[0].to;
        next.departDate = legs[0].date;
      }
      setParams(next);
      return;
    }

    // one-way or roundtrip: update departDate
    const next = Object.fromEntries(params.entries());
    next.departDate = newDate;
    setParams(next);
  }, [activeDate, isMultiCity, multiLegs, activeMultiLegIdx, params, setParams]);
  const selectedMultiFlights = isMultiCity
    ? multiLegs.map((_, idx) => selectedMultiLegFlights[idx]).filter(Boolean)
    : [];
  const allMultiLegsSelected = isMultiCity && selectedMultiFlights.length === multiLegs.length;
  const total = isMultiCity
    ? selectedMultiFlights.reduce((sum, f) => sum + Number(f?.totalPriceINR || 0), 0)
    : Number(selectedOnwardFare?.amount || selectedOnward?.totalPriceINR || 0) + Number(selectedReturnFare?.amount || selectedReturn?.totalPriceINR || 0);

  useEffect(() => {
    if (!selectedOnwardFares.length) return;
    if (!selectedOnwardFareId) setSelectedOnwardFareId(selectedOnwardFares[0].id);
  }, [selectedOnwardFares, selectedOnwardFareId]);

  useEffect(() => {
    if (!selectedReturnFares.length) return;
    if (!selectedReturnFareId) setSelectedReturnFareId(selectedReturnFares[0].id);
  }, [selectedReturnFares, selectedReturnFareId]);

  const buildItineraryUrl = ({ onwardFlight, returnFlight, multiFlights = [], onwardAmount, returnAmount }) => {
    const multiPriceIds = multiFlights.map((f) => f?.priceId || f?.id).filter(Boolean);
    const primaryPriceId = multiPriceIds[0] || onwardFlight?.priceId || onwardFlight?.id || '';
    const amount = isMultiCity
      ? multiFlights.reduce((sum, f) => sum + Number(f?.totalPriceINR || 0), 0)
      : Number(onwardAmount || onwardFlight?.totalPriceINR || 0) + Number(returnAmount || returnFlight?.totalPriceINR || 0) || Number(onwardAmount || onwardFlight?.totalPriceINR || 0);

    const params = new URLSearchParams({
      priceId: String(primaryPriceId),
      amount: String(amount),
    });

    if (returnFlight) params.set('returnPriceId', String(returnFlight.priceId || returnFlight.id));
    if (multiPriceIds.length) params.set('multiPriceIds', multiPriceIds.join(','));

    return `/flights/itinerary?${params.toString()}`;
  };

  const goToItinerary = (onwardFlight) => {
    if (isMultiCity) {
      if (!allMultiLegsSelected) return;
      const first = selectedMultiFlights[0];
      if (!first) return;
      setBookingFlightId(first.id || first.priceId || 'booking');
      const nextUrl = buildItineraryUrl({ onwardFlight: first, multiFlights: selectedMultiFlights });
      if (typeof window !== 'undefined' && window.requestAnimationFrame) {
        window.requestAnimationFrame(() => navigate(nextUrl));
        return;
      }
      navigate(nextUrl);
      return;
    }

    if (!onwardFlight) return;
    const activeBookingId = onwardFlight.id || onwardFlight.priceId || 'booking';
    setBookingFlightId(activeBookingId);
    const nextUrl = buildItineraryUrl({
      onwardFlight,
      returnFlight: selectedReturn,
      onwardAmount: selectedOnwardFare?.amount,
      returnAmount: selectedReturnFare?.amount,
    });
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => navigate(nextUrl));
      return;
    }
    navigate(nextUrl);
  };
  const desktopGridCols = isRoundTrip
    ? 'xl:grid-cols-[280px_minmax(420px,1fr)_minmax(420px,1fr)]'
    : 'xl:grid-cols-[280px_minmax(780px,1fr)]';

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#dfdfdf] pb-14">
      <header className="sticky top-14 z-40 border-b border-black bg-[#222] text-white">
        <div className="mx-auto grid max-w-screen-2xl grid-cols-2 gap-[1px] bg-black px-2 py-1 md:grid-cols-6">
          <TopCell label={isMultiCity ? 'Leg From' : 'From'} value={activeFrom} sub="" />
          <TopCell label={isMultiCity ? 'Leg To' : 'To'} value={activeTo} sub="" />
          <TopCell label="Departure Date" value={fmtDate(activeDate)} sub="" />
          <TopCell label="Return Date" value={fmtDate(query.returnDate)} sub="" />
          <TopCell label="Passengers / Class" value={`${query.adults + query.children + query.infants}, ${query.cabinClass}`} sub="" />
          <div className="flex items-center justify-center gap-2 bg-[#2f2f2f] p-2">
            <button
              type="button"
              onClick={() => {
                setModify(initModifyForm(query, params));
                setShowModifyPanel((v) => !v);
              }}
              className={clsx(
                'rounded border px-2 py-1 text-[10px] font-semibold',
                showModifyPanel ? 'border-orange-400 text-orange-300' : 'border-slate-400 hover:border-orange-400',
              )}
            >
              MODIFY SEARCH
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1 rounded border border-slate-400 px-2 py-1 text-[10px] font-semibold hover:border-orange-400 disabled:opacity-60"
            >
              <RefreshCw className={clsx('h-3 w-3', isFetching && 'animate-spin')} /> REFRESH
            </button>
          </div>
        </div>
      </header>

      {showModifyPanel && (
        <section className="border-b border-black bg-[#323235] text-white">
          <div className="mx-auto max-w-screen-2xl px-4 py-3">
            <div className="mb-3 flex items-start justify-between">
              <div className="inline-flex rounded-lg bg-white/95 p-1 text-sm font-semibold">
                <TripTab active={modify.tripType === 'O'} onClick={() => setModify((v) => ({ ...v, tripType: 'O', returnDate: '' }))}>ONE WAY</TripTab>
                <TripTab active={modify.tripType === 'R'} onClick={() => setModify((v) => ({ ...v, tripType: 'R' }))}>ROUND TRIP</TripTab>
                <TripTab active={modify.tripType === 'M'} onClick={() => setModify((v) => ({ ...v, tripType: 'M', returnDate: '' }))}>MULTI CITY</TripTab>
              </div>
              <button type="button" onClick={() => setShowModifyPanel(false)} className="rounded p-1 text-white/90 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modify.tripType !== 'M' ? (
              <div className="flex flex-wrap lg:flex-nowrap items-stretch gap-2">
                <div className="relative bg-white rounded-lg shadow-sm flex items-stretch flex-1 min-w-[280px]">
                  <AirportField label="Where Fromkk ?" value={modify.from} onChange={(v) => setModify((s) => ({ ...s, from: v }))} side="from" placeholder="Where Fromkk ?" />
                  <div className="w-px bg-slate-200 my-3" />
                  <AirportField label="Where To ?" value={modify.to} onChange={(v) => setModify((s) => ({ ...s, to: v }))} side="to" placeholder="Where To ?" />
                </div>

                <div className="bg-white rounded-lg shadow-sm flex items-stretch min-w-[260px]">
                  <DateField label="Departure" value={modify.departDate} onChange={(v) => setModify((s) => ({ ...s, departDate: v }))} icon />
                  <div className="w-px bg-slate-200 my-3" />
                  <DateField
                    label="Return"
                    value={modify.returnDate}
                    onChange={(v) => setModify((s) => ({ ...s, returnDate: v, tripType: v ? 'R' : s.tripType }))}
                    clearable
                    onClear={() => setModify((s) => ({ ...s, returnDate: '', tripType: 'O' }))}
                    muted
                  />
                </div>

                <PaxField
                  pax={{ adults: modify.adults, children: modify.children, infants: modify.infants }}
                  cabin={modify.cabinClass}
                  open={modifyPaxOpen}
                  setOpen={setModifyPaxOpen}
                  onChange={(p) => setModify((s) => ({ ...s, adults: p.adults, children: p.children, infants: p.infants }))}
                  onCabin={(v) => setModify((s) => ({ ...s, cabinClass: v }))}
                />

                <button type="button" onClick={runModifiedSearch} className="px-10 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-sm">
                  Search
                </button>
                <button type="button" className="w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex flex-col items-center justify-center shadow-sm">
                  <Mic className="w-4 h-4" />
                  <span className="text-[9px] tracking-wider leading-none mt-0.5">BETA</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(modify.legs || []).map((leg, idx) => (
                  <div key={idx} className="flex flex-wrap lg:flex-nowrap items-stretch gap-2">
                    <div className="relative bg-white rounded-lg shadow-sm flex items-stretch flex-1 min-w-[280px]">
                      <AirportField label="Where Fromkk ?" value={leg.from} onChange={(v) => updateModifyLeg(idx, { from: v })} side="from" placeholder="Where From ?" />
                      <div className="w-px bg-slate-200 my-3" />
                      <AirportField label="Where To ?" value={leg.to} onChange={(v) => updateModifyLeg(idx, { to: v })} side="to" placeholder="Where To ?" />
                    </div>

                    <div className="bg-white rounded-lg shadow-sm flex items-stretch min-w-[170px] flex-1">
                      <DateField label="Departure" value={leg.date} onChange={(v) => updateModifyLeg(idx, { date: v })} icon />
                    </div>

                    <div className="min-w-[170px] flex-1" />

                    {idx === (modify.legs || []).length - 1 && (modify.legs || []).length < 4 ? (
                      <button type="button" onClick={addModifyLeg} className="border border-white/70 text-white font-semibold tracking-wide rounded-lg px-6 hover:bg-white/10">
                        ADD ONE MORE
                      </button>
                    ) : (
                      <button type="button" onClick={() => removeModifyLeg(idx)} className="border border-white/40 text-white/80 rounded-lg px-6 hover:bg-white/10 inline-flex items-center justify-center gap-1">
                        <X className="w-4 h-4" /> REMOVE
                      </button>
                    )}
                  </div>
                ))}

                <div className="flex flex-wrap lg:flex-nowrap items-stretch gap-2">
                  <div className="min-w-[280px] flex-1" />
                  <PaxField
                    pax={{ adults: modify.adults, children: modify.children, infants: modify.infants }}
                    cabin={modify.cabinClass}
                    open={modifyPaxOpen}
                    setOpen={setModifyPaxOpen}
                    onChange={(p) => setModify((s) => ({ ...s, adults: p.adults, children: p.children, infants: p.infants }))}
                    onCabin={(v) => setModify((s) => ({ ...s, cabinClass: v }))}
                  />
                  <button type="button" onClick={runModifiedSearch} className="px-10 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-sm">
                    Search
                  </button>
                  <button type="button" className="w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex flex-col items-center justify-center shadow-sm">
                    <Mic className="w-4 h-4" />
                    <span className="text-[9px] tracking-wider leading-none mt-0.5">BETA</span>
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-white/90 text-sm">
              <AirlineSelector value={modify.airline} onChange={(v) => setModify((s) => ({ ...s, airline: v }))} />

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-white/80">Select Fare Type:</span>
                {FARE_TYPES.slice(0, 3).map((f) => (
                  <label key={f.value} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="modifyFareType"
                      value={f.value}
                      className="h-4 w-4 accent-orange-500"
                      checked={modify.fareType === f.value}
                      onChange={() => setModify((s) => ({ ...s, fareType: f.value }))}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>

              <label className="ml-auto inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="accent-orange-500" checked={modify.directOnly} onChange={(e) => setModify((s) => ({ ...s, directOnly: e.target.checked }))} />
                <span>Direct Flight</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="accent-orange-500" checked={modify.creditShell} onChange={(e) => setModify((s) => ({ ...s, creditShell: e.target.checked }))} />
                <span>Credit Shell</span>
              </label>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-screen-2xl px-2 pt-2">
        <div className={clsx('hidden h-[calc(100vh-220px)] gap-2 xl:grid', desktopGridCols)}>
          <aside className="tj-scroll rounded border border-slate-300 bg-white p-2">
            {!isRoundTrip ? (
              <>
                <FilterBlock title="Price">
                  <div className="space-y-2 text-[11px]">
                    <div className="relative h-8">
                      <input
                        type="range"
                        className="absolute top-2 h-2 w-full accent-orange-500"
                        min={bounds.min}
                        max={bounds.max}
                        value={Math.min(draftMinPrice, draftMaxPrice)}
                        onChange={(e) => setDraftMinPrice(Math.min(Number(e.target.value || bounds.min), draftMaxPrice))}
                      />
                      <input
                        type="range"
                        className="absolute top-2 h-2 w-full accent-orange-500"
                        min={bounds.min}
                        max={bounds.max}
                        value={Math.max(draftMaxPrice, draftMinPrice)}
                        onChange={(e) => setDraftMaxPrice(Math.max(Number(e.target.value || bounds.max), draftMinPrice))}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-600">
                      <span>{fmtINR(draftMinPrice)}</span>
                      <span>{fmtINR(draftMaxPrice)}</span>
                    </div>

                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        className="rounded border border-slate-300 px-2 py-1"
                        type="number"
                        value={draftMinPrice}
                        min={bounds.min}
                        max={draftMaxPrice}
                        onChange={(e) => setDraftMinPrice(Number(e.target.value || 0))}
                      />
                      <input
                        className="rounded border border-slate-300 px-2 py-1"
                        type="number"
                        value={draftMaxPrice}
                        min={draftMinPrice}
                        max={bounds.max}
                        onChange={(e) => setDraftMaxPrice(Number(e.target.value || 0))}
                      />
                      <button
                        type="button"
                        onClick={applyPriceRange}
                        className="rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold text-white hover:bg-slate-700"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </FilterBlock>

                <FilterBlock title="Fare Options">
                  <div className="space-y-1">
                    <Tick label="Show Incv" checked={showIncvOnly} onChange={() => setShowIncvOnly((v) => !v)} />
                    <Tick label="Show Net" checked={showNetOnly} onChange={() => setShowNetOnly((v) => !v)} />
                    <Tick label="Hide Nearby Airports" />

                  </div>
                </FilterBlock>

                <FilterBlock title="Popular Filters">
                  <div className="flex flex-wrap gap-1">
                    <PopularChip active={selectedStops.has('0')} onClick={() => setSelectedStops((s) => toggleSet(s, '0'))}>Non Stop</PopularChip>
                    <PopularChip active={selectedStops.has('1')} onClick={() => setSelectedStops((s) => toggleSet(s, '1'))}>1 Stop</PopularChip>
                    <PopularChip active={onwardDepartBuckets.has('12-18')} onClick={() => setOnwardDepartBuckets((s) => toggleSet(s, '12-18'))}>Departure: 12-18</PopularChip>
                    <PopularChip active={onwardDepartBuckets.has('18-24')} onClick={() => setOnwardDepartBuckets((s) => toggleSet(s, '18-24'))}>Departure: 18-24</PopularChip>
                    <PopularChip active={selectedAirlines.has(allAirlines.find((name) => normalizeKey(name) === normalizeKey('IndiGo')) || 'IndiGo')} onClick={() => toggleAirlineByName('IndiGo')}>IndiGo</PopularChip>
                    <PopularChip active={selectedAirlines.has(allAirlines.find((name) => normalizeKey(name) === normalizeKey('SpiceJet')) || 'SpiceJet')} onClick={() => toggleAirlineByName('SpiceJet')}>SpiceJet</PopularChip>
                    <PopularChip active={selectedAirlines.has(allAirlines.find((name) => normalizeKey(name) === normalizeKey('Air India')) || 'Air India')} onClick={() => toggleAirlineByName('Air India')}>Air India</PopularChip>
                  </div>
                </FilterBlock>

                <FilterBlock title="Stops">
                  <div className="grid grid-cols-4 gap-1">
                    <StopChip active={selectedStops.has('0')} onClick={() => setSelectedStops((s) => toggleSet(s, '0'))}>0</StopChip>
                    <StopChip active={selectedStops.has('1')} onClick={() => setSelectedStops((s) => toggleSet(s, '1'))}>1</StopChip>
                    <StopChip active={selectedStops.has('2')} onClick={() => setSelectedStops((s) => toggleSet(s, '2'))}>2</StopChip>
                    <StopChip active={selectedStops.has('3+')} onClick={() => setSelectedStops((s) => toggleSet(s, '3+'))}>3+</StopChip>
                  </div>
                </FilterBlock>

                <FilterBlock title={`Departure From ${isMultiCity ? activeFrom : query.from}`}>
                  <TimeChips selected={onwardDepartBuckets} onToggle={(id) => setOnwardDepartBuckets((s) => toggleSet(s, id))} />
                  <button type="button" className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-left text-[10px] text-slate-600 hover:bg-white">
                    Select Specific Timeframe
                  </button>
                </FilterBlock>

                <FilterBlock title={`Arrival From ${isMultiCity ? activeTo : query.to}`}>
                  <TimeChips selected={onwardArrivalBuckets} onToggle={(id) => setOnwardArrivalBuckets((s) => toggleSet(s, id))} />
                  <button type="button" className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-left text-[10px] text-slate-600 hover:bg-white">
                    Select Specific Timeframe
                  </button>
                </FilterBlock>

                <FilterBlock title="Baggage">
                  <div className="space-y-1">
                    <Tick label="Show CheckIn Baggage" checked={showCheckInBaggage} onChange={() => setShowCheckInBaggage((v) => !v)} />
                    <Tick label="Show Hand Baggage Only" checked={showHandBaggageOnly} onChange={() => setShowHandBaggageOnly((v) => !v)} />
                  </div>
                </FilterBlock>

                <FilterBlock title="Fare Identifier">
                  <Tick label="Refundable" checked={refundableOnly} onChange={() => setRefundableOnly((v) => !v)} />
                  <div className="mt-2 space-y-1">
                    {(fareIdentifierExpanded ? fareIdentifierStats : fareIdentifierStats.slice(0, 5)).map((item) => (
                      <Tick
                        key={item.name}
                        label={`${item.name} (${item.count})`}
                        checked={selectedFareIdentifiers.has(item.name)}
                        onChange={() => setSelectedFareIdentifiers((s) => toggleSet(s, item.name))}
                      />
                    ))}
                  </div>
                  {fareIdentifierStats.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setFareIdentifierExpanded((v) => !v)}
                      className="mt-2 text-[10px] font-semibold text-slate-700 hover:underline"
                    >
                      {fareIdentifierExpanded ? 'See less' : 'See more'}
                    </button>
                  )}
                </FilterBlock>

                <FilterBlock title="Flight Number">
                  <div className="mb-1 flex justify-end">
                    <button type="button" onClick={() => setFlightNumberQuery('')} className="text-[10px] font-semibold text-orange-600 hover:underline">
                      CLEAR
                    </button>
                  </div>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1 text-[11px]"
                    placeholder="Eg. 123 or 6E-123"
                    value={flightNumberQuery}
                    onChange={(e) => setFlightNumberQuery(e.target.value)}
                  />
                </FilterBlock>

                <FilterBlock title="Airlines">
                  <div className="mb-1 flex justify-end">
                    <button type="button" onClick={() => setSelectedAirlines(new Set())} className="text-[10px] font-semibold text-orange-600 hover:underline">
                      CLEAR
                    </button>
                  </div>
                  <input
                    className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-[11px]"
                    placeholder="Search Airline Name"
                    value={airlineSearch}
                    onChange={(e) => setAirlineSearch(e.target.value)}
                  />
                  <div className="space-y-1">
                    {filteredAirlineStats.map((item) => (
                      <div key={item.name} className="flex items-center justify-between gap-2 text-[11px]">
                        <Tick label={`${item.name} (${item.count})`} checked={selectedAirlines.has(item.name)} onChange={() => setSelectedAirlines((s) => toggleSet(s, item.name))} />
                        <span className="whitespace-nowrap text-[10px] text-slate-500">{fmtINR(item.minPrice)}</span>
                      </div>
                    ))}
                    {!filteredAirlineStats.length && <div className="text-[10px] text-slate-500">No airlines found.</div>}
                  </div>
                </FilterBlock>

                <FilterBlock title="Terminal">
                  <div className="space-y-2 text-[11px]">
                    <div>
                      <p className="mb-1 font-semibold text-slate-600">Departure</p>
                      <div className="space-y-1">
                        {terminalOptions.departure.map((item) => (
                          <Tick
                            key={`dep-terminal-${item.name}`}
                            label={`${item.name} (${item.count})`}
                            checked={selectedDepartureTerminals.has(item.name)}
                            onChange={() => setSelectedDepartureTerminals((s) => toggleSet(s, item.name))}
                          />
                        ))}
                        {!terminalOptions.departure.length && <div className="text-[10px] text-slate-500">No terminal data.</div>}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 font-semibold text-slate-600">Arrival</p>
                      <div className="space-y-1">
                        {terminalOptions.arrival.map((item) => (
                          <Tick
                            key={`arr-terminal-${item.name}`}
                            label={`${item.name} (${item.count})`}
                            checked={selectedArrivalTerminals.has(item.name)}
                            onChange={() => setSelectedArrivalTerminals((s) => toggleSet(s, item.name))}
                          />
                        ))}
                        {!terminalOptions.arrival.length && <div className="text-[10px] text-slate-500">No terminal data.</div>}
                      </div>
                    </div>
                  </div>
                </FilterBlock>

                <FilterBlock title="Airport">
                  <div className="space-y-2 text-[11px]">
                    <div>
                      <p className="mb-1 font-semibold text-slate-600">Departure</p>
                      <div className="space-y-1">
                        {airportOptions.departure.map((item) => (
                          <Tick
                            key={`dep-airport-${item.code}`}
                            label={`${item.name} (${item.count})`}
                            checked={selectedDepartureAirports.has(item.code)}
                            onChange={() => setSelectedDepartureAirports((s) => toggleSet(s, item.code))}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 font-semibold text-slate-600">Arrival</p>
                      <div className="space-y-1">
                        {airportOptions.arrival.map((item) => (
                          <Tick
                            key={`arr-airport-${item.code}`}
                            label={`${item.name} (${item.count})`}
                            checked={selectedArrivalAirports.has(item.code)}
                            onChange={() => setSelectedArrivalAirports((s) => toggleSet(s, item.code))}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </FilterBlock>

                <FilterBlock title="Layover Airport">
                  <div className="space-y-1 text-[11px]">
                    {layoverOptions.map((item) => (
                      <Tick
                        key={`layover-${item.code}`}
                        label={`${item.name} (${item.count})`}
                        checked={selectedLayoverAirports.has(item.code)}
                        onChange={() => setSelectedLayoverAirports((s) => toggleSet(s, item.code))}
                      />
                    ))}
                    {!layoverOptions.length && <div className="text-[10px] text-slate-500">No layover airports in current results.</div>}
                  </div>
                </FilterBlock>

                <FilterBlock title="Duration">
                  <div className="text-[11px]">
                    <p className="mb-1">Upto {fmtDuration(maxDurationMinutes)}</p>
                    <input
                      type="range"
                      className="w-full accent-orange-500"
                      min={durationBounds.min}
                      max={durationBounds.max}
                      value={maxDurationMinutes}
                      onChange={(e) => setMaxDurationMinutes(Number(e.target.value || durationBounds.max))}
                    />
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{fmtDuration(durationBounds.min)}</span>
                      <span>{fmtDuration(durationBounds.max)}</span>
                    </div>
                  </div>
                </FilterBlock>

                <FilterBlock title="Layover Duration">
                  <div className="text-[11px]">
                    <p className="mb-1">Upto {fmtDuration(maxLayoverMinutes)}</p>
                    <input
                      type="range"
                      className="w-full accent-orange-500"
                      min={layoverBounds.min}
                      max={layoverBounds.max}
                      value={maxLayoverMinutes}
                      onChange={(e) => setMaxLayoverMinutes(Number(e.target.value || layoverBounds.max))}
                    />
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{fmtDuration(layoverBounds.min)}</span>
                      <span>{fmtDuration(layoverBounds.max)}</span>
                    </div>
                  </div>
                </FilterBlock>
              </>
            ) : (
              <>
                <FilterBlock title="Price">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label>
                      Min
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                        type="number"
                        value={minPrice}
                        min={bounds.min}
                        max={maxPrice}
                        onChange={(e) => setMinPrice(Number(e.target.value || 0))}
                      />
                    </label>
                    <label>
                      Max
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                        type="number"
                        value={maxPrice}
                        min={minPrice}
                        onChange={(e) => setMaxPrice(Number(e.target.value || 0))}
                      />
                    </label>
                  </div>
                </FilterBlock>

                <FilterBlock title="Stops">
                  <div className="grid grid-cols-4 gap-1">
                    <StopChip active={selectedStops.has('0')} onClick={() => setSelectedStops((s) => toggleSet(s, '0'))}>0</StopChip>
                    <StopChip active={selectedStops.has('1')} onClick={() => setSelectedStops((s) => toggleSet(s, '1'))}>1</StopChip>
                    <StopChip active={selectedStops.has('2')} onClick={() => setSelectedStops((s) => toggleSet(s, '2'))}>2</StopChip>
                    <StopChip active={selectedStops.has('3+')} onClick={() => setSelectedStops((s) => toggleSet(s, '3+'))}>3+</StopChip>
                  </div>
                </FilterBlock>

                <FilterBlock title={`Departure From ${query.from}`}>
                  <TimeChips selected={onwardDepartBuckets} onToggle={(id) => setOnwardDepartBuckets((s) => toggleSet(s, id))} />
                </FilterBlock>

                <FilterBlock title={`Arrival From ${query.to}`}>
                  <TimeChips selected={onwardArrivalBuckets} onToggle={(id) => setOnwardArrivalBuckets((s) => toggleSet(s, id))} />
                </FilterBlock>

                <FilterBlock title={`Departure From ${isMultiCity ? activeFrom : query.to}`}>
                  <TimeChips selected={returnDepartBuckets} onToggle={(id) => setReturnDepartBuckets((s) => toggleSet(s, id))} />
                </FilterBlock>

                <FilterBlock title={`Arrival From ${isMultiCity ? activeTo : query.from}`}>
                  <TimeChips selected={returnArrivalBuckets} onToggle={(id) => setReturnArrivalBuckets((s) => toggleSet(s, id))} />
                </FilterBlock>

                <FilterBlock title="Fare Identifier">
                  <Tick label="Refundable" checked={refundableOnly} onChange={() => setRefundableOnly((v) => !v)} />
                </FilterBlock>

                <FilterBlock title="Airlines">
                  <div className="space-y-1">
                    {allAirlines.map((name) => (
                      <Tick
                        key={name}
                        label={name}
                        checked={selectedAirlines.has(name)}
                        onChange={() => setSelectedAirlines((s) => toggleSet(s, name))}
                      />
                    ))}
                  </div>
                </FilterBlock>
              </>
            )}
          </aside>

          {isRoundTrip ? (
            <RoundTripResultColumn
              className="tj-scroll"
              title={`${activeFrom} -> ${activeTo}`}
              date={activeDate}
              flights={filteredOnward}
              selectedId={selectedOnwardId}
              onSelect={setSelectedOnwardId}
              type="onward"
              loading={initialLoading}
              sortBy={sortBy}
              onSort={setSortBy}
              selectedFareId={selectedOnwardFareId}
              onFareSelect={(flight, fare) => {
                setSelectedOnwardFareId(fare?.id || null);
              }}
            />
          ) : (
            <ResultColumn
              className="tj-scroll"
              title={`${activeFrom} -> ${activeTo}`}
              date={activeDate}
              flights={filteredOnward}
              selectedId={isMultiCity ? selectedOnward?.id || null : selectedOnwardId}
              onSelect={(flightId) => {
                if (isMultiCity) {
                  const hit = filteredOnward.find((f) => f.id === flightId);
                  if (!hit) return;
                  setSelectedMultiLegFlights((prev) => ({ ...prev, [activeMultiLegIdx]: hit }));
                  return;
                }
                setSelectedOnwardId(flightId);
              }}
              type="onward"
              loading={initialLoading}
              oneWayMode
              sortBy={sortBy}
              onSort={setSortBy}
              onDateSelect={handleDateSelect}
              isMultiCity={isMultiCity}
              multiLegs={multiLegs}
              activeMultiLegIdx={activeMultiLegIdx}
              onSelectMultiLeg={setActiveMultiLegIdx}
              onBook={goToItinerary}
              selectedFareId={selectedOnwardFareId}
              onFareSelect={(flight, fare) => {
                if (!isMultiCity) setSelectedOnwardFareId(fare?.id || null);
              }}
              bookingFlightId={bookingFlightId}
              bookEnabled
            />
          )}

          {isRoundTrip && (
            <RoundTripResultColumn
              className="tj-scroll"
              title={`${query.to} -> ${query.from}`}
              date={query.returnDate}
              flights={filteredReturn}
              selectedId={selectedReturnId}
              onSelect={setSelectedReturnId}
              type="return"
              loading={initialLoading}
              sortBy={sortBy}
              onSort={setSortBy}
              selectedFareId={selectedReturnFareId}
              onFareSelect={(flight, fare) => {
                setSelectedReturnFareId(fare?.id || null);
              }}
            />
          )}
        </div>

        <div className="space-y-2 xl:hidden">
          <div className="rounded border border-slate-300 bg-white p-3 text-sm text-slate-700">
            Desktop view has the exact three-column scrolling layout.
          </div>
          {isRoundTrip ? (
            <RoundTripResultColumn
              title={`${activeFrom} -> ${activeTo}`}
              date={activeDate}
              flights={filteredOnward}
              selectedId={selectedOnwardId}
              onSelect={setSelectedOnwardId}
              type="onward"
              loading={initialLoading}
              sortBy={sortBy}
              onSort={setSortBy}
              selectedFareId={selectedOnwardFareId}
              onFareSelect={(flight, fare) => {
                setSelectedOnwardFareId(fare?.id || null);
              }}
            />
          ) : (
            <ResultColumn
              title={`${activeFrom} -> ${activeTo}`}
              date={activeDate}
              flights={filteredOnward}
              selectedId={isMultiCity ? selectedOnward?.id || null : selectedOnwardId}
              onSelect={(flightId) => {
                if (isMultiCity) {
                  const hit = filteredOnward.find((f) => f.id === flightId);
                  if (!hit) return;
                  setSelectedMultiLegFlights((prev) => ({ ...prev, [activeMultiLegIdx]: hit }));
                  return;
                }
                setSelectedOnwardId(flightId);
              }}
              type="onward"
              loading={initialLoading}
              oneWayMode
              sortBy={sortBy}
              onSort={setSortBy}
              onDateSelect={handleDateSelect}
              isMultiCity={isMultiCity}
              multiLegs={multiLegs}
              activeMultiLegIdx={activeMultiLegIdx}
              onSelectMultiLeg={setActiveMultiLegIdx}
              onBook={goToItinerary}
              selectedFareId={selectedOnwardFareId}
              onFareSelect={(flight, fare) => {
                if (!isMultiCity) setSelectedOnwardFareId(fare?.id || null);
              }}
              bookingFlightId={bookingFlightId}
              bookEnabled
            />
          )}
          {isRoundTrip && (
            <RoundTripResultColumn
              title={`${query.to} -> ${query.from}`}
              date={query.returnDate}
              flights={filteredReturn}
              selectedId={selectedReturnId}
              onSelect={setSelectedReturnId}
              type="return"
              loading={initialLoading}
              sortBy={sortBy}
              onSort={setSortBy}
              selectedFareId={selectedReturnFareId}
              onFareSelect={(flight, fare) => {
                setSelectedReturnFareId(fare?.id || null);
              }}
            />
          )}
        </div>

        {!initialLoading && error && (
          <div className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error?.response?.data?.message || error?.response?.data?.error_code || error?.response?.data?.detail?.message || 'Unable to fetch live flight inventory.'}
          </div>
        )}
        {isLoadingNextPage && (
          <div className="mt-2 rounded border border-slate-300 bg-white px-3 py-2 text-center text-xs text-slate-500">
            Searching more live flights...
          </div>
        )}
      </section>

      {!initialLoading && (
        (isMultiCity && selectedMultiFlights.length > 0) ||
        (!isMultiCity && !isRoundTrip && selectedOnward && selectedOnwardFare) ||
        (!isMultiCity && isRoundTrip && selectedOnward && selectedReturn && selectedOnwardFare && selectedReturnFare)
      ) && (
          <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-black bg-black text-white">
            <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-3 py-2 text-xs">
              {isMultiCity ? (
                selectedMultiFlights.map((flight, idx) => (
                  <div key={`${flight.id}-${idx}`} className="flex items-center gap-1.5 border-r border-white/20 pr-3">
                    <PlaneTakeoff className="h-3.5 w-3.5 text-orange-400" />
                    <span>LEG {idx + 1}:</span>
                    <b>{fmtINR(flight.totalPriceINR)}</b>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center gap-2 border-r border-white/20 pr-4">
                    <div className={clsx('h-7 w-7 rounded-sm', badgeClass(selectedOnward?.segments?.[0]?.airline || ''))} />
                    <div>
                      <div className="text-[10px] font-semibold">{selectedOnward?.segments?.[0]?.airline || 'Onward'}</div>
                      <div className="text-[9px] text-slate-300">{selectedOnward?.segments?.[0]?.flightNumber || '-'}</div>
                    </div>
                    <div className="pl-3 text-center">
                      <div className="text-[14px] font-bold leading-none">{fmtClock(selectedOnward?.segments?.[0]?.departureTime)}</div>
                      <div className="text-[9px] text-slate-300">{selectedOnward?.segments?.[0]?.from}</div>
                    </div>
                    <div className="text-[14px] font-bold leading-none">{'->'}</div>
                    <div className="text-center">
                      <div className="text-[14px] font-bold leading-none">{fmtClock(selectedOnward?.segments?.[0]?.arrivalTime)}</div>
                      <div className="text-[9px] text-slate-300">{selectedOnward?.segments?.[0]?.to}</div>
                    </div>
                    <div className="pl-3 text-[20px] font-bold">{fmtINR(selectedOnwardFare?.amount || selectedOnward?.totalPriceINR)}</div>
                  </div>
                </>
              )}
              {!isMultiCity && isRoundTrip && selectedReturn && selectedReturnFare && (
                <div className="flex items-center gap-2 border-r border-white/20 pr-4">
                  <div className={clsx('h-7 w-7 rounded-sm', badgeClass(selectedReturn?.segments?.[0]?.airline || ''))} />
                  <div>
                    <div className="text-[10px] font-semibold">{selectedReturn?.segments?.[0]?.airline || 'Return'}</div>
                    <div className="text-[9px] text-slate-300">{selectedReturn?.segments?.[0]?.flightNumber || '-'}</div>
                  </div>
                  <div className="pl-3 text-center">
                    <div className="text-[14px] font-bold leading-none">{fmtClock(selectedReturn?.segments?.[0]?.departureTime)}</div>
                    <div className="text-[9px] text-slate-300">{selectedReturn?.segments?.[0]?.from}</div>
                  </div>
                  <div className="text-[14px] font-bold leading-none">{'->'}</div>
                  <div className="text-center">
                    <div className="text-[14px] font-bold leading-none">{fmtClock(selectedReturn?.segments?.[0]?.arrivalTime)}</div>
                    <div className="text-[9px] text-slate-300">{selectedReturn?.segments?.[0]?.to}</div>
                  </div>
                  <div className="pl-3 text-[20px] font-bold">{fmtINR(selectedReturnFare?.amount || selectedReturn?.totalPriceINR)}</div>
                </div>
              )}
              <div className="ml-auto flex items-center gap-3">
                {isMultiCity && !allMultiLegsSelected ? (
                  <div className="text-[10px] text-amber-300">
                    Select fare for all {multiLegs.length} legs to continue
                  </div>
                ) : null}
                <div className="text-right leading-tight">
                  <div className="text-[10px] text-slate-300">TOTAL PAYABLE</div>
                  <div className="text-[24px] font-bold text-orange-400">{fmtINR(total || selectedOnward?.totalPriceINR)}</div>
                </div>
                {isMultiCity ? (
                  <button
                    type="button"
                    onClick={() => goToItinerary(selectedMultiFlights[0])}
                    disabled={!allMultiLegsSelected}
                    className="rounded bg-orange-500 px-5 py-1.5 text-[14px] font-semibold hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    BOOK
                  </button>
                ) : (
                  <Link
                    to={buildItineraryUrl({
                      onwardFlight: selectedOnward,
                      returnFlight: selectedReturn,
                      onwardAmount: selectedOnwardFare?.amount,
                      returnAmount: selectedReturnFare?.amount,
                    })}
                    className="rounded bg-orange-500 px-5 py-1.5 text-[14px] font-semibold hover:bg-orange-600"
                  >
                    BOOK
                  </Link>
                )}
              </div>
            </div>
          </footer>
        )}
    </div>
  );
}

function TopCell({ label, value, sub }) {
  return (
    <div className="bg-[#2f2f2f] px-2 py-1.5 text-[10px]">
      <div className="uppercase tracking-wide text-slate-300">{label}</div>
      <div className="mt-0.5 text-[12px] font-semibold text-white">{value || '-'}</div>
      {sub ? <div className="text-[10px] text-slate-400">{sub}</div> : null}
    </div>
  );
}

function SortBar({ from, to, date, sortBy, onSort, label }) {
  return (
    <div className="rounded border border-slate-300 bg-white px-2 py-2 text-[11px]">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-700">
        <span>{label} | {from} {'->'} {to}</span>
        <span className="text-slate-500">{fmtDate(date)}</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-slate-600">
        <span className="font-semibold">Sort by:</span>
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSort(s.key)}
            className={clsx(
              'rounded px-2 py-0.5',
              sortBy === s.key ? 'bg-orange-500 text-white' : 'bg-slate-100 hover:bg-slate-200',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterBlock({ title, children }) {
  return (
    <section className="mb-2 border border-slate-200 bg-slate-50 p-2">
      <div className="mb-1 text-[11px] font-semibold text-slate-700">{title}</div>
      {children}
    </section>
  );
}

function StopChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded border px-2 py-1 text-[11px] font-semibold',
        active ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-300 bg-white text-slate-700',
      )}
    >
      {children}
    </button>
  );
}

function PopularChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        active ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
      )}
    >
      {children}
    </button>
  );
}

function TimeChips({ selected, onToggle }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {TIME_BUCKETS.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onToggle(b.id)}
          className={clsx(
            'rounded border px-1 py-1 text-[10px] font-semibold',
            selected.has(b.id) ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-300 bg-white text-slate-600',
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

function Tick({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-slate-700">
      <input type="checkbox" className="accent-orange-500" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function RoundTripResultColumn({
  title,
  date,
  flights,
  selectedId,
  onSelect,
  type,
  loading,
  className,
  sortBy = 'fastest',
  onSort = () => { },
  selectedFareId = null,
  onFareSelect = () => { },
}) {
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!flights.some((f) => f.id === expandedId)) setExpandedId(null);
  }, [flights, expandedId]);

  return (
    <section className={clsx('rounded border border-slate-300 bg-[#f2f2f2] p-1', className)}>
      <div className="sticky top-0 z-10 border-x border-b border-slate-300 bg-[#f3f3f3] px-3 py-2 text-[15px] text-[#474747]">
        <div className="flex items-center justify-between">
          <span className="font-semibold">
            {title} <span className="ml-1 font-normal text-[#8a8a8a]">{fmtDate(date)}</span>
          </span>
          <span className="text-[11px] text-slate-500">{flights.length} fares</span>
        </div>
      </div>

      <RoundTripSortRow sortBy={sortBy} onSort={onSort} />

      <div className="space-y-1 pt-1">
        {loading && <div className="rounded border border-slate-300 bg-white p-4 text-center text-sm text-slate-500">Searching live inventory...</div>}

        {!loading && flights.map((flight) => (
          <RoundTripFlightCard
            key={`${type}-${flight.id}`}
            flight={flight}
            selected={flight.id === selectedId}
            onSelect={() => onSelect(flight.id)}
            onFareSelect={(fare) => onFareSelect(flight, fare)}
            selectedFareId={selectedFareId}
            fareGroupKey={type}
            expanded={expandedId === flight.id}
            onToggleDetail={() => setExpandedId((id) => (id === flight.id ? null : flight.id))}
          />
        ))}

        {!loading && !flights.length && (
          <div className="rounded border border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No flights match your current filters.
          </div>
        )}
      </div>
    </section>
  );
}

function RoundTripSortRow({ sortBy, onSort }) {
  return (
    <div className="grid grid-cols-[1fr_160px_160px_240px] items-center border-x border-b border-slate-300 bg-white px-2 py-1.5 text-[12px] font-semibold text-slate-600">
      <button
        type="button"
        onClick={() => onSort('fastest')}
        className={clsx('text-left hover:text-orange-600', sortBy === 'fastest' ? 'text-orange-600' : 'text-slate-600')}
      >
        Sort By : Duration
      </button>
      <button
        type="button"
        onClick={() => onSort('earliest')}
        className={clsx('text-left hover:text-orange-600', sortBy === 'earliest' ? 'text-orange-600' : 'text-slate-600')}
      >
        Departure
      </button>
      <button
        type="button"
        onClick={() => onSort('arrival')}
        className={clsx('text-left hover:text-orange-600', sortBy === 'arrival' ? 'text-orange-600' : 'text-slate-600')}
      >
        Arrival
      </button>
      <button
        type="button"
        onClick={() => onSort('cheapest')}
        className={clsx('text-left hover:text-orange-600', sortBy === 'cheapest' ? 'text-orange-600' : 'text-slate-600')}
      >
        Price
      </button>
    </div>
  );
}

function RoundTripFlightCard({
  flight,
  selected,
  onSelect,
  onFareSelect,
  selectedFareId: selectedFareIdFromColumn = null,
  fareGroupKey = 'onward',
  expanded,
  onToggleDetail,
}) {
  const seg = flight.segments?.[0] || {};
  const stops = Number(seg.stops || 0);
  const seatsLeft = Math.max(1, Number(flight.seatsRemaining || 3));
  const fares = buildFareOptions(flight);
  const [detailTab, setDetailTab] = useState('flight');
  const [localSelectedFareId, setLocalSelectedFareId] = useState(() => fares[0]?.id || '');
  const dayOffset = dayOffsetLabel(seg.departureTime, seg.arrivalTime);

  useEffect(() => {
    if (!fares.some((fare) => fare.id === localSelectedFareId)) {
      setLocalSelectedFareId(fares[0]?.id || '');
    }
  }, [fares, localSelectedFareId]);

  return (
    <article className="rounded border border-slate-300 bg-white transition hover:border-slate-500">
      <div className="grid grid-cols-[48%_52%] gap-2 px-2 py-2">
        <div className="min-w-0">
          <div className="grid grid-cols-[120px_1fr_auto_1fr] items-center gap-1.5">
            <div className="grid grid-cols-[auto_1fr] items-center gap-2">

              <div>
                <div className={clsx('rounded px-1.5 py-1 text-[10px] font-bold', badgeClass(seg.airline))}>
                  {(seg.airlineCode || seg.airline || 'XX').slice(0, 2).toUpperCase()}
                </div>
                <div className="text-[10px] font-semibold text-slate-800">{seg.airline || 'Airline'}</div>
                <div className="text-[9px] text-slate-500">{seg.flightNumber || '-'}</div>
              </div>
            </div>

            <div>
              <div className="text-[14px] font-semibold leading-none text-slate-900">{fmtClock(seg.departureTime)}</div>
              <div className="text-[8px] leading-none text-slate-600">{seg.from}</div>
            </div>

            <div className="min-w-[60px] text-center">

              <div className="text-[9px] font-semibold text-orange-600">{stops ? `${stops} Stop` : 'Non Stop'}</div>
              <div className="my-1 h-px w-full bg-slate-300" />
              <div className="text-[9px] text-slate-600">{fmtDuration(seg.durationMinutes)}</div>

            </div>

            <div className="text-right">
              <div className="text-[14px] font-semibold leading-none text-slate-900">{fmtClock(seg.arrivalTime)}</div>
              <div className="text-[8px] leading-none text-slate-600">{seg.to}</div>
            </div>
          </div>

          <div className="mt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDetail();
              }}
              className="rounded border border-[#dddddd] bg-[#f7f7f7] px-4 py-1.5 text-[12px] font-semibold text-[#ff6d2d] shadow-sm"
            >
              View Details {expanded ? '-' : '+'}
            </button>
            {dayOffset ? (
              <div className="mt-2 inline-flex items-center gap-2 text-[12px] text-slate-600">
                <PlaneTakeoff className="h-4 w-4 text-orange-500" /> {dayOffset}
              </div>
            ) : null}
            {/* <div className="mt-1 text-[12px] font-semibold text-orange-600">Seats left: {seatsLeft}</div> */}
          </div>
        </div>

        <div className="border-l border-slate-300 pl-2">
          {(() => {
            const selectedFare = fares.find((fare) => fare.id === selectedFareIdFromColumn);
            const shownFare = (selected && selectedFare) || fares[0];
            if (!shownFare) return null;
            return (
              <label
                className="grid w-full cursor-pointer grid-cols-[14px_1fr] items-start gap-1 text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="radio"
                  name={`rt-fare-${fareGroupKey}`}
                  className="mt-1 accent-orange-500"
                  checked={selected && selectedFareIdFromColumn === shownFare.id}
                  onChange={() => {
                    onSelect();
                    setLocalSelectedFareId(shownFare.id);
                    onFareSelect?.(shownFare);
                  }}
                />
                <span>
                  <span className="block text-[8px] text-slate-400">713208</span>
                  <span className="flex items-center gap-1">
                    <span className="text-[15px] font-bold leading-none text-slate-800">{fmtINR(shownFare.amount)}</span>
                    <span className="text-[9px] text-blue-600">*</span>
                  </span>
                  <span className="mt-1 inline-block bg-amber-100 px-1 py-0.5 text-[8px] font-semibold text-amber-800">{shownFare.name}</span>
                  <span className="ml-1 text-[8px] text-slate-500">Economy, {flight.refundable ? 'Refundable' : 'Non-refundable'}</span>
                </span>
              </label>
            );
          })()}
        </div>
      </div>

      {expanded && (
        <div className="mx-2 mb-2 border border-slate-300 bg-white">
          <div className="flex items-center justify-between border-b border-slate-300 px-3 py-2">
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <button type="button" onClick={() => setDetailTab('flight')} className={detailTab === 'flight' ? 'text-orange-600' : 'text-slate-600'}>Flight Details</button>
              <button type="button" onClick={() => setDetailTab('fare')} className={detailTab === 'fare' ? 'text-orange-600' : 'text-slate-600'}>Fare Details</button>
              <button type="button" onClick={() => setDetailTab('rules')} className={detailTab === 'rules' ? 'text-orange-600' : 'text-slate-600'}>Fare Rules</button>
            </div>
            <button type="button" onClick={onToggleDetail} className="text-lg leading-none text-slate-500">x</button>
          </div>

          {detailTab === 'flight' && <div className="px-3 py-2">
            <div className="mb-2 text-[12px] font-semibold text-slate-700">{seg.fromCity || seg.from} {'->'} {seg.toCity || seg.to} {fmtDate(seg.departureTime)}</div>

            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 border-b border-slate-200 pb-2 text-[11px]">
              <div className={clsx('rounded px-2 py-1 text-[10px] font-bold', badgeClass(seg.airline))}>{(seg.airlineCode || 'XX').slice(0, 2)}</div>
              <div>
                <div className="font-semibold text-slate-700">{seg.flightNumber}</div>
                <div className="text-slate-500">Economy</div>
              </div>
              <div className="text-slate-700">{fmtClock(seg.departureTime)}</div>
              <div className="text-slate-700">{fmtDuration(seg.durationMinutes)}</div>
              <div className="text-slate-700">{fmtClock(seg.arrivalTime)}</div>
            </div>

            <div className="pt-2 text-[11px]">
              <div className="mb-1 font-semibold text-slate-700">Baggage Information</div>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <div className="font-semibold">Check In</div>
                  <div>{seg.checkInBaggage || '15kg'}</div>
                </div>
                <div>
                  <div className="font-semibold">Cabin</div>
                  <div>{seg.cabinBaggage || '7kg'}</div>
                </div>
              </div>
            </div>
          </div>}

          {detailTab === 'fare' && (
            <div className="px-3 py-2 text-[11px] text-slate-700">
              <div className="mb-2 font-semibold">Fare Breakup</div>
              <div className="grid grid-cols-2 gap-y-1 border border-slate-200 p-2">
                <span>Base Fare</span><span className="text-right">{fmtINR(Number(flight.totalPriceINR || 0) * 0.72)}</span>
                <span>Taxes & Fees</span><span className="text-right">{fmtINR(Number(flight.totalPriceINR || 0) * 0.28)}</span>
                <span className="font-semibold">Total</span><span className="text-right font-semibold">{fmtINR(flight.totalPriceINR)}</span>
              </div>
            </div>
          )}

          {detailTab === 'rules' && <FareRulesPanel seg={seg} />}
        </div>
      )}
    </article>
  );
}

function ResultColumn({
  title,
  date,
  flights,
  selectedId,
  onSelect,
  type,
  loading,
  disabled,
  className,
  oneWayMode = false,
  sortBy = 'fastest',
  onSort = () => { },
  onDateSelect = () => { },
  selectedFareId = null,
  isMultiCity = false,
  multiLegs = [],
  activeMultiLegIdx = 0,
  onSelectMultiLeg = () => { },
  onBook = () => { },
  onFareSelect = () => { },
  bookingFlightId = null,
  bookEnabled = false,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [compareId, setCompareId] = useState(null);
  const [selectedDateIdx, setSelectedDateIdx] = useState(1);

  useEffect(() => {
    if (!flights.some((f) => f.id === expandedId)) setExpandedId(null);
  }, [flights, expandedId]);

  useEffect(() => {
    if (!flights.some((f) => f.id === compareId)) setCompareId(null);
  }, [flights, compareId]);

  if (disabled) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
        Return section is available for round-trip search only.
      </section>
    );
  }

  return (
    <section className={clsx('rounded border border-slate-300 bg-[#f2f2f2] p-1', className)}>
      <div className="sticky top-0 z-10 border-x border-b border-slate-300 bg-[#f3f3f3] px-3 py-2 text-[15px] text-[#474747]">
        <div className="flex items-center justify-between">
          <span className="font-semibold">
            {title} <span className="ml-1 font-normal text-[#8a8a8a]">{fmtDate(date)}</span>
          </span>
          <span className="text-[11px] text-slate-500">{flights.length} fares</span>
        </div>
      </div>

      {oneWayMode && !isMultiCity && (
        <OneWayDateBar
          baseDate={date}
          selectedIdx={selectedDateIdx}
          onSelect={(idx) => {
            setSelectedDateIdx(idx);
            try { onDateSelect(idx); } catch (_) { }
          }}
        />
      )}
      {oneWayMode && isMultiCity && (
        <MultiCityLegBar legs={multiLegs} activeIdx={activeMultiLegIdx} onSelect={onSelectMultiLeg} />
      )}

      {oneWayMode && type === 'return' && <ShareByRow />}

      {oneWayMode && <FareSummaryChips flights={flights} sortBy={sortBy} onSort={onSort} />}

      {oneWayMode ? (
        <div className="grid grid-cols-12 border-x border-b border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-600">
          <button
            type="button"
            onClick={() => onSort('fastest')}
            className={clsx('col-span-3 text-left font-semibold hover:text-orange-600', sortBy === 'fastest' ? 'text-orange-600' : 'text-slate-600')}
          >
            Sort By : Duration
          </button>
          <button
            type="button"
            onClick={() => onSort('earliest')}
            className={clsx('col-span-2 text-left font-semibold hover:text-orange-600', sortBy === 'earliest' ? 'text-orange-600' : 'text-slate-600')}
          >
            Departure
          </button>
          <button
            type="button"
            onClick={() => onSort('arrival')}
            className={clsx('col-span-2 text-left font-semibold hover:text-orange-600', sortBy === 'arrival' ? 'text-orange-600' : 'text-slate-600')}
          >
            Arrival
          </button>
          <button
            type="button"
            onClick={() => onSort('cheapest')}
            className={clsx('col-span-2 text-left font-semibold hover:text-orange-600', sortBy === 'cheapest' ? 'text-orange-600' : 'text-slate-600')}
          >
            Price
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_160px_160px_240px] items-center border-x border-b border-slate-300 bg-white px-2 py-1.5 text-[12px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => onSort('fastest')}
            className={clsx('text-left hover:text-orange-600', sortBy === 'fastest' ? 'text-orange-600' : 'text-slate-600')}
          >
            Sort By : Duration
          </button>
          <button
            type="button"
            onClick={() => onSort('earliest')}
            className={clsx('text-left hover:text-orange-600', sortBy === 'earliest' ? 'text-orange-600' : 'text-slate-600')}
          >
            Departure
          </button>
          <button
            type="button"
            onClick={() => onSort('arrival')}
            className={clsx('text-left hover:text-orange-600', sortBy === 'arrival' ? 'text-orange-600' : 'text-slate-600')}
          >
            Arrival
          </button>
          <button
            type="button"
            onClick={() => onSort('cheapest')}
            className={clsx('text-left hover:text-orange-600', sortBy === 'cheapest' ? 'text-orange-600' : 'text-slate-600')}
          >
            Price
          </button>
        </div>
      )}

      <div className="space-y-1 pt-1">
        {loading && <div className="rounded border border-slate-300 bg-white p-4 text-center text-sm text-slate-500">Searching live inventory...</div>}

        {!loading && flights.map((flight) => (
          <div key={`${type}-${flight.id}`} className="space-y-1">
            <FlightCard
              flight={flight}
              selected={flight.id === selectedId}
              onSelect={() => onSelect(flight.id)}
              onBook={() => onBook(flight)}
              onFareSelect={(fare) => onFareSelect(flight, fare)}
              selectedFareId={selectedFareId}
              fareGroupKey={type}
              isBooking={
                bookingFlightId != null && [flight.id, flight.priceId].filter(Boolean).includes(bookingFlightId)
              }
              bookEnabled={bookEnabled}
              expanded={expandedId === flight.id}
              onToggleDetail={() => setExpandedId((id) => (id === flight.id ? null : flight.id))}
              oneWayMode={oneWayMode}
              compared={compareId === flight.id}
              onCompare={() => setCompareId((id) => (id === flight.id ? null : flight.id))}
            />

            {oneWayMode && compareId === flight.id && <CompareFarePanel flight={flight} />}
          </div>
        ))}

        {!loading && !flights.length && (
          <div className="rounded border border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No flights match your current filters.
          </div>
        )}
      </div>
    </section>
  );
}

function FareSummaryChips({ flights, sortBy, onSort = () => { } }) {
  if (!flights.length) return null;
  const cheapest = [...flights].sort((a, b) => Number(a.totalPriceINR || 0) - Number(b.totalPriceINR || 0))[0];
  const fastest = [...flights].sort((a, b) => Number(a.segments?.[0]?.durationMinutes || 0) - Number(b.segments?.[0]?.durationMinutes || 0))[0];

  return (
    <div className="mb-1 flex gap-2 border-x border-b border-slate-300 bg-white px-2 py-2">
      <button
        type="button"
        onClick={() => onSort('cheapest')}
        className={clsx(
          'min-w-[210px] rounded-xl border-b-2 border-orange-500 px-3 py-2 text-left transition',
          sortBy === 'cheapest' ? 'bg-[#f7f7f7]' : 'bg-[#f1f1f1] hover:bg-[#ececec]',
        )}
      >
        <div className="flex items-center gap-1 text-[14px] font-semibold text-slate-700"><IndianRupee className="h-4 w-4 text-orange-500" /> Cheapest</div>
        <div className="text-[13px] text-slate-600">{fmtINR(cheapest.totalPriceINR)}   Duration: {fmtDuration(cheapest.segments?.[0]?.durationMinutes)}</div>
      </button>
      <button
        type="button"
        onClick={() => onSort('fastest')}
        className={clsx(
          'min-w-[210px] rounded-xl border-b-2 border-orange-500 px-3 py-2 text-left transition',
          sortBy === 'fastest' ? 'bg-[#f7f7f7]' : 'bg-[#f1f1f1] hover:bg-[#ececec]',
        )}
      >
        <div className="flex items-center gap-1 text-[14px] font-semibold text-slate-700"><Zap className="h-4 w-4 text-slate-600" /> Fastest</div>
        <div className="text-[13px] text-slate-600">{fmtINR(fastest.totalPriceINR)}   Duration: {fmtDuration(fastest.segments?.[0]?.durationMinutes)}</div>
      </button>
    </div>
  );
}

function ShareByRow() {
  return (
    <div className="mb-1 flex items-center justify-end gap-2 border-x border-b border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-600">
      <Share2 className="h-3.5 w-3.5" />
      <span className="font-semibold">Share By :</span>
      <button type="button" className="rounded border border-green-300 bg-green-50 p-1 text-green-700" title="WhatsApp">
        <MessageCircle className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="rounded border border-orange-300 bg-orange-50 p-1 text-orange-700" title="Email">
        <Mail className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="rounded border border-amber-600 bg-amber-50 p-1 text-amber-700" title="Preview">
        <Eye className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function OneWayDateBar({ baseDate, selectedIdx, onSelect }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(baseDate, i - 1)), [baseDate]);

  return (
    <div className="mb-1 grid grid-cols-[26px_1fr_26px] items-stretch border-x border-b border-slate-300 bg-white">
      <button type="button" className="grid place-items-center border-r border-slate-300 text-slate-500" aria-label="Previous date">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const label = fmtDateBar(d);
          const active = i === selectedIdx;
          return (
            <button
              key={`${label.dow}-${label.short}-${i}`}
              type="button"
              onClick={() => onSelect(i)}
              className={clsx(
                'border-r border-slate-300 px-1.5 py-1 text-left text-[12px] last:border-r-0',
                active ? 'bg-orange-50 text-orange-600' : 'bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <div className="font-semibold">{label.dow}, {label.short}</div>
              <div className={clsx('font-bold', active ? 'text-orange-600' : 'text-slate-700')}>Fetch Fare</div>
            </button>
          );
        })}
      </div>
      <button type="button" className="grid place-items-center border-l border-slate-300 text-slate-500" aria-label="Next date">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function MultiCityLegBar({ legs, activeIdx, onSelect }) {
  if (!legs?.length) return null;
  return (
    <div className="mb-1 border-x border-b border-slate-300 bg-white px-2 py-2">
      <div className="flex flex-wrap gap-2">
        {legs.map((leg, idx) => {
          const active = idx === activeIdx;
          return (
            <button
              key={`${leg.from}-${leg.to}-${leg.date}-${idx}`}
              type="button"
              onClick={() => onSelect(idx)}
              className={clsx(
                'rounded border px-2 py-1 text-left text-[12px]',
                active ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              <div className="font-semibold">{leg.from} {'->'} {leg.to}</div>
              <div className="text-[11px]">{leg.date || '--'}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompareFarePanel({ flight }) {
  const fares = buildFareOptions(flight);
  const seg = flight.segments?.[0] || {};
  const visibleFares = fares.slice(0, 4);
  const serviceRows = [
    { key: 'Fares', value: '-' },
    { key: 'Baggage Info', value: `Adult (Age 12+)` },
    { key: 'Cancellation Fee', value: '4 hrs to 365 days' },
    { key: 'Date Change Fee', value: '4 hrs to 365 days' },
    { key: 'Seat Charge', value: 'Chargeable' },
    { key: 'Meals', value: 'Paid meal' },
  ];

  return (
    <div className="rounded border border-slate-300 bg-[#f3f3f3] p-2">
      <div className="grid grid-cols-[182px_1fr] gap-2">
        <div className="space-y-2">
          <div className="rounded-xl bg-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700">Services (Per Pax)</div>
          {serviceRows.map((row) => (
            <div key={row.key} className="rounded-xl bg-slate-200 px-3 py-2 text-slate-700">
              <div className="text-[11px] font-semibold leading-tight">{row.key}</div>
              <div className="mt-0.5 text-[10px]">{row.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          {visibleFares.map((fare, idx) => (
            <div key={fare.id} className={clsx('rounded-2xl border bg-white', idx === 0 ? 'border-orange-400' : 'border-slate-200')}>
              <div className="rounded-t-2xl bg-amber-100 px-3 py-2">
                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                  <span className={clsx('inline-block h-4 w-4 rounded-full border', idx === 0 ? 'border-orange-400 bg-orange-400' : 'border-slate-300 bg-white')} />
                  {fare.name}
                </div>
              </div>
              <div className="border-b border-slate-200 px-3 py-3 text-center text-[15px] font-bold text-slate-800">{fmtINR(fare.amount)}</div>
              <div className="grid grid-cols-2 border-b border-slate-200 text-center text-[11px]">
                <div className="border-r border-slate-200 px-2 py-2.5">
                  <div className="font-semibold text-slate-500">Check In Bag</div>
                  <div className="font-bold text-slate-700">{seg.checkInBaggage || '-'}</div>
                </div>
                <div className="px-2 py-2.5">
                  <div className="font-semibold text-slate-500">Cabin Bag</div>
                  <div className="font-bold text-slate-700">{seg.cabinBaggage || '7 Kg'}</div>
                </div>
              </div>
              <div className="border-b border-slate-200 px-3 py-3 text-center text-[11px] font-semibold text-slate-700">Refundable subject to cancellation <span className="text-orange-600">See More</span></div>
              <div className="border-b border-slate-200 px-3 py-3 text-center text-[11px] font-semibold text-slate-700">INR 1,100.00 + INR 100.00 | + Difference <span className="text-orange-600">See More</span></div>
              <div className="border-b border-slate-200 px-3 py-3 text-center text-[11px] font-semibold text-slate-700">Paid Seat</div>
              <div className="px-3 py-3 text-center">
                <div className="mb-1.5 text-[12px] font-bold text-slate-700">Chargeable</div>
                <button type="button" className="rounded bg-orange-500 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-orange-600">BOOK NOW</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlightCard({
  flight,
  selected,
  onSelect,
  onBook,
  onFareSelect,
  selectedFareId: selectedFareIdFromColumn = null,
  fareGroupKey = 'onward',
  isBooking = false,
  bookEnabled,
  expanded,
  onToggleDetail,
  oneWayMode,
  compared,
  onCompare,
}) {
  const seg = flight.segments?.[0] || {};
  const stops = Number(seg.stops || 0);
  const seatsLeft = Math.max(1, Number(flight.seatsRemaining || 3));
  const fares = buildFareOptions(flight);
  const [detailTab, setDetailTab] = useState('flight');
  const [localSelectedFareId, setLocalSelectedFareId] = useState(() => fares[0]?.id || '');
  const dayOffset = dayOffsetLabel(seg.departureTime, seg.arrivalTime);

  useEffect(() => {
    if (!fares.some((fare) => fare.id === localSelectedFareId)) {
      setLocalSelectedFareId(fares[0]?.id || '');
    }
  }, [fares, localSelectedFareId]);

  const visibleFares = oneWayMode ? fares.slice(0, 4) : fares;
  const hiddenFareCount = Math.max(0, fares.length - visibleFares.length);
  const handleBookClick = (e) => {
    e.stopPropagation();
    if (isBooking) return;
    onSelect();
    onBook?.();
  };

  if (oneWayMode) {
    return (
      <article className="rounded-md border border-[#e4e4e4] bg-white">
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(e) => e.key === 'Enter' && onSelect()}
          className="grid grid-cols-12 gap-2 px-4 py-4"
        >
          <div className="col-span-7">
            <div className="flex">
              <div className="w-[170px]">
                <div className="flex gap-2">
                  <div
                    className={clsx(
                      'mt-1 h-4 w-4 rounded-sm',
                      (seg.airline || '').toLowerCase().includes('indigo')
                        ? 'bg-[#2f5fa7]'
                        : (seg.airline || '').toLowerCase().includes('spice')
                          ? 'bg-[#d72f2f]'
                          : (seg.airline || '').toLowerCase().includes('air india')
                            ? 'bg-[#b3261e]'
                            : 'bg-[#3057a5]',
                    )}
                  />
                  <div>
                    <div className="text-[16px] font-semibold leading-none text-[#444]">{seg.airline || 'Airline'}</div>
                    <div className="mt-1 text-[13px] text-[#777]">{seg.flightNumber || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 items-center justify-between px-5">
                <div>
                  <div className="text-[14px] font-semibold text-[#888]">{seg.from || '---'}</div>
                  <div className="text-[18px] font-bold leading-none text-[#444]">{fmtClock(seg.departureTime)}</div>
                  <div className="mt-1 text-[14px] text-[#777]">{fmtDate(seg.departureTime).replace(',', '')}</div>
                </div>

                <div className="flex flex-col items-center px-3">
                  <div className="text-[13px] text-[#888]">{stops ? `${stops} Stop` : 'Non-Stop'}</div>
                  <div className="relative my-1 flex items-center">
                    <div className="h-[2px] w-[75px] bg-[#d7d7d7]" />
                    <span className="absolute right-[-5px] text-[#aaa]">{'->'}</span>
                  </div>
                  <div className="text-[16px] text-[#555]">{fmtDuration(seg.durationMinutes)}</div>
                </div>

                <div>
                  <div className="text-[14px] font-semibold text-[#888]">{seg.to || '---'}</div>
                  <div className="text-[18px] font-bold leading-none text-[#444]">{fmtClock(seg.arrivalTime)}</div>
                  <div className="mt-1 text-[14px] text-[#777]">{fmtDate(seg.arrivalTime).replace(',', '')}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDetail();
                }}
                className="rounded border border-[#dddddd] bg-[#f7f7f7] px-4 py-2 text-[14px] font-semibold text-[#ff6d2d] shadow-sm"
              >
                View Details {expanded ? '-' : '+'}
              </button>

              {dayOffset ? <div className="text-[14px] text-[#666]"> {dayOffset}</div> : null}

              {/* <div className={clsx('text-[14px] font-semibold', seatsLeft <= 3 ? 'text-red-500' : 'text-[#ff6d2d]')}>
                Seats left: {seatsLeft}
              </div> */}
            </div>
          </div>

          <div className="col-span-5 flex justify-between border-l border-[#ededed] pl-5">
            <div className="flex-1 space-y-2">
              {visibleFares.map((fare, idx) => {
                const active = localSelectedFareId === fare.id;
                const labelClass =
                  fare.name.toLowerCase().includes('sme')
                    ? 'bg-[#ffe3d2] text-[#ff6d2d]'
                    : fare.name.toLowerCase().includes('flex')
                      ? 'bg-[#f7efad] text-[#777]'
                      : 'bg-[#f6df7a] text-[#444]';

                return (
                  <div key={fare.id} className={idx !== visibleFares.length - 1 ? 'border-b border-[#ededed] pb-2' : ''}>
                    <label className="flex cursor-pointer items-start gap-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="radio"
                        className="mt-1 accent-orange-500"
                        name={`fare-${flight.id}`}
                        checked={active}
                        onChange={() => {
                          setLocalSelectedFareId(fare.id);
                          onSelect();
                          onFareSelect?.(fare);
                        }}
                      />

                      <span>
                        <span className="block text-[11px] text-[#9a9a9a]">713208</span>
                        <span className="flex items-center gap-1">
                          <span className="text-[18px] font-bold leading-none text-[#444]">{fmtINR(fare.amount)}</span>
                          <span className="text-[13px] text-[#2f5fa7]">*</span>
                        </span>

                        <span className="mt-1 flex items-center gap-2 text-[14px]">
                          <span className={clsx('px-1 text-[12px] font-semibold', labelClass)}>{fare.name}</span>
                          <span className="text-[#777]">Economy, {flight.refundable ? 'Refundable' : 'Non-refundable'}</span>
                        </span>
                      </span>
                    </label>
                  </div>
                );
              })}

              {hiddenFareCount > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full bg-slate-600 px-2.5 py-0.5 text-[10px] font-semibold text-white"
                  >
                    +{hiddenFareCount} more fare v
                  </button>
                </div>
              )}
            </div>

            <div className="ml-5 flex w-[120px] flex-col gap-3">
              <button
                type="button"
                onClick={handleBookClick}
                disabled={isBooking}
                className="rounded bg-[#ff7b39] py-3 text-[16px] font-bold text-white hover:bg-[#f06d2d] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBooking ? (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Booking...
                  </span>
                ) : (
                  'BOOK'
                )}
              </button>

              {fares.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompare();
                  }}
                  className="rounded border border-[#ff7b39] bg-white py-3 text-[15px] text-[#555]"
                >
                  Compare {compared ? '^' : 'v'}
                </button>
              )}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="mx-2 mb-2 border border-slate-300 bg-white">
            <div className="flex items-center justify-between border-b border-slate-300 px-3 py-2">
              <div className="flex items-center gap-4 text-[11px] font-semibold">
                <button type="button" onClick={() => setDetailTab('flight')} className={detailTab === 'flight' ? 'text-orange-600' : 'text-slate-600'}>Flight Details</button>
                <button type="button" onClick={() => setDetailTab('fare')} className={detailTab === 'fare' ? 'text-orange-600' : 'text-slate-600'}>Fare Details</button>
                <button type="button" onClick={() => setDetailTab('rules')} className={detailTab === 'rules' ? 'text-orange-600' : 'text-slate-600'}>Fare Rules</button>
              </div>
              <button type="button" onClick={onToggleDetail} className="text-lg leading-none text-slate-500">x</button>
            </div>

            {detailTab === 'flight' && <div className="px-3 py-2">
              <div className="mb-2 text-[12px] font-semibold text-slate-700">{seg.fromCity || seg.from} {'->'} {seg.toCity || seg.to} {fmtDate(seg.departureTime)}</div>

              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 border-b border-slate-200 pb-2 text-[11px]">
                <div className={clsx('rounded px-2 py-1 text-[10px] font-bold', badgeClass(seg.airline))}>{(seg.airlineCode || 'XX').slice(0, 2)}</div>
                <div>
                  <div className="font-semibold text-slate-700">{seg.flightNumber}</div>
                  <div className="text-slate-500">Economy</div>
                </div>
                <div className="text-slate-700">{fmtClock(seg.departureTime)}</div>
                <div className="text-slate-700">{fmtDuration(seg.durationMinutes)}</div>
                <div className="text-slate-700">{fmtClock(seg.arrivalTime)}</div>
              </div>

              <div className="pt-2 text-[11px]">
                <div className="mb-1 font-semibold text-slate-700">Baggage Information</div>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    <div className="font-semibold">Check In</div>
                    <div>{seg.checkInBaggage || '15kg'}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Cabin</div>
                    <div>{seg.cabinBaggage || '7kg'}</div>
                  </div>
                </div>
              </div>
            </div>}

            {detailTab === 'fare' && (
              <div className="px-3 py-2 text-[11px] text-slate-700">
                <div className="mb-2 font-semibold">Fare Breakup</div>
                <div className="grid grid-cols-2 gap-y-1 border border-slate-200 p-2">
                  <span>Base Fare</span><span className="text-right">{fmtINR(Number(flight.totalPriceINR || 0) * 0.72)}</span>
                  <span>Taxes & Fees</span><span className="text-right">{fmtINR(Number(flight.totalPriceINR || 0) * 0.28)}</span>
                  <span className="font-semibold">Total</span><span className="text-right font-semibold">{fmtINR(flight.totalPriceINR)}</span>
                </div>
              </div>
            )}

            {detailTab === 'rules' && <FareRulesPanel seg={seg} />}
          </div>
        )}
      </article>
    );
  }

  return (
    <article className="rounded border border-slate-300 bg-white transition hover:border-slate-500">
      <div
        role={oneWayMode ? 'button' : undefined}
        tabIndex={oneWayMode ? 0 : -1}
        onClick={oneWayMode ? onSelect : undefined}
        onKeyDown={oneWayMode ? (e) => e.key === 'Enter' && onSelect() : undefined}
        className={clsx('gap-2 px-2 py-2', oneWayMode ? 'grid grid-cols-[1fr_280px_100px]' : 'grid grid-cols-[48%_52%]')}
      >
        <div className="min-w-0">
          <div className="grid grid-cols-[120px_1fr_auto_1fr] items-center gap-1.5">
            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
              <div className={clsx('rounded px-1.5 py-1 text-[10px] font-bold', badgeClass(seg.airline))}>
                {(seg.airlineCode || seg.airline || 'XX').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-800">{seg.airline || 'Airline'}</div>
                <div className="text-[9px] text-slate-500">{seg.flightNumber || '-'}</div>
              </div>
            </div>

            <div>
              <div className="text-[20px] font-semibold leading-none text-slate-900">{fmtClock(seg.departureTime)}</div>
              <div className="text-[10px] leading-none text-slate-600">{seg.from}</div>
            </div>

            <div className="min-w-[88px] text-center">
              <div className="text-[9px] text-slate-600">{fmtDuration(seg.durationMinutes)}</div>
              <div className="my-1 h-px w-full bg-slate-300" />
              <div className="text-[9px] font-semibold text-orange-600">{stops ? `${stops} Stop` : 'Non Stop'}</div>
            </div>

            <div className="text-right">
              <div className="text-[20px] font-semibold leading-none text-slate-900">{fmtClock(seg.arrivalTime)}</div>
              <div className="text-[10px] leading-none text-slate-600">{seg.to}</div>
            </div>
          </div>

          {oneWayMode ? (
            <>
              <div className="mt-1.5 flex items-center justify-between text-[10px]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleDetail();
                  }}
                  className="font-semibold text-orange-600 hover:underline"
                >
                  View Details {expanded ? '-' : '+'}
                </button>
                {/* <span className="text-orange-600">Seats left: {seatsLeft}</span> */}
              </div>

              <div className="mt-1.5 flex items-center justify-between border-t border-slate-200 pt-1.5 text-[10px] text-slate-600">
                <div className="inline-flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {seg.checkInBaggage || '15kg'} / {seg.cabinBaggage || '7kg'}
                </div>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">Published</span>
              </div>
              {dayOffset ? <div className="mt-1 text-[10px] font-semibold text-slate-500"> {dayOffset}</div> : null}
            </>
          ) : (
            <div className="mt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDetail();
                }}
                className="rounded border border-[#dddddd] bg-[#f7f7f7] px-4 py-1.5 text-[14px] font-semibold text-[#ff6d2d] shadow-sm"
              >
                View Details {expanded ? '-' : '+'}
              </button>
              {dayOffset ? (
                <div className="mt-2 inline-flex items-center gap-2 text-[13px] text-slate-600">
                  <PlaneTakeoff className="h-4 w-4 text-orange-500" /> {dayOffset}
                </div>
              ) : null}
              {/* <div className="mt-1 text-[14px] font-semibold text-orange-600">Seats left: {seatsLeft}</div> */}
            </div>
          )}
        </div>

        {oneWayMode ? (
          <>
            <div className="border-l border-slate-300 pl-2">
              <ul className="space-y-1">
                {visibleFares.map((fare) => {
                  const isActive = selected && selectedFareIdFromColumn === fare.id;
                  return (
                    <li key={fare.id} className="border-b border-slate-200 pb-1 last:border-b-0 last:pb-0">
                      <label className="grid cursor-pointer grid-cols-[14px_1fr] items-start gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="radio"
                          className="mt-1 accent-orange-500"
                          name={`rt-fare-${fareGroupKey}`}
                          checked={isActive}
                          onChange={() => {
                            setLocalSelectedFareId(fare.id);
                            onSelect();
                            onFareSelect?.(fare);
                          }}
                        />
                        <span>
                          <span className="block text-[9px] text-slate-400">713208</span>
                          <span className="flex items-center gap-1">
                            <span className="text-[18px] font-semibold leading-none text-slate-800">{fmtINR(fare.amount)}</span>
                            <span className="text-[10px] text-blue-600">*</span>
                          </span>
                          <span className="mt-0.5 block">
                            <span className="inline-block bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">{fare.name}</span>
                            <span className="ml-1 text-[9px] text-slate-500">Economy, {flight.refundable ? 'Refundable' : 'Non-refundable'}</span>
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {hiddenFareCount > 0 && (
                <div className="mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full bg-slate-600 px-2.5 py-0.5 text-[9px] font-semibold text-white"
                  >
                    +{hiddenFareCount} more fare v
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col items-stretch gap-1 border-l border-slate-300 pl-2">
              <button
                type="button"
                onClick={handleBookClick}
                disabled={isBooking}
                className="rounded bg-orange-500 px-2 py-1.5 text-[12px] font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBooking ? (
                  <span className="inline-flex items-center gap-1">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Booking...
                  </span>
                ) : (
                  'BOOK'
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCompare();
                }}
                className={clsx(
                  'rounded border px-2 py-1 text-[10px] font-semibold',
                  compared ? 'border-slate-700 bg-slate-700 text-white' : 'border-orange-400 text-slate-700 hover:bg-orange-50',
                )}
              >
                Compare {compared ? '^' : 'v'}
              </button>
            </div>
          </>
        ) : (
          <div className="border-l border-slate-300 pl-2">
            {(() => {
              const selectedFare = fares.find((fare) => fare.id === selectedFareIdFromColumn);
              const shownFare = (selected && selectedFare) || fares[0];
              if (!shownFare) return null;
              return (
                <label
                  className="grid w-full cursor-pointer grid-cols-[14px_1fr] items-start gap-1 text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="radio"
                    name={`rt-fare-${fareGroupKey}`}
                    className="mt-1 accent-orange-500"
                    checked={selected && selectedFareIdFromColumn === shownFare.id}
                    onChange={() => {
                      onSelect();
                      setLocalSelectedFareId(shownFare.id);
                      onFareSelect?.(shownFare);
                    }}
                  />
                  <span>
                    <span className="block text-[8px] text-slate-400">713208</span>
                    <span className="flex items-center gap-1">
                      <span className="text-[15px] font-bold leading-none text-slate-800">{fmtINR(shownFare.amount)}</span>
                      <span className="text-[9px] text-blue-600">*</span>
                    </span>
                    <span className="mt-1 inline-block bg-amber-100 px-1 py-0.5 text-[8px] font-semibold text-amber-800">{shownFare.name}</span>
                    <span className="ml-1 text-[8px] text-slate-500">Economy, {flight.refundable ? 'Refundable' : 'Non-refundable'}</span>
                  </span>
                </label>
              );
            })()}
          </div>
        )}
      </div>

      {expanded && (
        <div className="mx-2 mb-2 border border-slate-300 bg-white">
          <div className="flex items-center justify-between border-b border-slate-300 px-3 py-2">
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <button type="button" onClick={() => setDetailTab('flight')} className={detailTab === 'flight' ? 'text-orange-600' : 'text-slate-600'}>Flight Details</button>
              <button type="button" onClick={() => setDetailTab('fare')} className={detailTab === 'fare' ? 'text-orange-600' : 'text-slate-600'}>Fare Details</button>
              <button type="button" onClick={() => setDetailTab('rules')} className={detailTab === 'rules' ? 'text-orange-600' : 'text-slate-600'}>Fare Rules</button>
            </div>
            <button type="button" onClick={onToggleDetail} className="text-lg leading-none text-slate-500">x</button>
          </div>

          {detailTab === 'flight' && <div className="px-3 py-2">
            <div className="mb-2 text-[12px] font-semibold text-slate-700">{seg.fromCity || seg.from} {'->'} {seg.toCity || seg.to} {fmtDate(seg.departureTime)}</div>

            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 border-b border-slate-200 pb-2 text-[11px]">
              <div className={clsx('rounded px-2 py-1 text-[10px] font-bold', badgeClass(seg.airline))}>{(seg.airlineCode || 'XX').slice(0, 2)}</div>
              <div>
                <div className="font-semibold text-slate-700">{seg.flightNumber}</div>
                <div className="text-slate-500">Economy</div>
              </div>
              <div className="text-slate-700">{fmtClock(seg.departureTime)}</div>
              <div className="text-slate-700">{fmtDuration(seg.durationMinutes)}</div>
              <div className="text-slate-700">{fmtClock(seg.arrivalTime)}</div>
            </div>

            <div className="pt-2 text-[11px]">
              <div className="mb-1 font-semibold text-slate-700">Baggage Information</div>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <div className="font-semibold">Check In</div>
                  <div>{seg.checkInBaggage || '15kg'}</div>
                </div>
                <div>
                  <div className="font-semibold">Cabin</div>
                  <div>{seg.cabinBaggage || '7kg'}</div>
                </div>
              </div>
            </div>
          </div>}

          {detailTab === 'fare' && (
            <div className="px-3 py-2 text-[11px] text-slate-700">
              <div className="mb-2 font-semibold">Fare Breakup</div>
              <div className="grid grid-cols-2 gap-y-1 border border-slate-200 p-2">
                <span>Base Fare</span><span className="text-right">{fmtINR(Number(flight.totalPriceINR || 0) * 0.72)}</span>
                <span>Taxes & Fees</span><span className="text-right">{fmtINR(Number(flight.totalPriceINR || 0) * 0.28)}</span>
                <span className="font-semibold">Total</span><span className="text-right font-semibold">{fmtINR(flight.totalPriceINR)}</span>
              </div>
            </div>
          )}

          {detailTab === 'rules' && <FareRulesPanel seg={seg} />}
        </div>
      )}
    </article>
  );
}

function FareRulesPanel({ seg }) {
  return (
    <div className="bg-[#f4f4f4] px-3 py-3 text-[11px] text-slate-700">
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-block border-b-2 border-orange-500 bg-white px-2 py-1 text-[22px] font-semibold text-slate-700">
          {seg.from}-{seg.to}
        </div>
        <button type="button" className="rounded bg-white px-3 py-1.5 text-[14px] font-semibold text-orange-600 shadow-sm">
          Detailed Rules
        </button>
      </div>

      <div className="mb-2 text-[14px] font-semibold text-rose-500">* To view charges, click on the below fee sections.</div>

      <table className="w-full border border-slate-300 text-left text-[11px]">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-100 px-2 py-1.5 text-center">
              <div className="font-semibold text-slate-700">Time Frame</div>
              <div className="text-[9px] text-slate-500">(From First Schedule Flight Departure)</div>
            </th>
            <th className="relative border border-slate-300 bg-white px-2 py-1.5 text-center text-orange-500">
              <div className="font-semibold">Cancellation Fee</div>
              <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-orange-500" />
            </th>
            <th className="border border-slate-300 bg-slate-100 px-2 py-1.5 text-center">
              <div className="font-semibold text-slate-700">Date Change Fee</div>
            </th>
            <th className="border border-slate-300 bg-slate-100 px-2 py-1.5 text-center">
              <div className="font-semibold text-slate-700">No Show Fee</div>
              <div className="text-[9px] text-slate-500">( Post Departure )</div>
            </th>
            <th className="border border-slate-300 bg-slate-100 px-2 py-1.5 text-center">
              <div className="font-semibold text-slate-700">Seat Chargeable Fee</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 px-2 py-2">4 hrs to 365 days</td>
            <td className="border border-slate-300 px-2 py-2 text-slate-700">
              <div>Refundable subject to cancellation penalty</div>
              <div className="mt-1">Please Note: Fare rules are subject to change without any notice</div>
            </td>
            <td className="border border-slate-300 px-2 py-2 text-slate-500">-</td>
            <td className="border border-slate-300 px-2 py-2 text-slate-500">-</td>
            <td className="border border-slate-300 px-2 py-2 text-slate-500">-</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 space-y-2 text-[14px] font-semibold text-rose-500">
        <div>The airline fee is indicative, which will depend upon the time of cancellation / re-issue as per the airline fare rules.</div>
        <div>Mentioned fees are Per Pax Per Sector</div>
        <div>Apart from airline charges, GST + RAF + applicable charges if any, will be charged.</div>
        <div>For more clarity, Please check Detailed Rules</div>
      </div>
    </div>
  );
}




