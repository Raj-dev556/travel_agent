import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuthStore } from '../store/auth';

function registrationError(error) {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => {
      const field = item.loc?.at(-1)?.replaceAll('_', ' ');
      return `${field ? `${field}: ` : ''}${item.msg || 'Invalid value'}`;
    }).join(' · ');
  }
  return typeof detail === 'string' ? detail : 'Registration failed';
}

function validateRegistration(form) {
  const errors = {};
  const companyName = form.company_name.trim();
  const subdomain = form.subdomain.trim();
  const adminName = form.admin_name.trim();
  const adminEmail = form.admin_email.trim();
  const mobile = form.mobile.trim();

  if (companyName.length < 2) errors.company_name = 'Enter at least 2 characters.';
  if (companyName.length > 160) errors.company_name = 'Use no more than 160 characters.';
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain)) errors.subdomain = 'Use at least 2 lowercase letters or numbers; hyphens are allowed only inside.';
  if (subdomain.length > 50) errors.subdomain = 'Use no more than 50 characters.';
  if (adminName.length < 2) errors.admin_name = 'Enter at least 2 characters.';
  if (adminName.length > 120) errors.admin_name = 'Use no more than 120 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) errors.admin_email = 'Enter a valid email address.';
  if (mobile && !/^\+?[0-9]{7,15}$/.test(mobile)) errors.mobile = 'Use 7–15 digits, optionally beginning with +.';
  if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (form.password.length > 128) errors.password = 'Use no more than 128 characters.';
  if (!form.confirm) errors.confirm = 'Confirm the password.';
  else if (form.password !== form.confirm) errors.confirm = 'Passwords do not match.';
  return errors;
}

export default function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const setTenant = useAuthStore((state) => state.setTenant);
  const [form, setForm] = useState({ company_name: '', subdomain: '', admin_name: '', admin_email: '', mobile: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setSubmitError('');
  };
  async function submit(event) {
    event.preventDefault();
    const companyName = form.company_name.trim();
    const subdomain = form.subdomain.trim();
    const adminName = form.admin_name.trim();
    const adminEmail = form.admin_email.trim().toLowerCase();
    const validationErrors = validateRegistration(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) {
      toast.error('Please correct the highlighted fields');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        company_name: companyName,
        subdomain,
        admin_name: adminName,
        admin_email: adminEmail,
        mobile: form.mobile.trim() || null,
        password: form.password,
      };
      const { data } = await api.post('/auth/register-company', payload);
      setTenant(subdomain);
      setSession(data);
      if (data.verificationToken) {
        try {
          await api.post('/auth/verify-email', { token: data.verificationToken });
          setSession({ ...data, user: { ...data.user, emailVerified: true } });
          toast.success('Company registered and email verified for development');
        } catch {
          toast.success('Company registered. Sign in after verifying the administrator email.');
        }
      } else toast.success('Company registered. Check your email to verify the administrator account.');
      navigate('/employee-master', { replace: true });
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        const serverErrors = {};
        detail.forEach((item) => {
          const field = item.loc?.at(-1);
          if (field && Object.hasOwn(form, field)) serverErrors[field] = item.msg;
        });
        setErrors((current) => ({ ...current, ...serverErrors }));
      }
      const errorMessage = registrationError(error);
      setSubmitError(errorMessage);
      toast.error(errorMessage);
    } finally { setLoading(false); }
  }
  return <AuthCard title="Register your company" subtitle="Create the tenant and first Company Administrator."><form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}>
    <Field label="Company name" error={errors.company_name} minLength={2} maxLength={160} value={form.company_name} set={(v) => update('company_name', v)} />
    <Field label="Subdomain" error={errors.subdomain} minLength={2} maxLength={50} value={form.subdomain} set={(v) => update('subdomain', v.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
    <Field label="Administrator name" error={errors.admin_name} minLength={2} maxLength={120} value={form.admin_name} set={(v) => update('admin_name', v)} />
    <Field label="Administrator email" error={errors.admin_email} type="email" value={form.admin_email} set={(v) => update('admin_email', v)} />
    <Field label="Mobile" error={errors.mobile} maxLength={16} value={form.mobile} set={(v) => update('mobile', v.replace(/[^\d+]/g, ''))} required={false} />
    <span />
    <Field label="Password" error={errors.password} type="password" minLength={8} maxLength={128} value={form.password} set={(v) => update('password', v)} />
    <Field label="Confirm password" error={errors.confirm} type="password" minLength={8} maxLength={128} value={form.confirm} set={(v) => update('confirm', v)} />
    {submitError && <div role="alert" className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div>}
    <button className="btn-accent sm:col-span-2" disabled={loading}>{loading ? 'Creating company…' : 'Create company'}</button>
    <Link className="sm:col-span-2 text-center text-sm text-brand-700" to="/login">Already registered? Sign in</Link>
  </form></AuthCard>;
}

export function AuthCard({ title, subtitle, children }) {
  return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4"><div className="card w-full max-w-2xl border border-slate-100 p-6 md:p-8"><h1 className="text-2xl font-bold">{title}</h1><p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>{children}</div></div>;
}

export function Field({ label, value, set, type = 'text', required = true, error, ...inputProps }) {
  return <label><span className="label">{label}</span><input className={`input mt-1 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`} aria-invalid={Boolean(error)} type={type} required={required} value={value} onChange={(event) => set(event.target.value)} {...inputProps} />{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>;
}
