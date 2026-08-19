import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import api from '../api';
import StatusPill from '../components/StatusPill';

export default function TripList() {
  const { data, isLoading } = useQuery({
    queryKey: ['trips-all'], queryFn: () => api.get('/trips').then((r) => r.data.data),
  });

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Trip Requests</h1>
        <Link to="/trips/new" className="btn-accent"><Plus className="w-4 h-4" /> New Trip</Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="tj-table">
          <thead>
            <tr>
              <th className="p-4">Trip ID</th><th>Title</th><th>Type</th>
              <th>Dates</th><th>Estimated</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan="6" className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {(data || []).map((t) => (
              <tr key={t._id} className="hover:bg-orange-50/40">
                <td className="font-mono text-xs">{t.tripId}</td>
                <td><Link to={`/trips/${t._id}`} className="text-brand-700 hover:underline">{t.title}</Link></td>
                <td className="capitalize">{t.travelType}</td>
                <td className="text-slate-500">
                  {new Date(t.fromDate).toLocaleDateString()} → {new Date(t.toDate).toLocaleDateString()}
                </td>
                <td>{new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(t.costEstimation?.totalEstimatedINR || 0)}</td>
                <td><StatusPill status={t.status} /></td>
              </tr>
            ))}
            {!isLoading && !data?.length && (
              <tr><td colSpan="6" className="p-10 text-center text-slate-400">No trips yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
