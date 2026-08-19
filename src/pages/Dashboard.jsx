import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Home,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import api from '../api';
import OrganizationHierarchy from './OrganizationHierarchy';
import DesignationMaster from './DesignationMaster';
import { BudgetWorkflow, ReportingWorkflow, TripWorkflow, VisaWorkflow } from '../features/workflow';
import { useAuthStore } from '../store/auth';
import UserAccess from './UserAccess';
import EmployeeMasterPanel from '../features/employees/EmployeeMasterPanel';
import PolicyPanel from '../features/policies/PolicyPanel';
import BookingCalendarPanel from '../features/calendar/BookingCalendarPanel';
import { SIDEBAR_SECTIONS } from '../components/AppSidebar';

export default function Dashboard({ sectionId = 'employees', action = 'listing', itemId }) {
  const active = SIDEBAR_SECTIONS.find((item) => item.id === sectionId) || SIDEBAR_SECTIONS[0];

  return (
    <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
          <span className="w-7 h-7 rounded bg-accent-500 text-white flex items-center justify-center">
            <Home className="w-4 h-4" />
          </span>
          <span className="text-accent-600 font-medium">{toSlug(active.label)}</span>
        </div>

        <DashboardSummary />

        {sectionId === 'employees' && <EmployeeMasterPanel action={action} itemId={itemId} />}
        {sectionId === 'policies' && <PolicyPanel action={action} itemId={itemId} />}
        {sectionId === 'hierarchy' && <OrganizationHierarchy />}
        {sectionId === 'designations' && <DesignationMaster />}
        {sectionId === 'budgets' && <BudgetWorkflow action={action} itemId={itemId} />}
        {sectionId === 'trips' && <TripWorkflow action={action} tripId={itemId} />}
        {sectionId === 'calendar' && <BookingCalendarPanel />}
        {sectionId === 'visa' && <VisaWorkflow />}
        {sectionId === 'reports' && <ReportingWorkflow />}
        {sectionId === 'access' && <UserAccess />}
    </div>
  );
}

function DashboardSummary() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary').then((response) => response.data),
  });
  const value = (current, formatter = (item) => Number(item || 0).toLocaleString('en-IN')) => (
    isLoading ? '…' : formatter(current)
  );
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <MetricCard icon={Users} label="Active Employees" value={value(data?.employees?.active)} subtext={isError ? 'Unable to load metrics' : `${value(data?.employees?.inactive)} inactive`} />
      <MetricCard icon={ShieldCheck} label="Grade Policies" value={value(data?.grade_policies?.total)} subtext={isError ? 'Unable to load metrics' : `${value(data?.grade_policies?.updated_this_month)} updated this month`} />
      <MetricCard icon={WalletCards} label="Budget Balance" value={value(data?.budgets?.balance, formatInrCompact)} subtext={isError ? 'Unable to load metrics' : `${value(data?.budgets?.active_pools)} active budget pools`} />
      <MetricCard icon={ClipboardList} label="Open Trips" value={value(data?.trips?.open)} subtext={isError ? 'Unable to load metrics' : `${value(data?.trips?.awaiting_approval)} awaiting approval`} />
    </div>
  );
}

function formatInrCompact(amount) {
  const value = Number(amount || 0);
  if (Math.abs(value) >= 10_000_000) return `INR ${(value / 10_000_000).toFixed(2)} Cr`;
  if (Math.abs(value) >= 100_000) return `INR ${(value / 100_000).toFixed(2)} L`;
  return `INR ${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function MetricCard({ icon: Icon, label, value, subtext }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center ring-1 ring-brand-100">
          <Icon className="w-5 h-5" />
        </span>
        <div>
          <div className="text-xs uppercase text-slate-500 font-semibold">{label}</div>
          <div className="text-xl font-bold text-slate-900">{value}</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-500">{subtext}</div>
    </div>
  );
}

function toSlug(value) {
  return value.toLowerCase().replace(/\s+/g, '-');
}
