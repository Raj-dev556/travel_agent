import { useState } from 'react';
import { Search } from 'lucide-react';
import { SectionCard } from '../dashboard/components';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = ['2024', '2025', '2026', '2027'];
const STATUSES = ['Success', 'On Hold', 'Cancelled', 'Vouchered', 'Failed'];

function FormField({ label, children }) {
  return <label className="min-w-44 rounded-md border border-slate-200 bg-white px-3 py-2"><span className="mb-1 block text-xs text-slate-500">{label}</span>{children}</label>;
}

function SelectField({ value, onChange, options, placeholder, accent }) {
  return <select className={`w-full bg-transparent outline-none ${accent ? 'font-semibold text-accent-600' : 'text-slate-800'}`} value={value} onChange={(event) => onChange(event.target.value)}>{placeholder && <option value="">{placeholder}</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

export default function BookingCalendarPanel() {
  const [filters, setFilters] = useState({ fromDate: '2026-05-13', toDate: '2026-05-13', month: '', year: '', status: 'Success' });
  const update = (name) => (value) => setFilters((current) => ({ ...current, [name]: value }));
  return <SectionCard title="Booking Calendar"><div className="flex flex-wrap gap-x-6 gap-y-4">
    <FormField label="From (Date)"><input type="date" value={filters.fromDate} onChange={(event) => update('fromDate')(event.target.value)} className="w-full bg-transparent text-slate-800 outline-none" /></FormField>
    <FormField label="To (Date)"><input type="date" value={filters.toDate} onChange={(event) => update('toDate')(event.target.value)} className="w-full bg-transparent text-slate-800 outline-none" /></FormField>
    <FormField label="Month"><SelectField value={filters.month} onChange={update('month')} placeholder="Month" options={MONTHS} /></FormField>
    <FormField label="Year"><SelectField value={filters.year} onChange={update('year')} placeholder="Year" options={YEARS} /></FormField>
    <FormField label="Booking Status"><SelectField value={filters.status} onChange={update('status')} options={STATUSES} accent /></FormField>
  </div><div className="mt-5"><button className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-2 text-sm font-semibold uppercase text-white hover:bg-accent-600">Search <Search className="h-4 w-4" /></button></div></SectionCard>;
}
