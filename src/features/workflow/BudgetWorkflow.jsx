import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api';
import { WorkflowCard, WorkflowInput, WorkflowSelect } from './components';
import { apiErrorMessage, formatMoney } from './utils';

const INITIAL_BUDGET = {
  name: '', owner_type: 'Team', owner_id: '', cycle: 'Annual',
  start_date: '2026-04-01', end_date: '2027-03-31', allocated_amount: '',
  currency: 'INR', alert_threshold_percent: 80, rollover: false, status: 'Active',
};

export default function BudgetWorkflow() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_BUDGET);
  const budgets = useQuery({ queryKey: ['budgets'], queryFn: () => api.get('/budgets', { params: { limit: 500 } }).then((response) => response.data) });
  const createBudget = useMutation({
    mutationFn: (data) => api.post('/budgets', { ...data, allocated_amount: Number(data.allocated_amount) }),
    onSuccess: () => {
      toast.success('Budget created');
      setForm(INITIAL_BUDGET);
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Unable to create budget')),
  });
  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <WorkflowCard title="Budget Pools and Utilisation" action={<button className="btn-accent text-xs" type="button" onClick={() => setIsFormOpen((open) => !open)}><Plus className="h-4 w-4" /> Create Budget</button>}>
      {isFormOpen && (
        <form className="mb-5 grid gap-3 rounded-md bg-slate-50 p-4 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); createBudget.mutate(form); }}>
          <WorkflowInput label="Name" value={form.name} onChange={update('name')} />
          <WorkflowSelect label="Owner type" value={form.owner_type} onChange={update('owner_type')} options={['Company', 'Department', 'Team', 'Employee', 'Project']} />
          <WorkflowInput label="Owner ID" value={form.owner_id} onChange={update('owner_id')} />
          <WorkflowSelect label="Cycle" value={form.cycle} onChange={update('cycle')} options={['Monthly', 'Quarterly', 'Annual', 'Project']} />
          <WorkflowInput label="Amount" type="number" value={form.allocated_amount} onChange={update('allocated_amount')} />
          <WorkflowInput label="Start date" type="date" value={form.start_date} onChange={update('start_date')} />
          <WorkflowInput label="End date" type="date" value={form.end_date} onChange={update('end_date')} />
          <div className="flex items-end"><button className="btn-accent w-full" disabled={createBudget.isPending}>Save Budget</button></div>
        </form>
      )}
      <div className="overflow-x-auto"><table className="tj-table min-w-[900px]"><thead><tr><th>Budget</th><th>Owner</th><th>Cycle</th><th>Allocated</th><th>Reserved</th><th>Consumed</th><th>Remaining</th><th>Status</th></tr></thead><tbody>
        {(budgets.data?.items || []).map((item) => <tr key={item.id}><td><b className="text-brand-700">{item.id}</b><div className="text-xs text-slate-400">{item.name}</div></td><td>{item.owner_type}: {item.owner_id}</td><td>{item.cycle}</td><td>{formatMoney(item.allocated_amount)}</td><td>{formatMoney(item.reserved_amount)}</td><td>{formatMoney(item.consumed_amount)}</td><td className="font-semibold">{formatMoney(item.remaining_amount)}</td><td>{item.status}</td></tr>)}
        {!budgets.isLoading && !(budgets.data?.items || []).length && <tr><td colSpan="8" className="py-8 text-center text-slate-400">No persisted budgets yet.</td></tr>}
      </tbody></table></div>
    </WorkflowCard>
  );
}
