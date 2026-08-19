import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuthStore } from '../store/auth';
import { AuthCard, Field } from './Register';

export function ForgotPassword() {
  const [form, setForm] = useState({ tenant: 'dummy-corp', email: '' });
  const [resetToken, setResetToken] = useState('');
  async function submit(event) {
    event.preventDefault();
    const { data } = await api.post('/auth/forgot-password', form);
    setResetToken(data.resetToken || '');
    toast.success(data.message);
  }
  return <AuthCard title="Forgot password" subtitle="Request a one-time password reset link."><form className="space-y-4" onSubmit={submit}><Field label="Company subdomain" value={form.tenant} set={(v) => setForm({ ...form, tenant: v })} /><Field label="Email" type="email" value={form.email} set={(v) => setForm({ ...form, email: v })} /><button className="btn-accent w-full">Generate reset link</button>{resetToken && <Link className="btn-ghost w-full" to={`/reset-password?token=${encodeURIComponent(resetToken)}`}>Open development reset link</Link>}<Link className="block text-center text-sm text-brand-700" to="/login">Back to login</Link></form></AuthCard>;
}

function TokenPasswordForm({ mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) return toast.error('Passwords do not match');
    try {
      const endpoint = mode === 'activate' ? '/auth/activate' : '/auth/reset-password';
      const { data } = await api.post(endpoint, { token: params.get('token'), password });
      if (data.accessToken) setSession(data);
      toast.success(mode === 'activate' ? 'Account activated' : 'Password reset successfully');
      navigate(data.accessToken ? '/' : '/login');
    } catch (error) { toast.error(error.response?.data?.detail || 'Link is invalid or expired'); }
  }
  return <AuthCard title={mode === 'activate' ? 'Activate account' : 'Reset password'} subtitle="Choose a strong password with at least eight characters."><form className="space-y-4" onSubmit={submit}><Field label="New password" type="password" value={password} set={setPassword} /><Field label="Confirm password" type="password" value={confirm} set={setConfirm} /><button className="btn-accent w-full">{mode === 'activate' ? 'Activate account' : 'Reset password'}</button></form></AuthCard>;
}

export const ActivateAccount = () => <TokenPasswordForm mode="activate" />;
export const ResetPassword = () => <TokenPasswordForm mode="reset" />;

export function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Ready to verify');
  async function verify() {
    try { const { data } = await api.post('/auth/verify-email', { token: params.get('token') }); setStatus(data.message); toast.success(data.message); setTimeout(() => navigate('/login'), 800); }
    catch (error) { setStatus(error.response?.data?.detail || 'Verification failed'); }
  }
  return <AuthCard title="Verify email" subtitle={status}><button className="btn-accent w-full" onClick={verify}>Verify email address</button></AuthCard>;
}
