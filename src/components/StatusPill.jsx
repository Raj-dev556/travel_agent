export default function StatusPill({ status }) {
  const styles = {
    Draft: 'bg-slate-100 text-slate-700',
    'Pending Approval': 'bg-amber-100 text-amber-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Booked: 'bg-brand-100 text-brand-700',
    Completed: 'bg-violet-100 text-violet-700',
    Cancelled: 'bg-slate-200 text-slate-600',
  };
  return <span className={`pill ${styles[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>;
}
