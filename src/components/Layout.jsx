import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'; import clsx from 'clsx';
import { useAuthStore } from '../store/auth';
import api from '../api';
import AppSidebar from './AppSidebar';

const TOP_NAV = [
  { to: '/flights', label: 'FLIGHT' },
  { to: '/hotels', label: 'HOTEL' },
  // { to: '/tripsafe', label: 'TRIPSAFE' },
  // { to: '/transfers', label: 'TRANSFERS', badge: 'NEW' },
  // { to: '/affiliates', label: 'AFFILIATES PORTAL' },
  { to: '/visa', label: 'VISA', caret: true },
  // { to: '/insurance', label: 'INSURANCE', caret: true },
  // { to: '/holidays', label: 'HOLIDAYS' },
  // { to: '/cruise', label: 'CRUISE' },
  { to: '/', label: 'DASHBOARD', end: true },
  // { to: '/manage-bookings', label: 'MANAGE BOOKINGS' },
  // { to: '/quick-links', label: 'QUICK LINKS', caret: true },
  // { to: '/mihuru', label: 'MIHURU OD' },
];

const VISA_OPTIONS = [
  { label: 'Dubai Visa' },
  { label: 'Turkey Visa' },
  { label: 'Kenya Visa' },
  { label: 'South Africa Visa' },
  { label: 'Oman Visa' },
  { label: 'Singapore Visa' },
];

export default function Layout() {
  const { user, tenant, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const isFlightFlow =
    location.pathname.startsWith('/flights/itinerary') ||
    location.pathname.startsWith('/flights/passenger') ||
    location.pathname.startsWith('/flights/review') ||
    location.pathname.startsWith('/flights/payment');
  const hideFooter =
    location.pathname === '/' ||
    location.pathname === '/hotels' ||
    location.pathname === '/hotels/results' ||
    location.pathname === '/hotels/invoice' ||
    isFlightFlow;

  const tenantLabel = (tenant || 'tenant').toUpperCase();
  const agencyId = '6811';
  const userName = user?.fullName || user?.name || 'Demo User';
  const userType = user?.roles?.[0] || user?.role || 'User';

  useEffect(() => {
    function handleClick(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogout() {
    const refreshToken = useAuthStore.getState().refreshToken;
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Local logout must still succeed when the session already expired.
    } finally {
      logout();
      navigate('/login');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
     

        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center gap-6">
          <Link to="/" className="flex items-end gap-1 select-none">
            <img
              src="/acuitilabs-logo.png"
              alt="AcuitiLabs"
              className="h-14 w-auto"
            />
          </Link>

          <nav className="ml-auto hidden lg:flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50/90 p-1 text-[12px] font-bold tracking-wide text-slate-700">
            {TOP_NAV.map((n) => (
              n.label === 'VISA' ? <VisaDropdown key={`${n.to}-${n.label}`} />
                : (
                  <NavLink key={`${n.to}-${n.label}`} to={n.to} end={n.end}
                    className={({ isActive }) =>
                      clsx(
                        'relative inline-flex items-center gap-1 rounded-full px-4 py-2 transition hover:bg-white hover:text-[#f58a1f]',
                        isActive ? 'bg-white text-[#f58a1f] shadow-sm' : 'text-slate-700',
                      )}>
                    {n.badge && (
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] bg-sky-500 text-white px-1 rounded">
                        {n.badge}
                      </span>
                    )}
                    {n.label}
                    {n.caret && <span className="text-[10px]">▾</span>}
                  </NavLink>
                )
            ))}
          </nav>
 <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left shadow-sm transition hover:bg-white"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {userName.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:block">
                <span className="block text-xs font-bold leading-tight text-slate-800">{userName}</span>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{userType}</span>
              </span>
              <span className={`text-[10px] text-slate-500 transition ${accountOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {accountOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-bold text-slate-900">{userName}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{userType}</div>
                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {tenantLabel} PVT LTD ({agencyId})
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  type="button"
                >
                  Logout
                  <span aria-hidden="true">-&gt;</span>
                </button>
              </div>
            )}
          </div>
          <div className="ml-auto lg:hidden flex items-center gap-2">
            <span className="pill bg-orange-50 text-accent-600 border border-orange-100 capitalize text-[10px]">
              {user?.role?.replace('_', ' ') || 'role'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-slate-100">
        <div className="flex min-h-[calc(100vh-6.25rem)]">
          <AppSidebar />
          <section className="min-w-0 flex-1 overflow-x-hidden bg-[linear-gradient(180deg,#f7f9fc_0%,#eef2f7_100%)]">
            <Outlet />
          </section>
        </div>
      </main>

      {!hideFooter && (
        <footer className="mt-8">
          <div className="bg-slate-700 text-white">
            <div className="max-w-screen-2xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-center gap-4">
              <div>
                <div className="text-lg font-semibold">How can we help you?</div>
                <div className="text-xs text-slate-300">Contact us anytime.</div>
              </div>
              <div className="md:ml-auto flex items-start gap-6 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-300">Send us an email at</div>
                  <div className="font-medium">support@corptravel.com</div>
                </div>
                <div className="w-px bg-slate-500 self-stretch hidden md:block" />
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-300">Or call us at</div>
                  <div className="font-medium">022 62506250</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 text-slate-300">
            <div className="max-w-screen-2xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-2xl font-extrabold tracking-tight">
                  <span className="text-accent-500">Corp</span>
                  <span className="text-sky-400">Travel</span>
                </div>
                <div className="text-xs text-slate-400 mt-3">
                  (c) {new Date().getFullYear()} {tenantLabel}. All Rights Reserved.
                </div>
              </div>

              <FooterCol title="More Links" items={[
                { label: 'Terms & conditions', to: '#' },
                { label: 'Payment Security', to: '#' },
              ]} />

              <FooterCol title="Policies" items={[
                { label: 'Privacy Policy', to: '#' },
              ]} />

              <FooterCol title="Get in Touch" items={[
                { label: 'Contact Us', to: '#' },
              ]} />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">{title}</div>
      <ul className="space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.label}>
            <a href={i.to} className="text-slate-200 hover:text-accent-400">{i.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VisaDropdown() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          navigate('/visa');
        }}
        className={clsx(
          'relative inline-flex items-center gap-1 rounded-full px-4 py-2 text-[12px] font-bold tracking-wide transition hover:bg-white hover:text-[#f58a1f]',
          open ? 'bg-white text-[#f58a1f] shadow-sm' : 'text-slate-700',
        )}
      >
        VISA

      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-52 bg-white rounded-md shadow-xl border border-slate-100 border-t-2 border-t-[#f58a1f] py-1">
          {VISA_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/visa');
              }}
              className="w-full text-left px-5 py-3 text-sm text-slate-700 hover:text-[#f58a1f] hover:bg-slate-50"
            >
              {opt.label}
            </button>
          ))}
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f58a1f] rounded-b-md"
          />
        </div>
      )}
    </div>
  );
}
