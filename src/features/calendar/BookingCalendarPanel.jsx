import { useMemo, useState } from 'react';
import { CalendarDays, Hotel, Plane, Search } from 'lucide-react';
import { SectionCard } from '../dashboard/components';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = ['2024', '2025', '2026', '2027'];
const STATUSES = ['Success', 'On Hold', 'Cancelled', 'Vouchered', 'Failed'];

const DEMO_BOOKINGS = [
  { id: 'BK-2605-1042', date: '2026-05-13', employee: 'Arjun Menon', type: 'Flight', route: 'Pune to Bengaluru', vendor: 'IndiGo 6E-6214', status: 'Success', pnr: 'HF7K2Q', amount: 18450 },
  { id: 'BK-2605-1043', date: '2026-05-13', employee: 'Rhea Iyer', type: 'Hotel', route: 'Mumbai, BKC', vendor: 'Trident Bandra Kurla', status: 'Success', pnr: 'HTL78291', amount: 21800 },
  { id: 'BK-2605-1044', date: '2026-05-13', employee: 'Nisha Rao', type: 'Flight', route: 'Mumbai to Delhi', vendor: 'Air India AI-864', status: 'Success', pnr: 'LQ9M4P', amount: 32760 },
  { id: 'BK-2605-1045', date: '2026-05-13', employee: 'Sara Fernandes', type: 'Hotel', route: 'Singapore, Marina Bay', vendor: 'Parkroyal Collection Marina Bay', status: 'Success', pnr: 'HTL90316', amount: 77200 },
  { id: 'BK-2605-1051', date: '2026-05-16', employee: 'Kabir Sethi', type: 'Flight', route: 'Delhi to Dubai', vendor: 'Emirates EK-515', status: 'On Hold', pnr: 'D8P2VX', amount: 68400 },
  { id: 'BK-2605-1052', date: '2026-05-18', employee: 'Priya Shah', type: 'Hotel', route: 'Pune, Viman Nagar', vendor: 'Hyatt Regency Pune', status: 'Vouchered', pnr: 'HTL64108', amount: 29200 },
  { id: 'BK-2606-1101', date: '2026-06-04', employee: 'Aarav Mehta', type: 'Flight', route: 'Bengaluru to Singapore', vendor: 'Singapore Airlines SQ-509', status: 'Success', pnr: 'SQ4R8N', amount: 162500 },
  { id: 'BK-2606-1102', date: '2026-06-04', employee: 'Vikram Bansal', type: 'Hotel', route: 'Delhi, Aerocity', vendor: 'Roseate House New Delhi', status: 'Cancelled', pnr: 'HTL55720', amount: 17400 },
  { id: 'BK-2607-1188', date: '2026-07-09', employee: 'Arjun Menon', type: 'Flight', route: 'Pune to Mumbai', vendor: 'Akasa Air QP-1602', status: 'Failed', pnr: 'N/A', amount: 0 },
];

const fmtINR = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(amount) || 0);

function statusClass(status) {
  return {
    Success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'On Hold': 'bg-amber-50 text-amber-700 ring-amber-200',
    Cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
    Vouchered: 'bg-blue-50 text-blue-700 ring-blue-200',
    Failed: 'bg-red-50 text-red-700 ring-red-200',
  }[status] || 'bg-slate-50 text-slate-700 ring-slate-200';
}

function FormField({ label, children }) {
  return <label className="min-w-44 rounded-md border border-slate-200 bg-white px-3 py-2"><span className="mb-1 block text-xs text-slate-500">{label}</span>{children}</label>;
}

function SelectField({ value, onChange, options, placeholder, accent }) {
  return <select className={`w-full bg-transparent outline-none ${accent ? 'font-semibold text-accent-600' : 'text-slate-800'}`} value={value} onChange={(event) => onChange(event.target.value)}>{placeholder && <option value="">{placeholder}</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

export default function BookingCalendarPanel() {
  const [filters, setFilters] = useState({ fromDate: '2026-05-13', toDate: '2026-05-13', month: '', year: '', status: 'Success' });
  const update = (name) => (value) => setFilters((current) => ({ ...current, [name]: value }));
  const rows = useMemo(() => DEMO_BOOKINGS.filter((booking) => {
    if (filters.fromDate && booking.date < filters.fromDate) return false;
    if (filters.toDate && booking.date > filters.toDate) return false;
    if (filters.status && booking.status !== filters.status) return false;
    if (filters.month) {
      const bookingMonth = MONTHS[new Date(`${booking.date}T00:00:00`).getMonth()];
      if (bookingMonth !== filters.month) return false;
    }
    if (filters.year && !booking.date.startsWith(filters.year)) return false;
    return true;
  }), [filters]);

  return <SectionCard title="Booking Calendar"><div className="flex flex-wrap gap-x-6 gap-y-4">
    <FormField label="From (Date)"><input type="date" value={filters.fromDate} onChange={(event) => update('fromDate')(event.target.value)} className="w-full bg-transparent text-slate-800 outline-none" /></FormField>
    <FormField label="To (Date)"><input type="date" value={filters.toDate} onChange={(event) => update('toDate')(event.target.value)} className="w-full bg-transparent text-slate-800 outline-none" /></FormField>
    <FormField label="Month"><SelectField value={filters.month} onChange={update('month')} placeholder="Month" options={MONTHS} /></FormField>
    <FormField label="Year"><SelectField value={filters.year} onChange={update('year')} placeholder="Year" options={YEARS} /></FormField>
    <FormField label="Booking Status"><SelectField value={filters.status} onChange={update('status')} options={STATUSES} accent /></FormField>
  </div><div className="mt-5"><button className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-2 text-sm font-semibold uppercase text-white hover:bg-accent-600">Search <Search className="h-4 w-4" /></button></div>

    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visible Bookings</div>
        <div className="mt-2 text-2xl font-bold text-slate-900">{rows.length}</div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Value</div>
        <div className="mt-2 text-2xl font-bold text-slate-900">{fmtINR(rows.reduce((sum, booking) => sum + booking.amount, 0))}</div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Travel Types</div>
        <div className="mt-2 text-2xl font-bold text-slate-900">{new Set(rows.map((booking) => booking.type)).size || 0}</div>
      </div>
    </div>

    <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
      <div className="hidden grid-cols-[1.1fr_1.2fr_1.2fr_1.3fr_0.8fr_0.8fr] bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white md:grid">
        <span>Booking</span>
        <span>Traveler</span>
        <span>Route</span>
        <span>Vendor</span>
        <span>Status</span>
        <span className="text-right">Amount</span>
      </div>

      <div className="divide-y divide-slate-100 bg-white">
        {rows.map((booking) => {
          const Icon = booking.type === 'Hotel' ? Hotel : Plane;
          return (
            <div key={booking.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.1fr_1.2fr_1.2fr_1.3fr_0.8fr_0.8fr] md:items-center">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon className="h-5 w-5" /></span>
                <span>
                  <span className="block font-semibold text-slate-900">{booking.id}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> {booking.date}</span>
                </span>
              </div>
              <div className="text-sm font-medium text-slate-700">{booking.employee}</div>
              <div className="text-sm text-slate-600">{booking.route}</div>
              <div className="text-sm text-slate-600">{booking.vendor}<div className="text-xs text-slate-400">PNR: {booking.pnr}</div></div>
              <div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(booking.status)}`}>{booking.status}</span></div>
              <div className="font-semibold text-slate-900 md:text-right">{fmtINR(booking.amount)}</div>
            </div>
          );
        })}

        {!rows.length && (
          <div className="px-4 py-10 text-center text-sm text-slate-500">No demo bookings match the selected filters.</div>
        )}
      </div>
    </div>
  </SectionCard>;
}
