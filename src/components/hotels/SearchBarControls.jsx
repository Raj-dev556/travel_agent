import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, MapPin, Users, X } from 'lucide-react';
import clsx from 'clsx';
import { fetchHotelCitySuggestions } from '../../pages/hotels/hotelCityAutocomplete';
import {
  HOTEL_NATIONALITY_OPTIONS,
  HOTEL_RESIDENCE_OPTIONS,
} from '../../data/hotelCountryOptions';

export const HOTEL_SEARCH_CITIES = [
  { name: 'DUBAI', code: 'DXB', state: '', country: 'UNITED ARAB EMIRATES' },
  { name: 'MUMBAI', code: 'BOM', state: 'MAHARASHTRA', country: 'INDIA' },
  { name: 'SINGAPORE', code: 'SIN', state: '', country: 'SINGAPORE' },
  { name: 'DELHI', code: 'DEL', state: 'NATIONAL CAPITAL TERRITORY OF DELHI', country: 'INDIA' },
  { name: 'BANGKOK', code: 'BKK', state: 'BANGKOK PROVINCE', country: 'THAILAND' },
  { name: 'PATTAYA', code: 'PYX', state: 'CHONBURI', country: 'THAILAND' },
  { name: 'BENGALURU', code: 'BLR', state: 'KARNATAKA', country: 'INDIA' },
  { name: 'CHENNAI', code: 'MAA', state: 'TAMIL NADU', country: 'INDIA' },
  { name: 'GOA', code: 'GOI', state: 'GOA', country: 'INDIA' },
  { name: 'KOLKATA', code: 'CCU', state: 'WEST BENGAL', country: 'INDIA' },
];

export const HOTEL_SEARCH_NATIONALITIES = HOTEL_NATIONALITY_OPTIONS.filter(
  (country) => country.label.toLowerCase() === 'india',
);

export function getHotelNationalityOptions() {
  return HOTEL_NATIONALITY_OPTIONS;
}

export function getHotelResidenceOptions() {
  return HOTEL_RESIDENCE_OPTIONS;
}

function normalizeDropdownOption(option) {
  if (option && typeof option === 'object') {
    const value = String(option.value ?? option.countryId ?? option.id ?? '');
    const label = String(option.label ?? option.name ?? option.countryName ?? value);
    return { value, label };
  }
  return { value: String(option), label: String(option) };
}

export const HOTEL_SEARCH_RATING_OPTIONS = [
  { value: '0', label: 'Rating' },
  { value: '3', label: '3* & above' },
  { value: '4', label: '4* & above' },
  { value: '5', label: '5* only' },
];

export function deriveCityCode(cityName) {
  const input = String(cityName || '').trim();
  if (!input) return 'CTY';
  const exact = HOTEL_SEARCH_CITIES.find((city) => city.name.toLowerCase() === input.toLowerCase());
  if (exact?.code) return exact.code;
  return input.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'CTY';
}

function isHotelSuggestion(item) {
  return item?.type === 'HOTEL' || item?.regionType === 'HOTEL';
}

export function summarizeRooms(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) return '1 Room 1 Adult';
  const roomCount = rooms.length;
  const adults = rooms.reduce((sum, room) => sum + Number(room?.adults || 0), 0);
  const children = rooms.reduce((sum, room) => sum + Number(room?.children || 0), 0);
  return `${roomCount} Room ${adults} Adult${adults === 1 ? '' : 's'}${children ? ` ${children} Child${children === 1 ? '' : 'ren'}` : ''}`;
}

export function CityDropdownField({
  value,
  onChange,
  onCityPick,
  label = 'City, area or property',
  className = '',
  fieldError = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [matches, setMatches] = useState(HOTEL_SEARCH_CITIES);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!ref.current) return;
      if (!ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const localMatches = useMemo(() => {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return HOTEL_SEARCH_CITIES;
    return HOTEL_SEARCH_CITIES.filter((city) =>
      `${city.code} ${city.name} ${city.state} ${city.country}`.toLowerCase().includes(needle),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;

    const needle = String(query || '').trim();
    if (needle.length < 2) {
      setMatches(localMatches);
      setLoading(false);
      setFetchError('');
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFetchError('');

      try {
        const suggestions = await fetchHotelCitySuggestions(needle, {
          limit: 10,
        });
        if (!active) return;
        setMatches(suggestions);
      } catch (err) {
        if (!active) return;
        setMatches([]);
        setFetchError('Could not load suggestions');
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [localMatches, open, query]);

  function selectCity(city) {
    onChange(city.name);
    onCityPick?.(city);
    setQuery(city.name);
    setOpen(false);
  }

  return (
    <div ref={ref} className={clsx('relative border rounded-md px-3 py-2', fieldError ? 'border-red-400' : 'border-slate-300', className)}>
      <label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</label>
      <input
        value={value}
        onFocus={() => {
          setOpen(true);
          setQuery(value || '');
        }}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
          setQuery(next);
          setOpen(true);
        }}
        placeholder="Search city or property"
        className="w-full text-sm font-semibold text-slate-800 focus:outline-none bg-transparent"
      />

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-slate-200 bg-white shadow-xl">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                const next = event.target.value;
                setQuery(next);
                onChange(next);
              }}
              placeholder="Search city, area or property"
              className="flex-1 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-auto">
            {loading && (
              <div className="px-4 py-3 text-sm text-slate-500">Searching suggestions...</div>
            )}

            {!loading && matches.map((city) => (
              <button
                key={`${city.code}-${city.name}-${city.type || city.regionType || ''}`}
                type="button"
                onClick={() => selectCity(city)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-orange-50 text-left border-b border-slate-50 last:border-b-0"
              >
                {isHotelSuggestion(city) ? (
                  <Building2 className="w-4 h-4 mt-1 text-accent-500 shrink-0" />
                ) : (
                  <MapPin className="w-4 h-4 mt-1 text-accent-500 shrink-0" />
                )}
                <div className="min-w-0">
                <div className="font-semibold text-slate-800">{city.displayName || city.name}</div>
                <div className="text-xs text-slate-500">
                  {city.subtitle || `${city.state ? `${city.state}, ` : ''}${city.country}`}
                  {city.type === 'HOTEL' || city.regionType === 'HOTEL' ? ' · HOTEL' : ''}
                </div>
                </div>
              </button>
            ))}

            {!loading && !matches.length && !fetchError && (
              <button
                type="button"
                onClick={() => selectCity({
                  name: query.trim() || value || 'City',
                  code: deriveCityCode(query || value || 'City'),
                  type: 'CITY',
                })}
                className="w-full text-left px-4 py-3 hover:bg-orange-50 text-sm text-slate-700"
              >
                Use "{query.trim() || value || 'City'}"
              </button>
            )}

            {!loading && fetchError && (
              <div className="px-4 py-3 text-sm text-slate-500">{fetchError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function RoomsGuestsDropdown({
  rooms,
  onChange,
  label = 'Rooms and guests',
  className = '',
  error = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onPointerDown(event) {
      if (!ref.current) return;
      if (!ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const safeRooms = Array.isArray(rooms) && rooms.length ? rooms : [{ adults: 1, children: 0, ages: [] }];

  function updateRoom(index, patch) {
    const next = safeRooms.map((room, idx) => (idx === index ? { ...room, ...patch } : room));
    onChange(next);
  }

  function addRoom() {
    onChange([...safeRooms, { adults: 1, children: 0, ages: [] }]);
  }

  return (
    <div ref={ref} className={clsx('relative border rounded-md px-3 py-2 flex items-center', error ? 'border-red-400' : 'border-slate-300', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full text-left inline-flex items-start gap-2"
      >
        <Users className="w-4 h-4 mt-1 text-accent-500 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
          <div className="text-sm font-semibold text-slate-800 truncate">{summarizeRooms(safeRooms)}</div>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[340px] rounded-md border border-slate-200 bg-white p-4 shadow-xl">
          {safeRooms.map((room, index) => (
            <div key={`room-${index}`} className="mb-3 pb-3 border-b border-slate-100 last:border-0">
              <div className="text-accent-600 font-semibold text-sm mb-1">Room {index + 1}</div>
              <Counter
                label={`${room.adults} Adults`}
                value={Number(room.adults || 1)}
                min={1}
                onChange={(next) => updateRoom(index, { adults: next })}
              />
              <Counter
                label={`${room.children || 0} Children`}
                sub="0 - 17 Years Old"
                value={Number(room.children || 0)}
                onChange={(next) => updateRoom(index, { children: next, ages: new Array(next).fill(8) })}
              />

              {Number(room.children || 0) > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-slate-500 mb-1">Age of Child</div>
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(room.ages) ? room.ages : []).map((age, ageIdx) => (
                      <select
                        key={`age-${ageIdx}`}
                        value={age}
                        onChange={(event) => {
                          const ages = [...(Array.isArray(room.ages) ? room.ages : [])];
                          ages[ageIdx] = Number(event.target.value);
                          updateRoom(index, { ages });
                        }}
                        className="border border-slate-200 rounded text-xs px-1.5 py-0.5"
                      >
                        {Array.from({ length: 17 }, (_, k) => k + 1).map((ageValue) => (
                          <option key={ageValue} value={ageValue}>{ageValue}</option>
                        ))}
                      </select>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between mt-2">
            <button type="button" onClick={addRoom} className="text-accent-600 text-sm font-semibold">
              + ADD ROOM
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-accent-500 font-bold text-sm">
              DONE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function OptionDropdown({
  label,
  value,
  onChange,
  options,
  className = '',
  variant = 'pill',
  showChecks = false,
  displayLabel,
  placeholder,
  searchable = false,
  searchPlaceholder = 'Search',
  emptyLabel = 'No options found',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const normalizedOptions = useMemo(() => (options || []).map(normalizeDropdownOption), [options]);
  const filteredOptions = useMemo(() => {
    if (!searchable) return normalizedOptions;
    const needle = query.trim().toLowerCase();
    if (!needle) return normalizedOptions;
    return normalizedOptions.filter((option) =>
      option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle),
    );
  }, [normalizedOptions, query, searchable]);
  const selectedOption = normalizedOptions.find((option) => option.value === String(value));
  const selectedLabel = selectedOption?.label || String(value || '');
  const buttonLabel =
    typeof displayLabel === 'function'
      ? displayLabel(selectedOption || { value: String(value || ''), label: selectedLabel })
      : value
        ? `${label}: ${selectedLabel}`
        : placeholder
          ? `${label}: ${placeholder}`
          : label;
  const isPlain = variant === 'plain';

  useEffect(() => {
    function onPointerDown(event) {
      if (!ref.current) return;
      if (!ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          'inline-flex items-center gap-1 text-xs font-semibold',
          isPlain
            ? 'text-slate-700 hover:text-accent-600'
            : 'px-2 py-0.5 rounded-md bg-[#e8effc] text-[#0c4da2] hover:bg-[#dbe6fb]',
        )}
      >
        {buttonLabel}
        <ChevronDown className={clsx('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px] max-h-80 overflow-auto rounded-md border border-slate-200 bg-white shadow-xl p-1">
          {searchable && (
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-accent-400"
              />
            </div>
          )}
          {filteredOptions.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">{emptyLabel}</div>
          )}
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={clsx(
                'flex w-full items-center justify-between gap-4 rounded px-3 py-2 text-left text-sm hover:bg-orange-50',
                option.value === String(value) && 'bg-orange-50 text-accent-600 font-medium',
              )}
            >
              <span>{option.label}</span>
              {showChecks && (
                <span
                  className={clsx(
                    'h-3.5 w-3.5 rounded-sm border',
                    option.value === String(value)
                      ? 'border-blue-500 bg-blue-500 shadow-[inset_0_0_0_2px_white]'
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

function Counter({ label, sub, value, min = 0, onChange }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <div className="text-sm text-slate-800">{label}</div>
        {sub ? <div className="text-[11px] text-slate-500">{sub}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded border border-slate-200 text-slate-600 hover:border-accent-300"
        >
          -
        </button>
        <span className="w-5 text-center font-semibold text-sm">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded border border-slate-200 text-slate-600 hover:border-accent-300"
        >
          +
        </button>
      </div>
    </div>
  );
}
