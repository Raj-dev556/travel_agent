import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api';

const CAT = [
  { key: 'flightCostINR',  label: 'Flight cost (INR)' },
  { key: 'stayNightlyINR', label: 'Stay nightly rate (INR)' },
  { key: 'stayNights',     label: 'No. of nights' },
  { key: 'cabINR',         label: 'Pickup / drop cab (INR)' },
  { key: 'perDiemDays',    label: 'Per-diem days' },
  { key: 'perDiemRateINR', label: 'Per-diem rate / day (INR)' },
  { key: 'advanceINR',     label: 'Travel advance (INR)' },
  { key: 'visaFeeINR',     label: 'Visa fee (INR)' },
  { key: 'miscINR',        label: 'Miscellaneous (INR)' },
];

export default function TripCreate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: '',
    travelType: 'domestic',
    purpose: '',
    origin: 'DEL',
    destinations: 'BOM',
    fromDate: today,
    toDate: today,
    advanceRequired: false,
    visaRequired: false,
    miscReason: '',
    costEstimation: { flightCostINR: Number(params.get('amount') || 0) },
  });

  const total = CAT.reduce((s, c) => {
    const v = form.costEstimation[c.key] || 0;
    if (c.key === 'stayNightlyINR') return s + v * (form.costEstimation.stayNights || 0);
    if (c.key === 'stayNights' || c.key === 'perDiemDays') return s;
    if (c.key === 'perDiemRateINR') return s + v * (form.costEstimation.perDiemDays || 0);
    return s + v;
  }, 0);

  const m = useMutation({
    mutationFn: () =>
      api.post('/trips', {
        ...form,
        destinations: form.destinations.split(',').map((s) => s.trim()),
        costEstimation: { ...form.costEstimation, miscReason: form.miscReason },
      }).then((r) => r.data),
    onSuccess: (trip) => {
      toast.success(`Trip ${trip.tripId} submitted for approval`);
      navigate(`/trips/${trip._id}`);
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  });

  function setCE(key, value) {
    setForm({ ...form, costEstimation: { ...form.costEstimation, [key]: Number(value) || 0 } });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">New Trip Request</h1>
      <p className="text-sm text-slate-500 mb-6">Submit your travel request with cost estimation for approval.</p>

      <div className="card p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Trip title">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Client visit – BMW Mumbai" />
          </Field>
          <Field label="Travel type">
            <select className="input" value={form.travelType} onChange={(e) => setForm({ ...form, travelType: e.target.value })}>
              <option value="domestic">Domestic</option>
              <option value="international">International</option>
            </select>
          </Field>
          <Field label="Origin (city / IATA)">
            <input className="input" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
          </Field>
          <Field label="Destinations (comma-separated)">
            <input className="input" value={form.destinations} onChange={(e) => setForm({ ...form, destinations: e.target.value })} />
          </Field>
          <Field label="From date">
            <input type="date" className="input" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
          </Field>
          <Field label="To date">
            <input type="date" className="input" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
          </Field>
          <Field label="Purpose" className="md:col-span-2">
            <textarea className="input" rows="2" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </Field>
        </div>

        <hr className="border-slate-100" />

        <div>
          <h3 className="font-semibold text-slate-800 mb-3">Cost Estimation</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {CAT.map((c) => (
              <Field key={c.key} label={c.label}>
                <input
                  type="number"
                  className="input"
                  value={form.costEstimation[c.key] || ''}
                  onChange={(e) => setCE(c.key, e.target.value)}
                />
              </Field>
            ))}
            <Field label="Miscellaneous reason" className="md:col-span-2">
              <input className="input" value={form.miscReason} onChange={(e) => setForm({ ...form, miscReason: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-between bg-brand-50 border border-brand-100 px-4 py-3 rounded-lg">
            <span className="font-medium text-slate-700">Total estimated cost</span>
            <span className="text-2xl font-bold text-brand-700">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(total)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={() => navigate(-1)} className="btn-ghost">Cancel</button>
          <button onClick={() => m.mutate()} disabled={m.isPending || !form.title} className="btn-primary">
            {m.isPending ? 'Submitting…' : 'Submit for approval'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={className + ' block'}>
      <div className="label mb-1">{label}</div>
      {children}
    </label>
  );
}
