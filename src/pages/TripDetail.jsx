import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, RotateCcw, Plane, Hotel } from 'lucide-react';
import api from '../api';
import StatusPill from '../components/StatusPill';

const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function TripDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id], queryFn: () => api.get(`/trips/${id}`).then((r) => r.data),
  });

  const act = useMutation({
    mutationFn: (body) => api.post('/approvals/act', { tripId: id, ...body }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trip', id] }); toast.success('Action recorded'); },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  });

  if (isLoading || !trip) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-xs text-slate-500">{trip.tripId}</div>
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <div className="text-sm text-slate-500">
            {trip.origin} → {trip.destinations?.join(', ')} ·
            {' '}{new Date(trip.fromDate).toLocaleDateString()} → {new Date(trip.toDate).toLocaleDateString()}
          </div>
        </div>
        <StatusPill status={trip.status} />
      </div>

      <section className="card p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Approval Chain</h3>
        <ol className="relative border-l-2 border-slate-100 pl-6 space-y-4">
          {trip.approvalChain?.map((s) => (
            <li key={s.level}>
              <div className="absolute -left-2.5 w-5 h-5 rounded-full border-2 border-white"
                   style={{ background: s.action === 'approved' ? '#10b981' : s.action === 'rejected' ? '#ef4444' : '#cbd5e1' }} />
              <div className="font-medium text-slate-800">Level {s.level} — {s.role}</div>
              <div className="text-xs text-slate-500">
                {s.action.toUpperCase()} {s.approverEmail ? `· ${s.approverEmail}` : ''}
                {s.actedAt ? ` · ${new Date(s.actedAt).toLocaleString()}` : ''}
              </div>
              {s.comment && <div className="text-sm text-slate-600 mt-1">“{s.comment}”</div>}
            </li>
          ))}
        </ol>

        {trip.status === 'pending_approval' && (
          <div className="mt-5 flex gap-2">
            <button className="btn-primary"
                    onClick={() => act.mutate({ level: trip.currentLevel, action: 'approved', comment: 'Approved' })}>
              <CheckCircle2 className="w-4 h-4" /> Approve (Level {trip.currentLevel})
            </button>
            <button className="btn-ghost text-red-600 border-red-200"
                    onClick={() => act.mutate({ level: trip.currentLevel, action: 'rejected', comment: 'Rejected' })}>
              <XCircle className="w-4 h-4" /> Reject
            </button>
            <button className="btn-ghost"
                    onClick={() => act.mutate({ level: trip.currentLevel, action: 'returned', comment: 'Needs changes' })}>
              <RotateCcw className="w-4 h-4" /> Return for revision
            </button>
          </div>
        )}
      </section>

      <section className="card p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Cost Estimation</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {Object.entries(trip.costEstimation || {}).map(([k, v]) => (
            <div key={k} className="bg-slate-50 rounded px-3 py-2">
              <div className="text-xs text-slate-500">{k}</div>
              <div className="font-semibold">{typeof v === 'number' ? fmtINR(v) : String(v || '—')}</div>
            </div>
          ))}
        </div>
      </section>

      {trip.status === 'approved' && (
        <section className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-3">Book now</h3>
          <div className="flex gap-3">
            <Link to="/flights" className="btn-primary"><Plane className="w-4 h-4" /> Book Flight</Link>
            <Link to="/hotels" className="btn-ghost"><Hotel className="w-4 h-4" /> Book Hotel</Link>
          </div>
        </section>
      )}
    </div>
  );
}
