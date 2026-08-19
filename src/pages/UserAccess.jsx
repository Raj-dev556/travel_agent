import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api';

const ROLES = ['Employee', 'Reporting Manager', 'Finance Approver', 'Travel Desk', 'HR Admin', 'Company Admin', 'Visa Operations'];

export default function UserAccess() {
  const client = useQueryClient();
  const [form, setForm] = useState({ employee_id: '', email: '', roles: ['Employee'] });
  const [activation, setActivation] = useState('');
  const users = useQuery({ queryKey: ['auth-users'], queryFn: () => api.get('/auth/users').then((r) => r.data.items) });
  const employees = useQuery({ queryKey: ['employees', 'account-options'], queryFn: () => api.get('/employees', { params: { limit: 100 } }).then((r) => r.data.items) });
  const invite = useMutation({
    mutationFn: (payload) => api.post('/auth/invitations', payload).then((r) => r.data),
    onSuccess: (data) => {
      setActivation(data.activationToken || '');
      toast.success('Invitation created');
      client.invalidateQueries({ queryKey: ['auth-users'] });
    },
    onError: (error) => toast.error(error.response?.data?.detail || 'Unable to create invitation'),
  });
  return <div className="space-y-5">
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-brand-700">Invite employee account</h2>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); invite.mutate(form); }}>
        <label><span className="label">Employee</span><select className="input mt-1" required value={form.employee_id} onChange={(event) => { const employee = (employees.data || []).find((item) => item.id === event.target.value); setForm({ ...form, employee_id: event.target.value, email: employee?.email || '' }); }}><option value="">Select employee</option>{(employees.data || []).map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.id})</option>)}</select></label>
        <label><span className="label">Account email</span><input className="input mt-1" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <fieldset className="md:col-span-2"><span className="label">Roles</span><div className="mt-2 grid gap-2 rounded border p-3 sm:grid-cols-2 lg:grid-cols-4">{ROLES.map((role) => <label key={role} className="flex gap-2 text-sm"><input type="checkbox" checked={form.roles.includes(role)} onChange={(event) => setForm({ ...form, roles: event.target.checked ? [...new Set([...form.roles, role])] : form.roles.filter((item) => item !== role) })} />{role}</label>)}</div></fieldset>
        <button className="btn-accent md:col-span-2" disabled={invite.isPending || !form.roles.length}>Create invitation</button>
      </form>
      {activation && <a className="btn-ghost mt-4 w-full" href={`/activate-account?token=${encodeURIComponent(activation)}`}>Open development activation link</a>}
    </section>
    <section className="rounded-lg bg-white shadow-sm"><div className="border-b p-4 font-semibold">User accounts</div><div className="overflow-x-auto"><table className="tj-table"><thead><tr><th>User</th><th>Employee</th><th>Roles</th><th>Verified</th><th>Status</th></tr></thead><tbody>{(users.data || []).map((user) => <tr key={user.id}><td>{user.fullName}<div className="text-xs text-slate-400">{user.email}</div></td><td>{user.employeeId || 'Administrator'}</td><td>{user.roles.join(', ')}</td><td>{user.emailVerified ? 'Yes' : 'No'}</td><td>{user.status}</td></tr>)}</tbody></table></div></section>
  </div>;
}
