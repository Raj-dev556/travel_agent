import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Stamp, WalletCards } from 'lucide-react';
import api from '../../api';
import { formatMoney } from './utils';

function ReportCard({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-3 rounded-lg bg-white p-5 shadow-sm"><span className="rounded bg-brand-50 p-3 text-brand-700"><Icon className="h-5 w-5" /></span><div><div className="text-xl font-bold">{value}</div><div className="text-xs text-slate-500">{label}</div></div></div>;
}

export default function ReportingWorkflow() {
  const report = useQuery({ queryKey: ['workflow-report'], queryFn: () => api.get('/reports/dashboard').then((response) => response.data) });
  const data = report.data || {};
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><ReportCard icon={ClipboardList} label="Active employees" value={data.employees?.active || 0} /><ReportCard icon={WalletCards} label="Budget allocated" value={formatMoney(data.budgets?.allocated)} /><ReportCard icon={CheckCircle2} label="Pending approvals" value={data.approvals_pending || 0} /><ReportCard icon={Stamp} label="Pending visas" value={data.visas_pending || 0} /></div>;
}
