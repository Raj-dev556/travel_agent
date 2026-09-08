import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Heart,
  List,
  Loader2,
  MapPin,
  Search,
  Star,
} from 'lucide-react';
import clsx from 'clsx';
import {
  addDays as addDateDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  CityDropdownField,
  HOTEL_SEARCH_NATIONALITIES,
  HOTEL_SEARCH_RATING_OPTIONS,
  OptionDropdown,
  RoomsGuestsDropdown,
} from '../../components/hotels/SearchBarControls';
import {
  isValidListingDestinationId,
  resolveDestinationFromCityName,
} from './hotelCityAutocomplete';
import {
  hasValidListingDestination,
  hasValidationErrors,
  SearchFieldError,
  validateHotelSearchFields,
} from '../../components/hotels/hotelSearchValidation';
import HotelListingMapModal from '../../components/hotels/HotelListingMapModal';
import { geocodeCityCenter, resolveHotelMapPoints } from '../../components/hotels/hotelMapCoords';
import { collectHotelCoordinates } from '../../components/hotels/parseHotelCoordinates';
import { saveHotelRecentSearch } from './hotelUserHistory';
import api from '../../api';

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const fmtCount = (n) => new Intl.NumberFormat('en-IN').format(n || 0);

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'priceLow', label: 'Price ( Lowest first )' },
  { value: 'priceHigh', label: 'Price ( Highest first )' },
  { value: 'rating', label: 'Star rating ( High to Low )' },
];
const FAVOURITES_STORAGE_KEY = 'hotel_result_favourites_v1';

const HOTEL_IMAGE_POOL = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1501117716987-c8e1ecb2108f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1468824357306-a439d58ccb1c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80',
];

const FALLBACK_GALLERIES = [
  makeFallbackGallery(0, 9),
  makeFallbackGallery(2, 10),
  makeFallbackGallery(4, 10),
  makeFallbackGallery(6, 10),
  makeFallbackGallery(8, 9),
  makeFallbackGallery(10, 10),
];


const BACKEND_API_KEY = import.meta.env.VITE_BACKEND_API_KEY || '';

function getHotelSortOrder(sortBy) {
  return {
    priceLow: 'price_low_to_high',
    priceHigh: 'price_high_to_low',
    rating: 'star_high_to_low',
  }[sortBy];
}

function buildFilterRequestBody(payload, appliedFilters, sortBy, pagination) {
  const sortOrder = getHotelSortOrder(sortBy);
  return {
    searchQuery: payload,
    appliedFilters,
    filterType: 'BOTH',
    ...(sortOrder ? { sortOrder } : {}),
    pagination,
  };
}

const HOTEL_PAGE_SIZE = 10;
const MAX_MAP_HOTELS = 40;

function normalizeFilterToken(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeSearchText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeRegionToken(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

function priceMatchesRange(price, rangeValue) {
  const [minRaw, maxRaw] = String(rangeValue || '').split('$');
  const min = Number(minRaw || 0);
  const max = maxRaw === '' || maxRaw == null ? Number.POSITIVE_INFINITY : Number(maxRaw);
  const amount = Number(price || 0);
  if (!Number.isFinite(amount)) return false;
  return amount >= min && amount <= max;
}

function matchesAppliedFilters(hotel, filters = {}) {
  if (filters.hotelName) {
    const needle = String(filters.hotelName).trim().toLowerCase();
    if (needle && !String(hotel.name || '').toLowerCase().includes(needle)) return false;
  }

  if (Array.isArray(filters.popularPlace) && filters.popularPlace.length) {
    const region = normalizeRegionToken(hotel.regionName || hotel.region || hotel.area);
    const allowed = filters.popularPlace.map(normalizeRegionToken);
    if (!allowed.some((value) => region === value || region.includes(value) || value.includes(region))) return false;
  }

  if (Array.isArray(filters.propertyTypes) && filters.propertyTypes.length) {
    const propertyType = String(hotel.propertyType || '');
    if (!filters.propertyTypes.includes(propertyType)) return false;
  }

  if (Array.isArray(filters.ratings) && filters.ratings.length) {
    if (!filters.ratings.includes(String(hotel.starRating))) return false;
  }

  if (Array.isArray(filters.mealType) && filters.mealType.length) {
    const meal = normalizeFilterToken(hotel.mealBasis);
    const allowed = filters.mealType.map(normalizeFilterToken);
    if (!allowed.some((value) => meal.includes(value) || value.includes(meal))) return false;
  }

  if (Array.isArray(filters.priceRange) && filters.priceRange.length) {
    const price = Number(hotel.totalRateINR || hotel.nightlyRateINR || 0);
    if (!filters.priceRange.some((rangeValue) => priceMatchesRange(price, rangeValue))) return false;
  }

  return true;
}

function hasAppliedListingFilters(filters = {}) {
  return Object.keys(filters).length > 0;
}

function paginationIsDone(nextPage, rows, total, pageSize = HOTEL_PAGE_SIZE, scanComplete = false) {
  if (rows.length === 0) return true;
  if (!scanComplete) return rows.length < pageSize;
  if (total > 0) return nextPage * pageSize >= total;
  return rows.length < pageSize;
}

function resolveTotalPages(total, nextPage, rows, pageSize = HOTEL_PAGE_SIZE) {
  if (total > 0) return Math.ceil(total / pageSize);
  return rows.length < pageSize ? nextPage : nextPage + 1;
}

const inFlightListingSessionKeys = new Set();
const inFlightFilterSessionKeys = new Set();

function coerceFilterMeta(filters) {
  if (!filters) return null;
  if (!Array.isArray(filters)) return filters;

  const keyMap = {
    'Property Type': 'propertyType',
    'Popular Places': 'popularPlaces',
    Rating: 'starCategory',
    'Meal Basis': 'mealBasis',
    'Price Range': 'priceRange',
  };

  const meta = {};
  for (const section of filters) {
    const key = keyMap[section?.name];
    if (!key) continue;
    meta[key] = (section.options || []).map((opt) => ({
      value: opt.value,
      label: opt.label,
      count: opt.count,
      min: opt.minPrice ?? opt.min,
      max: opt.maxPrice ?? opt.max,
      state: opt.state,
    }));
  }
  return meta;
}

function usePaginatedHotels(payload, enabled, refreshKey = '0', appliedFilters = {}, sortBy = 'popular') {
  const [cachedHotels, setCachedHotels] = useState([]);
  const [filterMeta, setFilterMeta] = useState(null);
  const [filterMetaFetchKey, setFilterMetaFetchKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState(null);
  const [hotelsFetchKey, setHotelsFetchKey] = useState('');
  const [totalResults, setTotalResults] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [liveHotelCount, setLiveHotelCount] = useState(0);
  const inFlightRef = useRef(false);
  const fetchGenRef = useRef(0);
  const fetchPageRef = useRef(null);
  const lastSearchSessionKeyRef = useRef('');
  const totalResultsRef = useRef(0);
  const filteredTargetRef = useRef(0);
  const unfilteredTotalRef = useRef(0);
  const cachedHotelsCountRef = useRef(0);
  const scanCompleteRef = useRef(false);
  const requestedListingPagesRef = useRef(new Set());
  const payloadKey = JSON.stringify(payload);
  const appliedFiltersKey = JSON.stringify(appliedFilters);
  const searchSessionKey = `${payloadKey}|${refreshKey}`;
  const fetchKey = `${searchSessionKey}|${appliedFiltersKey}|${sortBy}`;

  const mergeRows = useCallback((rows, reset = false) => {
    setCachedHotels((prev) => {
      const next = reset
        ? rows
        : (() => {
          const seen = new Set(prev.map((h) => String(h.id || h.hotelId)));
          const nextRows = rows.filter((h) => {
            const key = String(h.id || h.hotelId);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return [...prev, ...nextRows];
        })();

      cachedHotelsCountRef.current = next.length;
      return next;
    });
  }, []);

  const fetchPageData = useCallback(async (nextPage) => {
    const headers = { 'Content-Type': 'application/json' };
    if (BACKEND_API_KEY) headers.apikey = BACKEND_API_KEY;
    const sortOrder = getHotelSortOrder(sortBy);

    const res = await api.post('/hotels/listing', {
        ...payload,
        appliedFilters,
        ...(sortOrder ? { sortOrder } : {}),
        pagination: { page: nextPage, limit: HOTEL_PAGE_SIZE },
      }, { headers });

    const data = res.data;
    const rows = normalizeHotels(hotelRowsFromResponse(data));
    const total = listingTotalFromResponse(data, 0);
    const totalPages = resolveTotalPages(total, nextPage, rows);
    const hasKnownPagination = Number(data?.pagination?.totalPages || totalPages || 0) > 0 || total > 0;
    return { rows, total, totalPages, raw: data, scanComplete: data.scanComplete === true || hasKnownPagination };
  }, [payloadKey, appliedFiltersKey, sortBy]);

  const fetchFilterMetadata = useCallback(async (gen, filterApplied = {}) => {
    if (!payload?.cityRegionId && !payload?.tjHotelId) return null;

    const headers = { 'Content-Type': 'application/json' };
    if (BACKEND_API_KEY) headers.apikey = BACKEND_API_KEY;

    const res = await api.post(
      '/hotels/listing/filter',
      buildFilterRequestBody(payload, filterApplied, sortBy, { page: 1, limit: HOTEL_PAGE_SIZE }),
      { headers },
    );

    const data = res.data;
    if (fetchGenRef.current !== gen) return null;
    if (lastSearchSessionKeyRef.current !== searchSessionKey) return null;

    setFilterMeta(coerceFilterMeta(data.filters));
    setFilterMetaFetchKey(searchSessionKey);
    scanCompleteRef.current = true;
    setScanComplete(true);

    const filtersActive = hasAppliedListingFilters(filterApplied);
    const live = Number(data.availableHotelCount ?? data.hotelCount ?? listingTotalFromResponse(data, 0));
    if (live > 0) {
      if (filtersActive) {
        filteredTargetRef.current = live;
        totalResultsRef.current = live;
        setTotalResults(live);
        setLiveHotelCount(live);
      } else {
        filteredTargetRef.current = 0;
        setLiveHotelCount((prev) => Math.max(prev, live));
        if (live > totalResultsRef.current) {
          totalResultsRef.current = live;
          setTotalResults(live);
        }
      }
    }

    return data;
  }, [payloadKey, sortBy, searchSessionKey]);

  const fetchPage = useCallback(async (nextPage, reset = false, gen) => {
    if (!enabled) return;
    if (inFlightRef.current) return;
    if (!reset && requestedListingPagesRef.current.has(nextPage)) return;

    requestedListingPagesRef.current.add(nextPage);
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchPageData(nextPage);
      if (fetchGenRef.current !== gen) return;

      const resolvedTotal = listingTotalFromResponse(data.raw, 0);
      if (resolvedTotal > 0) {
        unfilteredTotalRef.current = resolvedTotal;
      }

      const filtersActive = hasAppliedListingFilters(appliedFilters);
      const rowsToMerge = data.rows;

      mergeRows(rowsToMerge, reset);
      setHotelsFetchKey(fetchKey);

      if (filtersActive) {
        const target = filteredTargetRef.current || resolvedTotal;
        if (target > 0) {
          filteredTargetRef.current = target;
          totalResultsRef.current = target;
          setTotalResults(target);
          setLiveHotelCount(target);
        }
      } else if (resolvedTotal > 0 || reset) {
        totalResultsRef.current = resolvedTotal;
        setTotalResults(resolvedTotal);
        setLiveHotelCount(resolvedTotal);
      }
      if (data.raw?.scanComplete) {
        scanCompleteRef.current = true;
        setScanComplete(true);
      }

      if (filtersActive) {
        const target = filteredTargetRef.current || resolvedTotal;
        const unfilteredTotal = unfilteredTotalRef.current;
        const fetchedAllUnfiltered = scanCompleteRef.current
          && (unfilteredTotal > 0
            ? nextPage * HOTEL_PAGE_SIZE >= unfilteredTotal
            : data.rows.length < HOTEL_PAGE_SIZE);
        const mergedCount = cachedHotelsCountRef.current;
        setIsDone(
          (target > 0 && mergedCount >= target)
          || fetchedAllUnfiltered,
        );
      } else {
        setIsDone(paginationIsDone(
          nextPage,
          data.rows,
          totalResultsRef.current,
          HOTEL_PAGE_SIZE,
          scanCompleteRef.current,
        ));
      }
    } catch (err) {
      requestedListingPagesRef.current.delete(nextPage);
      if (fetchGenRef.current === gen) {
        setError(err.message || 'Failed to fetch hotels');
        setIsDone(true);
      }
    } finally {
      if (fetchGenRef.current === gen) {
        inFlightRef.current = false;
        setIsLoading(false);
      }
    }
  }, [enabled, fetchPageData, mergeRows, fetchKey, appliedFilters]);

  fetchPageRef.current = fetchPage;

  useEffect(() => {
    if (!enabled) return undefined;

    const isNewSearch = lastSearchSessionKeyRef.current !== searchSessionKey;
    if (isNewSearch) {
      inFlightListingSessionKeys.clear();
      inFlightFilterSessionKeys.clear();
    }

    if (inFlightListingSessionKeys.has(fetchKey)) return undefined;
    inFlightListingSessionKeys.add(fetchKey);

    if (isNewSearch) {
      lastSearchSessionKeyRef.current = searchSessionKey;
    }

    const sessionKey = fetchKey;
    const gen = ++fetchGenRef.current;

    inFlightRef.current = false;
    requestedListingPagesRef.current = new Set();
    setCachedHotels([]);
    cachedHotelsCountRef.current = 0;
    setHotelsFetchKey('');
    setTotalResults(0);
    totalResultsRef.current = 0;
    filteredTargetRef.current = 0;
    unfilteredTotalRef.current = 0;
    scanCompleteRef.current = false;
    setScanComplete(false);
    setLiveHotelCount(0);
    setIsDone(false);
    setError(null);

    if (isNewSearch) {
      setFilterMeta(null);
      setFilterMetaFetchKey('');
    }

    void (async () => {
      try {
        const canFetchFilterMeta = payload?.cityRegionId || payload?.tjHotelId;
        const filterSessionKey = searchSessionKey;

        const listingPromise = fetchPageRef.current?.(1, true, gen);

        if (
          canFetchFilterMeta
          && filterMetaFetchKey !== searchSessionKey
          && !inFlightFilterSessionKeys.has(filterSessionKey)
        ) {
          inFlightFilterSessionKeys.add(filterSessionKey);
          void fetchFilterMetadata(gen, {})
            .catch((err) => {
              console.warn('Hotel filter metadata request failed', err);
            })
            .finally(() => {
              inFlightFilterSessionKeys.delete(filterSessionKey);
            });
        }

        await listingPromise;
      } finally {
        inFlightListingSessionKeys.delete(sessionKey);
      }
    })();

    return undefined;
  }, [fetchKey, searchSessionKey, enabled, fetchFilterMetadata]);

  const loadMore = useCallback(() => {
    const filtersActive = hasAppliedListingFilters(appliedFilters);
    const resolvedTotal = totalResultsRef.current || totalResults;
    const unfilteredTotal = unfilteredTotalRef.current;

    if (filtersActive) {
      const target = filteredTargetRef.current;
      if (target > 0 && cachedHotels.length >= target) return;
      if (scanComplete && unfilteredTotal > 0) {
        const lastFetchedPage = requestedListingPagesRef.current.size > 0
          ? Math.max(...requestedListingPagesRef.current)
          : 0;
        if (lastFetchedPage * HOTEL_PAGE_SIZE >= unfilteredTotal) return;
      }
    } else if (scanComplete && resolvedTotal > 0 && cachedHotels.length >= resolvedTotal) {
      return;
    }

    if (isLoading || inFlightRef.current) return;
    if (isDone) return;

    const lastFetchedPage = requestedListingPagesRef.current.size > 0
      ? Math.max(...requestedListingPagesRef.current)
      : 0;
    const nextPage = lastFetchedPage + 1;
    fetchPageRef.current?.(nextPage, false, fetchGenRef.current);
  }, [appliedFilters, isLoading, isDone, totalResults, cachedHotels.length, scanComplete]);

  const liveHotels = hotelsFetchKey === fetchKey ? cachedHotels : [];
  const filtersReady = filterMetaFetchKey === searchSessionKey && Boolean(filterMeta);
  const filterCountsLoading = !filtersReady;

  useEffect(() => {
    if (!scanComplete) return;
    const total = totalResultsRef.current || totalResults;
    if (total <= 0) return;

    const filtersActive = hasAppliedListingFilters(appliedFilters);
    if (filtersActive) {
      const unfilteredTotal = unfilteredTotalRef.current;
      const lastFetchedPage = requestedListingPagesRef.current.size > 0
        ? Math.max(...requestedListingPagesRef.current)
        : 0;
      const fetchedAllUnfiltered = unfilteredTotal > 0
        && lastFetchedPage * HOTEL_PAGE_SIZE >= unfilteredTotal;
      setIsDone(cachedHotels.length >= total || fetchedAllUnfiltered);
      return;
    }

    setIsDone(cachedHotels.length >= total);
  }, [scanComplete, totalResults, cachedHotels.length, appliedFilters]);

  return {
    cachedHotels: liveHotels,
    filterMeta,
    filtersReady,
    filterCountsLoading,
    scanComplete,
    liveHotelCount,
    totalResults,
    isLoading,
    isDone,
    error,
    loadMore,
    isRefreshing: isLoading && hotelsFetchKey !== fetchKey,
  };
}

export default function HotelResults() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => ({
    city: params.get('city') || 'Mumbai',
    cityRegionId: params.get('cityRegionId') || params.get('cityCode') || '',
    countryCode: params.get('countryCode') || 'IN',
    destinationType: params.get('destinationType') || 'CITY',
    hotelId: params.get('hotelId') || '',
    checkin: params.get('checkin') || new Date().toISOString().slice(0, 10),
    checkout: params.get('checkout') || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    minStar: Number(params.get('minStar') || 3),
    residence: params.get('residence') || '',
    nationality: params.get('nationality') || '',
    gst: params.get('gst') === '1',
    rooms: safeParseRooms(params.get('rooms')),
    searchRequestId: params.get('searchRequestId') || '',
  }), [params]);

  const [cityInput, setCityInput] = useState(query.city);
  const [cityRegionIdInput, setCityRegionIdInput] = useState(query.cityRegionId);
  const [destinationTypeInput, setDestinationTypeInput] = useState(query.destinationType);
  const [hotelIdInput, setHotelIdInput] = useState(query.hotelId);
  const [checkinInput, setCheckinInput] = useState(query.checkin);
  const [checkoutInput, setCheckoutInput] = useState(query.checkout);
  const [roomsInput, setRoomsInput] = useState(query.rooms);
  const [minStarInput, setMinStarInput] = useState(String(query.minStar || 0));
  const [residenceInput, setResidenceInput] = useState(query.residence);
  const [nationalityInput, setNationalityInput] = useState(query.nationality || '');
  const residenceOptions = HOTEL_SEARCH_NATIONALITIES;
  const nationalityOptions = HOTEL_SEARCH_NATIONALITIES;
  const [gstInput, setGstInput] = useState(Boolean(query.gst));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(parseISO(query.checkin)));
  const [draftStart, setDraftStart] = useState(() => parseISO(query.checkin));
  const [draftEnd, setDraftEnd] = useState(() => parseISO(query.checkout));

  const [hotelNameFilter, setHotelNameFilter] = useState('');
  const [selectedPrice, setSelectedPrice] = useState([]);
  const [selectedStars, setSelectedStars] = useState([]);
  const [selectedMeals, setSelectedMeals] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [sortBy, setSortBy] = useState('popular');
  const [view, setView] = useState('grid');
  const [sortOpen, setSortOpen] = useState(false);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [showSearchMoreOptions, setShowSearchMoreOptions] = useState(false);
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [favouriteHotelIds, setFavouriteHotelIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(FAVOURITES_STORAGE_KEY);
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) return parsed.map((id) => String(id));
    } catch {
      // Use empty favourites when storage payload is malformed.
    }
    return [];
  });
  const [debouncedHotelName, setDebouncedHotelName] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [mapHotels, setMapHotels] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapCityCenter, setMapCityCenter] = useState(null);
  const sortMenuRef = useRef(null);
  const listingScrollRef = useRef(null);
  const lastWindowScrollYRef = useRef(0);
  const mapAutoOpenedRef = useRef('');

  const hasValidDestination = useMemo(() => {
    if (String(query.destinationType || '').toUpperCase() === 'HOTEL') {
      return isValidListingDestinationId(query.hotelId);
    }
    return isValidListingDestinationId(query.cityRegionId);
  }, [query.destinationType, query.hotelId, query.cityRegionId]);

  const [resolvingDestination, setResolvingDestination] = useState(false);
  const [destinationError, setDestinationError] = useState('');
  const [searchFieldErrors, setSearchFieldErrors] = useState({});

  const streamPayload = useMemo(() => buildHotelListingPayload(query), [query]);
  const searchRefreshKey = query.searchRequestId || '0';
  const listingEnabled = hasValidDestination && !resolvingDestination;

  useEffect(() => {
    setCityInput(query.city);
    setCityRegionIdInput(query.cityRegionId);
    setDestinationTypeInput(query.destinationType);
    setHotelIdInput(query.hotelId);
    setCheckinInput(query.checkin);
    setCheckoutInput(query.checkout);
    setRoomsInput(query.rooms);
    setMinStarInput(String(query.minStar || 0));
    setResidenceInput(query.residence);
    setNationalityInput(query.nationality || '');
    setGstInput(Boolean(query.gst));
    resetFilterSelections();
  }, [
    query.city,
    query.cityRegionId,
    query.destinationType,
    query.hotelId,
    query.checkin,
    query.checkout,
    query.minStar,
    query.residence,
    query.nationality,
    query.gst,
    query.searchRequestId,
    JSON.stringify(query.rooms),
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedHotelName(hotelNameFilter.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [hotelNameFilter]);

  const appliedFilters = useMemo(() => {
    const next = {};
    if (debouncedHotelName) next.hotelName = debouncedHotelName;
    if (selectedPrice.length) next.priceRange = selectedPrice;
    if (selectedStars.length) next.ratings = selectedStars.map(String);
    if (selectedMeals.length) next.mealType = selectedMeals;
    if (selectedTypes.length) next.propertyTypes = selectedTypes;
    if (selectedAreas.length) next.popularPlace = selectedAreas;
    return next;
  }, [debouncedHotelName, selectedPrice, selectedStars, selectedMeals, selectedTypes, selectedAreas]);

  const hasBackendFilters = useMemo(
    () => Object.keys(appliedFilters).length > 0,
    [appliedFilters],
  );

  const {
    cachedHotels,
    filterMeta,
    filtersReady,
    filterCountsLoading,
    scanComplete,
    liveHotelCount,
    totalResults,
    isLoading,
    isDone,
    error,
    loadMore,
    isRefreshing,
  } = usePaginatedHotels(streamPayload, listingEnabled, searchRefreshKey, appliedFilters, sortBy);

  useEffect(() => {
    setDestinationError('');
    if (hasValidDestination) {
      setResolvingDestination(false);
      return undefined;
    }

    const city = String(query.city || '').trim();
    if (city.length < 2) {
      setDestinationError('Please select a city from the suggestions list.');
      return undefined;
    }

    let cancelled = false;
    setResolvingDestination(true);

    resolveDestinationFromCityName(city)
      .then((resolved) => {
        if (cancelled) return;

        if (!resolved) {
          setDestinationError('Could not find this city. Please pick one from the suggestions list.');
          return;
        }

        const isHotel = resolved.type === 'HOTEL' || resolved.regionType === 'HOTEL';
        const cityRegionId = resolved.cityRegionId ? String(resolved.cityRegionId) : '';
        const hotelId = resolved.hotelId ? String(resolved.hotelId) : '';

        if (isHotel && isValidListingDestinationId(hotelId)) {
          setCityRegionIdInput('');
          setHotelIdInput(hotelId);
          setDestinationTypeInput('HOTEL');
          setParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('destinationType', 'HOTEL');
            next.set('hotelId', hotelId);
            next.delete('cityRegionId');
            next.delete('cityCode');
            return next;
          }, { replace: true });
          return;
        }

        if (isValidListingDestinationId(cityRegionId)) {
          setCityRegionIdInput(cityRegionId);
          setHotelIdInput('');
          setDestinationTypeInput('CITY');
          setParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('destinationType', 'CITY');
            next.set('cityRegionId', cityRegionId);
            next.delete('cityCode');
            next.delete('hotelId');
            return next;
          }, { replace: true });
          return;
        }

        setDestinationError('Could not find this city. Please pick one from the suggestions list.');
      })
      .catch(() => {
        if (!cancelled) {
          setDestinationError('Could not resolve this city. Please pick one from the suggestions list.');
        }
      })
      .finally(() => {
        if (!cancelled) setResolvingDestination(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasValidDestination, query.city, setParams]);

  useEffect(() => {
    listingScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [streamPayload, searchRefreshKey, appliedFilters, sortBy]);

  useEffect(() => {
    const nextStart = parseISO(checkinInput);
    const nextEnd = parseISO(checkoutInput);
    if (isValidDate(nextStart)) setDraftStart(nextStart);
    if (isValidDate(nextEnd)) setDraftEnd(nextEnd);
  }, [checkinInput, checkoutInput]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!sortMenuRef.current) return;
      if (!sortMenuRef.current.contains(event.target)) {
        setSortOpen(false);
      }
    }

    if (sortOpen) {
      document.addEventListener('mousedown', onPointerDown);
    }
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [sortOpen]);

  const isSearchPending = resolvingDestination || isRefreshing || (cachedHotels.length === 0 && isLoading);
  const displayError = destinationError || error;
  const showFiltersPanel = !!(streamPayload.cityRegionId || streamPayload.tjHotelId);
  const showResultsPanel = !isSearchPending && cachedHotels.length > 0;
  const responseFilters = filterMeta || {};
  const showFilterSections = filtersReady && Boolean(filterMeta);

  const priceBuckets = useMemo(() => {
    if (!showFilterSections) return [];
    return normalizePriceBuckets(responseFilters.priceRange);
  }, [showFilterSections, responseFilters.priceRange]);

  const mealBuckets = useMemo(
    () => normalizeFilterBuckets(responseFilters.mealBasis).slice(0, 8),
    [responseFilters.mealBasis],
  );

  const typeBuckets = useMemo(
    () => normalizeFilterBuckets(responseFilters.propertyType),
    [responseFilters.propertyType],
  );

  const areaBuckets = useMemo(
    () => normalizeFilterBuckets(responseFilters.popularPlaces),
    [responseFilters.popularPlaces],
  );

  const starBuckets = useMemo(
    () => normalizeStarBuckets(responseFilters.starCategory),
    [responseFilters.starCategory],
  );

  const visibleTypeBuckets = useMemo(
    () => (showAllTypes ? typeBuckets : typeBuckets.slice(0, 6)),
    [showAllTypes, typeBuckets],
  );

  const visibleAreaBuckets = useMemo(
    () => (showAllAreas ? areaBuckets : areaBuckets.slice(0, 8)),
    [showAllAreas, areaBuckets],
  );

  const unpagedDisplayedHotels = useMemo(() => {
    let list = [...cachedHotels];

    if (!hasBackendFilters && hotelNameFilter.trim()) {
      const needle = hotelNameFilter.trim().toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(needle));
    }

    return list;
  }, [cachedHotels, hasBackendFilters, hotelNameFilter, appliedFilters]);

  const favouriteIdSet = useMemo(
    () => new Set(favouriteHotelIds.map((id) => String(id))),
    [favouriteHotelIds],
  );

  const displayedHotels = useMemo(() => (
    showFavouritesOnly
      ? unpagedDisplayedHotels.filter((hotel) => favouriteIdSet.has(String(hotel.id)))
      : unpagedDisplayedHotels
  ), [showFavouritesOnly, unpagedDisplayedHotels, favouriteIdSet]);

  const loadedHotelCount = hasBackendFilters ? unpagedDisplayedHotels.length : cachedHotels.length;

  const totalHotelCount = useMemo(() => {
    if (isRefreshing) return 0;
    if (showFavouritesOnly) return unpagedDisplayedHotels.length;
    if (hasBackendFilters) return totalResults > 0 ? totalResults : 0;
    if (liveHotelCount > 0 || totalResults > 0) {
      return liveHotelCount > 0 ? liveHotelCount : totalResults;
    }
    return 0;
  }, [
    showFavouritesOnly,
    unpagedDisplayedHotels.length,
    isRefreshing,
    hasBackendFilters,
    liveHotelCount,
    totalResults,
  ]);
  const showTotalInHeader = !showFavouritesOnly && totalHotelCount > 0;
  const visibleHotelCount = displayedHotels.length;
  const hasMoreVisibleHotels = !isDone && (
    hasBackendFilters
      ? loadedHotelCount < totalHotelCount
      : (!scanComplete || loadedHotelCount < totalHotelCount)
  );

  const isHotelSearch = String(query.destinationType || '').toUpperCase() === 'HOTEL';
  const mapFocusHotelId = isHotelSearch ? String(query.hotelId || '') : '';
  const mapLoadKey = `${searchRefreshKey}|${query.cityRegionId}|${query.hotelId}|${query.destinationType}`;
  const mapSessionKey = `${mapLoadKey}|${displayedHotels.length}`;
  const mapSnapshotRef = useRef([]);
  const mapResolveKeyRef = useRef('');
  const displayedHotelsRef = useRef(displayedHotels);
  const unpagedDisplayedHotelsRef = useRef(unpagedDisplayedHotels);
  displayedHotelsRef.current = displayedHotels;
  unpagedDisplayedHotelsRef.current = unpagedDisplayedHotels;

  useEffect(() => {
    if (!mapOpen) {
      mapResolveKeyRef.current = '';
      mapSnapshotRef.current = [];
      return undefined;
    }

    const snapshot = (
      isHotelSearch ? displayedHotelsRef.current : unpagedDisplayedHotelsRef.current
    ).slice(0, MAX_MAP_HOTELS);
    const snapshotKey = `${mapLoadKey}|${snapshot.map((hotel) => String(hotel.hotelId || hotel.id || '')).join('|')}`;

    if (mapResolveKeyRef.current === snapshotKey) return undefined;
    mapResolveKeyRef.current = snapshotKey;
    mapSnapshotRef.current = snapshot;

    let cancelled = false;
    setMapHotels([]);
    setMapLoading(true);

    (async () => {
      try {
        const cityCenter = await geocodeCityCenter(query.city, query.countryCode);
        if (!cancelled) setMapCityCenter(cityCenter);
      } catch {
        if (!cancelled) setMapCityCenter(null);
      }

      try {
        const points = await resolveHotelMapPoints(snapshot);
        if (!cancelled) setMapHotels(points);
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapOpen, mapLoadKey, query.city, query.countryCode, isHotelSearch]);

  useEffect(() => {
    if (!isHotelSearch || isSearchPending || displayedHotels.length === 0) return;
    if (mapAutoOpenedRef.current === mapSessionKey) return;
    mapAutoOpenedRef.current = mapSessionKey;
    setMapOpen(true);
  }, [isHotelSearch, isSearchPending, displayedHotels.length, mapSessionKey]);

  const mapSnapshotCount = mapHotels.length || mapSnapshotRef.current.length;
  const mapTitle = isHotelSearch
    ? (displayedHotels[0]?.name || query.city || 'Hotel location')
    : `Hotels in ${query.city || 'this city'}`;
  const mapSubtitle = isHotelSearch
    ? (displayedHotels[0]?.address || query.city || '')
    : `${mapSnapshotCount} hotel location${mapSnapshotCount === 1 ? '' : 's'} on map`;

  useEffect(() => {
    const listEl = listingScrollRef.current;
    let ticking = false;
    lastWindowScrollYRef.current = window.scrollY || 0;

    const loadNext = () => {
      if (isSearchPending) return;
      if (!isLoading && !isDone) loadMore();
    };

    const onListScroll = () => {
      if (!listEl) return;
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 80;
        if (nearBottom) loadNext();
        ticking = false;
      });
    };

    const onWindowScroll = () => {
      const currentY = window.scrollY || 0;
      const isDownwardUserScroll = currentY > lastWindowScrollYRef.current + 12;
      lastWindowScrollYRef.current = currentY;
      if (!isDownwardUserScroll || ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
        if (nearBottom) loadNext();
        ticking = false;
      });
    };

    listEl?.addEventListener('scroll', onListScroll, { passive: true });
    window.addEventListener('scroll', onWindowScroll, { passive: true });

    return () => {
      listEl?.removeEventListener('scroll', onListScroll);
      window.removeEventListener('scroll', onWindowScroll);
    };
  }, [isLoading, isDone, isSearchPending, loadMore]);
  const inputNights = useMemo(() => nightCount(checkinInput, checkoutInput), [checkinInput, checkoutInput]);

  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Most Popular';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(favouriteHotelIds));
    } catch {
      // Ignore storage write issues in restricted environments.
    }
  }, [favouriteHotelIds]);

  function toggleFavouriteHotel(hotelId) {
    const key = String(hotelId);
    setFavouriteHotelIds((prev) => (
      prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key]
    ));
  }

  function openCalendar() {
    const start = parseISO(checkinInput);
    const end = parseISO(checkoutInput);
    const safeStart = isValidDate(start) ? start : new Date();
    const safeEnd = isValidDate(end) ? end : addDateDays(safeStart, 1);
    setDraftStart(safeStart);
    setDraftEnd(safeEnd);
    setCalendarMonth(startOfMonth(safeStart));
    setCalendarOpen(true);
  }

  function onCalendarDateSelect(day) {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }

    if (isBefore(day, draftStart)) {
      setDraftStart(day);
      return;
    }

    if (isSameDay(day, draftStart)) {
      setDraftEnd(addDateDays(day, 1));
      return;
    }

    setDraftEnd(day);
  }

  function applyCalendar() {
    if (!draftStart || !isValidDate(draftStart)) return;
    const endDate = draftEnd && isAfter(draftEnd, draftStart) ? draftEnd : addDateDays(draftStart, 1);
    setCheckinInput(format(draftStart, 'yyyy-MM-dd'));
    setCheckoutInput(format(endDate, 'yyyy-MM-dd'));
    setSearchFieldErrors((prev) => ({ ...prev, checkin: '', checkout: '' }));
    setCalendarOpen(false);
  }

  function resetFilterSelections() {
    setHotelNameFilter('');
    setSelectedPrice([]);
    setSelectedStars([]);
    setSelectedMeals([]);
    setSelectedTypes([]);
    setSelectedAreas([]);
    setShowAllTypes(false);
    setShowAllAreas(false);
  }

  async function triggerSearch() {
    resetFilterSelections();
    const cityChangedFromQuery = normalizeSearchText(cityInput) !== normalizeSearchText(query.city);
    const fallbackCityRegionId = cityChangedFromQuery ? '' : (query.cityRegionId || params.get('cityCode') || '');
    const fallbackHotelId = cityChangedFromQuery ? '' : (query.hotelId || '');
    const hasPickedDestination =
      isValidListingDestinationId(cityRegionIdInput) || isValidListingDestinationId(hotelIdInput);
    const selectedDestinationType = hasPickedDestination
      ? destinationTypeInput
      : (cityChangedFromQuery ? 'CITY' : (destinationTypeInput || query.destinationType));

    const destinationContext = {
      destinationType: selectedDestinationType,
      cityRegionId: cityRegionIdInput || fallbackCityRegionId,
      hotelId: hotelIdInput || fallbackHotelId,
    };

    const errors = validateHotelSearchFields({
      destinationName: cityInput,
      hasValidDestinationId: hasValidListingDestination(destinationContext),
      checkin: checkinInput,
      checkout: checkoutInput,
      rooms: roomsInput,
      skipDestination: true,
    });

    if (!cityInput.trim()) {
      errors.destination = 'Please enter a city, area or hotel name.';
    }

    setSearchFieldErrors(errors);
    if (hasValidationErrors(errors)) {
      setDestinationError(errors.destination || '');
      return;
    }

    setDestinationError('');
    setSearchFieldErrors({});

    const parsedCheckin = parseISO(checkinInput);
    const parsedCheckout = parseISO(checkoutInput);
    const safeCheckin = isValidDate(parsedCheckin) ? checkinInput : query.checkin;
    const safeCheckout =
      isValidDate(parsedCheckout) && isAfter(parsedCheckout, parseISO(safeCheckin))
        ? checkoutInput
        : addDays(safeCheckin, 1);

    let resolvedCityRegionId = cityRegionIdInput || fallbackCityRegionId;
    let resolvedHotelId = hotelIdInput || fallbackHotelId;
    let resolvedDestinationType = selectedDestinationType || 'CITY';

    const needsHotelId = String(resolvedDestinationType).toUpperCase() === 'HOTEL';
    const hasValidId = needsHotelId
      ? isValidListingDestinationId(resolvedHotelId)
      : isValidListingDestinationId(resolvedCityRegionId);

    if (!hasValidId) {
      setResolvingDestination(true);
      try {
        const resolved = await resolveDestinationFromCityName(cityInput.trim());
        if (!resolved) {
          const message = 'Please select a city from the suggestions list.';
          setDestinationError(message);
          setSearchFieldErrors((prev) => ({ ...prev, destination: message }));
          return;
        }

        const isHotel = resolved.type === 'HOTEL' || resolved.regionType === 'HOTEL';
        if (isHotel && isValidListingDestinationId(resolved.hotelId)) {
          resolvedDestinationType = 'HOTEL';
          resolvedHotelId = String(resolved.hotelId);
          resolvedCityRegionId = '';
        } else if (isValidListingDestinationId(resolved.cityRegionId)) {
          resolvedDestinationType = 'CITY';
          resolvedCityRegionId = String(resolved.cityRegionId);
          resolvedHotelId = '';
        } else {
          const message = 'Please select a city from the suggestions list.';
          setDestinationError(message);
          setSearchFieldErrors((prev) => ({ ...prev, destination: message }));
          return;
        }
      } catch {
        const message = 'Could not resolve this city. Please pick one from the suggestions list.';
        setDestinationError(message);
        setSearchFieldErrors((prev) => ({ ...prev, destination: message }));
        return;
      } finally {
        setResolvingDestination(false);
      }
    }

    const next = new URLSearchParams(params);
    next.set('city', cityInput.trim());
    next.set('checkin', safeCheckin);
    next.set('checkout', safeCheckout);
    next.set('rooms', JSON.stringify(roomsInput));
    next.set('countryCode', query.countryCode || 'IN');
    next.set('minStar', String(Number(minStarInput || 0)));
    next.set('destinationType', resolvedDestinationType);
    if (isValidListingDestinationId(resolvedCityRegionId)) {
      next.set('cityRegionId', resolvedCityRegionId);
    } else {
      next.delete('cityRegionId');
    }
    next.delete('cityCode');
    if (resolvedDestinationType === 'HOTEL' && isValidListingDestinationId(resolvedHotelId)) {
      next.set('hotelId', resolvedHotelId);
    } else {
      next.delete('hotelId');
    }
    next.set('residence', residenceInput || '');
    if (nationalityInput) next.set('nationality', nationalityInput);
    else next.delete('nationality');
    next.set('gst', gstInput ? '1' : '0');
    next.set('searchRequestId', String(Date.now()));

    saveHotelRecentSearch({
      city: cityInput.trim(),
      cityRegionId: resolvedCityRegionId,
      hotelId: resolvedHotelId,
      destinationType: resolvedDestinationType,
      countryCode: query.countryCode || 'IN',
      checkin: safeCheckin,
      checkout: safeCheckout,
      rooms: roomsInput,
      minStar: String(Number(minStarInput || 0)),
      residence: residenceInput || '',
      nationality: nationalityInput || '',
      gst: gstInput,
    });

    setCheckinInput(safeCheckin);
    setCheckoutInput(safeCheckout);
    setCityRegionIdInput(resolvedCityRegionId);
    setHotelIdInput(resolvedHotelId);
    setDestinationTypeInput(resolvedDestinationType);
    setParams(next);
  }

  return (
    <div className="bg-slate-100 min-h-[calc(100vh-6.25rem)] lg:h-[calc(100vh-6.25rem)] lg:overflow-hidden">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 space-y-2">
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1.7fr_1fr_auto] gap-2">
            <div>
              <CityDropdownField
                value={cityInput}
                className="h-14"
                fieldError={searchFieldErrors.destination || destinationError}
                onChange={(nextValue) => {
                  setCityInput(nextValue);
                  setDestinationTypeInput('CITY');
                  setHotelIdInput('');
                  setCityRegionIdInput('');
                  setDestinationError('');
                  setSearchFieldErrors((prev) => ({ ...prev, destination: '' }));
                }}
                onCityPick={(city) => {
                  const regionId = city.cityRegionId || city.regionId || '';
                  setCityRegionIdInput(regionId ? String(regionId) : '');
                  setDestinationTypeInput(city.type || city.regionType || 'CITY');
                  setHotelIdInput(city.hotelId ? String(city.hotelId) : '');
                  setDestinationError('');
                  setSearchFieldErrors((prev) => ({ ...prev, destination: '' }));
                }}
              />
              <SearchFieldError message={searchFieldErrors.destination || destinationError} />
            </div>
            <div>
              <button
                type="button"
                onClick={openCalendar}
                className={clsx(
                  'h-14 w-full border rounded-md px-3 py-2 grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-left hover:border-accent-400',
                  (searchFieldErrors.checkin || searchFieldErrors.checkout) ? 'border-red-400' : 'border-slate-300',
                )}
              >
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Check-in</div>
                  <div className="text-sm font-semibold text-slate-800">{prettyDate(checkinInput)}</div>
                </div>
                <div className="text-center px-2">
                  <CalendarDays className="w-4 h-4 mx-auto text-slate-500" />
                  <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mt-1">{inputNights}N</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Check-out</div>
                  <div className="text-sm font-semibold text-slate-800">{prettyDate(checkoutInput)}</div>
                </div>
              </button>
              <SearchFieldError message={searchFieldErrors.checkin || searchFieldErrors.checkout} />
            </div>
            <div>
              <RoomsGuestsDropdown
                rooms={roomsInput}
                className="h-14"
                error={searchFieldErrors.rooms}
                onChange={(nextRooms) => {
                  setRoomsInput(nextRooms);
                  setSearchFieldErrors((prev) => ({ ...prev, rooms: '' }));
                }}
              />
              <SearchFieldError message={searchFieldErrors.rooms} />
            </div>
            <button
              onClick={triggerSearch}
              className="h-14 self-start bg-accent-500 hover:bg-accent-600 text-white rounded-md px-6 text-sm font-semibold uppercase tracking-wide"
            >
              Search
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => setShowSearchMoreOptions((prev) => !prev)}
              className="inline-flex items-center gap-1 font-medium text-accent-600 hover:text-accent-700"
            >
              More options
              <ChevronDown className={clsx('w-3 h-3 transition-transform', showSearchMoreOptions && 'rotate-180')} />
            </button>
            {showSearchMoreOptions && (
              <>
                <OptionDropdown
                  label="Rating"
                  value={HOTEL_SEARCH_RATING_OPTIONS.find((option) => option.value === minStarInput)?.label || HOTEL_SEARCH_RATING_OPTIONS[0].label}
                  onChange={(labelValue) => {
                    const matched = HOTEL_SEARCH_RATING_OPTIONS.find((option) => option.label === labelValue);
                    setMinStarInput(matched?.value || '0');
                  }}
                  options={HOTEL_SEARCH_RATING_OPTIONS.map((option) => option.label)}
                  variant="plain"
                  showChecks
                />
                <OptionDropdown
                  label="Nationality"
                  value={nationalityInput}
                  onChange={setNationalityInput}
                  options={nationalityOptions}
                  variant="plain"
                  placeholder="Select Nationality"
                />
                <OptionDropdown
                  label="Country of Residence"
                  value={residenceInput}
                  onChange={setResidenceInput}
                  options={residenceOptions}
                  variant="plain"
                  placeholder="Select Country of Residence"
                />
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={gstInput}
                    onChange={(event) => setGstInput(event.target.checked)}
                    className="accent-accent-500"
                  />
                  Show GST claim eligible rates
                  <span className="ml-1 text-[10px] bg-sky-200 text-sky-900 px-1.5 py-0.5 rounded">NEW</span>
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      <CalendarRangeModal
        open={calendarOpen}
        month={calendarMonth}
        startDate={draftStart}
        endDate={draftEnd}
        onClose={() => setCalendarOpen(false)}
        onApply={applyCalendar}
        onDaySelect={onCalendarDateSelect}
        onPrevMonth={() => setCalendarMonth((m) => subMonths(m, 1))}
        onNextMonth={() => setCalendarMonth((m) => addMonths(m, 1))}
      />

      <div className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-screen-2xl mx-auto px-4 py-4 flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-500 inline-flex items-center gap-1.5">
            {isSearchPending && <Loader2 className="w-3 h-3 animate-spin text-accent-500" />}
            {isSearchPending ? (
              <span>Searching hotels in <strong>{query.city}</strong>…</span>
            ) : showTotalInHeader ? (
              <>
                Showing <span className="font-semibold text-slate-800">{fmtCount(loadedHotelCount)}</span> of <span className="font-semibold text-slate-800">{fmtCount(totalHotelCount)}</span> hotels for <strong>{query.city}</strong>
                {!isDone && isLoading && showResultsPanel && <span className="text-slate-400 italic">· loading more…</span>}
              </>
            ) : (
              <>
                Showing <span className="font-semibold text-slate-800">{fmtCount(loadedHotelCount)}</span> hotels for <strong>{query.city}</strong>
                {!isDone && isLoading && showResultsPanel && <span className="text-slate-400 italic">· loading more…</span>}
              </>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative" ref={sortMenuRef}>
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-slate-600" />
                <span className="text-slate-800">
                  Sort By: <strong>{currentSortLabel}</strong>
                </span>
                <ChevronDown className={clsx('w-3.5 h-3.5 ml-2 text-slate-500 transition-transform', sortOpen && 'rotate-180')} />
              </button>

              {sortOpen && (
                <div className="absolute left-0 top-full mt-1 z-30 w-64 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSortBy(option.value);
                        setSortOpen(false);
                      }}
                      className={clsx(
                        'block w-full px-4 py-3 text-left text-sm border-b border-slate-100 last:border-b-0',
                        sortBy === option.value
                          ? 'bg-slate-100 text-slate-900 font-medium'
                          : 'text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="inline-flex rounded-md border border-slate-300 overflow-hidden bg-white">
              <button
                onClick={() => setView('grid')}
                className={clsx(
                  'px-3 py-2 text-xs inline-flex items-center gap-1 border-r border-slate-300',
                  view === 'grid'
                    ? 'bg-white text-slate-900 ring-1 ring-inset ring-accent-500 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                <Grid2X2 className="w-3.5 h-3.5" /> Grid View
              </button>
              <button
                onClick={() => setView('list')}
                className={clsx(
                  'px-3 py-2 text-xs inline-flex items-center gap-1',
                  view === 'list'
                    ? 'bg-white text-slate-900 ring-1 ring-inset ring-accent-500 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                <List className="w-3.5 h-3.5" /> List View
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowFavouritesOnly((v) => !v)}
              className={clsx(
                'rounded-md border bg-white px-3 py-2 text-xs inline-flex items-center gap-1.5',
                showFavouritesOnly
                  ? 'border-accent-400 text-accent-700 hover:bg-accent-50'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100',
              )}
            >
              <Heart className={clsx('w-3.5 h-3.5', showFavouritesOnly ? 'text-accent-600 fill-accent-100' : 'text-rose-500')} />
              {showFavouritesOnly ? 'Back to hotel list' : 'View Favourites'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-5">
        <div className={clsx('grid gap-5 lg:h-[calc(100vh-18rem)] lg:overflow-hidden', showFiltersPanel ? 'lg:grid-cols-[300px_1fr]' : 'lg:grid-cols-1')}>
          {showFiltersPanel && (
          <aside className="space-y-3 pb-6 lg:overflow-y-auto lg:pr-1 lg:pb-8 tj-scrollbar-hidden">
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              disabled={!hasValidDestination || resolvingDestination}
              className={clsx(
                'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 inline-flex items-center justify-center gap-2 shadow-sm',
                hasValidDestination && !resolvingDestination
                  ? 'hover:bg-slate-50'
                  : 'cursor-not-allowed opacity-60',
              )}
            >
              <MapPin className="w-4 h-4 text-accent-500" /> See on Map
            </button>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-800 flex items-center justify-between gap-2">
                <span>Filter by :</span>
                {filterCountsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />}
              </div>

              <div className="relative mt-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  className="w-full border border-slate-300 rounded-md py-2 pl-9 pr-3 text-sm"
                  placeholder="Select by Hotel Name"
                  value={hotelNameFilter}
                  onChange={(e) => setHotelNameFilter(e.target.value)}
                />
              </div>

              {showFilterSections && (
              <div className="mt-4 space-y-3">
                <FilterBlock title="Price Range" noDivider>
                  {priceBuckets.map((b) => (
                    <CheckboxRow
                      key={b.id}
                      checked={selectedPrice.includes(b.id)}
                      onChange={() => setSelectedPrice((s) => toggleSetValue(s, b.id))}
                      label={b.label || formatPriceLabel(b.min, b.max)}
                      count={b.count}
                    />
                  ))}
                </FilterBlock>

                <FilterBlock
                  title="Property Type"
                  footer={
                    typeBuckets.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setShowAllTypes((v) => !v)}
                        className="text-xs font-semibold text-accent-600 hover:text-accent-700 inline-flex items-center gap-1"
                      >
                        {showAllTypes ? 'Show Less' : `Show All ${fmtCount(typeBuckets.length)}`}
                        <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', showAllTypes && 'rotate-180')} />
                      </button>
                    )
                  }
                >
                  {visibleTypeBuckets.map((b) => (
                    <CheckboxRow
                      key={b.id || b.label}
                      checked={selectedTypes.includes(b.id || b.label)}
                      onChange={() => setSelectedTypes((s) => toggleSetValue(s, b.id || b.label))}
                      label={b.label}
                      count={b.count}
                    />
                  ))}
                </FilterBlock>

                {areaBuckets.length > 0 && (
                <FilterBlock
                  title="Popular Places"
                  footer={
                    areaBuckets.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setShowAllAreas((v) => !v)}
                        className="text-xs font-semibold text-accent-600 hover:text-accent-700 inline-flex items-center gap-1"
                      >
                        {showAllAreas ? 'Show Less' : `Show All ${fmtCount(areaBuckets.length)}`}
                        <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', showAllAreas && 'rotate-180')} />
                      </button>
                    )
                  }
                >
                  {visibleAreaBuckets.map((b) => (
                    <CheckboxRow
                      key={b.id || b.label}
                      checked={selectedAreas.includes(b.id || b.label)}
                      onChange={() => setSelectedAreas((s) => toggleSetValue(s, b.id || b.label))}
                      label={b.label}
                      count={b.count}
                    />
                  ))}
                </FilterBlock>
                )}

                <FilterBlock title="Star Category">
                  {starBuckets.map((bucket) => (
                    <CheckboxRow
                      key={bucket.label}
                      checked={selectedStars.includes(bucket.label)}
                      onChange={() => setSelectedStars((s) => toggleSetValue(s, bucket.label))}
                      label={<StarCategoryLabel rating={bucket.label} />}
                      count={bucket.count}
                    />
                  ))}
                </FilterBlock>

                {mealBuckets.length > 0 && (
                <FilterBlock title="Meal Basis">
                  {mealBuckets.map((b) => (
                    <CheckboxRow
                      key={b.id || b.label}
                      checked={selectedMeals.includes(b.id || b.label)}
                      onChange={() => setSelectedMeals((s) => toggleSetValue(s, b.id || b.label))}
                      label={b.label}
                      count={b.count}
                    />
                  ))}
                </FilterBlock>
                )}
              </div>
              )}
            </div>
          </aside>
          )}

          <section
            ref={listingScrollRef}
            className="pb-6 lg:overflow-y-auto lg:pr-1 lg:pb-8 tj-scrollbar-hidden">
            <div className="mb-4 rounded-md bg-slate-200/70 px-4 py-2.5 flex items-center gap-2 lg:sticky lg:top-0 lg:z-10">
              <h2 className="text-lg font-semibold text-slate-800">
                {showFavouritesOnly ? `Favourite hotels in ${query.city}` : `Popular in ${query.city}`}
              </h2>
            </div>

            {((isLoading && cachedHotels.length === 0) || isSearchPending) && (
              <div className={clsx('gap-4', view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid grid-cols-1')}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-[18px] border border-slate-200 bg-white p-2.5 animate-pulse">
                    <div className="aspect-[16/9] rounded-[14px] bg-slate-200" />
                    <div className="px-1.5 pt-3 pb-2.5 space-y-2">
                      <div className="h-5 bg-slate-200 rounded w-3/4" />
                      <div className="h-4 bg-slate-100 rounded w-1/2" />
                      <div className="h-4 bg-slate-100 rounded w-full mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {displayError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-700 text-sm">
                {destinationError || `Failed to load hotels: ${error}`}
              </div>
            )}

            {isDone && displayedHotels.length === 0 && !displayError && !isSearchPending && (
              <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-slate-600">
                {showFavouritesOnly
                  ? 'No favourite hotels yet. Click the heart icon on a hotel card to save it.'
                  : 'No hotels matched your filters. Try clearing a few filter options.'}
              </div>
            )}

            {showResultsPanel && displayedHotels.length > 0 && (
              <div className={clsx('gap-4', view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid grid-cols-1')}>
                {displayedHotels.map((hotel) => (
                  <HotelCard
                    key={`${searchRefreshKey}-${hotel.id}-${hotel.totalRateINR}`}
                    hotel={hotel}
                    query={query}
                    view={view}
                    isFavourite={favouriteIdSet.has(String(hotel.id))}
                    onToggleFavourite={toggleFavouriteHotel}
                  />
                ))}
              </div>
            )}

            {cachedHotels.length > 0 && ((!isDone && isLoading) || hasMoreVisibleHotels) && (
              <div className="flex justify-center py-8">
                <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-accent-500" />
                  Loading more hotels...
                </span>
              </div>
            )}

            {isDone && visibleHotelCount > 0 && showTotalInHeader && loadedHotelCount >= totalHotelCount && (
              <div className="text-center py-6 text-xs text-slate-400">
                All {fmtCount(totalHotelCount)} hotels loaded
              </div>
            )}
          </section>
        </div>
      </div>

      <HotelListingMapModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        title={mapTitle}
        subtitle={mapSubtitle}
        hotels={mapHotels}
        focusHotelId={mapFocusHotelId}
        cityCenter={mapCityCenter}
        loading={mapLoading}
      />
    </div>
  );
}

function HotelCard({ hotel, query, view, isFavourite, onToggleFavourite }) {
  const navigate = useNavigate();
  const correlationId = hotel.correlationId || '';

  const path = `/hotels/${encodeURIComponent(hotel.tjHotelId || hotel.hotelId || hotel.id)}?city=${encodeURIComponent(query.city || hotel.city || '')}&hotelName=${encodeURIComponent(
    hotel.name || '',
  )}&checkin=${encodeURIComponent(query.checkin)}&checkout=${encodeURIComponent(
    query.checkout,
  )}&rooms=${encodeURIComponent(JSON.stringify(query.rooms))}&amount=${encodeURIComponent(
    hotel.totalRateINR || hotel.nightlyRateINR || '',
  )}&mealBasis=${encodeURIComponent(hotel.mealBasis || '')}&optionId=${encodeURIComponent(hotel.optionId || '')}${
    correlationId ? `&correlationId=${encodeURIComponent(correlationId)}` : ''
  }&nationality=${encodeURIComponent(query.nationality || query.residence || '106')}&residence=${encodeURIComponent(query.residence || '')}&gst=${query.gst ? '1' : '0'}`;

  const amenities = (hotel.amenities || []).slice(0, 3).filter(Boolean);
  const imageSet = Array.isArray(hotel.images) ? hotel.images.filter(Boolean) : [];
  const fallbackGallery = FALLBACK_GALLERIES[Math.abs(String(hotel.id).length) % FALLBACK_GALLERIES.length];
  const gallery = imageSet.length
    ? imageSet
    : hotel.thumbnail
      ? [hotel.thumbnail]
      : fallbackGallery;
  const detailPath = `${path}&images=${encodeURIComponent(JSON.stringify(gallery))}`;
  const totalImages = Math.max(1, gallery.length);
  const [imageIndex, setImageIndex] = useState(0);
  const safeImageIndex = imageIndex % totalImages;
  const activeImage = gallery[safeImageIndex] || hotel.thumbnail;
  const hasMultipleImages = totalImages > 1;

  useEffect(() => {
    setImageIndex(0);
  }, [hotel.id]);

  function showNextImage(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!hasMultipleImages) return;
    setImageIndex((idx) => (idx + 1) % totalImages);
  }

  function onFavouriteClick(event) {
    event.preventDefault();
    event.stopPropagation();
    onToggleFavourite?.(hotel.id);
  }

  if (view === 'grid') {
    return (
      <article className="rounded-[18px] border border-[#e3e6ea] bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:shadow-[0_10px_22px_-8px_rgba(15,23,42,0.24)] transition">
        <Link to={detailPath} className="block">
          <div className="relative aspect-[16/9] rounded-[14px] overflow-hidden bg-slate-100">
            <img src={activeImage} alt={hotel.name} className="w-full h-full object-cover" />

            <button
              type="button"
              onClick={onFavouriteClick}
              className={clsx(
                'absolute top-3 right-3 w-10 h-10 rounded-full bg-white border border-slate-200 inline-flex items-center justify-center shadow-sm transition-colors',
                isFavourite ? 'text-rose-500' : 'text-slate-600 hover:text-rose-500',
              )}
              aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            >
              <Heart className={clsx('w-5 h-5 stroke-[2.2]', isFavourite && 'fill-rose-100')} />
            </button>

            <button
              type="button"
              onClick={showNextImage}
              disabled={!hasMultipleImages}
              className={clsx(
                'absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 border border-slate-200 inline-flex items-center justify-center text-slate-600 shadow-sm text-3xl leading-none',
                hasMultipleImages ? 'hover:bg-white' : 'opacity-50 cursor-default',
              )}
              aria-label="Next hotel image"
            >
              &#8250;
            </button>

            <span className="absolute left-1/2 -translate-x-1/2 bottom-3 text-sm leading-none px-2.5 py-1 rounded-full bg-black/70 text-white font-medium">
              {safeImageIndex + 1} / {totalImages}
            </span>
          </div>

          <div className="px-1.5 pt-3 pb-2.5">

            <div className="mt-1 flex items-center justify-between gap-3">
              <div className=" min-h-[3.5rem]">
                <div className="text-xl leading-tight font-semibold text-slate-900 line-clamp-2">{hotel.name}</div>
                <div className="text-lg text-slate-700">{hotel.city || query.city}</div>
              </div>

              <span className="inline-flex items-center gap-0.5 shrink-0">
                {Array.from({ length: Number(hotel.starRating) || 0 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#f8b400] text-[#f8b400]" />
                ))}
              </span>
            </div>

            <div className="mt-2 border-t border-slate-200 pt-2">
              <div className="text-base text-sm text-slate-700">&#8226; {hotel.mealBasis || 'Room Only'}</div>
              <div className="mt-1 text-sm font-medium text-slate-800 truncate">
                {amenities.join(' | ')}
              </div>
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              {hotel.reviewCount > 0 && hotel.reviewScore > 0 ? (
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <div className="text-l leading-none font-semibold text-[#e6a23c] rounded-[8px] border border-[#e3e6ea] px-2 py-1">{hotel.reviewScore.toFixed(1)}</div>
                <div className="pb-1 min-w-0">
                  <div className="text-base leading-tight font- text-slate-900 ">{hotel.reviewLabel || scoreText(hotel.reviewScore)}</div>
                  <div className="text-xs text-slate-500 truncate">({fmtCount(hotel.reviewCount)} Ratings)</div>
                </div>
              </div>
              ) : <div />}

              <div className="text-right">
                <div className="text-xs pb-2 text-slate-700">{fmtINR(hotel.nightlyRateINR)}/night</div>
                <div className="text-xl leading-none font-semibold text-slate-900 whitespace-nowrap">
                  {fmtINR(hotel.totalRateINR)}
                  <span className="text-base ml-1 font-medium text-slate-500">Total</span>
                </div>
                <div className="text-xs text-slate-500 leading-tight">(Incl. of all taxes)</div>
              </div>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => navigate(detailPath)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(detailPath);
        }
      }}
      className="rounded-[24px] border border-[#ecd8c8] bg-white px-5 py-6 shadow-[0_8px_20px_rgba(15,23,42,0.1)] transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.16)] cursor-pointer"
    >
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)_220px]">
        <div className="relative h-[210px] overflow-hidden rounded-2xl bg-slate-200">
          <img src={activeImage} alt={hotel.name} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onFavouriteClick}
            className={clsx(
              'absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 transition-colors',
              isFavourite ? 'text-rose-500' : 'text-slate-700 hover:text-rose-500',
            )}
            aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Heart className={clsx('h-4 w-4', isFavourite && 'fill-rose-100')} />
          </button>
          <button
            type="button"
            onClick={showNextImage}
            disabled={!hasMultipleImages}
            className={clsx(
              'absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-xl leading-none text-slate-600',
              hasMultipleImages ? 'hover:bg-white' : 'opacity-50 cursor-default',
            )}
            aria-label="Next hotel image"
          >
            &#8250;
          </button>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold text-white">
            {safeImageIndex + 1} / {totalImages}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Link to={detailPath} className="text-[1.75rem] font-semibold leading-tight text-slate-800 hover:text-accent-600 line-clamp-2">
              {hotel.name}
            </Link>
            <span className="inline-flex items-center gap-0.5">
              {Array.from({ length: Number(hotel.starRating) || 0 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-[#f8b400] text-[#f8b400]" />
              ))}
            </span>
          </div>

          <div className="mt-2 text-lg text-slate-600">{hotel.city || query.city}</div>
          <div className="mt-3 text-base font-medium text-slate-700">&#8226; {hotel.mealBasis || 'Breakfast Included'}</div>

          <div className="mt-5 grid gap-2 text-lg font-medium leading-tight text-slate-800 sm:grid-cols-3">
            {amenities.slice(0, 2).map((item, idx) => (
              <div key={`${item}-${idx}`} className="truncate">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 text-right">
          {hotel.reviewCount > 0 && hotel.reviewScore > 0 && (
          <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="text-4xl leading-none font-semibold text-[#ea7a18]">{hotel.reviewScore.toFixed(1)}</div>
            <div>
              <div className="text-lg font-semibold leading-tight text-slate-700">{hotel.reviewLabel || scoreText(hotel.reviewScore)}</div>
              <div className="text-xs text-slate-500">({fmtCount(hotel.reviewCount)} Ratings)</div>
            </div>
          </div>
          )}

          <div>
            <div className="text-base text-slate-600">{fmtINR(hotel.nightlyRateINR)}/night</div>
            <div className="text-4xl font-semibold leading-none text-slate-800">
              {fmtINR(hotel.totalRateINR)}
              <span className="ml-1 text-xl font-medium text-slate-500">Total</span>
            </div>
            <div className="mt-1 text-sm text-slate-500">(Incl. of all taxes)</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function FilterBlock({ title, children, footer, noDivider = false }) {
  return (
    <section className={clsx(!noDivider && 'border-t border-slate-200 pt-3')}>
      <div className="text-sm font-semibold text-slate-800 mb-2">{title}</div>
      <div className="space-y-1.5">{children}</div>
      {footer ? <div className="mt-1">{footer}</div> : null}
    </section>
  );
}

function CalendarRangeModal({
  open,
  month,
  startDate,
  endDate,
  onClose,
  onApply,
  onDaySelect,
  onPrevMonth,
  onNextMonth,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/35 flex items-start justify-center p-4 pt-24" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-900">Select Start and End Date</div>
            <div className="text-xs text-slate-500 mt-0.5">Choose check-in first, then check-out.</div>
          </div>
          <div className="inline-flex items-center gap-2">
            <button onClick={onPrevMonth} className="w-8 h-8 rounded border border-slate-300 inline-flex items-center justify-center text-slate-700 hover:bg-slate-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={onNextMonth} className="w-8 h-8 rounded border border-slate-300 inline-flex items-center justify-center text-slate-700 hover:bg-slate-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 p-4">
          <CalendarMonthGrid
            month={month}
            startDate={startDate}
            endDate={endDate}
            onDaySelect={onDaySelect}
          />
          <CalendarMonthGrid
            month={addMonths(month, 1)}
            startDate={startDate}
            endDate={endDate}
            onDaySelect={onDaySelect}
          />
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Check-in:</span>{' '}
            {startDate && isValidDate(startDate) ? format(startDate, 'EEE, dd MMM yyyy') : '--'}
          </div>
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Check-out:</span>{' '}
            {endDate && isValidDate(endDate) ? format(endDate, 'EEE, dd MMM yyyy') : '--'}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded border border-slate-300 text-sm text-slate-700 hover:bg-slate-100">
              Cancel
            </button>
            <button onClick={onApply} className="px-3 py-1.5 rounded bg-accent-500 text-white text-sm font-semibold hover:bg-accent-600">
              Apply Dates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarMonthGrid({ month, startDate, endDate, onDaySelect }) {
  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-center font-semibold text-slate-800 mb-2">{format(month, 'MMMM yyyy')}</div>
      <div className="grid grid-cols-7 text-[11px] uppercase tracking-wide text-slate-500 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const selectedStart = startDate && isSameDay(day, startDate);
          const selectedEnd = endDate && isSameDay(day, endDate);
          const isPastDay = isBefore(startOfDay(day), startOfDay(new Date()));
          const inSelectedRange =
            startDate && endDate && isAfter(day, startDate) && isBefore(day, endDate);

          return (
            <div key={day.toISOString()} className={clsx('flex justify-center py-0.5', inSelectedRange && 'bg-orange-100')}>
              <button
                type="button"
                onClick={() => {
                  if (!isPastDay) onDaySelect(day);
                }}
                disabled={isPastDay}
                className={clsx(
                  'w-8 h-8 rounded-full text-sm transition',
                  isPastDay && 'cursor-not-allowed text-slate-300 opacity-40',
                  !isSameMonth(day, month) && 'text-slate-300',
                  isSameMonth(day, month) && !selectedStart && !selectedEnd && !isPastDay && 'text-slate-700 hover:bg-slate-100',
                  (selectedStart || selectedEnd) && 'bg-accent-500 text-white font-semibold',
                )}
              >
                {format(day, 'd')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckboxRow({ checked, onChange, label, count, disabled = false }) {
  return (
    <label className={clsx(
      'flex items-center gap-2.5 text-sm py-0.5',
      disabled ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 cursor-pointer',
    )}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500 disabled:opacity-50"
      />
      <span className="truncate">{label}</span>
      <span className="text-slate-400 ml-auto shrink-0">({fmtCount(count)})</span>
    </label>
  );
}

function StarCategoryLabel({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, idx) => (
        <Star
          key={`${rating}-${idx}`}
          className={clsx(
            'h-3.5 w-3.5',
            idx < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
          )}
        />
      ))}
    </span>
  );
}

function safeParseRooms(raw) {
  try {
    const parsed = JSON.parse(raw || '');
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    // Fall through to default when query-string room payload is malformed.
  }
  return [{ adults: 1, children: 0, ages: [] }];
}

function formatPriceLabel(min, max) {
  if (max === Number.POSITIVE_INFINITY) return `${fmtINR(min)}+`;
  if (min === 0) return `Up to ${fmtINR(max)}`;
  return `${fmtINR(min)} - ${fmtINR(max)}`;
}

function toggleSetValue(list, value) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function normalizeFilterBuckets(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (row && typeof row === 'object') {
        const label =
          row.label ??
          row.name ??
          row.value ??
          row.key ??
          row.type ??
          row.propertyType ??
          row.mealBasis ??
          row.area ??
          row.region ??
          row.place ??
          '';
        const id = row.value ?? row.id ?? row.key ?? label;
        const count = row.count ?? row.hotelCount ?? row.total ?? row.totalResults ?? 0;
        return label ? { id: String(id), label: String(label), count: Number(count) || 0 } : null;
      }
      return row ? { id: String(row), label: String(row), count: 0 } : null;
    })
    .filter(Boolean);
}

function normalizePriceBuckets(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;

      const value = String(row.value || '');
      const [left, right] = value.split('$$');
      const min = Number(left || row.min || 0);
      const max = right === '' ? Number.POSITIVE_INFINITY : Number(right || row.max || 0);

      return {
        id: value,
        value,
        label: formatPriceLabel(min, max),
        min,
        max,
        count: Number(row.count || 0),
      };
    })
    .filter(Boolean);
}

function normalizeStarBuckets(rows) {
  return normalizeFilterBuckets(rows)
    .map((bucket) => {
      const rating = Number(String(bucket.label).match(/\d+/)?.[0] || bucket.id);
      return Number.isFinite(rating) && rating > 0
        ? { ...bucket, id: String(bucket.id || rating), label: rating }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.label - a.label);
}

function prettyDate(v) {
  if (!v) return '--';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '--';
  const day = d.getDate();
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${day}${ordinal(day)} ${d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })}`;
}

function nightCount(checkin, checkout) {
  const diff = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
  return Math.max(1, diff);
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}


function makeFallbackGallery(startIndex, count) {
  return Array.from(
    { length: count },
    (_, idx) => HOTEL_IMAGE_POOL[(startIndex + idx) % HOTEL_IMAGE_POOL.length],
  );
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  if (n % 10 === 1) return 'st';
  if (n % 10 === 2) return 'nd';
  if (n % 10 === 3) return 'rd';
  return 'th';
}

function scoreText(score) {
  if (score >= 4.6) return 'Excellent';
  if (score >= 4.1) return 'Very Good';
  if (score >= 3.6) return 'Good';
  return 'Average';
}

function buildHotelListingPayload(query) {
  const destinationType = String(query.destinationType || '').toUpperCase();
  const payload = {
    checkIn: query.checkin,
    checkOut: query.checkout,
    rooms: toListingRooms(query.rooms),
    currency: 'INR',
    gstApplied: Boolean(query.gst),
    ...(query.residence ? { countryOfResidence: toNationalityCode(query.residence) } : {}),
    ...(query.nationality ? { nationality: toNationalityCode(query.nationality) } : {}),
  };

  if (destinationType === 'HOTEL' && query.hotelId) {
    const tjHotelId = Number(query.hotelId);
    if (Number.isFinite(tjHotelId)) payload.tjHotelId = tjHotelId;
  } else if (query.cityRegionId) {
    const cityRegionId = Number(query.cityRegionId);
    if (Number.isFinite(cityRegionId)) payload.cityRegionId = cityRegionId;
  }

  return payload;
}

function toListingRooms(rooms) {
  const safeRooms = Array.isArray(rooms) && rooms.length ? rooms : [{ adults: 1, children: 0, ages: [] }];
  return safeRooms.map((room) => {
    const children = Number(room.children || 0);
    const next = {
      adults: Number(room.adults || 1),
    };
    if (children > 0) {
      next.children = children;
      next.childAge = Array.isArray(room.ages) ? room.ages.map(Number).filter((age) => age > 0) : [];
    }
    return next;
  });
}

function toNationalityCode(value) {
  const raw = String(value || '');
  return raw.toLowerCase() === 'india' ? '106' : raw;
}

function listingTotalFromResponse(data, fallback = 0) {
  const total = Number(
    data?.hotelCount ??
    data?.availableHotelCount ??
    data?.pagination?.hotelCount ??
    data?.totalResults ??
    data?.pagination?.totalResults ??
    data?.liveHotelCount ??
    data?.pagination?.liveHotelCount ??
    data?.pagination?.total ??
    data?.total ??
    data?._live_meta?.total ??
    data?._live_meta?.totalResults ??
    data?.data?.hotelCount ??
    data?.data?.totalResults ??
    0,
  );
  return Number.isFinite(total) && total > 0 ? total : fallback;
}

function hotelRowsFromResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.hotels)) return payload.hotels;
  if (Array.isArray(payload?.data?.hotels)) return payload.data.hotels;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.results?.hotels)) return payload.results.hotels;
  if (Array.isArray(payload?.results?.data)) return payload.results.data;
  if (Array.isArray(payload?.results?.results)) return payload.results.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.hotelInfos)) return payload.hotelInfos;
  return [];
}

function extractImageUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (image.links?.XXL?.href) return image.links.XXL.href;
  if (image.links?.XL?.href) return image.links.XL.href;
  if (image.links?.L?.href) return image.links.L.href;
  if (image.links?.M?.href) return image.links.M.href;
  return image.url || image.imageUrl || image.link || image.href || image.path || '';
}

function normalizeHotels(list) {
  return list.map((item, idx) => {
    const option = item.cheapestOption || (Array.isArray(item.options) ? item.options[0] : item.option || {});
    const price = item.price || item.totalPrice || item.fare || option.price || option.pricing || {};
    const baseRate = Number(
      item.totalRateINR ||
      item.nightlyRateINR ||
      item.totalFare ||
      item.totalAmount ||
      price.totalRateINR ||
      price.totalPrice ||
      price.total ||
      price.amount ||
      option.totalRateINR ||
      0,
    );
    const providedImages = [
      ...(Array.isArray(item.images) ? item.images : []),
      ...(Array.isArray(item.img) ? item.img : []),
      ...(Array.isArray(item.imageUrls) ? item.imageUrls : []),
    ].map((image) => (typeof image === 'string' ? image : extractImageUrl(image))).filter(Boolean);
    const primaryImage = extractImageUrl(item.thumbnail || item.image || item.heroImage);
    const imageSet = providedImages.length > 0
      ? providedImages
      : primaryImage
        ? [primaryImage]
        : [];

    const amenities = item.amenities || item.facilities || item.propertyAmenities || [];
    const mealBasis =
      item.mealBasis ||
      option.mealBasis ||
      (Array.isArray(amenities) && amenities.some((a) => String(a).toLowerCase().includes('breakfast'))
        ? 'Breakfast Included'
        : 'Room Only');
    const localeAddress = item.locale?.address || {};
    const rawAddress = item.address || item.ad || localeAddress;
    const propertyType =
      item.propertyCategory ||
      item.hotelType ||
      (typeof item.propertyType === 'object' ? item.propertyType?.name : item.propertyType);
    const address = typeof rawAddress === 'object'
      ? [
        rawAddress.adr,
        rawAddress.adr2,
        rawAddress.address,
        rawAddress.line1,
        rawAddress.region,
        rawAddress.ctn,
        rawAddress.city,
        rawAddress.sn,
        rawAddress.state,
        rawAddress.cn,
        rawAddress.country,
      ].filter(Boolean).join(', ')
      : rawAddress;
    const city = item.city || item.cityName || rawAddress?.ctn || rawAddress?.city || item.ad?.city?.name || 'City';
    const regionName = item.regionName || item.region || localeAddress.region || rawAddress?.region || '';
    const area = item.area || regionName || rawAddress?.locality || rawAddress?.area || '';
    const mapPoint = collectHotelCoordinates(
      item.coordinates,
      item.geolocation,
      item.locale?.coordinates,
      item.staticContent?.coordinates,
    );
    const tjHotelId = String(item.tjHotelId || item.hotelId || item.tjid || item.hid || item.id || '');
    return {
      id: tjHotelId || `hotel-${idx + 1}`,
      tjHotelId,
      hotelId: tjHotelId,
      correlationId: item.correlationId || item.searchId || item.traceId || '',
      name: item.name || item.hotelName || item.label || 'Hotel',
      city,
      address: address || item.ad?.adr || city || '',
      area,
      region: regionName || area,
      regionName: regionName || area,
      starRating: Number(item.starRating || item.rating || 3),
      thumbnail: primaryImage || imageSet[0] || item.thumbnail || '',
      images: imageSet,
      amenities: Array.isArray(amenities) ? amenities.map((amenity) => (
        typeof amenity === 'object' ? amenity.name || amenity.label || amenity.id : amenity
      )).filter(Boolean) : [],
      nightlyRateINR: Number(item.nightlyRateINR || price.nightly || price.nightlyPrice || price.basePrice || option.nightlyRateINR || baseRate || 0),
      totalRateINR: Number(item.totalRateINR || price.totalPrice || price.total || price.amount || option.totalRateINR || baseRate || 0),
      mealBasis,
      propertyType: propertyType || 'Hotel',
      optionId: item.optionId || option.optionId || option.id || '',
      latitude: mapPoint?.latitude ?? null,
      longitude: mapPoint?.longitude ?? null,
    };
  });
}
