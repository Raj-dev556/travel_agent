import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plane, Calendar, Users, ArrowLeftRight, Mic, ChevronDown, X, Share2,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { deriveAirportSearchErrorMessage, searchAirports } from './airportSearchService';
import { buildFlightSearchPayload, deriveSearchErrorMessage, searchFlights } from './flightSearchService';

export const FARE_TYPES = [
  { value: 'regular', label: 'Regular' },
  { value: 'student', label: 'Student' },
  { value: 'senior', label: 'Senior Citizen' },
  { value: 'soto', label: 'SOTO' },
  { value: 'ndc', label: 'NDC' },
];

export const CABIN_OPTIONS = [
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'PREMIUM_ECONOMY', label: 'Premium Economy' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'FIRST', label: 'First' },
];

const fmtIN = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
};

const UPCOMING_BOOKINGS = [
  { id: 'CT1065165595644', passenger: 'ROHIT DNYANESHWAR...', date: 'May 12 2026', from: 'PNQ', to: 'BLR' },
  { id: 'CT1075161756179', passenger: 'ROHIT DNYANESHWAR...', date: 'May 13 2026', from: 'DEL', to: 'BOM' },
  { id: 'CT1032168434736', passenger: 'MANOJ DHUMAL + 3', date: 'May 15 2026', from: 'BOM', to: 'GOI' },
  { id: 'CT1097173441711', passenger: 'AKASH KUMAR GUPT...', date: 'May 19 2026', from: 'BLR', to: 'HYD' },
  { id: 'CT1165168880619', passenger: 'ANAND MURLIDHAR ...', date: 'May 29 2026', from: 'CCU', to: 'DEL' },
];

export default function FlightSearch() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [tripType, setTripType] = useState('O');
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [departDate, setDepartDate] = useState(today);
  const [returnDate, setReturnDate] = useState('');

  // Multi-city extra legs (beyond the first leg which uses from/to/departDate).
  const [legs, setLegs] = useState([
    { from: null, to: null, date: today },
  ]);

  const [pax, setPax] = useState({ adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState('ECONOMY');
  const [airline, setAirline] = useState('Any airline');
  const [fareType, setFareType] = useState('regular');
  const [directOnly, setDirectOnly] = useState(false);
  const [creditShell, setCreditShell] = useState(false);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [paxOpen, setPaxOpen] = useState(false);
  const [bookingTab, setBookingTab] = useState('upcoming');

  function swap() { setFrom(to); setTo(from); }
  function swapLeg(i) {
    setLegs((arr) => arr.map((l, idx) => (idx === i ? { ...l, from: l.to, to: l.from } : l)));
  }
  function updateLeg(i, patch) {
    setLegs((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLeg() {
    if (legs.length >= 4) return;
    const last = legs[legs.length - 1];
    setLegs((arr) => [...arr, { from: last.to, to: null, date: last.date }]);
  }
  function removeLeg(i) {
    setLegs((arr) => arr.filter((_, idx) => idx !== i));
  }

  async function go() {
    if (loadingSearch) return;

    const { payload, validationErrors } = buildFlightSearchPayload({
      tripType,
      from,
      to,
      departDate,
      returnDate,
      legs,
      pax,
      cabin,
      directOnly,
    });

    if (validationErrors.length) {
      const message = validationErrors[0];
      setSearchError(message);
      toast.error(message);
      return;
    }

    const base = {
      tripType,
      from: from.code, to: to.code,
      departDate,
      adults: pax.adults, children: pax.children, infants: pax.infants,
      cabinClass: cabin,
      directOnly: directOnly ? '1' : '0',
      creditShell: creditShell ? '1' : '0',
      airline: airline?.code || '',
      airlineName: airline?.name || airline,
      fareType,
    };
    if (tripType === 'R' && returnDate) base.returnDate = returnDate;
    if (tripType === 'M') {
      const allLegsForParams = [
        { from: from.code, to: to.code, date: departDate },
        ...legs.map((l) => ({ from: l.from?.code, to: l.to?.code, date: l.date })),
      ].filter((leg) => leg.from && leg.to && leg.date);
      base.legs = JSON.stringify(allLegsForParams);
    }

    setLoadingSearch(true);
    setSearchError('');
    try {
      const searchParams = new URLSearchParams(base).toString();
      const searchResponse = await searchFlights(payload);
      navigate(`/flights/results?${searchParams}`, {
        state: { searchResponse, searchKey: searchParams },
      });
    } catch (err) {
      const message = deriveSearchErrorMessage(err);
      setSearchError(message);
      toast.error(message);
    } finally {
      setLoadingSearch(false);
    }
  }

  function startReturnBooking(booking) {
    const depart = new Date();
    depart.setDate(depart.getDate() + 2);

    const params = new URLSearchParams({
      tripType: 'O',
      from: booking?.to || 'BLR',
      to: booking?.from || 'PNQ',
      departDate: depart.toISOString().slice(0, 10),
      adults: String(pax.adults),
      children: String(pax.children),
      infants: String(pax.infants),
      cabinClass: cabin,
      directOnly: directOnly ? '1' : '0',
      creditShell: creditShell ? '1' : '0',
      airline: airline?.code || '',
      airlineName: airline?.name || airline,
      fareType,
    });

    navigate(`/flights/results?${params.toString()}`);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flight-hero relative">
        <div className="max-w-screen-xl mx-auto px-4 pt-14 pb-16 relative">
          <h1 className="text-white text-3xl md:text-[34px] font-semibold tracking-tight">
            Book flights and explore the world with us.
          </h1>

          <div className="mt-6 inline-flex rounded-lg bg-white/95 p-1 text-sm font-semibold shadow-sm">
            <TripTab active={tripType === 'O'} onClick={() => setTripType('O')}>ONE WAY</TripTab>
            <TripTab active={tripType === 'R'} onClick={() => setTripType('R')}>ROUND TRIP</TripTab>
            <TripTab active={tripType === 'M'} onClick={() => setTripType('M')}>MULTI CITY</TripTab>
          </div>

          {tripType !== 'M' ? (
            <div className="mt-4 flex flex-wrap lg:flex-nowrap items-stretch gap-2">
              {/* Combined From ↔ To pill */}
              <div className="relative bg-white rounded-lg shadow-sm flex items-stretch flex-1 min-w-[280px]">
                <AirportField label="Where Fromss ?" value={from} onChange={setFrom} side="from" placeholder="Where From ?" />
                <div className="w-px bg-slate-200 my-3" />
                <AirportField label="Where To ?" value={to} onChange={setTo} side="to" placeholder="Where To ?" />
                <button
                  type="button"
                  onClick={swap}
                  title="Swap"
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center"
                >
                  <ArrowLeftRight className="w-4 h-4 text-accent-500" />
                </button>
              </div>

              {/* Combined Departure / Return pill */}
              <div className="bg-white rounded-lg shadow-sm flex items-stretch min-w-[260px]">
                <DateField label="Departure" value={departDate} onChange={setDepartDate} icon />
                <div className="w-px bg-slate-200 my-3" />
                <DateField
                  label="Return"
                  value={returnDate}
                  onChange={(v) => { setReturnDate(v); if (v) setTripType('R'); }}
                  clearable
                  onClear={() => { setReturnDate(''); setTripType('O'); }}
                  muted
                />
              </div>

              <PaxField
                pax={pax} cabin={cabin}
                open={paxOpen} setOpen={setPaxOpen}
                onChange={(p) => setPax(p)} onCabin={setCabin}
              />

              <button type="button" onClick={go} disabled={loadingSearch} className="px-10 rounded-lg bg-accent-500 hover:bg-accent-600 text-white font-semibold shadow-sm">
                {loadingSearch ? 'Searching...' : 'Search'}
              </button>
              {searchError && (
                <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert" aria-live="polite">
                  {searchError}
                </div>
              )}
              <button
                type="button"
                className="w-14 h-14 rounded-full bg-accent-500 hover:bg-accent-600 text-white flex flex-col items-center justify-center shadow-sm"
                title="Voice search (beta)"
              >
                <Mic className="w-4 h-4" />
                <span className="text-[9px] tracking-wider leading-none mt-0.5">BETA</span>
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {/* Leg 1 — pinned to from/to/departDate so existing state stays consistent. */}
              <div className="flex flex-wrap lg:flex-nowrap items-stretch gap-2">
                <div className="relative bg-white rounded-lg shadow-sm flex items-stretch flex-1 min-w-[280px]">
                  <AirportField label="Where From ?" value={from} onChange={setFrom} side="from" placeholder="Where From ?" />
                  <div className="w-px bg-slate-200 my-3" />
                  <AirportField label="Where To ?" value={to} onChange={setTo} side="to" placeholder="Where To ?" />
                  <button
                    type="button"
                    onClick={swap}
                    title="Swap"
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-accent-500" />
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow-sm flex items-stretch min-w-[170px] flex-1">
                  <DateField label="Departure" value={departDate} onChange={setDepartDate} icon />
                </div>

                <PaxField
                  pax={pax} cabin={cabin}
                  open={paxOpen} setOpen={setPaxOpen}
                  onChange={(p) => setPax(p)} onCabin={setCabin}
                />

                <button type="button" onClick={go} disabled={loadingSearch} className="px-10 rounded-lg bg-accent-500 hover:bg-accent-600 text-white font-semibold shadow-sm">
                  {loadingSearch ? 'Searching...' : 'Search'}
                </button>
                {searchError && (
                  <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert" aria-live="polite">
                    {searchError}
                  </div>
                )}
                <button
                  type="button"
                  className="w-14 h-14 rounded-full bg-accent-500 hover:bg-accent-600 text-white flex flex-col items-center justify-center shadow-sm"
                  title="Voice search (beta)"
                >
                  <Mic className="w-4 h-4" />
                  <span className="text-[9px] tracking-wider leading-none mt-0.5">BETA</span>
                </button>
              </div>

              {legs.map((leg, i) => (
                <div key={i} className="flex flex-wrap lg:flex-nowrap items-stretch gap-2">
                  <div className="relative bg-white rounded-lg shadow-sm flex items-stretch flex-1 min-w-[280px]">
                    <AirportField
                      label="Where From ?"
                      value={leg.from}
                      onChange={(v) => updateLeg(i, { from: v })}
                      side="from"
                      placeholder="Where From ?"
                    />
                    <div className="w-px bg-slate-200 my-3" />
                    <AirportField
                      label="Where To ?"
                      value={leg.to}
                      onChange={(v) => updateLeg(i, { to: v })}
                      side="to"
                      placeholder="Where To ?"
                    />
                    <button
                      type="button"
                      onClick={() => swapLeg(i)}
                      title="Swap"
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center"
                    >
                      <ArrowLeftRight className="w-4 h-4 text-accent-500" />
                    </button>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm flex items-stretch min-w-[170px] flex-1">
                    <DateField
                      label="Departure"
                      value={leg.date}
                      onChange={(v) => updateLeg(i, { date: v })}
                      icon
                    />
                  </div>

                  <div className="min-w-[170px] flex-1" />

                  {i === legs.length - 1 && legs.length < 4 ? (
                    <button
                      type="button"
                      onClick={addLeg}
                      className="border border-white/70 text-white font-semibold tracking-wide rounded-lg px-6 hover:bg-white/10"
                    >
                      ADD ONE MORE
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeLeg(i)}
                      className="border border-white/40 text-white/80 rounded-lg px-6 hover:bg-white/10 inline-flex items-center justify-center gap-1"
                      title="Remove leg"
                    >
                      <X className="w-4 h-4" /> REMOVE
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-white/90 text-sm">
            <AirlineSelector value={airline} onChange={setAirline} />

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-white/80">Select Fare Type:</span>
              {FARE_TYPES.map((f) => (
                <label key={f.value} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="fareType"
                    value={f.value}
                    className="h-4 w-4 accent-accent-500"
                    checked={fareType === f.value}
                    onChange={() => setFareType(f.value)}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-4">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-accent-500"
                  checked={directOnly}
                  onChange={(e) => setDirectOnly(e.target.checked)}
                />
                <span>Direct Flight</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-accent-500"
                  checked={creditShell}
                  onChange={(e) => setCreditShell(e.target.checked)}
                />
                <span>Credit Shell</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-4 py-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-6 text-sm font-semibold">
            <BookingTab id="upcoming" active={bookingTab} onClick={setBookingTab}>Upcoming Bookings</BookingTab>
            <BookingTab id="recent" active={bookingTab} onClick={setBookingTab}>Recent Searches</BookingTab>
            <BookingTab id="saved" active={bookingTab} onClick={setBookingTab} badge="New">Saved Trips</BookingTab>
            <BookingTab id="deals" active={bookingTab} onClick={setBookingTab}>Deals &amp; Offers</BookingTab>
          </div>
          <button className="ml-auto inline-flex items-center gap-2 text-sm font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-md px-3 py-1.5">
            <Share2 className="w-4 h-4" /> Share with Customer
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-4">
        {bookingTab === 'upcoming' && (
          <div className="bg-white rounded-md shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-orange-300 text-left text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">Booking ID</th>
                  <th className="px-4 py-3">Passenger Name</th>
                  <th className="px-4 py-3">Travel Date</th>
                  <th className="px-4 py-3">Booking Summary</th>
                  <th className="px-4 py-3">Add Seat, Meal &amp; Baggage</th>
                  <th className="px-4 py-3 text-right">Other Travel Options</th>
                </tr>
              </thead>
              <tbody>
                {UPCOMING_BOOKINGS.map((b, i) => (
                  <tr key={b.id} className={i % 2 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => startReturnBooking(b)} className="text-brand-700 underline">
                        {b.id}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium">{b.passenger}</td>
                    <td className="px-4 py-3">{b.date}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => startReturnBooking(b)} className="text-brand-600 hover:underline">
                        View Summary
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex gap-1">
                        <ChipBtn>Seat</ChipBtn>
                        <ChipBtn>Meal</ChipBtn>
                        <ChipBtn>Baggage</ChipBtn>
                        <ChipBtn>+ Add All</ChipBtn>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startReturnBooking(b)}
                        className="text-xs border border-slate-300 hover:border-accent-400 rounded-md px-3 py-1"
                      >
                        Book Return
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-center gap-2 py-3 text-xs">
              <button className="px-3 py-1 border border-slate-200 rounded text-slate-400">&lt; Prev</button>
              <button className="px-3 py-1 border border-accent-500 text-accent-600 rounded">1</button>
              <button className="px-3 py-1 border border-slate-200 rounded">Next &gt;</button>
            </div>
          </div>
        )}

        {bookingTab === 'recent' && <EmptyTab title="Recent Searches" subtitle="Run a few searches to see them here." />}
        {bookingTab === 'saved' && <EmptyTab title="Saved Trips" subtitle="Star a search to save it for later." />}
        {bookingTab === 'deals' && <EmptyTab title="Deals & Offers" subtitle="Promotional fares from partner airlines appear here." />}
      </div>
    </div>
  );
}

export function TripTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-5 py-2 rounded-md transition',
        active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:text-slate-900',
      )}
    >
      {children}
    </button>
  );
}

function BookingTab({ id, active, onClick, children, badge }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={clsx(
        'pb-2 border-b-2 -mb-[1px] flex items-center gap-2',
        isActive ? 'border-accent-500 text-accent-600' : 'border-transparent text-slate-600 hover:text-slate-900',
      )}
    >
      {children}
      {badge && <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">{badge}</span>}
    </button>
  );
}

function ChipBtn({ children }) {
  return (
    <button className="text-xs border border-slate-300 hover:border-accent-400 hover:text-accent-600 rounded-md px-2 py-1">
      {children}
    </button>
  );
}

function EmptyTab({ title, subtitle }) {
  return (
    <div className="bg-white rounded-md shadow-sm p-10 text-center">
      <div className="font-semibold text-slate-800">{title}</div>
      <div className="text-sm text-slate-500 mt-1">{subtitle}</div>
    </div>
  );
}

export function AirportField({ label, value, onChange, side, onSwap, placeholder, standalone }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrap = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    function onClick(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const trimmedQuery = q.trim();
    if (trimmedQuery.length < 2) {
      setMatches([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    const controller = new AbortController();
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const results = await searchAirports(trimmedQuery, {
          signal: controller.signal,
          limit: 10,
        });
        if (requestSeq.current === seq) {
          setMatches(results);
        }
      } catch (err) {
        if (err.code !== 'ERR_CANCELED' && requestSeq.current === seq) {
          setMatches([]);
          setError(deriveAirportSearchErrorMessage(err));
        }
      } finally {
        if (!controller.signal.aborted && requestSeq.current === seq) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, q]);

  function selectAirport(airport) {
    onChange(airport);
    setOpen(false);
    setQ('');
    setMatches([]);
    setError('');
  }

  function selectFirstMatch() {
    if (matches.length) selectAirport(matches[0]);
  }

  return (
    <div ref={wrap} className={clsx('relative flex-1 min-w-0', standalone && 'bg-white rounded-lg shadow-sm')}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-14 px-4 text-left flex items-center gap-3"
      >
        <Plane className={clsx('w-4 h-4 text-slate-400 shrink-0', side === 'to' && 'rotate-90')} />
        <div className="min-w-0">
          {value ? (
            <>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">{label.replace(' ?', '')}</div>
              <div className="font-semibold text-slate-800 truncate">
                <span className="font-bold">{value.code}</span>
                <span className="ml-2 text-slate-500 font-normal">{value.city}</span>
              </div>
            </>
          ) : (
            <span className="text-slate-400">{placeholder || label}</span>
          )}
        </div>
      </button>

      {onSwap && (
        <button
          type="button"
          onClick={onSwap}
          title="Swap"
          className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-slate-200 shadow items-center justify-center"
        >
          <ArrowLeftRight className="w-4 h-4 text-accent-500" />
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-[360px] bg-white rounded-md shadow-xl border border-slate-200">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              className="input bg-white text-slate-900 placeholder:text-slate-400"
              placeholder="City or airport code"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); selectFirstMatch(); } }}
            />
          </div>
          <div className="max-h-72 overflow-auto">
            {matches.map((a) => (
              <button
                key={a.code}
                onClick={() => selectAirport(a)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-orange-50 text-left border-b border-slate-50"
              >
                <span className="text-accent-500 font-bold w-12">{a.code}</span>
                <span className="flex-1">
                  <div className="font-semibold text-slate-800">{a.name || a.city}</div>
                  <div className="text-xs text-slate-500">{[a.city, a.country].filter(Boolean).join(', ')}</div>
                </span>
                <span className="text-xs text-slate-500">{a.country}</span>
              </button>
            ))}
            {loading && <div className="text-sm text-slate-400 p-4 text-center">Loading airports...</div>}
            {!loading && !!error && <div className="text-sm text-rose-500 p-4 text-center">{error}</div>}
            {!loading && !error && q.trim().length < 2 && <div className="text-sm text-slate-400 p-4 text-center">Type at least 2 characters</div>}
            {!loading && !error && q.trim().length >= 2 && !matches.length && <div className="text-sm text-slate-400 p-4 text-center">No airports found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function DateField({ label, value, onChange, clearable, onClear, icon, muted, standalone }) {
  return (
    <div className={clsx(
      'h-14 px-4 flex items-center gap-3 relative flex-1 min-w-0',
      standalone && 'bg-white rounded-lg shadow-sm',
      muted && !value && 'bg-slate-50/60',
    )}>
      {icon && <Calendar className="w-4 h-4 text-slate-400 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        <span className={clsx('font-semibold text-[13px] truncate block', value ? 'text-slate-800' : 'text-slate-400')}>
          {value ? fmtIN(value) : (clearable ? 'Add Return' : 'Select date')}
        </span>
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch (_) { /* noop */ } }}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
      {clearable && value && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="text-slate-400 hover:text-slate-700 z-10"
          title="Clear return"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function PaxField({ pax, cabin, open, setOpen, onChange, onCabin }) {
  const wrap = useRef(null);
  useEffect(() => {
    function onClick(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [setOpen]);

  const total = pax.adults + pax.children + pax.infants;
  const cabinLabel = CABIN_OPTIONS.find((c) => c.value === cabin)?.label || 'Economy';

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-14 bg-white rounded-lg px-4 text-left flex items-center gap-3 shadow-sm"
      >
        <Users className="w-4 h-4 text-slate-400" />
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Travellers &amp; Class</div>
          <div className="font-semibold text-slate-800 text-sm">
            {total} Passenger{total > 1 ? 's' : ''} | {cabinLabel}
          </div>
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 right-0 w-[460px] bg-white rounded-md shadow-xl border border-slate-200 p-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-bold text-slate-500 mb-2">SELECT PASSENGER</div>
            <PaxRow label="Adult" sub="Age 12+" value={pax.adults} min={1} onChange={(v) => onChange({ ...pax, adults: v })} />
            <PaxRow label="Children" sub="Age 2-12" value={pax.children} min={0} onChange={(v) => onChange({ ...pax, children: v })} />
            <PaxRow label="Infant" sub="Age 0-2" value={pax.infants} min={0} onChange={(v) => onChange({ ...pax, infants: v })} />
          </div>
          <div className="border-l border-slate-100 pl-4">
            <div className="text-xs font-bold text-slate-500 mb-2">SELECT CLASS</div>
            <div className="space-y-2">
              {CABIN_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onCabin(c.value)}
                  className="w-full flex items-center justify-between text-sm py-2 border-b border-slate-50"
                >
                  <span className={cabin === c.value ? 'text-slate-900 font-medium' : 'text-slate-600'}>{c.label}</span>
                  <span className={clsx(
                    'w-4 h-4 rounded-full border flex items-center justify-center',
                    cabin === c.value ? 'border-accent-500 bg-accent-500 text-white' : 'border-slate-300',
                  )}>
                    {cabin === c.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </button>
              ))}
            </div>
            <div className="text-right mt-3">
              <button onClick={() => setOpen(false)} className="text-accent-500 font-bold text-sm">DONE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AirlineSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/flights/airlines', {
          params: { search: q.trim(), limit: 10 },
          signal: controller.signal,
        });
        setOptions(res.data?.results || []);
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') setOptions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, q]);

  const selectedLabel = value && typeof value === 'object' ? value.name : (value || 'Any airline');

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="cursor-pointer bg-slate-900/80 rounded-md px-4 py-2 flex items-center gap-2 font-semibold w-fit">
        {selectedLabel === 'Any airline' ? 'Select Preferred Airline' : selectedLabel}
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-72 bg-white text-slate-700 rounded-md shadow-xl border border-slate-200 p-1 max-h-72 overflow-auto">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus className="input bg-white text-slate-900 placeholder:text-slate-400" placeholder="Search airline name or code" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button type="button" onClick={() => { onChange('Any airline'); setOpen(false); setQ(''); }} className={clsx('w-full text-left px-3 py-2 rounded text-sm hover:bg-orange-50', selectedLabel === 'Any airline' && 'bg-orange-50 text-accent-600 font-medium')}>
            Any airline
          </button>
          {options.map((a) => (
            <button key={a.code} type="button" onClick={() => { onChange(a); setOpen(false); setQ(''); }} className={clsx('w-full text-left px-3 py-2 rounded text-sm hover:bg-orange-50', a.code === value?.code && 'bg-orange-50 text-accent-600 font-medium')}>
              <span className="font-semibold text-accent-500 mr-2">{a.code}</span>{a.name}
            </button>
          ))}
          {loading && <div className="text-sm text-slate-400 p-3 text-center">Loading airlines...</div>}
          {!loading && !options.length && <div className="text-sm text-slate-400 p-3 text-center">No airlines match</div>}
        </div>
      )}
    </div>
  );
}

function PaxRow({ label, sub, value, min, onChange }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline gap-2">
        <span className="font-bold text-slate-800">{label}</span>
        <span className="text-xs text-slate-500">{sub}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i).slice(min === 1 ? 1 : 0, 10).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={clsx(
              'w-7 h-7 text-sm rounded border',
              n === value ? 'bg-accent-500 border-accent-500 text-white' : 'border-slate-200 text-slate-700 hover:border-accent-300',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}




