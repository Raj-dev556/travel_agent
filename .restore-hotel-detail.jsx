import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Info,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../api';
import {
  buildAddressLine,
  collectDescriptions,
  collectPolicySections,
  extractReviewSummary,
  filterRoomOptions,
  firstResult,
  fmtCount,
  fmtINR,
  formatCancellationSummary,
  imageUrl,
  optionToRoom,
  resolveSelectedRoom,
  scoreText,
  uniqueMealPlans,
} from './hotelTripjackHelpers';

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

export default function HotelDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(null);
  const [filters, setFilters] = useState({
    refundable: false,
    breakfast: false,
    panOptional: false,
    mealPlan: 'all',
  });
  const [mealMenuOpen, setMealMenuOpen] = useState(false);

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
      reviewScore: Number(params.get('reviewScore') || 0),
      reviewCount: Number(params.get('reviewCount') || 0),
    };
  }, [params]);

  const tjHotelId = String(id || '').trim();

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
  }), [tjHotelId, query]);

  const { data: liveData, isLoading: liveLoading, error: liveError } = useQuery({
    queryKey: ['hotel-detail', detailPayload],
    queryFn: () => api.post('/hotels/hotel-details', detailPayload).then((res) => res.data),
    enabled: Boolean(tjHotelId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const staticRecord = firstResult(staticData);
  const staticContent = staticRecord?.staticContent || staticData?.staticContent || firstResult(liveData)?.staticContent || {};
  const detail = firstResult(liveData);
  const address = staticContent.address || {};
  const images = (staticContent.images || detail?.images || []).map(imageUrl).filter(Boolean);
  const amenityGroups = staticContent.amenityGroups || [];
  const flatAmenities = staticContent.amenities || [];
  const descriptionSections = collectDescriptions(staticContent.descriptions || {});
  const policySections = collectPolicySections(staticContent.policies || {});
  const reviewSummary = useMemo(
    () => extractReviewSummary(detail || {}, { reviewScore: query.reviewScore, reviewCount: query.reviewCount }),
    [detail, query.reviewScore, query.reviewCount],
  );

  const roomOptions = useMemo(() => {
    const options = Array.isArray(detail?.options) ? detail.options : [];
    return options.map(optionToRoom).filter((room) => room.totalRateINR > 0);
  }, [detail?.options]);

  const mealPlans = useMemo(() => uniqueMealPlans(roomOptions), [roomOptions]);
  const filteredRooms = useMemo(
    () => filterRoomOptions(roomOptions, filters),
    [roomOptions, filters],
  );

  const selectedRoom = useMemo(
    () => resolveSelectedRoom(roomOptions, query),
    [roomOptions, query],
  );

  const leadRoom = selectedRoom || filteredRooms[0] || roomOptions[0] || null;
  const hotelName = staticRecord?.hotelName || staticContent.hotelName || detail?.hotelName || query.hotelName || 'Hotel details';
  const starRating = Number(staticRecord?.starRating || staticContent.starRating || detail?.starRating || 0);
  const propertyType = resolvePropertyTypeLabel(
    staticRecord?.propertyType || staticContent.propertyType || detail?.propertyType,
  );
  const fullAddress = buildAddressLine(address, query.city);
  const hasStaticContent = Boolean(
    (staticData?.success && staticRecord) ||
    staticContent.hotelName ||
    detail?.hotelName ||
    query.hotelName,
  );
  const showFatalError = staticError && liveError && !hasStaticContent;

  function toggleFilter(key) {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectRoom(room) {
    const bookParams = new URLSearchParams(params);
    if (room.optionId) bookParams.set('optionId', room.optionId);
    bookParams.delete('reviewHash');
    bookParams.delete('correlationId');
    bookParams.set('amount', String(room.totalRateINR));
    bookParams.set('mealBasis', room.mealBasis);
    bookParams.set('roomName', room.name);
    navigate(`/hotels/${encodeURIComponent(id)}/book?${bookParams.toString()}`);
  }

  return (
    <div className="min-h-[calc(100vh-6.25rem)] bg-slate-100">
      <div className="max-w-screen-xl mx-auto px-4 py-5 space-y-4">
        <Link to={`/hotels/results?${params.toString()}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-accent-600">
          <ArrowLeft className="w-4 h-4" /> Back to results
        </Link>

        {staticLoading && !hasStaticContent && (
          <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-slate-500">
            Loading hotel information...
          </div>
        )}

        {showFatalError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-700 text-sm">
            Failed to load hotel details. Please go back and try again.
          </div>
        )}

        {(hasStaticContent || detail) && (
          <>
            <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-semibold leading-tight text-slate-900">{hotelName}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-accent-500 shrink-0" />
                      <span>{fullAddress || query.city}</span>
                    </span>
                    {starRating > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: starRating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-[#f8b400] text-[#f8b400]" />
                        ))}
                      </span>
                    )}
                    {propertyType && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {propertyType}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {descriptionSections.length > 0 && (
                      <DetailActionButton label="Property details" onClick={() => setActiveModal('property')} />
                    )}
                    {(amenityGroups.length > 0 || flatAmenities.length > 0) && (
                      <DetailActionButton label="Amenities" onClick={() => setActiveModal('amenities')} />
                    )}
                    {reviewSummary.reviewScore > 0 && (
                      <DetailActionButton
                        label={`Reviews ${reviewSummary.reviewScore.toFixed(1)}`}
                        onClick={() => setActiveModal('reviews')}
                      />
                    )}
                  </div>

                  {reviewSummary.reviewScore > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveModal('reviews')}
                      className="mt-4 inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 hover:border-accent-300 transition"
                    >
                      <div className="text-2xl font-semibold text-[#ea7a18]">{reviewSummary.reviewScore.toFixed(1)}</div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-slate-800">{reviewSummary.label || scoreText(reviewSummary.reviewScore)}</div>
                        <div className="text-xs text-slate-500">
                          {reviewSummary.reviewCount > 0 ? `${fmtCount(reviewSummary.reviewCount)} ratings` : 'Guest ratings'}
                        </div>
                      </div>
                    </button>
                  )}
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-right min-w-[180px]">
                  {liveLoading && !leadRoom ? (
                    <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading live rates...
                    </div>
                  ) : leadRoom ? (
                    <>
                      <div className="text-xs text-slate-500">From</div>
                      <div className="text-2xl font-semibold text-slate-900">{fmtINR(leadRoom.totalRateINR)}</div>
                      <div className="text-xs text-slate-500">Incl. of all taxes</div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">Live rates unavailable</div>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                {images.length > 0 && (
                  <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="grid gap-3 md:grid-cols-3">
                      {images.slice(0, 6).map((src, index) => (
                        <div key={`${src}-${index}`} className={index === 0 ? 'md:col-span-2 md:row-span-2' : ''}>
                          <img src={src} alt={hotelName} className="h-full min-h-[180px] w-full rounded-md object-cover bg-slate-100" />
                        </div>
                      ))}
                    </div>
                    {images.length > 6 && (
                      <div className="mt-2 text-xs text-slate-500">+{images.length - 6} more photos</div>
                    )}
                  </div>
                )}

                {descriptionSections.length > 0 && (
                  <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">About this property</h2>
                      <button
                        type="button"
                        onClick={() => setActiveModal('property')}
                        className="text-sm font-semibold text-accent-600 hover:text-accent-700"
                      >
                        View all
                      </button>
                    </div>
                    <div className="mt-3 space-y-3">
                      {descriptionSections.slice(0, 2).map((section) => (
                        <div key={section.title}>
                          <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-700 line-clamp-4">{section.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(amenityGroups.length > 0 || flatAmenities.length > 0) && (
                  <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">Popular amenities</h2>
                      <button
                        type="button"
                        onClick={() => setActiveModal('amenities')}
                        className="text-sm font-semibold text-accent-600 hover:text-accent-700"
                      >
                        See all
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(flatAmenities.length ? flatAmenities : amenityGroups.flatMap((group) => group.items))
                        .slice(0, 12)
                        .map((item, index) => (
                          <span key={item.id || item.name || index} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {item.name || item.label || String(item)}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Room types</h2>
                      <div className="text-xs text-slate-500 mt-1">
                        {liveLoading && roomOptions.length === 0
                          ? 'Fetching live room options from TripJack...'
                          : `Showing ${filteredRooms.length} of ${roomOptions.length} live room options`}
                      </div>
                    </div>
                    {liveLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  </div>

                  {liveError && roomOptions.length === 0 && (
                    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Live room rates are temporarily unavailable. Property information above is still available from our catalog.
                    </div>
                  )}

                  {roomOptions.length > 0 && (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
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
                      </div>

                      <div className="mt-4 space-y-3">
                        {filteredRooms.length === 0 && (
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            No room options match the selected filters. Try clearing a filter.
                          </div>
                        )}

                        {filteredRooms.map((room) => (
                          <article key={room.optionId} className="rounded-xl border border-slate-200 p-4 hover:border-accent-300 transition">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-base font-semibold text-slate-900">{room.name}</h3>
                                <div className="mt-1 text-sm text-slate-600">
                                  {room.mealBasis} | {room.refundable ? 'Refundable' : 'Non-refundable'} | {room.panRequired ? 'PAN Required' : 'PAN (Optional)'}
                                </div>
                                <div className={clsx(
                                  'mt-2 text-sm font-medium',
                                  room.refundable ? 'text-emerald-700' : 'text-slate-600',
                                )}>
                                  {room.cancellationSummary}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-2xl font-semibold text-slate-900">{fmtINR(room.totalRateINR)}</div>
                                <div className="text-xs text-slate-500">Incl. of all taxes</div>
                                <button
                                  type="button"
                                  onClick={() => selectRoom(room)}
                                  className="mt-3 inline-flex items-center justify-center rounded-md bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-600"
                                >
                                  Select Room
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
                <h2 className="text-lg font-semibold text-slate-900">Trip summary</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 w-4 h-4 text-accent-500" />
                    <span>{fmtDate(query.checkIn)} - {fmtDate(query.checkOut)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 w-4 h-4 text-accent-500" />
                    <span>
                      {query.rooms.length} Room, {query.rooms.reduce((sum, room) => sum + Number(room.adults || 0), 0)} Adult(s)
                    </span>
                  </div>
                  {leadRoom && (
                    <>
                      <div className="border-t border-slate-200 pt-3 text-sm">
                        <div className="font-medium text-slate-800">{leadRoom.name}</div>
                        <div className="text-slate-600">{leadRoom.mealBasis}</div>
                        <div className="text-slate-600">{formatCancellationSummary(leadRoom.cancellation)}</div>
                      </div>
                      <div className="border-t border-slate-200 pt-3">
                        <div className="text-xs text-slate-500">Payable amount</div>
                        <div className="text-2xl font-semibold text-slate-900">{fmtINR(leadRoom.totalRateINR)}</div>
                      </div>
                    </>
                  )}
                </div>
                {leadRoom && (
                  <button
                    type="button"
                    onClick={() => selectRoom(leadRoom)}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-accent-500 px-4 py-3 text-sm font-semibold text-white hover:bg-accent-600"
                  >
                    Continue booking
                  </button>
                )}
              </aside>
            </section>
          </>
        )}
      </div>

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

      {activeModal === 'reviews' && reviewSummary.reviewScore > 0 && (
        <DetailModal
          title={`${reviewSummary.label || scoreText(reviewSummary.reviewScore)} - Summary of ${fmtCount(reviewSummary.reviewCount)} reviews`}
          onClose={() => setActiveModal(null)}
        >
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
                  Detailed category ratings are not available for this hotel yet. Overall guest score is shown from live search results.
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
        </DetailModal>
      )}
    </div>
  );
}

function DetailActionButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-accent-300 hover:text-accent-700 transition"
    >
      {label}
    </button>
  );
}

function DetailModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-label="Close modal" />
      <div className="relative max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
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
