import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const EMPTY = { code: '', name: '', department: '', level: 1, description: '', status: 'Active' };

export default function DesignationMaster() {
  const client = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['designations'],
    queryFn: () => api.get('/designations', { params: { page: 1, limit: 500 } }).then((response) => response.data),
  });
  const create = useMutation({
    mutationFn: (payload) => api.post('/designations', payload),
    onSuccess: () => {
      toast.success('Designation created');
      setForm(EMPTY);
      setShowForm(false);
      client.invalidateQueries({ queryKey: ['designations'] });
    },
    onError: (err) => toast.error(err?.response?.data?.detail || 'Unable to create designation'),
  });

  const items = data?.items || [];
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-700"><BriefcaseBusiness className="h-5 w-5" /></span>
            <div><h2 className="font-semibold">Designation Master</h2><p className="text-xs text-slate-500">Standard job titles used by Employee Master and approval reporting.</p></div>
          </div>
          <button className="btn-accent text-xs" onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" /> Create</button>
        </div>
        {showForm && (
          <form className="grid gap-3 border-b bg-slate-50 p-5 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); create.mutate({ ...form, level: Number(form.level) }); }}>
            <Input label="Code" value={form.code} onChange={(value) => setForm({ ...form, code: value })} placeholder="REGIONAL-MANAGER" />
            <Input label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <Input label="Department (optional)" value={form.department} onChange={(value) => setForm({ ...form, department: value })} required={false} />
            <Input label="Level" type="number" value={form.level} onChange={(value) => setForm({ ...form, level: value })} />
            <Input label="Description (optional)" value={form.description} onChange={(value) => setForm({ ...form, description: value })} required={false} />
            <div className="flex items-end"><button className="btn-accent w-full" disabled={create.isPending}>{create.isPending ? 'Saving...' : 'Save Designation'}</button></div>
          </form>
        )}
        <div className="overflow-x-auto">
          <table className="tj-table min-w-[720px]">
            <thead><tr><th>Code</th><th>Designation</th><th>Department</th><th>Level</th><th>Status</th></tr></thead>
            <tbody>
              {items.map((item) => <tr key={item.code}><td className="font-semibold text-brand-700">{item.code}</td><td>{item.name}</td><td>{item.department || 'All'}</td><td>{item.level}</td><td><span className={item.status === 'Active' ? 'pill bg-emerald-50 text-emerald-700' : 'pill bg-slate-100'}>{item.status}</span></td></tr>)}
              {isLoading && <tr><td colSpan="5" className="py-8 text-center text-slate-400">Loading designations...</td></tr>}
              {error && <tr><td colSpan="5" className="py-8 text-center text-red-500">Unable to load designations.</td></tr>}
              {!isLoading && !error && !items.length && <tr><td colSpan="5" className="py-8 text-center text-slate-400">No designations yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder = '', type = 'text', required = true }) {
  return <label><span className="label">{label}</span><input className="input mt-1" type={type} value={value} placeholder={placeholder} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}
