import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, CalendarDays, Users, ChevronDown, ChevronLeft, ChevronRight, Lightbulb, X,
} from 'lucide-react';
import clsx from 'clsx';
import { fetchHotelCitySuggestions } from './hotelCityAutocomplete';
import {
  buildHotelSearchResultsUrl,
  countSearchesInLastDays,
  formatBookingForTable,
  formatSearchCard,
  getHoldExpiringBookings,
  HOTEL_HISTORY_UPDATED_EVENT,
  loadHotelRecentBookings,
  loadHotelRecentSearches,
  saveHotelRecentSearch,
} from './hotelUserHistory';
import {
  HOTEL_NATIONALITY_OPTIONS,
  HOTEL_RESIDENCE_OPTIONS,
} from '../../data/hotelCountryOptions';
import {
  hasValidationErrors,
  validateHotelSearchFields,
} from '../../components/hotels/hotelSearchValidation';
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

// const POPULAR_CITIES = [
//   { name: 'DUBAI',     code: 'DXB', state: '',                                       country: 'UNITED ARAB EMIRATES' },
//   { name: 'MUMBAI',    code: 'BOM', state: 'MAHARASHTRA',                            country: 'INDIA' },
//   { name: 'SINGAPORE', code: 'SIN', state: '',                                       country: 'SINGAPORE' },
//   { name: 'DELHI',     code: 'DEL', state: 'NATIONAL CAPITAL TERRITORY OF DELHI',    country: 'INDIA' },
//   { name: 'BANGKOK',   code: 'BKK', state: 'BANGKOK PROVINCE',                       country: 'THAILAND' },
//   { name: 'PATTAYA',   code: 'PYX', state: 'CHONBURI',                               country: 'THAILAND' },
//   { name: 'BENGALURU', code: 'BLR', state: 'KARNATAKA',                              country: 'INDIA' },
//   { name: 'CHENNAI',   code: 'MAA', state: 'TAMIL NADU',                             country: 'INDIA' },
//   { name: 'GOA',       code: 'GOI', state: 'GOA',                                    country: 'INDIA' },
//   { name: 'KOLKATA',   code: 'CCU', state: 'WEST BENGAL',                            country: 'INDIA' },
// ];

// const POPULAR_CITIES = [];
// const HOLD_BOOKINGS = [
//   { id: 'CT2032162147449', hotel: 'Campanile Paris Bercy Village - Paris / France', deadline: 'May 14, 2026 11:59 PM', deadlineHint: '2 D Left', stay: 'May 18, 2026 To May 22, 2026', amount: 69385.52, status: 'On Hold' },
//   { id: 'CT2031171221976', hotel: 'Novotel Paris Centre Gare Montparnasse - Paris / France', deadline: 'May 15, 2026 11:59 PM', deadlineHint: '3 D Left', stay: 'May 17, 2026 To May 21, 2026', amount: 399967.77, status: 'On Hold' },
//   { id: 'CT2071171468983', hotel: 'Park Inn By Radisson Amsterdam City West - Amsterdam / NL', deadline: 'May 17, 2026 11:59 PM', deadlineHint: '5 D Left', stay: 'May 21, 2026 To May 25, 2026', amount: 522548.64, status: 'On Hold' },
//   { id: 'CT2083170663292', hotel: 'SO/ Vienna - Vienna / Austria', deadline: 'May 21, 2026 11:59 PM', deadlineHint: '9 D Left', stay: 'May 23, 2026 To May 27, 2026', amount: 193034.08, status: 'On Hold' },
//   { id: 'CT2002170666215', hotel: 'Hotel Bristol Salzburg - Salzburg / Austria', deadline: 'May 22, 2026 11:59 PM', deadlineHint: '10 D Left', stay: 'May 27, 2026 To May 30, 2026', amount: 235432.44, status: 'On Hold' },
// ];

// const RECENT_BOOKINGS = [
//   { id: 'CT2032173433083', hotel: 'Holiday Inn Chicago/Oak Brook - Oakbrook Terrace / USA', deadline: 'May 26, 2026 11:59 PM', deadlineHint: '14 D Left', stay: 'May 29, 2026 To Jun 7, 2026', amount: 96218.64, status: 'On Hold' },
//   { id: 'CT2068173424020', hotel: 'Holiday Inn Express Munich North - Munich / Germany', deadline: 'May 28, 2026 11:59 PM', deadlineHint: '16 D Left', stay: 'May 31, 2026 To Jun 4, 2026', amount: 28479.96, status: 'On Hold' },
//   { id: 'CT2018173369779', hotel: 'White Castle (Boutique Apartment Hotel) - Bangalore / IN', deadline: 'N/A', deadlineHint: '', stay: 'May 12, 2026 To May 13, 2026', amount: 2934.92, status: 'Vouchered' },
//   { id: 'CT2085173276608', hotel: 'Melia Danang Beach Resort - Da Nang / Vietnam', deadline: 'May 26, 2026 11:59 PM', deadlineHint: '14 D Left', stay: 'Jun 17, 2026 To Jun 19, 2026', amount: 74341.64, status: 'On Hold' },
//   { id: 'CT2073173276251', hotel: 'Mercure Danang French Village Bana Hills - Da Nang / VN', deadline: 'Jun 12, 2026 11:59 PM', deadlineHint: '1 M Left', stay: 'Jun 16, 2026 To Jun 17, 2026', amount: 40889.9, status: 'On Hold' },
//   { id: 'CT2018173272483', hotel: 'Melia Danang Beach Resort - Da Nang / Vietnam', deadline: 'May 25, 2026 11:59 PM', deadlineHint: '', stay: 'Jun 16, 2026 To Jun 19, 2026', amount: 111511.44, status: 'Cancelled' },
//   { id: 'CT2004173271743', hotel: 'Radisson Blu Resort Phu Quoc - Phu Quoc / Vietnam', deadline: 'Jun 3, 2026 11:59 PM', deadlineHint: '', stay: 'Jun 13, 2026 To Jun 16, 2026', amount: 98645.91, status: 'Aborted' },
// ];

const fmtINR = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const BOOKINGS_PAGE_SIZE = 5;
const POPULAR_CITIES = [
  {
    id: '1001',
    code: '1001',
    cityRegionId: 1001,
    name: 'MUMBAI',
    displayName: 'MUMBAI',
    state: 'MAHARASHTRA',
    country: 'INDIA',
    countryCode: 'IN',
    type: 'CITY',
    subtitle: 'Mumbai, Maharashtra, India',
  },
  {
    id: '1002',
    code: '1002',
    cityRegionId: 1002,
    name: 'BENGALURU',
    displayName: 'BENGALURU',
    state: 'KARNATAKA',
    country: 'INDIA',
    countryCode: 'IN',
    type: 'CITY',
    subtitle: 'Bengaluru, Karnataka, India',
  },
  {
    id: '1003',
    code: '1003',
    cityRegionId: 1003,
    name: 'DELHI',
    displayName: 'DELHI',
    state: 'DELHI',
    country: 'INDIA',
    countryCode: 'IN',
    type: 'CITY',
    subtitle: 'Delhi, India',
  },
  {
    id: '1004',
    code: '1004',
    cityRegionId: 1004,
    name: 'SINGAPORE',
    displayName: 'SINGAPORE',
    state: '',
    country: 'SINGAPORE',
    countryCode: 'SG',
    type: 'CITY',
    subtitle: 'Singapore',
  },
  {
    id: '1005',
    code: '1005',
    cityRegionId: 1005,
    name: 'PUNE',
    displayName: 'PUNE',
    state: 'MAHARASHTRA',
    country: 'INDIA',
    countryCode: 'IN',
    type: 'CITY',
    subtitle: 'Pune, Maharashtra, India',
  },
];

// const RECENT_SEARCHES = [
//   { title: 'Dedary Resort & Spa Ubud By Ini …', start: 'Wed, 2 Sep', end: 'Sun, 6 Sep', rooms: '1 Room : 2 (A)' },
//   { title: 'The Anvaya Beach Resort Bali', start: 'Sun, 6 Sep', end: 'Tue, 8 Sep', rooms: '1 Room : 2 (A)' },
//   { title: 'Ubud', start: 'Sun, 6 Sep', end: 'Tue, 8 Sep', rooms: '1 Room : 2 (A)' },
//   { title: 'Ubud', start: 'Wed, 2 Sep', end: 'Sun, 6 Sep', rooms: '1 Room : 2 (A)' },
//   { title: 'Four Points By Sheraton Danang', start: 'Fri, 31 Jul', end: 'Sun, 2 Aug', rooms: '1 Room : 3 (A)' },
//   { title: 'Hard Rock Hotel Goa', start: 'Sat, 12 Sep', end: 'Mon, 14 Sep', rooms: '1 Room : 2 (A)' },
//   { title: 'Taj Lake Palace, Udaipur', start: 'Tue, 1 Oct', end: 'Thu, 3 Oct', rooms: '1 Room : 2 (A)' },
// ];

const PROMO_SLIDES = [
  {
    kicker: 'amazing',
    title: 'THAILAND',
    body: 'The easiest way to switch off, slow down, and breathe again.',
    cta: 'BOOK NOW',
    bg: 'bg-[linear-gradient(110deg,#0f172a_0%,#263858_55%,#1e3a5f_100%)]',
  },
  {
    kicker: 'curated',
    title: 'SUMMER ESCAPES',
    body: 'For beaches, hills, and city getaways. Help your customers discover their perfect trip.',
    cta: 'BOOK NOW',
    bg: 'bg-[linear-gradient(110deg,#172033_0%,#2f4164_58%,#0f172a_100%)]',
  },
  {
    kicker: 'discover',
    title: 'INCREDIBLE EUROPE',
    body: 'Iconic cities, alpine peaks, and Mediterranean coasts in one trip.',
    cta: 'EXPLORE',
    bg: 'bg-[linear-gradient(110deg,#111827_0%,#334155_55%,#1e3a5f_100%)]',
  },
];

const DEALS = [
  { brand: 'Disney Cruise', title: 'Magical voyages from ₹59,999*', body: 'Price starting from ₹59,999* Plus T&C apply. Rate excludes gratuity. For bookings contact cruise.ops@corptravel.com', cta: 'Book Now', bg: 'bg-[linear-gradient(135deg,#0f172a,#263858)]', tag: '' },
  { brand: 'THE CLARKS HOTELS', title: 'On Offer — India\'s favourite', body: 'Limited inventory, high-demand destinations. Lock in these Sterling offers now.', cta: 'Book Now. Sell Faster.', bg: 'bg-[linear-gradient(135deg,#172033,#2f4164)]', tag: 'SPECIAL DEAL' },
  { brand: 'LARISA RESORT AM HOTELS', title: 'Save more, sell faster', body: 'Crisp-cool getaways. Book More, Save More with LaRiSa Resorts and AM Hotels.', cta: 'Book Now. Sell Faster.', bg: 'bg-[linear-gradient(135deg,#172033,#2f4164)]', tag: '' },
  { brand: 'ORCHARD HOTEL', title: 'Rendezvous Hotel by Far East Hospitality', body: 'Still looking for best stays in Singapore? Book Orchard Rendezvous Hotel at Special Rates.', cta: 'Book Now', bg: 'bg-[linear-gradient(135deg,#0f172a,#1e3a5f)]', tag: 'CAN' },
  { brand: 'BLOOM HOTELS', title: 'Deals Now Live — Don\'t Miss Out', body: 'Get Special Discount on hand-picked Bloom Hotels. Book before they sell out.', cta: 'View Deals', bg: 'bg-[linear-gradient(135deg,#172033,#2f4164)]', tag: '' },
  { brand: 'THE SURYAA, DELHI', title: 'Special Discount', body: 'Get amazing deals at The Suryaa, New Delhi.', cta: 'Book Now', bg: 'bg-[linear-gradient(135deg,#172033,#2f4164)]', tag: '' },
  { brand: 'CARLSON BRAND LAGOON', title: '328 Hotels on special rates', body: 'Turn stays into unforgettable memories. Book now with special 328 rates.', cta: 'Book Now', bg: 'bg-[linear-gradient(135deg,#172033,#2f4164)]', tag: '' },
  { brand: 'HARD ROCK HOTEL, GOA', title: '25% off on luxury stays', body: 'Where luxury hits the right note. Perfect for your customers looking for a stay in the heart of Goa.', cta: 'Book Now', bg: 'bg-[linear-gradient(135deg,#0f172a,#1e3a5f)]', tag: '' },
];

export default function HotelSearch() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [city, setCity] = useState(null);
  const [checkin, setCheckin] = useState(today);
  const [checkout, setCheckout] = useState(tomorrow);
  const [rooms, setRooms] = useState([{ adults: 2, children: 0, ages: [] }]);
  const [rating, setRating] = useState('0');
  const [residence, setResidence] = useState('');
  const residenceOptions = HOTEL_RESIDENCE_OPTIONS;
  const [nationality, setNationality] = useState('');
  const nationalityOptions = HOTEL_NATIONALITY_OPTIONS;
  const [gst, setGst] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [roomsOpen, setRoomsOpen] = useState(false);
  const [searchesOpen, setSearchesOpen] = useState(false);
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [bookingTab, setBookingTab] = useState('hold');
  const [bookingPage, setBookingPage] = useState(1);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [searchCount7d, setSearchCount7d] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(parseISO(today)));
  const [draftStart, setDraftStart] = useState(() => parseISO(today));
  const [draftEnd, setDraftEnd] = useState(() => parseISO(tomorrow));

  const totalNights = nightCount(checkin, checkout);
  const totalGuests = rooms.reduce((a, r) => a + r.adults + r.children, 0);

  function refreshHistory() {
    const bookings = loadHotelRecentBookings();
    setRecentBookings(bookings);
    setRecentSearches(loadHotelRecentSearches().map(formatSearchCard));
    setSearchCount7d(countSearchesInLastDays(7));
  }

  useEffect(() => {
    refreshHistory();
    const onHistoryUpdate = () => refreshHistory();
    window.addEventListener(HOTEL_HISTORY_UPDATED_EVENT, onHistoryUpdate);
    window.addEventListener('focus', onHistoryUpdate);
    return () => {
      window.removeEventListener(HOTEL_HISTORY_UPDATED_EVENT, onHistoryUpdate);
      window.removeEventListener('focus', onHistoryUpdate);
    };
  }, []);

  const holdBookings = getHoldExpiringBookings(recentBookings).map(formatBookingForTable);
  const allRecentBookings = recentBookings.map(formatBookingForTable);
  const activeBookings = bookingTab === 'hold' ? holdBookings : allRecentBookings;
  const bookingPageCount = Math.max(1, Math.ceil(activeBookings.length / BOOKINGS_PAGE_SIZE));
  const safeBookingPage = Math.min(bookingPage, bookingPageCount);
  const pagedBookings = activeBookings.slice(
    (safeBookingPage - 1) * BOOKINGS_PAGE_SIZE,
    safeBookingPage * BOOKINGS_PAGE_SIZE,
  );

  useEffect(() => {
    setBookingPage(1);
  }, [bookingTab, recentBookings.length]);

  useEffect(() => {
    const start = parseISO(checkin);
    const end = parseISO(checkout);
    if (isValidDate(start)) setDraftStart(start);
    if (isValidDate(end)) setDraftEnd(end);
  }, [checkin, checkout]);

  function openCalendar() {
    const start = parseISO(checkin);
    const end = parseISO(checkout);
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
    setCheckin(format(draftStart, 'yyyy-MM-dd'));
    setCheckout(format(endDate, 'yyyy-MM-dd'));
    clearFormError('checkin');
    clearFormError('checkout');
    setCalendarOpen(false);
  }

  function clearFormError(key) {
    setFormErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function go(event) {
    event?.preventDefault();
    const destinationType = String(city?.type || city?.regionType || 'CITY').toUpperCase();
    const destinationId = destinationType === 'HOTEL'
      ? String(city?.hotelId || '').trim()
      : String(city?.cityRegionId || city?.regionId || '').trim();
    const validationErrors = validateHotelSearchFields({
      destinationName: city?.name || '',
      hasValidDestinationId: /^\d+$/.test(destinationId) && Number(destinationId) > 0,
      checkin,
      checkout,
      rooms,
    });

    if (hasValidationErrors(validationErrors)) {
      setFormErrors(validationErrors);
      return;
    }

    setFormErrors({});
    const safeCheckout = checkout;
    // const params = new URLSearchParams({
    //   city: city.name, cityCode: city.code,
    //   checkin, checkout: safeCheckout, minStar: rating,
    //   residence, gst: gst ? '1' : '0',
    //   rooms: JSON.stringify(rooms),
    // });
    const params = new URLSearchParams({
      city: city.name,
      cityCode: String(city.cityRegionId || city.regionId || city.code || ''),
      checkin,
      checkout: safeCheckout,
      minStar: rating,
      gst: gst ? '1' : '0',
      rooms: JSON.stringify(rooms),
    });
    if (residence) params.set('residence', residence);
    if (nationality) params.set('nationality', nationality);

    params.set('destinationType', city.type || city.regionType || 'CITY');
    params.set('countryCode', city.countryCode || (city.country === 'INDIA' ? 'IN' : city.country || 'IN'));
    if (city.hotelId && (city.type === 'HOTEL' || city.regionType === 'HOTEL')) {
      params.set('hotelId', String(city.hotelId));
    }
    params.set('searchRequestId', String(Date.now()));

    saveHotelRecentSearch({
      city: city.name,
      cityRegionId: city.cityRegionId || city.regionId || city.code || '',
      hotelId: city.hotelId || '',
      destinationType: city.type || city.regionType || 'CITY',
      countryCode: city.countryCode || (city.country === 'INDIA' ? 'IN' : city.country || 'IN'),
      checkin,
      checkout: safeCheckout,
      rooms,
      minStar: rating,
      residence,
      nationality,
      gst,
    });

    navigate(`/hotels/results?${params.toString()}`);
  }

  return (
       <div className="space-y-6 p-4 md:p-6">
      <div className="hotel-hero relative">
        <div className="max-w-screen-xl mx-auto px-4 pt-14 pb-14 relative">
          <h1 className="text-white text-3xl md:text-[34px] font-semibold tracking-tight text-center">
            Book your stay with India&apos;s largest network of Hotels.
          </h1>

          <form onSubmit={go} noValidate>
            <div className="mt-8 bg-white/95 rounded-md shadow-card grid grid-cols-1 lg:grid-cols-[1.5fr_1.7fr_1.1fr_auto] p-2 gap-2">
              <CityField
                city={city}
                onChange={(nextCity) => {
                  setCity(nextCity);
                  clearFormError('destination');
                }}
                onInputChange={() => {
                  setCity(null);
                  clearFormError('destination');
                }}
                error={formErrors.destination}
              />
              <DateRangeBox
                checkin={checkin}
                checkout={checkout}
                nights={totalNights}
                onClick={openCalendar}
                error={formErrors.checkin || formErrors.checkout}
              />
              <RoomsBox
                rooms={rooms}
                totalGuests={totalGuests}
                open={roomsOpen}
                setOpen={setRoomsOpen}
                onChange={(nextRooms) => {
                  setRooms(nextRooms);
                  clearFormError('rooms');
                }}
                error={formErrors.rooms}
              />
              <button
                type="submit"
                className="min-h-14 rounded-md bg-[#ff7f2a] px-8 font-semibold uppercase tracking-wide text-white hover:bg-[#e56a00] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#ff7f2a]"
              >
                Search
              </button>
            </div>
            {hasValidationErrors(formErrors) && (
              <div id="hotel-destination-error" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert" aria-live="polite">
                {Object.values(formErrors)[0]}
              </div>
            )}
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-white text-sm">
            <span className="text-white/80 font-medium">More Options :</span>

            <Selector
              value={rating}
              onChange={setRating}
              displayLabel={({ label }) => label}
              showChecks
              options={[
                { value: '0', label: 'Rating' },
                { value: '3', label: '3* & above' },
                { value: '4', label: '4* & above' },
                { value: '5', label: '5* only' },
              ]}
            />
            <Selector
              value={nationality}
              onChange={setNationality}
              displayLabel={({ label }) => (label ? `Nationality: ${label}` : 'Nationality')}
              options={toCountrySelectOptions(nationalityOptions)}
              emptyLabel="No nationalities found"
            />
            <Selector
              value={residence}
              onChange={setResidence}
              displayLabel={({ label }) => (label ? `Country of Residence: ${label}` : 'Country of Residence')}
              options={toCountrySelectOptions(residenceOptions)}
              emptyLabel="No countries found"
            />

            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={gst}
                onChange={(e) => setGst(e.target.checked)}
                className="accent-[#ff7f2a]"
              />
              Show GST claim eligible rates
              <span className="ml-1 text-[10px] bg-[#ff7f2a] text-slate-950 px-1.5 py-0.5 rounded">NEW</span>
            </label>
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

      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-4 py-4 flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={() => setSearchesOpen((open) => !open)}
            className="text-sm font-medium text-slate-700 inline-flex items-center gap-1"
          >
            View your last search
            <ChevronDown className={clsx('w-3.5 h-3.5 transition', searchesOpen && 'rotate-180')} />
          </button>
          <button
            type="button"
            onClick={() => setBookingsOpen((o) => !o)}
            className="text-sm font-medium text-slate-700 inline-flex items-center gap-1"
          >
            View your bookings
            <span className="text-[10px] bg-sky-200 text-sky-900 px-1.5 py-0.5 rounded">NEW</span>
            <ChevronDown className={clsx('w-3.5 h-3.5 transition', bookingsOpen && 'rotate-180')} />
          </button>
          <div className="ml-auto inline-flex items-center gap-1.5 text-xs text-amber-700">
            <Lightbulb className="w-3.5 h-3.5" />
            You made {searchCount7d} search{searchCount7d === 1 ? '' : 'es'} in last 7 days
          </div>
        </div>
      </div>

      {searchesOpen && (
        <div className="max-w-screen-xl mx-auto px-4 pt-4">
          {recentSearches.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
              No recent searches yet. Run a hotel search and it will appear here.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recentSearches.map((search) => (
                <button
                  key={search.id}
                  type="button"
                  onClick={() => navigate(buildHotelSearchResultsUrl(search.raw))}
                  className="text-left bg-white rounded-md shadow-sm border border-slate-200 px-4 py-3 hover:border-[#ff7f2a]"
                >
                  <div className="font-semibold text-slate-800 truncate">{search.title}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {search.start} <span className="text-[#ff7f2a]">→</span> {search.end}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{search.rooms}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {bookingsOpen && (
        <div className="max-w-screen-xl mx-auto px-4 pt-6">
          <div className="inline-flex border border-slate-200 rounded-full overflow-hidden mb-4 bg-white">
            <TabPill active={bookingTab === 'hold'} onClick={() => setBookingTab('hold')}>Hold Expiring Soon</TabPill>
            <TabPill active={bookingTab === 'recent'} onClick={() => setBookingTab('recent')}>Recent Bookings</TabPill>
          </div>

          <div className="bg-white rounded-md shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white text-left text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">Booking ID</th>
                  <th className="px-4 py-3">Hotel</th>
                  <th className="px-4 py-3">Deadline Date</th>
                  <th className="px-4 py-3">Checkin–Checkout</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Booking Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      {bookingTab === 'hold'
                        ? 'No on-hold bookings expiring soon.'
                        : 'No bookings yet. Complete a booking through review to see it here.'}
                    </td>
                  </tr>
                ) : pagedBookings.map((b, i) => (
                  <tr key={b.id} className={i % 2 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/hotels/confirm?bookingId=${encodeURIComponent(b.bookingId)}`)}
                        className="text-[#ff7f2a] hover:underline"
                      >
                        {b.id}
                      </button>
                    </td>
                    <td className="px-4 py-3">{b.hotel}</td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        b.deadlineHint.startsWith('1 ')
                        || b.deadlineHint.startsWith('2 D')
                        || b.deadlineHint.startsWith('3 D')
                        || b.deadlineHint === 'Expired'
                          ? 'text-red-600 font-semibold'
                          : '',
                      )}
                      >
                        {b.deadline}
                      </span>
                      {b.deadlineHint && <span className="ml-2 text-xs text-amber-600">{b.deadlineHint}</span>}
                    </td>
                    <td className="px-4 py-3">{b.stay}</td>
                    <td className="px-4 py-3 whitespace-nowrap">₹{fmtINR(b.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusCell
                        status={b.status}
                        onPayNow={() => navigate(`/hotels/confirm?bookingId=${encodeURIComponent(b.bookingId)}`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeBookings.length > BOOKINGS_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs">
              <button
                type="button"
                disabled={safeBookingPage <= 1}
                onClick={() => setBookingPage((page) => Math.max(1, page - 1))}
                className={clsx(
                  'px-3 py-1 border border-slate-200 rounded',
                  safeBookingPage <= 1 ? 'text-slate-400' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                &lt; Prev
              </button>
              <button className="px-3 py-1 border border-[#ff7f2a] text-[#ff7f2a] rounded">{safeBookingPage}</button>
              <button
                type="button"
                disabled={safeBookingPage >= bookingPageCount}
                onClick={() => setBookingPage((page) => Math.min(bookingPageCount, page + 1))}
                className={clsx(
                  'px-3 py-1 border border-slate-200 rounded',
                  safeBookingPage >= bookingPageCount ? 'text-slate-400' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                Next &gt;
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Recent searches horizontal strip */}
      <div className="max-w-screen-xl mx-auto px-4 pt-6">
        {recentSearches.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
            Your recent searches will appear here after you search for hotels.
          </div>
        ) : (
          <div className="overflow-x-auto pb-3 -mx-1 ctmp-scroll">
            <div className="flex gap-3 px-1 min-w-max">
              {recentSearches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate(buildHotelSearchResultsUrl(s.raw))}
                  className="w-60 text-left bg-white rounded-md shadow-sm border border-slate-200 px-4 py-3 hover:border-[#ff7f2a]"
                >
                  <div className="font-semibold text-slate-800 truncate">{s.title}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {s.start} <span className="text-[#ff7f2a]">→</span> {s.end}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{s.rooms}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Promo carousel banner */}
      <div className="max-w-screen-xl mx-auto px-4 pt-6">
        <PromoCarousel />
      </div>

      {/* Deals & Offers grid */}
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="text-slate-800 font-semibold text-lg mb-3">Deals &amp; Offers</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEALS.map((d) => (
            <div
              key={d.title}
              className="rounded-md overflow-hidden shadow-sm bg-white border border-slate-200 hover:shadow-md transition"
            >
              <div className={clsx('h-32 flex items-center justify-center text-white p-4', d.bg)}>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/80">{d.brand}</div>
                  <div className="font-bold text-lg leading-snug">{d.title}</div>
                </div>
                {d.tag && (
                  <span className="absolute -mt-12 ml-32 bg-red-600 text-white text-[10px] uppercase tracking-wide px-2 py-0.5 rotate-12">
                    {d.tag}
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="text-xs text-slate-600 mb-2 line-clamp-2 min-h-[2.5rem]">{d.body}</div>
                <button className="text-xs font-semibold text-slate-800 hover:text-slate-950">
                  {d.cta} →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CityField({ city, onChange, onInputChange, error = '' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState(() => POPULAR_CITIES.slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const ref = useRef(null);
  const latestRequestRef = useRef(0);
  const trimmedQuery = q.trim();
  const mainCityText = city?.name || trimmedQuery;
  const mainCitySubtitle = city
    ? city.subtitle || [city.state, city.country].filter(Boolean).join(', ')
    : '';

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }

    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    if (trimmedQuery.length < 2) {
      setMatches(POPULAR_CITIES.slice(0, 10));
      setLoading(false);
      setFetchError('');
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFetchError('');

      try {
        // Do not cancel the first autocomplete request. React development mode
        // remounts effects once, and aborting here caused the first lookup to
        // appear as a failed/cancelled request in the browser.
        const remoteCities = await fetchHotelCitySuggestions(trimmedQuery, { limit: 10 });
        const localCities = POPULAR_CITIES.filter((city) =>
          `${city.name} ${city.displayName} ${city.state} ${city.country} ${city.subtitle}`.toLowerCase().includes(trimmedQuery.toLowerCase()),
        );
        const seen = new Set();
        const cities = [...localCities, ...remoteCities].filter((city) => {
          const key = `${city.type || city.regionType || 'CITY'}-${city.cityRegionId || city.regionId || city.hotelId || city.code || city.name}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 10);

        if (requestId === latestRequestRef.current) setMatches(cities);
      } catch (err) {
        if (requestId === latestRequestRef.current) {
          setMatches([]);
          setFetchError('Could not load cities');
        }
      } finally {
        if (requestId === latestRequestRef.current) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open, trimmedQuery]);

  function selectCity(nextCity) {
    onChange(nextCity);
    setOpen(false);
    setQ(nextCity.name);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'hotel-destination-error' : undefined}
        className={clsx(
          'w-full h-14 px-4 rounded-md hover:bg-slate-50 flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-[#ff7f2a]',
          error && 'border border-red-500 bg-red-50 ring-1 ring-red-400',
        )}
      >
        <MapPin className="w-4 h-4 text-[#ff7f2a]" />
        <div className="min-w-0 flex-1">
          {mainCityText ? (
            <>
              <div className="font-semibold text-slate-800 truncate tracking-wide">{mainCityText}</div>
              {mainCitySubtitle && (
                <div className="text-xs font-medium text-slate-500 truncate">{mainCitySubtitle}</div>
              )}
            </>
          ) : (
            <div className="font-medium text-slate-500 truncate">Search Times Square</div>
          )}
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-[420px] bg-white rounded-md shadow-xl border border-slate-200">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 caret-[#ff7f2a] outline-none"
              placeholder="Search Eiffel Tower, Connaught Place..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                onInputChange?.(e.target.value);
              }}
            />
            <button type="button" onClick={() => setOpen(false)}>
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="max-h-72 overflow-auto">
            {loading && (
              <div className="px-4 py-3 text-sm text-slate-500">Searching cities...</div>
            )}

            {!loading && matches.map((c) => (
              <button
                key={`${c.code}-${c.name}-${c.state}`}
                type="button"
                onClick={() => selectCity(c)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-orange-50 text-left border-b border-slate-50"
              >
                {isHotelSuggestion(c) ? (
                  <Building2 className="w-4 h-4 mt-1 text-[#ff7f2a] shrink-0" />
                ) : (
                  <MapPin className="w-4 h-4 mt-1 text-[#ff7f2a] shrink-0" />
                )}
                <div>
                  <div className="font-semibold text-slate-800 tracking-wide">{c.displayName || c.name}</div>
                  <div className="text-xs text-slate-500">
                    {c.subtitle || `${c.state ? `${c.state}, ` : ''}${c.country}`}
                    {isHotelSuggestion(c) ? ' · HOTEL' : ''}
                  </div>
                </div>
              </button>
            ))}

            {!loading && !matches.length && (
              <div className="px-4 py-3 text-sm text-slate-500">
                {fetchError || 'No cities found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DateRangeBox({ checkin, checkout, nights, onClick, error = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-invalid={Boolean(error)}
      className={clsx(
        'w-full h-14 px-4 rounded-md hover:bg-slate-50 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-left focus:outline-none focus:ring-2 focus:ring-[#ff7f2a]',
        error && 'border border-red-500 bg-red-50 ring-1 ring-red-400',
      )}
    >
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400">Check in</div>
        <div className="font-semibold text-slate-800 text-sm">{prettyDate(checkin)}</div>
      </div>
      <div className="text-center">
        <CalendarDays className="w-4 h-4 mx-auto text-[#ff7f2a]" />
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">{nights}N</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400">Check out</div>
        <div className="font-semibold text-slate-800 text-sm">{prettyDate(checkout)}</div>
      </div>
    </button>
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
            <button onClick={onApply} className="px-3 py-1.5 rounded bg-[#ff7f2a] text-white text-sm font-semibold hover:bg-[#e56a00]">
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
                  (selectedStart || selectedEnd) && 'bg-[#ff7f2a] text-white font-semibold',
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

function RoomsBox({ rooms, totalGuests, open, setOpen, onChange, error = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [setOpen]);

  function update(i, patch) {
    const next = rooms.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  }
  function addRoom() {
    onChange([...rooms, { adults: 1, children: 0, ages: [] }]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-invalid={Boolean(error)}
        className={clsx(
          'w-full h-14 px-4 rounded-md hover:bg-slate-50 flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-[#ff7f2a]',
          error && 'border border-red-500 bg-red-50 ring-1 ring-red-400',
        )}
      >
        <Users className="w-4 h-4 text-[#ff7f2a]" />
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Persons &amp; Rooms</div>
          <div className="font-semibold text-slate-800 text-sm">{rooms.length} Room · {totalGuests} Adult{totalGuests > 1 ? 's' : ''}</div>
        </div>
      </button>

      {open && (
        <div className="absolute z-50 right-0 mt-1 w-[340px] bg-white rounded-md shadow-xl border border-slate-200 p-4">
          {rooms.map((r, i) => (
            <div key={i} className="mb-3 pb-3 border-b border-slate-100 last:border-0">
              <div className="text-[#ff7f2a] font-semibold text-sm">Rooms {i + 1}</div>
              <Counter
                label={`${r.adults} Adults`}
                value={r.adults}
                min={1}
                onChange={(v) => update(i, { adults: v })}
              />
              <Counter
                label={`${r.children} Children`}
                sub="0 - 17 Years Old"
                value={r.children}
                onChange={(v) => update(i, { children: v, ages: new Array(v).fill(8) })}
              />
              {r.children > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-slate-500 mb-1">Age of Child</div>
                  <div className="flex flex-wrap gap-1">
                    {r.ages.map((age, idx) => (
                      <select
                        key={idx}
                        value={age}
                        onChange={(e) => {
                          const ages = [...r.ages];
                          ages[idx] = Number(e.target.value);
                          update(i, { ages });
                        }}
                        className="border border-slate-200 rounded text-xs px-1.5 py-0.5"
                      >
                        {Array.from({ length: 17 }, (_, k) => k + 1).map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between mt-2">
            <button type="button" onClick={addRoom} className="text-[#ff7f2a] text-sm font-semibold">+ ADD ROOM</button>
            <button type="button" onClick={() => setOpen(false)} className="text-[#ff7f2a] font-bold text-sm">DONE</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Counter({ label, sub, value, min = 0, onChange }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <div className="text-sm text-slate-800">{label}</div>
        {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded border border-slate-200 text-slate-600 hover:border-[#ff7f2a]"
        >−</button>
        <span className="w-5 text-center font-semibold text-sm">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded border border-slate-200 text-slate-600 hover:border-[#ff7f2a]"
        >+</button>
      </div>
    </div>
  );
}

function Selector({ value, onChange, options, displayLabel, showChecks = false, emptyLabel = 'No options found' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const safeOptions = Array.isArray(options) ? options.filter((option) => option?.value && option?.label) : [];
  const current = safeOptions.find((o) => o.value === value) || { value: '', label: '' };
  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer inline-flex items-center gap-1 text-sm font-semibold text-white hover:text-orange-100"
      >
        {displayLabel(current)} <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-[150px] bg-white text-slate-700 rounded-md shadow-xl border border-slate-200 p-1 max-h-64 overflow-auto">
          {safeOptions.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">{emptyLabel}</div>
          )}
          {safeOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={clsx(
                'flex w-full items-center justify-between gap-4 rounded px-3 py-2 text-left text-sm hover:bg-orange-50',
                o.value === value && 'bg-orange-50 text-[#ff7f2a] font-medium',
              )}
            >
              <span>{o.label}</span>
              {showChecks && (
                <span
                  className={clsx(
                    'h-3.5 w-3.5 rounded-sm border',
                    o.value === value
                      ? 'border-[#ff7f2a] bg-[#ff7f2a] shadow-[inset_0_0_0_2px_white]'
                      : 'border-slate-400 bg-white',
                  )}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function toCountrySelectOptions(countries) {
  const rows = Array.isArray(countries) ? countries : [];

  return rows
    .map((country) => {
      const value = country.value ?? country.countryId ?? country.id ?? '';
      const label = country.label ?? country.name ?? country.countryName ?? '';
      return {
        value: String(value),
        label: String(label),
      };
    })
    .filter((option) =>
      option.value &&
      option.label &&
      option.value.toLowerCase() !== 'null' &&
      option.label.toLowerCase() !== 'null' &&
      option.value.toLowerCase() !== 'undefined' &&
      option.label.toLowerCase() !== 'undefined',
    );
}

function TabPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-5 py-1.5 text-sm font-semibold',
        active ? 'bg-[#ff7f2a] text-slate-950' : 'text-slate-700 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

function StatusCell({ status, onPayNow }) {
  if (status === 'On Hold')
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={onPayNow}
          className="text-xs border border-[#ff7f2a] text-[#ff7f2a] hover:bg-[#ff7f2a] hover:text-white rounded px-3 py-1"
        >
          Pay Now
        </button>
        <span className="text-slate-600 text-xs">On Hold</span>
      </span>
    );
  if (status === 'Vouchered') return <span className="text-emerald-600 font-medium text-xs">Vouchered</span>;
  if (status === 'Cancelled') return <span className="text-slate-500 text-xs">Cancelled</span>;
  if (status === 'Aborted') return <span className="text-red-500 text-xs">Aborted</span>;
  return <span className="text-slate-500 text-xs">{status}</span>;
}

function isHotelSuggestion(item) {
  return item?.type === 'HOTEL' || item?.regionType === 'HOTEL';
}

function PromoCarousel() {
  const [idx, setIdx] = useState(0);
  const slide = PROMO_SLIDES[idx];
  const prev = () => setIdx((idx - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length);
  const next = () => setIdx((idx + 1) % PROMO_SLIDES.length);

  return (
    <div className="relative">
      <div className={clsx('rounded-md overflow-hidden text-white px-8 py-8 flex items-center gap-6', slide.bg)}>
        <div className="flex-1">
          <div className="text-sm italic opacity-90">{slide.kicker}</div>
          <div className="text-3xl md:text-4xl font-extrabold tracking-tight">{slide.title}</div>
          <div className="mt-2 text-sm md:text-base opacity-90 max-w-xl">{slide.body}</div>
          <button className="mt-4 inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/60 rounded-full px-5 py-1.5 text-sm font-semibold">
            {slide.cta}
          </button>
        </div>
        <div className="hidden md:block text-7xl font-extrabold italic opacity-30 select-none">
          {slide.title.split(' ')[0]}
        </div>
      </div>
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <div className="flex justify-center gap-2 mt-3">
        {PROMO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={clsx('w-2 h-2 rounded-full', i === idx ? 'bg-[#ff7f2a]' : 'bg-slate-300')}
          />
        ))}
      </div>
    </div>
  );
}

function prettyDate(v) {
  if (!v) return '--';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function nightCount(checkin, checkout) {
  const diff = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
  return Math.max(1, diff);
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

