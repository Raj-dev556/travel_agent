import { format, parseISO } from 'date-fns';

const RECENT_SEARCHES_KEY = 'hotel_recent_searches:v1';
const RECENT_BOOKINGS_KEY = 'hotel_recent_bookings:v1';
const MAX_SEARCHES = 30;
const MAX_BOOKINGS = 50;
const DEFAULT_HOLD_MS = 24 * 60 * 60 * 1000;

export const HOTEL_HISTORY_UPDATED_EVENT = 'hotel-history-updated';

function safeRead(key) {
  if (typeof window === 'undefined') return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function safeWrite(key, rows) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent(HOTEL_HISTORY_UPDATED_EVENT));
  } catch {
    // Ignore quota / privacy mode failures.
  }
}

function searchFingerprint(entry = {}) {
  return [
    entry.city,
    entry.cityRegionId,
    entry.hotelId,
    entry.checkin,
    entry.checkout,
    JSON.stringify(entry.rooms || []),
  ].join('|');
}

function fmtShortDate(value) {
  if (!value) return '--';
  const date = typeof value === 'string' ? parseISO(value.slice(0, 10)) : value;
  if (Number.isNaN(date.getTime())) return value;
  return format(date, 'EEE, d MMM');
}

function fmtLongDateTime(value) {
  if (!value) return 'N/A';
  const date = typeof value === 'number' ? new Date(value) : parseISO(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return format(date, 'MMM d, yyyy h:mm a');
}

function fmtStayRange(checkin, checkout) {
  return `${fmtShortDate(checkin)} To ${fmtShortDate(checkout)}`;
}

function roomsLabel(rooms = []) {
  const safeRooms = Array.isArray(rooms) && rooms.length ? rooms : [{ adults: 1, children: 0 }];
  const roomCount = safeRooms.length;
  const adults = safeRooms.reduce((sum, room) => sum + Number(room.adults || 0), 0);
  const children = safeRooms.reduce((sum, room) => sum + Number(room.children || 0), 0);
  const guestPart = children > 0 ? `${adults} (A) + ${children} (C)` : `${adults} (A)`;
  return `${roomCount} Room${roomCount === 1 ? '' : 's'} : ${guestPart}`;
}

function deadlineHint(holdExpiresAt) {
  if (!holdExpiresAt) return '';
  const msLeft = Number(holdExpiresAt) - Date.now();
  if (msLeft <= 0) return 'Expired';

  const hoursLeft = Math.ceil(msLeft / (60 * 60 * 1000));
  if (hoursLeft < 24) return `${hoursLeft} H Left`;

  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if (daysLeft >= 30) return `${Math.ceil(daysLeft / 30)} M Left`;
  return `${daysLeft} D Left`;
}

function parseHoldExpiry(review = {}) {
  const candidates = [
    review.holdExpiresAt,
    review.holdExpiry,
    review.paymentDeadline,
    review.deadline,
    review.expiresAt,
    review.onHoldDeadline,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 1_000_000_000_000) return asNumber;
    const parsed = Date.parse(String(value));
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
}

export function saveHotelRecentSearch(entry = {}) {
  const city = String(entry.city || '').trim();
  const checkin = String(entry.checkin || '').slice(0, 10);
  const checkout = String(entry.checkout || '').slice(0, 10);
  if (!city || !checkin || !checkout) return;

  const nextEntry = {
    id: String(entry.id || Date.now()),
    city,
    cityRegionId: entry.cityRegionId ? String(entry.cityRegionId) : '',
    hotelId: entry.hotelId ? String(entry.hotelId) : '',
    destinationType: entry.destinationType || 'CITY',
    countryCode: entry.countryCode || 'IN',
    checkin,
    checkout,
    rooms: Array.isArray(entry.rooms) ? entry.rooms : [{ adults: 2, children: 0, ages: [] }],
    minStar: String(entry.minStar || entry.rating || '0'),
    residence: entry.residence || '',
    nationality: entry.nationality || '',
    gst: Boolean(entry.gst),
    savedAt: Date.now(),
  };

  const fingerprint = searchFingerprint(nextEntry);
  const rows = safeRead(RECENT_SEARCHES_KEY).filter((row) => searchFingerprint(row) !== fingerprint);
  rows.unshift(nextEntry);
  safeWrite(RECENT_SEARCHES_KEY, rows.slice(0, MAX_SEARCHES));
}

export function loadHotelRecentSearches() {
  return safeRead(RECENT_SEARCHES_KEY).sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
}

export function countSearchesInLastDays(days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return loadHotelRecentSearches().filter((row) => Number(row.savedAt || 0) >= cutoff).length;
}

export function formatSearchCard(search = {}) {
  return {
    id: search.id,
    title: search.city,
    start: fmtShortDate(search.checkin),
    end: fmtShortDate(search.checkout),
    rooms: roomsLabel(search.rooms),
    raw: search,
  };
}

export function buildHotelSearchResultsUrl(search = {}) {
  const params = new URLSearchParams({
    city: search.city || '',
    cityCode: String(search.cityRegionId || ''),
    checkin: search.checkin || '',
    checkout: search.checkout || '',
    minStar: String(search.minStar || '0'),
    gst: search.gst ? '1' : '0',
    rooms: JSON.stringify(search.rooms || [{ adults: 2, children: 0, ages: [] }]),
    destinationType: search.destinationType || 'CITY',
    countryCode: search.countryCode || 'IN',
    searchRequestId: String(Date.now()),
  });

  if (search.residence) params.set('residence', search.residence);
  if (search.nationality) params.set('nationality', search.nationality);
  if (search.cityRegionId) params.set('cityRegionId', String(search.cityRegionId));
  if (search.destinationType === 'HOTEL' && search.hotelId) {
    params.set('hotelId', String(search.hotelId));
  }

  return `/hotels/results?${params.toString()}`;
}

export function saveHotelRecentBooking(entry = {}) {
  const bookingId = String(entry.bookingId || '').trim();
  if (!bookingId) return;

  const holdExpiresAt = entry.holdExpiresAt || parseHoldExpiry(entry.review) || (Date.now() + DEFAULT_HOLD_MS);
  const amount = Number(entry.amount || entry.fare?.totalPayable || 0);

  const nextEntry = {
    bookingId,
    hotelName: entry.hotelName || 'Hotel',
    city: entry.city || '',
    country: entry.country || 'IN',
    checkin: String(entry.checkin || '').slice(0, 10),
    checkout: String(entry.checkout || '').slice(0, 10),
    amount,
    status: entry.status || 'On Hold',
    holdExpiresAt,
    savedAt: Date.now(),
  };

  const rows = safeRead(RECENT_BOOKINGS_KEY).filter((row) => String(row.bookingId) !== bookingId);
  rows.unshift(nextEntry);
  safeWrite(RECENT_BOOKINGS_KEY, rows.slice(0, MAX_BOOKINGS));
}

export function updateHotelBookingStatus(bookingId, status) {
  const id = String(bookingId || '').trim();
  if (!id || !status) return;

  const rows = safeRead(RECENT_BOOKINGS_KEY).map((row) => (
    String(row.bookingId) === id ? { ...row, status, updatedAt: Date.now() } : row
  ));
  safeWrite(RECENT_BOOKINGS_KEY, rows);
}

export function loadHotelRecentBookings() {
  return safeRead(RECENT_BOOKINGS_KEY).sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
}

export function getHoldExpiringBookings(bookings = [], withinDays = 14) {
  const cutoff = Date.now() + withinDays * 24 * 60 * 60 * 1000;
  return bookings
    .filter((row) => row.status === 'On Hold' && Number(row.holdExpiresAt || 0) > Date.now() && Number(row.holdExpiresAt) <= cutoff)
    .sort((a, b) => Number(a.holdExpiresAt) - Number(b.holdExpiresAt));
}

export function formatBookingForTable(booking = {}) {
  const location = [booking.city, booking.country].filter(Boolean).join(' / ');
  const hotelLabel = location ? `${booking.hotelName} - ${location}` : booking.hotelName;
  const hint = booking.status === 'On Hold' ? deadlineHint(booking.holdExpiresAt) : '';

  return {
    id: booking.bookingId,
    hotel: hotelLabel,
    deadline: booking.status === 'On Hold' ? fmtLongDateTime(booking.holdExpiresAt) : 'N/A',
    deadlineHint: hint,
    stay: fmtStayRange(booking.checkin, booking.checkout),
    amount: Number(booking.amount || 0),
    status: booking.status || 'On Hold',
    bookingId: booking.bookingId,
  };
}
