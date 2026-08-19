import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, Plane } from 'lucide-react';
import api from '../api';
import { useAuthStore } from '../store/auth';

const DEMO_ACCOUNTS = [
  ['Company Admin', 'admin@dummy.example.test'],
  ['HR Admin', 'hr@dummy.example.test'],
  ['Finance Approver', 'finance@dummy.example.test'],
  ['Reporting Manager', 'manager@dummy.example.test'],
  ['Travel Desk', 'desk@dummy.example.test'],
  ['Visa Operations', 'visa@dummy.example.test'],
  ['Employee', 'traveler.one@dummy.example.test'],
];

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const setTenant = useAuthStore((state) => state.setTenant);
  const [form, setForm] = useState({
    tenant: 'dummy-corp',
    email: 'admin@dummy.example.test',
    password: 'Demo@12345',
  });
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/login-tenants')
      .then(({ data }) => setTenants(data.items || []))
      .catch(() => setTenants([]));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      setTenant(form.tenant);
      setSession(data);
      toast.success(`Welcome, ${data.user.fullName}`);
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_0.95fr] bg-slate-100">
      <div className="hero-gradient hidden lg:flex flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-2 font-bold text-xl"><Plane className="w-6 h-6 -rotate-45 text-accent-500" /> Corporate Travel Portal</div>
        <div><h1 className="text-4xl font-bold leading-tight max-w-xl">Secure corporate travel, approvals and budgets in one workspace.</h1><p className="mt-4 text-white/80 max-w-lg">Tenant-isolated accounts with role-based access for employees, managers, finance and travel operations.</p></div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} CTMP</p>
      </div>
      <div className="flex items-center justify-center p-4 md:p-8">
        <form onSubmit={submit} className="card w-full max-w-xl p-6 md:p-8 border border-slate-100">
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your company subdomain and corporate account.</p>
          <div className="mt-5 grid sm:grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map(([role, email]) => <button key={email} type="button" onClick={() => setForm({ tenant: 'dummy-corp', email, password: 'Demo@12345' })} className={`rounded-md border px-3 py-2 text-left ${form.email === email ? 'border-accent-500 bg-orange-50' : 'border-slate-200'}`}><div className="text-sm font-semibold">{role}</div><div className="truncate text-[11px] text-slate-500">{email}</div></button>)}
          </div>
          <div className="mt-6 space-y-4">
            {tenants.length ? (
              <label className="block">
                <span className="label">Company</span>
                <select className="input mt-1" required value={form.tenant} onChange={(event) => setForm({ ...form, tenant: event.target.value })}>
                  <option value="" disabled>Select your company</option>
                  {tenants.map((tenant) => <option key={tenant.subdomain} value={tenant.subdomain}>{tenant.name} ({tenant.subdomain})</option>)}
                </select>
              </label>
            ) : <Field label="Company subdomain" value={form.tenant} onChange={(tenant) => setForm({ ...form, tenant })} />}
            <Field label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
            <Field label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
            <button className="btn-accent w-full" disabled={loading}><LogIn className="w-4 h-4" /> {loading ? 'Signing in…' : 'Sign in'}</button>
            <div className="flex justify-between text-sm"><Link className="text-brand-700 hover:underline" to="/forgot-password">Forgot password?</Link><Link className="text-brand-700 hover:underline" to="/register">Register company</Link></div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return <label className="block"><span className="label">{label}</span><input className="input mt-1" required type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
