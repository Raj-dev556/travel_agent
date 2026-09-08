import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BedDouble,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  Loader2,
  MapPin,
  Search,
  Share2,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../api';
import HotelMapModal from '../../components/hotels/HotelMapModal';
import { collectHotelCoordinates } from '../../components/hotels/parseHotelCoordinates';
import {
  buildAddressLine,
  collectDescriptions,
  collectHotelImages,
  collectPolicySections,
  extractCheckInOutTimes,
  extractLiveDetail,
  extractReviewSummary,
  fallbackRoomFromSearchQuery,
  filterRoomOptions,
  firstResult,
  fmtCount,
  fmtINR,
  formatCancellationSummary,
  formatPolicyDateTime,
  groupRoomsByType,
  normalizeAmenityList,
  optionToRoom,
  resolveSelectedRoom,
  scoreText,
  uniqueMealPlans,
} from './hotelTripjackHelpers';

const PREVIEW_IMAGE_COUNT = 6;

function safeParseRooms(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) && parsed.length ? parsed : [{ adults: 1, children: 0, ages: [] }];
  } catch {
    return [{ adults: 1, children: 0, ages: [] }];
  }
}

function toDetailRooms(rooms) {
  return rooms.map((room) => {
    const children = Number(room.children || 0);
    const next = { adults: Number(room.adults || 1), children };
    if (children > 0) next.childAge = Array.isArray(room.ages) ? room.ages.map(Number).filter((age) => age > 0) : [];
    return next;
  });
}

function fmtDate(value) {
  if (!value) return '--';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function resolvePropertyTypeLabel(value) {
  if (!value) return '';
  if (typeof value === 'object') return value.name || value.label || value.id || '';
  return String(value);
}

function normalizeText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function toInfoSections(entries = []) {
  return entries
    .filter(Boolean)
    .map((entry) => ({
      label: entry.label,
      value: normalizeText(entry.value),
    }))
    .filter((entry) => entry.value);
}

function getArrayValue(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function safeParseImageList(value) {
  try {
    const parsed = JSON.parse(value || '');
    return Array.isArray(parsed) ? parsed.filter((src) => typeof src === 'string' && src.trim()) : [];
  } catch {
    return [];
  }
}

export default function HotelDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(null);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [galleryLightboxOpen, setGalleryLightboxOpen] = useState(false);
  const [filters, setFilters] = useState({
    refundable: false,
    breakfast: false,
    panOptional: false,
    mealPlan: 'all',
    roomSearch: '',
  });
  const [mealMenuOpen, setMealMenuOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [roomsPanelExpanded, setRoomsPanelExpanded] = useState(false);
  const [cancellationRoom, setCancellationRoom] = useState(null);
  const [failedImageSources, setFailedImageSources] = useState(() => new Set());
  const roomTypesRef = useRef(null);

  const query = useMemo(() => {
    const rooms = safeParseRooms(params.get('rooms'));
    return {
      city: params.get('city') || '',
      hotelName: params.get('hotelName') || '',
      checkIn: params.get('checkin') || new Date().toISOString().slice(0, 10),
      checkOut: params.get('checkout') || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      rooms,
      amount: params.get('amount') || '',
      optionId: params.get('optionId') || '',
      mealBasis: params.get('mealBasis') || '',
      roomName: params.get('roomName') || '',
      nationality: params.get('nationality') || params.get('residence') || '106',
      reviewHash: params.get('reviewHash') || '',
      gst: params.get('gst') === '1',
    };
  }, [params]);

  const tjHotelId = String(id || '').trim();
  const listingImages = useMemo(() => safeParseImageList(params.get('images')), [params]);

  const { data: staticData, isLoading: staticLoading, error: staticError } = useQuery({
    queryKey: ['hotel-static', tjHotelId],
    queryFn: () => api.post('/hotels/hotel-details/static', { tjHotelId }).then((res) => res.data),
    enabled: Boolean(tjHotelId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const detailPayload = useMemo(() => ({
    tjHotelId,
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    rooms: toDetailRooms(query.rooms),
    currency: 'INR',
    nationality: String(query.nationality || '106'),
    gstApplied: Boolean(query.gst),
  }), [tjHotelId, query]);

  const { data: liveData, isLoading: liveLoading, error: liveError, isError: liveIsError } = useQuery({
    queryKey: ['hotel-detail', detailPayload],
    queryFn: async () => {
      try {
        const res = await api.post('/hotels/hotel-details', detailPayload);
        return res.data;
      } catch (err) {
        if (err.response?.data) return err.response.data;
        throw err;
      }
    },
    enabled: Boolean(tjHotelId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const staticRecord = firstResult(staticData) || staticData?.hotel || staticData || null;
  const detail = extractLiveDetail(liveData) || {};
  const detailHotel = detail?.hotel || detail?.property || detail?.propertyInfo || {};
  const staticContent = detail?.staticContent || detailHotel?.staticContent || staticRecord?.staticContent || staticData?.staticContent || staticRecord || {};
  const address = staticContent.address || detailHotel?.address || detail?.address || {};
  const detailPolicies = detail?.policies || detailHotel?.policies || {};
  const combinedPolicies = { ...(staticContent.policies || {}), ...(detailPolicies || {}) };
  const detailAmenities = getArrayValue(
    staticContent.amenities,
    staticContent.amenityList,
    detail?.amenities,
    detailHotel?.amenities,
    staticRecord?.amenities,
  );
  const detailFacilities = getArrayValue(
    staticContent.facilities,
    staticContent.facilityList,
    detail?.facilities,
    detailHotel?.facilities,
    staticRecord?.facilities,
    staticRecord?.facilityList,
    staticRecord?.propertyAmenities,
  );
  const detailImages = getArrayValue(
    staticContent.images,
    staticRecord?.images,
    detail?.images,
    detailHotel?.images,
    staticContent.media,
    detail?.media,
    detailHotel?.media,
    staticContent?.imageGallery,
    detail?.imageGallery,
  );
  const listingFallbackRoom = useMemo(() => fallbackRoomFromSearchQuery(query), [query]);
  const images = useMemo(
    () => collectHotelImages(
      listingImages,
      staticContent,
      staticRecord,
      detail,
      detailHotel,
      detailImages,
    ),
    [detail, detailHotel, detailImages, listingImages, staticContent, staticRecord],
  );
  const galleryImages = useMemo(
    () => images
      .map((src, index) => ({ src, index }))
      .filter(({ src }) => !failedImageSources.has(src)),
    [images, failedImageSources],
  );
  const flatAmenities = useMemo(
    () => normalizeAmenityList([
      ...detailAmenities,
      ...detailFacilities,
      staticContent.amenities || [],
      staticContent.facilities || [],
      detail?.facilities || [],
    ]),
    [detailAmenities, detailFacilities, detail, staticContent.amenities, staticContent.facilities],
  );
  const facilityGroups = useMemo(
    () => normalizeAmenityList([
      ...detailFacilities,
      staticContent.facilities || [],
      detail?.facilities || [],
    ]),
    [detailFacilities, staticContent.facilities, detail],
  );
  const amenitySections = useMemo(() => {
    const sections = [];
    if (flatAmenities.length) sections.push({ key: 'amenities', title: 'Amenities', items: flatAmenities });
    if (facilityGroups.length) {
      sections.push({ key: 'facilities', title: 'Facilities', items: facilityGroups });
    }
    return sections.length ? sections : [{ key: 'amenities', title: 'Hotel amenities', items: [] }];
  }, [flatAmenities, facilityGroups]);
  const descriptionFromPayload = useMemo(() => {
    const source = collectDescriptions(staticContent.descriptions || {});
    const extra = [
      staticContent.description,
      detail.description,
      detailHotel?.description,
      detail?.overview,
      detailHotel?.overview,
    ].filter(Boolean).map((item) => ({ title: 'Description', text: String(item).trim() }));
    return [...source, ...extra];
  }, [detail.description, detail.overview, detailHotel, staticContent.description, staticContent.descriptions, staticContent.overview]);
  const descriptionSections = useMemo(() => {
    const seen = new Set();
    return descriptionFromPayload.filter((section) => {
      if (!section?.text) return false;
      const key = `${section.title}-${section.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [descriptionFromPayload]);
  const policySections = collectPolicySections(combinedPolicies);
  const checkInOutTimes = useMemo(
    () => extractCheckInOutTimes(combinedPolicies),
    [combinedPolicies],
  );
  const reviewSummary = useMemo(
    () => extractReviewSummary(detail || {}),
    [detail],
  );

  const roomOptions = useMemo(() => {
    const options = Array.isArray(detail?.options)
      ? detail.options
      : Array.isArray(detail?.roomOptions)
        ? detail.roomOptions
        : Array.isArray(detailHotel?.options)
          ? detailHotel.options
          : [];
    const hotelAmenities = flatAmenities.slice(0, 8);
    const fallbackImages = images.slice(0, 8);
    const liveRooms = options.map((option) => {
      const room = optionToRoom(option);
      return {
        ...room,
        images: room.images.length ? room.images : fallbackImages,
        amenities: room.amenities.length ? room.amenities : hotelAmenities,
      };
    }).filter((room) => room.totalRateINR > 0);
    if (liveRooms.length > 0) return liveRooms;
    if (listingFallbackRoom) {
      return [{
        ...listingFallbackRoom,
        images: listingFallbackRoom.images?.length ? listingFallbackRoom.images : fallbackImages,
        amenities: listingFallbackRoom.amenities?.length ? listingFallbackRoom.amenities : hotelAmenities,
      }];
    }
    return [];
  }, [detail?.options, listingFallbackRoom, images, flatAmenities]);

  const usingListingFallback = roomOptions.length > 0 && roomOptions.every((room) => room.fromSearchListing);
  const liveRatesUnavailable = !liveLoading && (liveIsError || liveData?.success === false) && usingListingFallback;

  const mealPlans = useMemo(() => uniqueMealPlans(roomOptions), [roomOptions]);
  const filteredRooms = useMemo(
    () => filterRoomOptions(roomOptions, filters),
    [roomOptions, filters],
  );

  const groupedRooms = useMemo(
    () => groupRoomsByType(filteredRooms),
    [filteredRooms],
  );

  const selectedRoom = useMemo(
    () => resolveSelectedRoom(roomOptions, query),
    [roomOptions, query],
  );

  const leadRoom = selectedRoom || filteredRooms[0] || roomOptions[0] || null;
  const hotelName = detail?.hotelName || detailHotel?.hotelName || staticRecord?.hotelName || staticContent.hotelName || query.hotelName || 'Hotel details';
  const starRating = Number(
    detail?.starRating
      || detailHotel?.starRating
      || detail?.rating
      || staticRecord?.starRating
      || staticContent.starRating
      || 0,
  );
  const propertyType = resolvePropertyTypeLabel(
    staticRecord?.propertyType
      || staticContent.propertyType
      || detail?.propertyType
      || detailHotel?.propertyType
      || detail?.property_category
      || detailHotel?.property_category,
  );
  const fullAddress = buildAddressLine(address, query.city);
  const mapCoords = useMemo(
    () => collectHotelCoordinates(
      staticContent.coordinates,
      staticContent.location,
      staticContent.geo,
      staticRecord?.coordinates,
      staticRecord?.location,
      staticRecord?.geo,
      staticRecord?.geolocation,
      staticRecord?.locale?.coordinates,
      staticContent.locale?.coordinates,
      detail?.staticContent?.coordinates,
      detail?.geolocation,
    ),
    [
      staticContent.coordinates,
      staticContent.location,
      staticContent.geo,
      staticRecord?.coordinates,
      staticRecord?.location,
      staticRecord?.geo,
      staticRecord?.geolocation,
      staticRecord?.locale?.coordinates,
      staticContent.locale?.coordinates,
      detail?.staticContent?.coordinates,
      detail?.geolocation,
    ],
  );
  const totalAdults = query.rooms.reduce((sum, room) => sum + Number(room.adults || 0), 0);
  const hasMultipleRooms = roomOptions.length > 1;
  const hotelInfoItems = useMemo(() => toInfoSections([
    { label: 'City', value: query.city || address.city || address.cityName || detailHotel?.city || detailHotel?.cityName },
    { label: 'Area', value: query.city || address.region || address.locality || detailHotel?.area || detailHotel?.region || detailHotel?.regionName },
    { label: 'Check-in', value: checkInOutTimes.checkIn || '--' },
    { label: 'Check-out', value: checkInOutTimes.checkOut || '--' },
    { label: 'Meal plan', value: query.mealBasis || detail?.mealBasis || detailHotel?.mealBasis || 'Room only' },
  ]), [address, checkInOutTimes.checkIn, checkInOutTimes.checkOut, detail, detailHotel, query.city, query.mealBasis]);
  const featureSections = useMemo(() => {
    const roomTypes = roomOptions.map((room) => room.name).filter(Boolean);
    const uniqueRoomTypes = Array.from(new Set(roomTypes));
    const raw = [
      { label: 'Available room types', value: uniqueRoomTypes.join(', ') || 'Standard room type' },
      ...hotelInfoItems,
    ];
    return toInfoSections(raw);
  }, [roomOptions, hotelInfoItems]);
  const hasStaticContent = Boolean(
    (staticData?.success && staticRecord) ||
    staticContent.hotelName ||
    detail?.hotelName ||
    detailHotel?.hotelName ||
    query.hotelName,
  );
  const showFatalError = staticError && liveError && !hasStaticContent;
  const isInitializing = !hasStaticContent && (staticLoading || liveLoading);
  const hasAnyError = staticError || liveError;
  const isEmptyContent = !hasStaticContent && !detail;

  function toggleFilter(key) {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openGallery(index = 0, openLightboxImmediately = false) {
    setGalleryStartIndex(index);
    setGalleryLightboxOpen(openLightboxImmediately);
    setActiveModal('photos');
  }

  function scrollToRoomTypes(expandPanel = false) {
    if (expandPanel) setRoomsPanelExpanded(true);
    window.requestAnimationFrame(() => {
      roomTypesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function selectRoom(room) {
    if (room.fromSearchListing) return;

    const bookParams = new URLSearchParams(params);
    const selectedReviewHash = room.reviewHash || detail?.reviewHash || query.reviewHash;
    if (room.optionId) bookParams.set('optionId', room.optionId);
    if (selectedReviewHash) bookParams.set('reviewHash', selectedReviewHash);
    if (liveData?.correlationId) bookParams.set('correlationId', liveData.correlationId);
    if (room.taxesAndFees > 0) bookParams.set('taxesAndFees', String(room.taxesAndFees));
    bookParams.set('amount', String(room.totalRateINR));
    bookParams.set('mealBasis', room.mealBasis);
    bookParams.set('roomName', room.name);
    if (room.cancellationSummary) bookParams.set('cancellationSummary', room.cancellationSummary);
    if (galleryImages.length) bookParams.set('images', JSON.stringify(galleryImages.map(({ src }) => src)));
    navigate(`/hotels/${encodeURIComponent(id)}/book?${bookParams.toString()}`);
  }

  return (
    <div className="min-h-[calc(100vh-6.25rem)] bg-slate-100">
      <div className="max-w-screen-xl mx-auto px-4 py-5 space-y-4">
        <Link to={`/hotels/results?${params.toString()}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-accent-600">
          <ArrowLeft className="w-4 h-4" /> Back to results
        </Link>

        {isInitializing && !showFatalError && (
          <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-slate-500">
            Loading hotel details...
          </div>
        )}

        {showFatalError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-700 text-sm">
            Failed to load hotel details. Please go back and try again.
          </div>
        )}

        {hasAnyError && !showFatalError && hasStaticContent && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Live hotel details could not be loaded right now. Showing available hotel information.
          </div>
        )}

        {isEmptyContent && !isInitializing && !showFatalError && (
          <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-slate-500">
            Hotel information is currently unavailable for this selection. Please try again.
          </div>
        )}

        {(hasStaticContent || detail) && (
          <>
            <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="relative z-10 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h1 className="text-2xl sm:text-3xl font-semibold leading-tight text-slate-900">{hotelName}</h1>
                  {starRating > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={`${starRating} star hotel`}>
                      {Array.from({ length: Math.min(starRating, 5) }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-[#f8b400] text-[#f8b400]" />
                      ))}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                  <span>{fullAddress || query.city}</span>
                  <button
                    type="button"
                    onClick={() => setMapOpen(true)}
                    disabled={!mapCoords && !fullAddress}
                    className={clsx(
                      'inline-flex items-center gap-1 font-semibold',
                      mapCoords || fullAddress
                        ? 'text-[#2f80ed] hover:underline'
                        : 'text-slate-400 cursor-not-allowed',
                    )}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Show on map
                  </button>
                  {propertyType && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {propertyType}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                <div className="space-y-4 min-w-0">
                  {galleryImages.length > 0 ? (
                    <div className="grid auto-rows-[180px] gap-2 sm:gap-3 md:grid-cols-3 md:grid-rows-[180px_180px]">
                      {galleryImages.slice(0, PREVIEW_IMAGE_COUNT).map(({ src, index }, previewIndex) => {
                        const isLastPreview = previewIndex === PREVIEW_IMAGE_COUNT - 1 && galleryImages.length > PREVIEW_IMAGE_COUNT;
                        return (
                          <button
                            key={`${src}-${index}`}
                            type="button"
                            onClick={() => openGallery(index, true)}
                            className={clsx(
                              'relative overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500',
                              previewIndex === 0 ? 'md:col-span-2 md:row-span-2' : '',
                              previewIndex >= 3 ? 'md:row-start-2' : '',
                            )}
                          >
                            <img
                              src={src}
                              alt={`${hotelName} photo ${previewIndex + 1}`}
                              onError={() => setFailedImageSources((current) => {
                                if (current.has(src)) return current;
                                const next = new Set(current);
                                next.add(src);
                                return next;
                              })}
                              className={clsx(
                                'w-full object-cover bg-slate-100',
                                'h-full',
                              )}
                            />
                            {isLastPreview && (
                              <span className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-sm font-semibold text-white">
                                +{galleryImages.length - PREVIEW_IMAGE_COUNT} photos
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      Hotel photos are not available.
                    </div>
                  )}

                  {descriptionSections.length > 0 && (
                    <div className="border-t border-slate-200 pt-5">
                      <h2 className="text-lg font-semibold text-slate-900">About this property</h2>
                      <div className="mt-3 space-y-3">
                        {descriptionSections.slice(0, 2).map((section) => (
                          <div key={section.title}>
                            <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-700 line-clamp-4">{section.text}</p>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveModal('property')}
                        className="mt-2 text-sm font-semibold text-[#2f80ed] hover:underline"
                      >
                        Read more
                      </button>
                    </div>
                  )}

                  {flatAmenities.length > 0 && (
                    <div className="border-t border-slate-200 pt-5">
                      <h2 className="text-lg font-semibold text-slate-900">Amenities</h2>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
                        {flatAmenities.slice(0, 8).map((item) => (
                          <span key={item.id || item.name} className="inline-flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            {item.name}
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => setActiveModal('amenities')}
                          className="text-sm font-semibold text-[#2f80ed] hover:underline"
                        >
                          View more
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 lg:sticky lg:top-4">
                  <DetailBookingCard
                    leadRoom={leadRoom}
                    liveLoading={liveLoading}
                    roomCount={query.rooms.length}
                    totalAdults={totalAdults}
                    hasMultipleRooms={hasMultipleRooms}
                    roomsPanelExpanded={roomsPanelExpanded}
                    onBook={() => leadRoom && selectRoom(leadRoom)}
                    onViewDetails={() => scrollToRoomTypes(false)}
                    onViewAllRooms={() => scrollToRoomTypes(true)}
                  />
                  <ReviewSummaryBar
                    reviewSummary={reviewSummary}
                    onOpenReviews={() => setActiveModal('reviews')}
                  />
                  <CheckInOutBar
                    checkIn={checkInOutTimes.checkIn}
                    checkOut={checkInOutTimes.checkOut}
                  />
                </div>
              </div>
            </section>

            <section
              ref={roomTypesRef}
              className={clsx(
                'rounded-md border bg-white p-5 shadow-sm scroll-mt-24',
                roomsPanelExpanded ? 'border-accent-300 ring-1 ring-accent-100' : 'border-slate-200',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Room types</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Showing results of {filteredRooms.length} of {roomOptions.length} room options
                  </p>
                  <p className="text-xs text-slate-500">
                    {fmtDate(query.checkIn)} - {fmtDate(query.checkOut)} | {query.rooms.length} Room, {totalAdults} Adult(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {liveLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  <button
                    type="button"
                    onClick={() => {
                      const message = [
                        `Check out ${hotelName}`,
                        `${fmtDate(query.checkIn)} to ${fmtDate(query.checkOut)}`,
                        `${query.rooms.length} Room, ${totalAdults} Adult${totalAdults === 1 ? '' : 's'}`,
                        window.location.href,
                      ].join('\n');
                      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </button>
                </div>
              </div>

              {liveRatesUnavailable && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Live TripJack room options are temporarily unavailable. Showing the starting rate from your search results below.
                </div>
              )}

              {liveError && roomOptions.length === 0 && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Live room rates are temporarily unavailable. Property information above is still available from our catalog.
                </div>
              )}

              {roomOptions.length > 0 && !usingListingFallback && (
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={filters.roomSearch}
                      onChange={(event) => setFilters((prev) => ({ ...prev, roomSearch: event.target.value }))}
                      placeholder="Search by Room Type/Room Category"
                      className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FilterChip active={filters.refundable} onClick={() => toggleFilter('refundable')} label="Refundable" />
                    <FilterChip active={filters.breakfast} onClick={() => toggleFilter('breakfast')} label="Breakfast Included" />
                    <FilterChip active={filters.panOptional} onClick={() => toggleFilter('panOptional')} label="PAN (Optional)" />
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMealMenuOpen((open) => !open)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Meal Plans: {filters.mealPlan === 'all' ? 'All' : filters.mealPlan}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {mealMenuOpen && (
                        <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] rounded-md border border-slate-200 bg-white shadow-lg">
                          <button
                            type="button"
                            onClick={() => { setFilters((prev) => ({ ...prev, mealPlan: 'all' })); setMealMenuOpen(false); }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            All
                          </button>
                          {mealPlans.map((plan) => (
                            <button
                              key={plan}
                              type="button"
                              onClick={() => { setFilters((prev) => ({ ...prev, mealPlan: plan })); setMealMenuOpen(false); }}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              {plan}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Filter
                    </button>
                  </div>
                </div>
              )}

              {roomOptions.length > 0 && (
                <div className="mt-4 space-y-4">
                  {groupedRooms.length === 0 && !usingListingFallback && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      No room options match the selected filters. Try clearing a filter.
                    </div>
                  )}

                  {groupedRooms.map((group) => (
                    <RoomTypeCard
                      key={group.name}
                      group={group}
                      roomCount={query.rooms.length}
                      totalAdults={totalAdults}
                      onSelectRoom={selectRoom}
                      onOpenCancellation={setCancellationRoom}
                      onOpenAmenities={() => setActiveModal('amenities')}
                      onOpenPhotos={(startIndex) => openGallery(startIndex, true)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {activeModal === 'photos' && images.length > 0 && (
        <PhotoGalleryModal
          title={`${hotelName} photos`}
          images={images}
          startIndex={galleryStartIndex}
          initialLightboxOpen={galleryLightboxOpen}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'property' && (
        <DetailModal title="Property details" onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            {descriptionSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700 whitespace-pre-line">{section.text}</p>
              </div>
            ))}
            {policySections.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-slate-900">Policies</h3>
                <div className="mt-3 space-y-3">
                  {policySections.map((section) => (
                    <div key={section.title}>
                      <div className="text-sm font-semibold text-slate-800">{section.title}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-700 whitespace-pre-line">{section.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DetailModal>
      )}

      {activeModal === 'amenities' && (
        <DetailModal title={`${hotelName} amenities`} onClose={() => setActiveModal(null)}>
          <div className="space-y-6">
            {(amenityGroups.length ? amenityGroups : [{ title: 'Hotel amenities', items: flatAmenities }]).map((group) => (
              <div key={group.key || group.title}>
                <h3 className="text-base font-semibold text-slate-900">{group.title}</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(group.items || []).map((item) => (
                    <li key={item.id || item.name} className="flex items-start gap-2 text-sm text-slate-700">
                      <Sparkles className="mt-0.5 w-4 h-4 shrink-0 text-accent-500" />
                      <span>{item.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DetailModal>
      )}

      {activeModal === 'reviews' && (
        <DetailModal
          title={
            reviewSummary.reviewScore > 0
              ? `${reviewSummary.label || scoreText(reviewSummary.reviewScore)} - Summary of ${fmtCount(reviewSummary.reviewCount)} reviews`
              : 'Guest reviews'
          }
          onClose={() => setActiveModal(null)}
        >
          {reviewSummary.reviewScore > 0 ? (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="text-5xl font-semibold text-[#ea7a18]">{reviewSummary.reviewScore.toFixed(1)}</div>
                  <div>
                    <div className="text-lg font-semibold text-slate-800">{reviewSummary.label}</div>
                    <div className="text-sm text-slate-500">{fmtCount(reviewSummary.reviewCount)} ratings</div>
                  </div>
                </div>
                {reviewSummary.categories.length > 0 ? (
                  <div className="space-y-3">
                    {reviewSummary.categories.map((category) => (
                      <div key={category.key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{category.label}</span>
                          <span className="font-semibold text-slate-900">{category.score.toFixed(1)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-[#2f80ed]"
                            style={{ width: `${Math.min(100, (category.score / 5) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    Detailed category ratings are not available for this hotel yet.
                  </p>
                )}
              </div>
              {reviewSummary.highlights.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Good to know</h3>
                  <ul className="mt-3 space-y-2">
                    {reviewSummary.highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                        <Info className="mt-0.5 w-4 h-4 shrink-0 text-accent-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
              <div className="mx-auto inline-flex rounded-md bg-emerald-600/15 px-3 py-1.5 text-sm font-bold text-emerald-800">
                Excellent
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Guest reviews are not available for this property yet. Check back later for ratings and feedback from travellers.
              </p>
            </div>
          )}
        </DetailModal>
      )}

      {cancellationRoom && (
        <CancellationPolicyModal
          room={cancellationRoom}
          onClose={() => setCancellationRoom(null)}
        />
      )}

      {(mapCoords || fullAddress) && (
        <HotelMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          latitude={mapCoords?.latitude}
          longitude={mapCoords?.longitude}
          title={hotelName}
          address={fullAddress}
        />
      )}
    </div>
  );
}

function DetailBookingCard({
  leadRoom,
  liveLoading,
  roomCount,
  totalAdults,
  hasMultipleRooms,
  roomsPanelExpanded,
  onBook,
  onViewDetails,
  onViewAllRooms,
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      {liveLoading && !leadRoom ? (
        <div className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading live rates...
        </div>
      ) : leadRoom ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-bold leading-snug text-slate-900">{leadRoom.name}</h3>
            <button
              type="button"
              onClick={onViewDetails}
              className="shrink-0 text-sm font-semibold text-[#2f80ed] hover:underline"
            >
              View details
            </button>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {roomCount} Room for {totalAdults} Adult{totalAdults === 1 ? '' : 's'}
          </p>

          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
            <li>{leadRoom.mealBasis || 'Room Only'}</li>
            <li>{leadRoom.panRequired ? 'PAN Required' : 'PAN (Optional)'}</li>
            <li>{leadRoom.refundable ? 'Refundable' : 'Non-refundable'}</li>
          </ul>

          <div className="mt-4 text-3xl font-bold text-slate-900">{fmtINR(leadRoom.totalRateINR)}</div>
          <p className="text-xs text-slate-500">Total Price for {roomCount} room</p>

          <button
            type="button"
            onClick={onBook}
            disabled={leadRoom.fromSearchListing}
            className={clsx(
              'mt-4 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white',
              leadRoom.fromSearchListing
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-accent-500 hover:bg-accent-600',
            )}
          >
            {leadRoom.fromSearchListing ? 'Live rates unavailable' : 'Book Now'}
          </button>

          {hasMultipleRooms && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="text-sm font-semibold text-slate-800">More options available</p>
              <button
                type="button"
                onClick={onViewAllRooms}
                className={clsx(
                  'mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border-2 px-4 py-2.5 text-sm font-semibold transition',
                  roomsPanelExpanded
                    ? 'border-accent-500 bg-accent-50 text-accent-700'
                    : 'border-accent-500 bg-white text-accent-600 hover:bg-accent-50',
                )}
              >
                View all rooms
                <ChevronDown className={clsx('w-4 h-4 transition-transform', roomsPanelExpanded && 'rotate-180')} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-slate-500">Live rates unavailable</div>
      )}
    </div>
  );
}

function ReviewSummaryBar({ reviewSummary, onOpenReviews }) {
  const hasReviews = reviewSummary.reviewScore > 0;

  return (
    <div className="flex items-center gap-3 border-t border-slate-200 pt-3">
      <div className={clsx(
        'shrink-0 rounded px-2 py-1.5 text-sm font-bold text-white min-w-[2.75rem] text-center',
        hasReviews ? 'bg-emerald-600' : 'bg-emerald-600/25 text-emerald-800',
      )}
      >
        {hasReviews ? reviewSummary.reviewScore.toFixed(1) : '—'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-800">
          {hasReviews ? (reviewSummary.label || scoreText(reviewSummary.reviewScore)) : 'Excellent'}
        </div>
        <div className="text-xs text-slate-500">
          {hasReviews && reviewSummary.reviewCount > 0
            ? `${fmtCount(reviewSummary.reviewCount)} Ratings`
            : 'Ratings not available yet'}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenReviews}
        className="shrink-0 text-sm font-semibold text-[#2f80ed] hover:underline"
      >
        Read all reviews
      </button>
    </div>
  );
}

function CheckInOutBar({ checkIn, checkOut }) {
  return (
    <div className="grid grid-cols-1 divide-y rounded-md border border-slate-200 bg-slate-50 text-sm overflow-hidden sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      <div className="px-4 py-3">
        <div className="font-semibold text-slate-800">Check-in from:</div>
        <div className="mt-0.5 text-slate-600">{checkIn || 'Contact hotel for timings'}</div>
      </div>
      <div className="px-4 py-3">
        <div className="font-semibold text-slate-800">Check-out until:</div>
        <div className="mt-0.5 text-slate-600">{checkOut || 'Contact hotel for timings'}</div>
      </div>
    </div>
  );
}

function RoomTypeCard({
  group,
  roomCount,
  totalAdults,
  onSelectRoom,
  onOpenCancellation,
  onOpenAmenities,
  onOpenPhotos,
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const gallery = group.images?.length ? group.images : [];
  const safeIndex = gallery.length ? imageIndex % gallery.length : 0;
  const previewAmenities = (group.amenities || []).slice(0, 4);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col xl:flex-row">
        <div className="w-full shrink-0 border-b border-slate-200 p-4 xl:w-[300px] xl:border-b-0 xl:border-r">
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-slate-100">
            {gallery.length > 0 ? (
              <>
                <img src={gallery[safeIndex]} alt={group.name} className="h-full w-full object-cover" />
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setImageIndex((idx) => (idx - 1 + gallery.length) % gallery.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageIndex((idx) => (idx + 1) % gallery.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                {gallery.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onOpenPhotos(safeIndex)}
                    className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white"
                  >
                    +{gallery.length - 1} Photos →
                  </button>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No room photos</div>
            )}
          </div>

          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-slate-500" />
              <span>{group.bedType || 'Standard bedding'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              <span>Fits max. {group.maxGuests || totalAdults} guests</span>
            </div>
          </div>

          {previewAmenities.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs text-slate-700">
              {previewAmenities.map((item) => (
                <div key={item.id || item.name} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="line-clamp-1">{item.name}</span>
                </div>
              ))}
            </div>
          )}

          {(group.amenities?.length || 0) > 4 && (
            <button
              type="button"
              onClick={onOpenAmenities}
              className="mt-2 text-xs font-semibold text-[#2f80ed] hover:underline"
            >
              View more amenities
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 divide-y divide-slate-200">
          {group.rates.map((rate) => (
            <div key={rate.optionId || rate.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900">{group.name}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {rate.mealBasis} | {rate.refundable ? 'Refundable' : 'Non-refundable'} | {rate.panRequired ? 'PAN Required' : 'PAN (Optional)'}
                </p>
                <p className={clsx(
                  'mt-2 text-sm font-medium',
                  rate.refundable ? 'text-emerald-700' : 'text-slate-600',
                )}>
                  {rate.refundable ? '✓ ' : ''}{rate.cancellationSummary}
                </p>
                {(rate.cancellation?.penalties?.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenCancellation(rate)}
                    className="mt-1 text-sm font-semibold text-[#2f80ed] hover:underline"
                  >
                    View more
                  </button>
                )}
              </div>

              <div className="shrink-0 text-right">
                <div className="flex items-start justify-end gap-1">
                  <span className="text-2xl font-bold text-slate-900">{fmtINR(rate.totalRateINR)}</span>
                  <span className="rounded bg-[#2f80ed] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Total</span>
                </div>
                <p className="text-xs text-slate-500">
                  Total Price for {roomCount} room{roomCount === 1 ? '' : 's'}
                </p>
                <button
                  type="button"
                  onClick={() => onSelectRoom(rate)}
                  disabled={rate.fromSearchListing}
                  className={clsx(
                    'mt-3 inline-flex min-w-[140px] items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold text-white',
                    rate.fromSearchListing
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-accent-500 hover:bg-accent-600',
                  )}
                >
                  {rate.fromSearchListing ? 'Unavailable' : 'Select Room'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function CancellationPolicyModal({ room, onClose }) {
  const penalties = Array.isArray(room?.cancellation?.penalties) ? room.cancellation.penalties : [];
  const summary = formatCancellationSummary(room?.cancellation);
  const freePenalty = penalties.find((row) => Number(row.amount || 0) === 0);
  const paidPenalty = penalties.find((row) => Number(row.amount || 0) > 0);

  return (
    <DetailModal title="Room with Cancellation Policy" onClose={onClose}>
      <div className="space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>{summary}</li>
          {paidPenalty?.from && (
            <li>No Refund if cancelled after {formatPolicyDateTime(paidPenalty.from)}</li>
          )}
        </ul>

        {penalties.length > 0 && (
          <>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="flex h-10 text-xs font-semibold text-white">
                {freePenalty && (
                  <div className="flex flex-1 items-center justify-center bg-emerald-600 px-2">100% Refund</div>
                )}
                {paidPenalty && (
                  <div className="flex flex-1 items-center justify-center bg-red-600 px-2">Non-Refundable</div>
                )}
              </div>
              <div className="flex justify-between px-3 py-2 text-xs text-slate-600">
                <span>Now</span>
                {freePenalty?.to && <span>{formatPolicyDateTime(freePenalty.to)}</span>}
                {paidPenalty?.to && <span>{formatPolicyDateTime(paidPenalty.to)}</span>}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-300">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="border-r border-slate-300 px-3 py-2 text-left font-semibold">Cancellation On or After</th>
                    <th className="border-r border-slate-300 px-3 py-2 text-left font-semibold">Cancellation On or Before</th>
                    <th className="px-3 py-2 text-left font-semibold">Cancellation Charges</th>
                  </tr>
                </thead>
                <tbody>
                  {penalties.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200">
                      <td className="border-r border-slate-200 px-3 py-2">{formatPolicyDateTime(row.from)}</td>
                      <td className="border-r border-slate-200 px-3 py-2">{formatPolicyDateTime(row.to)}</td>
                      <td className="px-3 py-2">{Number(row.amount) === 0 ? fmtINR(0) : fmtINR(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="space-y-1 text-xs text-slate-500">
          <p>* No Show will attract full cancellation charge unless otherwise specified.</p>
          <p>* Early check out will attract full cancellation charge unless otherwise specified.</p>
        </div>
      </div>
    </DetailModal>
  );
}

function DetailModal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-label="Close modal" />
      <div className={clsx(
        'relative max-h-[85vh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl',
        wide ? 'max-w-6xl' : 'max-w-3xl',
      )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900 pr-8">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[calc(85vh-4rem)] overflow-y-auto px-5 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function PhotoGalleryModal({ title, images, startIndex = 0, initialLightboxOpen = false, onClose }) {
  const [lightboxIndex, setLightboxIndex] = useState(initialLightboxOpen ? startIndex : -1);

  function openLightbox(index) {
    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxIndex(-1);
  }

  function showPrevious() {
    setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
  }

  function showNext() {
    setLightboxIndex((prev) => (prev + 1) % images.length);
  }

  return (
    <>
      {lightboxIndex < 0 && (
        <DetailModal title={title} onClose={onClose} wide>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                onClick={() => openLightbox(index)}
                className="overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              >
                <img
                  src={src}
                  alt={`${title} ${index + 1}`}
                  className="aspect-[4/3] w-full object-cover bg-slate-100"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </DetailModal>
      )}

      <PhotoLightbox
        images={images}
        index={lightboxIndex}
        onClose={() => {
          if (initialLightboxOpen && lightboxIndex >= 0) {
            onClose();
            return;
          }
          closeLightbox();
        }}
        onPrevious={showPrevious}
        onNext={showNext}
      />
    </>
  );
}

function PhotoLightbox({ images, index, onClose, onPrevious, onNext }) {
  const containerRef = useRef(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, [index]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'ArrowLeft') onPrevious();
      if (event.key === 'ArrowRight') onNext();
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onNext, onPrevious]);

  if (index < 0 || !images[index]) return null;

  const hasMultiple = images.length > 1;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 outline-none"
      tabIndex={-1}
    >
      <button type="button" className="absolute inset-0 bg-slate-950/90" onClick={onClose} aria-label="Close photo viewer" />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-full bg-white p-2 text-slate-800 shadow-lg hover:bg-slate-100"
      >
        <X className="w-5 h-5" />
      </button>
      {hasMultiple && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPrevious();
          }}
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white p-3 text-slate-900 shadow-lg hover:bg-slate-100 sm:left-6"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}
      <img
        src={images[index]}
        alt={`Hotel photo ${index + 1} of ${images.length}`}
        className="relative z-10 max-h-[85vh] max-w-[min(1100px,88vw)] rounded-md object-contain shadow-2xl"
      />
      {hasMultiple && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNext();
          }}
          className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white p-3 text-slate-900 shadow-lg hover:bg-slate-100 sm:right-6"
          aria-label="Next photo"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}
      <div className="absolute bottom-5 z-20 rounded-full bg-black/70 px-4 py-1.5 text-sm font-medium text-white">
        {index + 1} / {images.length}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition',
        active
          ? 'border-accent-400 bg-accent-50 text-accent-700'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      {label}
    </button>
  );
}
