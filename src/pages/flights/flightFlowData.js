const STORAGE_KEY = 'flight_booking_flow_draft_v1';

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
    depDateTime: 'May 14, Thu, 22:00',
    depCity: 'Pune, India',
    depAirport: 'Lohegaon Arpt',
    arrDateTime: 'May 15, Fri, 00:15',
    arrCity: 'Delhi, India',
    arrAirport: 'Delhi Indira Gandhi Intl Terminal 2',
    refundable: 'Economy,Non Refundable',
    code: '*-32N',
  },
  {
    airline: 'Air India',
    flightNo: 'AI-1767',
    duration: '00h 50m',
    depDateTime: 'May 15, Fri, 07:05',
    depCity: 'Delhi, India',
    depAirport: 'Delhi Indira Gandhi Intl Terminal 2',
    arrDateTime: 'May 15, Fri, 07:55',
    arrCity: 'Jaipur, India',
    arrAirport: 'Sanganer Arpt Terminal 2',
    refundable: 'Economy,Non Refundable',
    code: '*-319',
  },
  {
    airline: 'Air India',
    flightNo: 'AI-9707',
    duration: '2h 40m',
    depDateTime: 'May 15, Fri, 13:10',
    depCity: 'Jaipur, India',
    depAirport: 'Sanganer Arpt Terminal 2',
    arrDateTime: 'May 15, Fri, 15:50',
    arrCity: 'Bengaluru, India',
    arrAirport: 'Bengaluru Intl Arpt Terminal 2',
    refundable: 'Economy,Non Refundable',
    code: '*-737',
  },
];

export const ITINERARY_LAYOVERS = ['Layover Time - 6h 50m', 'Layover Time - 5h 15m'];

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
      fN: 'SHRIKANT',
      lN: 'B',
      dob: '1991-06-15',
      pt: 'ADULT',
      pNa: 'IN',
      pNum: '',
      pCountry: '',
      eD: '',
    },
  ],
  contact: {
    email: 'kunal.a@triphobo.com',
    phone: '1234567890',
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
  const next = mergeDraft(existing, { priceId, returnPriceId, multiPriceIds, amount, bookingId });
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
  return q.toString();
}
