const STORAGE_KEY = 'flight_booking_flow_draft_v1';

function demoDateTime(offset, hour, minute) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.toLocaleDateString('en-IN', { month: 'short', day: '2-digit', weekday: 'short' })}, ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export const FLOW_STEPS = [
  { id: 1, title: 'FIRST STEP', label: 'Flight Itinerary' },
  { id: 2, title: 'SECOND STEP', label: 'Passenger Details' },
  { id: 3, title: 'THIRD STEP', label: 'Review' },
  { id: 4, title: 'FINISH STEP', label: 'Payments' },
];

export const ITINERARY_SEGMENTS = [
  {
    airline: 'Air India',
    flightNo: 'AI-1804',
    duration: '2h 15m',
    depDateTime: demoDateTime(0, 22, 0),
    depCity: 'Pune, India',
    depAirport: 'Lohegaon Arpt',
    arrDateTime: demoDateTime(1, 0, 15),
    arrCity: 'Delhi, India',
    arrAirport: 'Delhi Indira Gandhi Intl Terminal 2',
    refundable: 'Economy,Non Refundable',
    code: '*-32N',
  },
  {
    airline: 'Air India',
    flightNo: 'AI-1767',
    duration: '01h 50m',
    depDateTime: demoDateTime(1, 7, 5),
    depCity: 'Delhi, India',
    depAirport: 'Delhi Indira Gandhi Intl Terminal 2',
    arrDateTime: demoDateTime(1, 7, 55),
    arrCity: 'Jaipur, India',
    arrAirport: 'Sanganer Arpt Terminal 2',
    refundable: 'Economy,Non Refundable',
    code: '*-319',
  },
];

export const ITINERARY_LAYOVERS = ['Layover Time - 6h 50m'];

export const MEAL_OPTIONS = [
  { id: 'veg_vegan', name: 'Vegan Veg Meal' },
  { id: 'veg_hindu', name: 'Hindu Veg Meal' },
  { id: 'veg_jain', name: 'Jain Veg Meal' },
  { id: 'veg_lacto', name: 'Lacto-ovo Veg Meal' },
  { id: 'fruit_platter', name: 'Fruit Platter Meal' },
  { id: 'non_veg', name: 'Non-veg Meal' },
  { id: 'moslem', name: 'Moslem Meal' },
  { id: 'hindu_nonveg', name: 'Hindu Non-veg Meal' },
  { id: 'seafood', name: 'Sea Food Meal' },
  { id: 'diabetic', name: 'Diabetic Meal' },
];

export const DEFAULT_DRAFT = {
  priceId: '',
  returnPriceId: '',
  multiPriceIds: [],
  amount: 15354.5,
  travellers: [
    {
      ti: 'Mr',
      fN: '',
      lN: '',
      dob: '',
      pt: 'ADULT',
      pNa: 'IN',
      pNum: '',
      pCountry: '',
      eD: '',
    },
  ],
  contact: {
    email: '',
    phone: '',
    countryCode: '+91',
    note: '',
  },
  gst: {
    enabled: false,
    gstNumber: '',
    registeredName: '',
    email: '',
    phone: '',
    address: '',
  },
  mealByTraveller: { 0: 'veg_jain' },
  agreedTerms: false,
  bookingId: '',
};

export const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export function computeFare(amount) {
  const total = Number(amount || DEFAULT_DRAFT.amount);
  const base = Number((total * 0.76666558).toFixed(2));
  const taxes = Number((total - base).toFixed(2));
  return {
    baseFare: base,
    taxes,
    mealBaggage: 0,
    total,
    commission: -0,
    tds: 0,
    netPrice: total,
  };
}

function isBrowser() {
  return typeof window !== 'undefined';
}

export function readFlowDraft() {
  if (!isBrowser()) return { ...DEFAULT_DRAFT };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DRAFT };
    const parsed = JSON.parse(raw);
    return mergeDraft(DEFAULT_DRAFT, parsed);
  } catch (_) {
    return { ...DEFAULT_DRAFT };
  }
}

export function writeFlowDraft(draft) {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function hydrateFromQuery(params) {
  const existing = readFlowDraft();
  const priceId = params.get('priceId') || existing.priceId;
  const returnPriceId = params.get('returnPriceId') || existing.returnPriceId;
  const multiPriceIdsRaw = params.get('multiPriceIds');
  const multiPriceIds =
    typeof multiPriceIdsRaw === 'string' && multiPriceIdsRaw.trim()
      ? multiPriceIdsRaw.split(',').map((x) => x.trim()).filter(Boolean)
      : existing.multiPriceIds || [];
  const amountRaw = Number(params.get('amount'));
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : existing.amount;
  const bookingId = params.get('bookingId') || existing.bookingId;
  let itinerary = existing.itinerary || null;
  try {
    const rawItinerary = params.get('itinerary');
    if (rawItinerary) itinerary = JSON.parse(rawItinerary);
  } catch (_) {
    itinerary = existing.itinerary || null;
  }
  const next = mergeDraft(existing, { priceId, returnPriceId, multiPriceIds, amount, bookingId, itinerary });
  writeFlowDraft(next);
  return next;
}

export function buildBookPayload(draft) {
  const email = String(draft?.contact?.email || '').trim();
  const phone = String(draft?.contact?.phone || '').trim();
  const rawMultiIds = Array.isArray(draft?.multiPriceIds) ? draft.multiPriceIds : [];
  const multiIds = rawMultiIds.map((x) => String(x || '').trim()).filter(Boolean);
  const fallbackIds = [draft.priceId, draft.returnPriceId].filter(Boolean);
  const priceIds = multiIds.length ? multiIds : fallbackIds;
  return {
    priceIds,
    travellerInfo: (draft.travellers || []).map((p) => normalizeTraveller(p)),
    deliveryInfo: {
      emails: [email || DEFAULT_DRAFT.contact.email],
      contacts: [phone || DEFAULT_DRAFT.contact.phone],
    },
    ...(draft.gst?.enabled && draft.gst?.gstNumber
      ? {
          gstInfo: {
            gstNumber: draft.gst.gstNumber,
            email: draft.gst.email || '',
            registeredName: draft.gst.registeredName || '',
            mobile: draft.gst.phone || '',
            address: draft.gst.address || '',
          },
        }
      : {}),
  };
}

function normalizeTraveller(pax = {}) {
  const fallback = DEFAULT_DRAFT.travellers[0];
  return {
    ti: pax.ti || fallback.ti,
    fN: String(pax.fN || fallback.fN).trim(),
    lN: String(pax.lN || fallback.lN).trim(),
    dob: isValidDob(pax.dob) ? pax.dob : fallback.dob,
    pt: pax.pt || fallback.pt || 'ADULT',
    pNa: pax.pNa || fallback.pNa || 'IN',
    pNum: pax.pNum || '',
    pCountry: pax.pCountry || '',
    eD: pax.eD || '',
  };
}

function isValidDob(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

export function validateBookDraft(draft) {
  const errors = [];
  if (!String(draft?.priceId || '').trim()) {
    errors.push('Missing fare id. Please go back to results and select a fare.');
  }

  const traveller = draft?.travellers?.[0] || {};
  if (!String(traveller.ti || '').trim()) errors.push('Traveller title is required.');
  if (!String(traveller.fN || '').trim()) errors.push('Traveller first name is required.');
  if (!String(traveller.lN || '').trim()) errors.push('Traveller last name is required.');
  if (!isValidDob(traveller.dob)) errors.push('Traveller date of birth is required.');

  const email = String(draft?.contact?.email || '').trim();
  const phone = String(draft?.contact?.phone || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid contact email is required.');
  if (!/^\d{7,15}$/.test(phone)) errors.push('Valid contact mobile number is required.');
  return errors;
}

export function mergeDraft(base, patch) {
  return {
    ...base,
    ...patch,
    contact: { ...base.contact, ...(patch?.contact || {}) },
    gst: { ...base.gst, ...(patch?.gst || {}) },
    mealByTraveller: { ...base.mealByTraveller, ...(patch?.mealByTraveller || {}) },
    travellers: Array.isArray(patch?.travellers) ? patch.travellers : base.travellers,
  };
}

export function getMealName(id) {
  return MEAL_OPTIONS.find((item) => item.id === id)?.name || 'Vegan Veg Meal';
}

export function buildFlowQuery(draft) {
  const q = new URLSearchParams();
  if (draft.priceId) q.set('priceId', draft.priceId);
  if (draft.returnPriceId) q.set('returnPriceId', draft.returnPriceId);
  if (Array.isArray(draft.multiPriceIds) && draft.multiPriceIds.length) q.set('multiPriceIds', draft.multiPriceIds.join(','));
  if (draft.amount) q.set('amount', String(draft.amount));
  if (draft.bookingId) q.set('bookingId', String(draft.bookingId));
  if (draft.itinerary) q.set('itinerary', JSON.stringify(draft.itinerary));
  return q.toString();
}

export function getItineraryDisplaySegments(itinerary) {
  const flights = [
    ...(Array.isArray(itinerary?.multiFlights) ? itinerary.multiFlights : []),
    ...(itinerary?.multiFlights?.length ? [] : [itinerary?.onwardFlight, itinerary?.returnFlight]),
  ].filter(Boolean);
  const selectedSegments = flights.flatMap((flight) => (
    Array.isArray(flight?.segments) ? flight.segments.map((segment) => ({ segment, flight })) : []
  ));

  if (!selectedSegments.length) return ITINERARY_SEGMENTS;

  return selectedSegments.slice(0, 2).map(({ segment, flight }, index) => {
    const departureTime = segment.departureTime || segment.dt || '';
    const arrivalTime = segment.arrivalTime || segment.at || '';
    const durationMinutes = Number(segment.durationMinutes || 0) || minutesBetween(departureTime, arrivalTime);
    const cabin = segment.cabinClass || flight.cabinClass || 'ECONOMY';
    return {
      airline: segment.airline || flight.airline || 'Airline',
      flightNo: segment.flightNumber || `FL-${index + 1}`,
      duration: formatDuration(durationMinutes),
      durationMinutes,
      depDateTime: departureTime ? formatDisplayDateTime(departureTime) : 'Today',
      depCity: segment.fromCity || segment.from || '--',
      depAirport: segment.fromAirport || segment.from || '--',
      arrDateTime: arrivalTime ? formatDisplayDateTime(arrivalTime) : 'Today',
      arrCity: segment.toCity || segment.to || '--',
      arrAirport: segment.toAirport || segment.to || '--',
      refundable: `${cabin},${flight.refundable ? 'Refundable' : 'Non Refundable'}`,
      code: segment.airlineCode || '',
    };
  });
}

export function getItineraryDurationText(segments) {
  const total = (segments || []).reduce((sum, segment) => sum + Number(segment.durationMinutes || parseDuration(segment.duration)), 0);
  return total > 0 ? formatDuration(total) : '--';
}

function minutesBetween(from, to) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 60000) : 0;
}

function parseDuration(value) {
  const match = String(value || '').match(/(?:(\d+)h)?\s*(?:(\d+)m)?/i);
  return match ? Number(match[1] || 0) * 60 + Number(match[2] || 0) : 0;
}

function formatDuration(minutes) {
  const safe = Math.max(0, Number(minutes || 0));
  return `${Math.floor(safe / 60)}h ${safe % 60}m`;
}

function formatDisplayDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toLocaleDateString('en-IN', { month: 'short', day: '2-digit', weekday: 'short' })}, ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}
