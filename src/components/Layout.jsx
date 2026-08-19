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
        <div className="max-w-screen-2xl mx-auto px-4 h-9 flex items-center justify-end gap-4 overflow-x-auto whitespace-nowrap text-[11px] text-slate-600 font-semibold uppercase tracking-wide">
          <span className="text-slate-700">HELLO {tenantLabel} PVT LTD ({agencyId})</span>
          <span className="text-slate-700 flex items-center gap-1">
            MY BALANCE: ₹ {user?.balance != null ? Number(user.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-slate-400 cursor-pointer hover:text-accent-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
          </span>
          <span className="text-slate-700 flex items-center gap-1 cursor-pointer hover:text-[#f58a1f]">RECHARGE
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
          </span>
          <span className="text-slate-700 flex items-center gap-1 cursor-pointer hover:text-[#f58a1f]">SALES REP
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </span>
          <span className="text-slate-700 flex items-center gap-1">TJ CASH: {user?.tjCash ?? 0}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
          </span>
          <button onClick={handleLogout} className="text-slate-700 hover:text-red-600 font-semibold">LOGOUT
          </button>
        </div>

        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center gap-6">
          <Link to="/" className="flex items-end gap-1 select-none">
            {/* Leaf Icon */}
            <img
              src="/TH-LOGO.png"
              alt="TripHobo"
              className="h-16 w-auto"
            />

            {/* Text */}
            <span className="text-[42px] font-black leading-none tracking-tight">

            </span>
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
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          'relative inline-flex items-center gap-1 rounded-full px-4 py-2 text-[12px] font-bold tracking-wide transition hover:bg-white hover:text-[#f58a1f]',
          open ? 'bg-white text-[#f58a1f] shadow-sm' : 'text-slate-700',
        )}
      >
        VISA
        <span className="text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-52 bg-white rounded-md shadow-xl border border-slate-100 border-t-2 border-t-[#f58a1f] py-1">
          {VISA_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setOpen(false)}
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
