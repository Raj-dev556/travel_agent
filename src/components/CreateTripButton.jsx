import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

export default function CreateTripButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn-accent text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Create Trip
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="trip-purpose-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Create trip</p>
                <h2 id="trip-purpose-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Choose your trip purpose</h2>
                <p className="mt-2 text-sm text-slate-500">Select a flow to continue with your trip planning.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close trip purpose dialog" className="grid h-9 w-9 place-items-center rounded-full text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                &times;
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link to="/flights" onClick={() => setOpen(false)} className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:shadow-md">
                <span className="flex items-center justify-between gap-3"><span className="text-base font-bold text-slate-900">Personal trip</span><span className="text-lg text-brand-600 transition group-hover:translate-x-1">-&gt;</span></span>
                <span className="mt-2 block text-sm leading-5 text-slate-500">Search and book flights for personal travel.</span>
              </Link>
              <Link to="/trip-lifecycle/create" onClick={() => setOpen(false)} className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md">
                <span className="flex items-center justify-between gap-3"><span className="text-base font-bold text-slate-900">Business trip</span><span className="text-lg text-accent-600 transition group-hover:translate-x-1">-&gt;</span></span>
                <span className="mt-2 block text-sm leading-5 text-slate-500">Create a trip request for business travel and approvals.</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
