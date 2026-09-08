import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Calendar,
  ClipboardList,
  FileSpreadsheet,
  Network,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';

export const SIDEBAR_SECTIONS = [
  { id: 'employees', path: '/employee-master', label: 'Employee Master', icon: Users, roles: ['Company Admin', 'HR Admin'] },
  { id: 'policies', path: '/grade-policies', label: 'Grade Policies', icon: ShieldCheck, roles: ['Company Admin', 'HR Admin'] },
  { id: 'hierarchy', path: '/organization-hierarchy', label: 'Organization Hierarchy', icon: Network },
  { id: 'designations', path: '/designation-master', label: 'Designation Master', icon: BriefcaseBusiness, roles: ['Company Admin', 'HR Admin'] },
  { id: 'budgets', path: '/budgets', label: 'Budgets', icon: WalletCards, roles: ['Company Admin', 'Finance Approver'] },
  { id: 'trips', path: '/trip-lifecycle', label: 'Trip Lifecycle', icon: ClipboardList },
  { id: 'calendar', path: '/booking-calendar', label: 'Booking Calendar', icon: Calendar },
  { id: 'visa', path: '/visa', label: 'Visa Operations', icon: BadgeCheck, roles: ['Company Admin', 'Visa Operations', 'Travel Desk'] },
  { id: 'reports', path: '/reports', label: 'Reports', icon: FileSpreadsheet, roles: ['Company Admin', 'Finance Approver', 'Reporting Manager'] },
  { id: 'access', path: '/user-access', label: 'User Access', icon: ShieldCheck, roles: ['Company Admin', 'HR Admin'] },
  { id: 'invoice', path: '/invoice', label: 'Invoice', icon: FileSpreadsheet, roles: ['Company Admin', 'Finance Approver'] },

];

export default function AppSidebar() {
  const [isHovered, setIsHovered] = useState(false);
  const roles = useAuthStore((state) => state.user?.roles || []);
  const visibleSections = SIDEBAR_SECTIONS.filter((item) => !item.roles || item.roles.some((role) => roles.includes(role)));
  const expanded = isHovered;

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`sticky top-[4.5rem] h-[calc(100vh-4.5rem)] self-start border-r border-slate-800/60 bg-[linear-gradient(180deg,#0f172a_0%,#172033_52%,#1e293b_100%)] text-slate-100 shadow-xl shadow-slate-900/10 transition-all ${expanded ? 'w-64' : 'w-14'} flex shrink-0 flex-col`}
    >
      <nav className="flex-1 overflow-y-auto py-3">
        {visibleSections.map((item) => (
          <SideItem
            key={item.id}
            item={item}
            collapsed={!expanded}
          />
        ))}
      </nav>
    </aside>
  );
}

function SideItem({ item, collapsed }) {
  const { icon: Icon, label, path } = item;
  return (
    <NavLink
      to={path}
      title={label}
      className={({ isActive }) => `mx-2 mb-1 flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-left text-sm font-semibold transition ${isActive ? 'border-white/80 bg-white/10 text-white shadow-sm' : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
        }`}
    >
      <Icon className="w-4 h-4 text-current shrink-0" />
      {!collapsed && <span className="hidden flex-1 truncate lg:block">{label}</span>}
    </NavLink>
  );
}
