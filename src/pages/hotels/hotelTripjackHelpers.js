export const fmtINR = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(n) || 0);

const IMAGE_PATH_KEYS = [
  'url',
  'imageUrl',
  'image',
  'link',
  'href',
  'path',
  'src',
];

function readImageFromObject(candidate) {
  if (!candidate || typeof candidate !== 'object') return '';
  for (const key of IMAGE_PATH_KEYS) {
    const raw = candidate[key];
    if (typeof raw === 'string' && raw.trim()) return raw;
  }
  if (typeof candidate.src === 'string' && candidate.src.trim()) return candidate.src;
  if (typeof candidate.url === 'object' && candidate.url?.href) return candidate.url.href;
  if (candidate.image?.href) return candidate.image.href;
  if (candidate.image?.url && typeof candidate.image.url === 'string' && candidate.image.url.trim()) return candidate.image.url;
  return '';
}

function candidateImageSet(source) {
  if (!source) return [];

  if (typeof source === 'string') return [source];
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.images)) return source.images;
  if (Array.isArray(source?.media)) return source.media;
  if (Array.isArray(source?.photos)) return source.photos;
  if (Array.isArray(source?.imageUrls)) return source.imageUrls;
  if (Array.isArray(source?.mediaImages)) return source.mediaImages;
  if (Array.isArray(source?.imageGallery)) return source.imageGallery;
  if (Array.isArray(source?.images?.gallery)) return source.images.gallery;

  return [source];
}

export function imageUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;

  const links = image?.links;
  if (links && typeof links === 'object') {
    const preferred = links.XXL || links.XL || links.L || links.M || links.S || links.Standard;
    if (preferred?.href) return preferred.href;
    const first = Object.values(links).find((link) => link?.href);
    if (first?.href) return first.href;
  }

  const direct = readImageFromObject(image);
  if (direct) return direct;

  if (image?.url?.href) return image.url.href;
  if (typeof image?.uri === 'string' && image.uri) return image.uri;

  const directImage = image?.image || image?.thumbnail;
  if (typeof directImage === 'string' && directImage.trim()) return directImage;
  if (typeof directImage?.href === 'string') return directImage.href;
  if (typeof image?.media === 'string' && image.media.trim()) return image.media;
  if (typeof image?.thumb === 'string' && image.thumb.trim()) return image.thumb;
  return '';
}

export function collectHotelImages(...sources) {
  const normalizedSources = sources.flatMap(candidateImageSet).filter(Boolean);
  const seen = new Set();
  const urls = [];

  for (const source of normalizedSources) {
    const url = imageUrl(source);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}

export function firstResult(payload) {
  if (Array.isArray(payload?.results)) return payload.results[0] || null;
  if (Array.isArray(payload?.data?.results)) return payload.data.results[0] || null;
  if (Array.isArray(payload?.hotels)) return payload.hotels[0] || null;
  return payload?.result || payload?.data || null;
}

function looksLikeHotelRecord(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  return Boolean(
    candidate.hotelName ||
    candidate.tjHotelId ||
    candidate.tjid ||
    candidate.name ||
    Array.isArray(candidate.options) ||
    candidate.staticContent ||
    candidate.amenities ||
    candidate.facilities ||
    candidate.images,
  );
}

function extractLiveCandidates(payload) {
  if (!payload || typeof payload !== 'object') return [];
  return [
    payload,
    payload?.result,
    payload?.data,
    payload?.hotel,
    payload?.data?.hotel,
    payload?.property,
    payload?.data?.property,
    payload?.propertyInfo,
    payload?.result?.hotel,
    payload?.result?.property,
    payload?.result?.propertyInfo,
    firstResult(payload),
  ].filter(Boolean);
}

export function extractLiveDetail(payload) {
  for (const candidate of extractLiveCandidates(payload)) {
    if (looksLikeHotelRecord(candidate)) return candidate;
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload?.options) || payload?.hotelName || payload?.tjHotelId) return payload;
    if (payload.data && typeof payload.data === 'object') {
      if (Array.isArray(payload.data?.options) || payload.data?.hotelName || payload.data?.tjHotelId) {
        return payload.data;
      }
    }
  }

  return firstResult(payload);
}

function normalizeCancellationPolicy(raw) {
  if (!raw) return {};

  if (typeof raw === 'string') {
    return {
      policyText: raw,
      isRefundable: false,
      penalties: [],
    };
  }

  if (typeof raw !== 'object') return {};

  const penalties = Array.isArray(raw.penalties) || Array.isArray(raw.penalty)
    ? (Array.isArray(raw.penalties) ? raw.penalties : raw.penalty)
    : [];

  const policyText = raw.policyText || raw.summary || raw.description || raw.note || '';
  const isRefundable = Boolean(
    raw.isRefundable ??
    raw.refundable ??
    raw.freeCancellation ??
    raw.cancellationPolicy?.isRefundable ??
    raw.cancellation?.isRefundable,
  );

  return {
    ...raw,
    isRefundable,
    penalties,
    policyText,
  };
}

export function fallbackRoomFromSearchQuery(query = {}) {
  const totalRateINR = Number(query.amount || 0);
  if (totalRateINR <= 0 && !query.optionId) return null;

  return {
    id: query.optionId || query.roomName || 'search-listing-room',
    optionId: query.optionId || '',
    name: query.roomName || 'Room from search results',
    mealBasis: query.mealBasis || 'Room Only',
    boardBasis: query.mealBasis || 'Room Only',
    refundable: false,
    panRequired: false,
    panOptional: true,
    cancellation: {},
    cancellationSummary: 'See room details for cancellation policy',
    totalRateINR,
    nightlyRateINR: totalRateINR,
    taxesAndFees: 0,
    pricing: { totalPrice: totalRateINR },
    images: [],
    fromSearchListing: true,
  };
}

export function formatIsoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tryParseJsonObject(value) {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  const raw = String(value).trim();
  if (!raw.startsWith('{') && !raw.startsWith('[')) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeDescriptions(descriptions = {}) {
  let source = descriptions;

  if (typeof source === 'string') {
    source = tryParseJsonObject(source) || {};
  }

  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

  const normalized = { ...source };
  const parsedDefault = tryParseJsonObject(normalized.default);

  if (parsedDefault) {
    delete normalized.default;
    Object.entries(parsedDefault).forEach(([key, value]) => {
      if (!normalized[key] && value) normalized[key] = value;
    });
  } else if (typeof normalized.default === 'string' && normalized.default.trim().startsWith('{')) {
    delete normalized.default;
  }

  return normalized;
}

function formatDescriptionText(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(formatDescriptionText).filter(Boolean).join('\n');
    }
    return Object.values(value).map(formatDescriptionText).filter(Boolean).join('\n');
  }

  let text = stripHtml(String(value));
  text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
  return text.trim();
}

export function formatCancellationSummary(cancellation) {
  if (!cancellation) return 'Cancellation policy unavailable';

  const penalties = Array.isArray(cancellation.penalties) ? cancellation.penalties : [];
  const freePenalty = penalties.find((row) => Number(row.amount || 0) === 0);

  if (cancellation.isRefundable && freePenalty?.to) {
    return `Free Cancellation before ${formatIsoDate(freePenalty.to)}`;
  }
  if (cancellation.isRefundable) return 'Refundable';
  return 'Non-refundable';
}

export function collectDescriptions(descriptions = {}) {
  const normalized = normalizeDescriptions(descriptions);
  const sections = [
    ['headline', 'Headline'],
    ['location', 'Location'],
    ['amenities', 'Amenities'],
    ['rooms', 'Rooms'],
    ['dining', 'Dining'],
    ['business_amenities', 'Business amenities'],
    ['attractions', 'Attractions'],
    ['spoken_languages', 'Spoken languages'],
    ['onsite_payments', 'Onsite payments'],
    ['default', 'Overview'],
  ];

  const seenTexts = new Set();

  return sections
    .map(([key, title]) => {
      const text = formatDescriptionText(normalized[key]);
      if (!text || seenTexts.has(text)) return null;
      seenTexts.add(text);
      return { title, text };
    })
    .filter(Boolean);
}

export function scoreText(score) {
  const value = Number(score || 0);
  if (value >= 4.6) return 'Excellent';
  if (value >= 4.1) return 'Very Good';
  if (value >= 3.6) return 'Good';
  if (value > 0) return 'Average';
  return '';
}

export function fmtCount(n) {
  return new Intl.NumberFormat('en-IN').format(Number(n) || 0);
}

export function buildAddressLine(address = {}, fallbackCity = '') {
  return address.fullAddress || [
    address.line1,
    address.line2,
    address.cityName || fallbackCity,
    address.stateName,
    address.countryName,
  ].filter(Boolean).join(', ');
}

export function extractCheckInOutTimes(policies = {}) {
  const check = policies.checkInCheckOut || {};
  const checkInFrom = check.checkInFrom || check.checkin_from || check.checkinFrom || '';
  const checkInTill = check.checkInTill || check.checkin_till || check.checkinTill || '';
  const checkOutTill = check.checkOutTill || check.checkout_till || check.checkoutTill || '';
  const checkOutFrom = check.checkOutFrom || check.checkout_from || check.checkoutFrom || '';

  let checkIn = '';
  if (checkInFrom && checkInTill) checkIn = `${checkInFrom} - ${checkInTill}`;
  else if (checkInFrom) checkIn = `${checkInFrom} - anytime`;
  else if (checkInTill) checkIn = checkInTill;

  const checkOut = checkOutTill || checkOutFrom || '';

  return { checkIn, checkOut };
}

function formatPolicyBlock(value) {
  if (value == null || value === '') return '';

  const parsed = tryParseJsonObject(value);
  if (!parsed) return formatDescriptionText(value);

  return Object.entries(parsed)
    .map(([, entryValue]) => formatDescriptionText(entryValue))
    .filter(Boolean)
    .join('\n\n');
}

function readPolicyValue(policies, ...keys) {
  for (const key of keys) {
    const value = policies?.[key];
    if (value != null && value !== '') return value;
  }
  return null;
}

export function collectPolicySections(policies = {}) {
  const rows = [];
  const { checkIn, checkOut } = extractCheckInOutTimes(policies);
  if (checkIn) rows.push({ title: 'Check-in', text: checkIn });
  if (checkOut) rows.push({ title: 'Check-out', text: checkOut });

  const knowBefore = formatPolicyBlock(readPolicyValue(
    policies,
    'know_before_you_go',
    'knowBeforeYouGo',
  ));
  if (knowBefore) rows.push({ title: 'Policies', text: knowBefore });

  const checkinInstructions = formatPolicyBlock(readPolicyValue(
    policies,
    'special_instructions',
    'specialInstructions',
  ));
  if (checkinInstructions) rows.push({ title: 'Checkin Instructions', text: checkinInstructions });

  const fees = formatPolicyBlock(readPolicyValue(
    policies,
    'mandatory_fees',
    'mandatoryFees',
  ));
  if (fees) rows.push({ title: 'Fees', text: fees });

  return rows;
}

const REVIEW_CATEGORY_KEYS = [
  ['cleanliness', 'Cleanliness'],
  ['comfort', 'Comfort'],
  ['facilities', 'Facilities'],
  ['staff', 'Staff'],
  ['location', 'Location'],
  ['value', 'Value'],
  ['room', 'Room'],
  ['service', 'Service'],
];

export function extractReviewSummary(source = {}, fallback = {}) {
  const reviewScore = Number(
    source.reviewScore
    ?? source.rating
    ?? source.overallRating
    ?? fallback.reviewScore
    ?? 0,
  );
  const reviewCount = Number(
    source.reviewCount
    ?? source.ratingCount
    ?? source.totalReviews
    ?? fallback.reviewCount
    ?? 0,
  );

  const ratingRoot = source.ratings || source.ratingBreakdown || source.categoryRatings || source.reviewRatings || {};
  const categories = REVIEW_CATEGORY_KEYS
    .map(([key, label]) => {
      const raw = ratingRoot[key] ?? source[key];
      const score = Number(raw?.score ?? raw?.rating ?? raw ?? 0);
      return score > 0 ? { key, label, score } : null;
    })
    .filter(Boolean);

  const highlights = Array.isArray(source.goodToKnow)
    ? source.goodToKnow
    : Array.isArray(source.highlights)
      ? source.highlights
      : [];

  const summary = {
    categories,
    highlights: highlights.map((item) => (
      typeof item === 'string' ? item : item?.label || item?.text || item?.name || ''
    )).filter(Boolean),
  };

  if (reviewScore > 0) summary.reviewScore = reviewScore;
  if (reviewCount > 0) summary.reviewCount = reviewCount;
  if (reviewScore > 0) summary.label = scoreText(reviewScore);

  return summary;
}

export function optionToRoom(option) {
  const room = (option?.roomInfo || [])[0] || option?.room || {};
  const pricing = option?.pricing || option?.price || option?.fare || {};
  const compliance = option?.compliance || {};
  const cancellation = normalizeCancellationPolicy(
    option?.cancellation || option?.cancellationPolicy || option?.cancelPolicy || option?.cancellation_text,
  );
  const totalRateINR = Number(
    pricing.totalPrice
    ?? pricing.totalAmount
    ?? pricing.total
    ?? pricing.amount
    ?? option.totalRateINR
    ?? option.totalFare
    ?? option.total
    ?? option.amount
    ?? option.rate
    ?? option.price
    ?? 0,
  );
  const nightlyRateINR = Number(
    pricing.basePrice
    ?? pricing.nightly
    ?? pricing.baseFare
    ?? pricing.priceWithoutTax
    ?? option.nightlyRateINR
    ?? option.nightly
    ?? option.ratePerNight
    ?? totalRateINR
    ?? 0,
  );
  const taxes = Number(
    pricing.taxes
    ?? pricing.tax
    ?? option.taxes
    ?? option.tax
    ?? option.taxesAndFees
    ?? option.fees
    ?? 0,
  );
  const serviceCharges = Number(
    pricing.mf
    ?? pricing.mft
    ?? pricing.managementFees
    ?? pricing.managementFeesTax
    ?? pricing.serviceCharge
    ?? pricing.serviceCharges
    ?? option.serviceCharges
    ?? 0,
  );
  const taxesAndFees = taxes + serviceCharges;

  const roomImages = collectHotelImages(
    room.images,
    option?.images,
    option?.roomImages,
    option?.media,
    room.media,
    room.photos,
  );
  const cancellationSummary = cancellation.policyText || formatCancellationSummary(cancellation);
  const amenitySource = [
    room.amenities,
    room.facilities,
    room.facility,
    option?.amenities,
    option?.facilities,
    option?.roomAmenities,
  ];

  return {
    id: option?.optionId || room.id || room.name || option?.id || option?.roomId,
    optionId: option?.optionId || '',
    roomId: room.id || room.roomId || '',
    reviewHash: option?.reviewHash || option?.review_id || option?.reviewId || option?.hash || '',
    name: room.name
      || option?.roomName
      || option?.name
      || option?.title
      || room.roomName
      || option?.room_type
      || 'Room',
    bedType: room.bedType || room.bed || room.bedDescription || '',
    maxGuests: Number(room.maxOccupancy || room.maxGuests || room.occupancy || room.capacity || 0),
    mealBasis: option?.mealBasis || option?.boardBasis || option?.mealPlan || option?.meal || 'Room Only',
    boardBasis: option?.mealBasis || option?.boardBasis || option?.mealPlan || option?.meal || 'Room Only',
    refundable: Boolean(option?.cancellation?.isRefundable ?? option?.refundable ?? option?.isRefundable),
    panRequired: Boolean(compliance.panRequired),
    panOptional: !compliance.panRequired,
    cancellation,
    cancellationSummary,
    totalRateINR,
    nightlyRateINR,
    taxesAndFees,
    taxes: taxes,
    fees: Number(pricing.mf || pricing.managementFees || pricing.serviceCharge || 0) + Number(pricing.mft || pricing.managementFeesTax || 0),
    baseFare: Number(pricing.basePrice || pricing.base || 0),
    pricing,
    images: roomImages,
    amenities: normalizeAmenityList(amenitySource),
    facilities: normalizeAmenityList(room.facilities || option?.facilities || []),
    cancellationText: cancellationSummary,
  };
}

export function normalizeAmenityList(amenities) {
  if (!Array.isArray(amenities)) return [];

  const flatten = amenities
    .flatMap((item) => {
      if (!item) return [];
      if (Array.isArray(item)) return item;
      return [item];
    })
    .filter((item) => item != null && item !== '');

  return flatten
    .map((item) => {
      if (typeof item === 'string') return { id: item, name: item };
      return {
        id: String(item?.id || item?.name || item?.label || ''),
        name: String(item?.name || item?.label || item?.id || ''),
      };
    })
    .filter((item) => item.name);
}

export function formatPolicyDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function groupRoomsByType(rooms = []) {
  const groups = new Map();

  for (const room of rooms) {
    const key = room.name || 'Room';
    if (!groups.has(key)) {
      groups.set(key, {
        name: key,
        roomId: room.roomId || '',
        bedType: room.bedType || '',
        maxGuests: room.maxGuests || 0,
        images: room.images || [],
        amenities: room.amenities || [],
        rates: [],
      });
    }
    const group = groups.get(key);
    if (!group.bedType && room.bedType) group.bedType = room.bedType;
    if (!group.maxGuests && room.maxGuests) group.maxGuests = room.maxGuests;
    if (!group.images.length && room.images?.length) group.images = room.images;
    if (!group.amenities.length && room.amenities?.length) group.amenities = room.amenities;
    group.rates.push(room);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    rates: group.rates.sort((a, b) => a.totalRateINR - b.totalRateINR),
  }));
}

export function filterRoomOptions(rooms, filters) {
  return rooms.filter((room) => {
    if (filters.roomSearch) {
      const needle = String(filters.roomSearch).trim().toLowerCase();
      if (needle && !String(room.name || '').toLowerCase().includes(needle)) return false;
    }
    if (filters.refundable && !room.refundable) return false;
    if (filters.breakfast && !String(room.mealBasis).toLowerCase().includes('breakfast')) return false;
    if (filters.panOptional && room.panRequired) return false;
    if (filters.mealPlan && filters.mealPlan !== 'all' && room.mealBasis !== filters.mealPlan) return false;
    return true;
  });
}

export function uniqueMealPlans(rooms) {
  return [...new Set(rooms.map((room) => room.mealBasis).filter(Boolean))].sort();
}

export function resolveSelectedRoom(rooms, { optionId, amount, mealBasis, roomName } = {}) {
  if (!Array.isArray(rooms) || !rooms.length) return null;

  if (optionId) {
    const byId = rooms.find((room) => room.optionId === optionId);
    if (byId) return byId;
  }

  const targetAmount = Number(amount);
  if (targetAmount > 0) {
    const closeMatches = rooms.filter((room) => Math.abs(room.totalRateINR - targetAmount) < 1);
    if (mealBasis) {
      const mealMatch = closeMatches.find((room) => room.mealBasis === mealBasis);
      if (mealMatch) return mealMatch;
    }
    if (roomName) {
      const nameMatch = closeMatches.find((room) => room.name === roomName);
      if (nameMatch) return nameMatch;
    }
    if (closeMatches.length) return closeMatches[0];
  }

  if (mealBasis) {
    const byMeal = rooms.find((room) => room.mealBasis === mealBasis);
    if (byMeal) return byMeal;
  }

  return rooms.reduce((best, room) => (
    !best || room.totalRateINR < best.totalRateINR ? room : best
  ), null);
}

export function buildFareBreakdown(pricing = {}, fallbackTotal = 0) {
  const totalPrice = Number(pricing.totalPrice || pricing.totalAmount || pricing.total || fallbackTotal || 0);
  const basePrice = Number(pricing.basePrice || pricing.baseFare || pricing.priceWithoutTax || 0);
  const taxes = Number(pricing.taxes || pricing.tax || 0);
  const mf = Number(pricing.mf || pricing.managementFees || pricing.serviceCharge || 0);
  const mft = Number(pricing.mft || pricing.managementFeesTax || 0);
  const discount = Number(pricing.discount || 0);
  const taxesAndFees = taxes + mf + mft;

  return {
    totalPayable: totalPrice,
    baseFare: basePrice || Math.max(0, totalPrice - taxesAndFees),
    taxesAndFees,
    markup: Number(pricing.markup || 0),
    managementFees: mf,
    managementFeesTax: mft,
    taxes,
    discount,
    grossPrice: totalPrice,
    totalMarkup: Number(pricing.markup || 0),
    netPrice: totalPrice,
  };
}

const HOTEL_BOOKING_SNAPSHOT_KEY = 'hotelBookingSnapshot:v1';

export function getNestedField(data, keys, fallback = '') {
  if (!data) return fallback;
  for (const key of keys) {
    const value = String(key).split('.').reduce((acc, part) => (acc && part in acc ? acc[part] : undefined), data);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

export function extractBookingRecord(payload) {
  if (!payload) return null;
  const nested = firstResult(payload);
  return nested || payload.booking || payload.data || payload;
}

export function extractPricingFromSource(source) {
  if (!source || typeof source !== 'object') return null;

  const pricing = source.pricing || source.priceInfo || source.fare || source.amountDetails;
  if (pricing && typeof pricing === 'object') {
    const fare = buildFareBreakdown(pricing);
    if (fare.totalPayable > 0) return fare;
  }

  const total = Number(
    source.totalAmount
    ?? source.totalPrice
    ?? source.amount
    ?? source.totalFare
    ?? source.price
    ?? source.payableAmount
    ?? 0,
  );
  if (total <= 0) return null;

  const base = Number(source.baseFare ?? source.basePrice ?? source.priceWithoutTax ?? 0);
  const taxes = Number(source.taxes ?? source.tax ?? 0);
  const mf = Number(source.mf ?? source.managementFees ?? source.serviceCharge ?? source.convenienceSurcharge ?? 0);
  const mft = Number(source.mft ?? source.managementFeesTax ?? 0);

  if (base || taxes || mf || mft) {
    return buildFareBreakdown({
      totalPrice: total,
      basePrice: base,
      taxes,
      mf,
      mft,
    });
  }

  return buildFareBreakdown({}, total);
}

export function extractHotelBookingFare(payload, snapshot = null) {
  const record = extractBookingRecord(payload);
  const candidates = [
    record,
    record?.pricing,
    record?.fare,
    record?.paymentInfo,
    record?.priceInfo,
    payload?.pricing,
    payload?.fare,
  ];

  for (const candidate of candidates) {
    const fare = extractPricingFromSource(candidate);
    if (fare?.totalPayable > 0) return fare;
  }

  if (snapshot?.fare?.totalPayable > 0) return snapshot.fare;
  return buildFareBreakdown({}, 0);
}

export function saveHotelBookingSnapshot(bookingId, snapshot) {
  if (!bookingId || typeof window === 'undefined') return;
  try {
    const all = JSON.parse(window.sessionStorage.getItem(HOTEL_BOOKING_SNAPSHOT_KEY) || '{}');
    all[String(bookingId)] = { ...snapshot, savedAt: Date.now() };
    window.sessionStorage.setItem(HOTEL_BOOKING_SNAPSHOT_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

export function loadHotelBookingSnapshot(bookingId) {
  if (!bookingId || typeof window === 'undefined') return null;
  try {
    const all = JSON.parse(window.sessionStorage.getItem(HOTEL_BOOKING_SNAPSHOT_KEY) || '{}');
    return all[String(bookingId)] || null;
  } catch {
    return null;
  }
}
