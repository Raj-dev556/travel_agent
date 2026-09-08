import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Network,
  Plus,
  UserRound,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const EMPTY_TEAM = {
  name: '',
  department: '',
  cost_center: '',
  lead_employee_id: '',
  parent_team_id: '',
  status: 'Active',
};

function errorMessage(error, fallback) {
  return error?.response?.data?.detail || error?.message || fallback;
}

function ReportingNode({ node, depth = 0 }) {
  return (
    <li className={depth ? 'ml-7 border-l border-slate-200 pl-4' : ''}>
      <div className="mb-2 flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <UserRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{node.name}</div>
          <div className="truncate text-xs text-slate-500">
            {node.employee_id} · {node.designation || 'No designation'} · {node.grade || 'No grade'}
          </div>
        </div>
        {node.reports?.length > 0 && (
          <span className="pill bg-slate-100 text-slate-600">
            {node.reports.length} direct
          </span>
        )}
        {node.cycle && <span className="pill bg-red-50 text-red-700">Cycle</span>}
      </div>
      {node.reports?.length > 0 && (
        <ul>
          {node.reports.map((report) => (
            <ReportingNode key={`${report.employee_id}-${depth}`} node={report} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrganizationHierarchy() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_TEAM);

  const hierarchyQuery = useQuery({
    queryKey: ['organization-hierarchy'],
    queryFn: () => api.get('/hierarchy').then((response) => response.data),
  });
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get('/teams', { params: { page: 1, limit: 500 } }).then((response) => response.data),
  });
  const employeesQuery = useQuery({
    queryKey: ['employees', 'hierarchy-options'],
    queryFn: () => api.get('/employees', { params: { page: 1, limit: 100 } }).then((response) => response.data),
  });

  const teams = teamsQuery.data?.items || [];
  const employees = employeesQuery.data?.items || [];
  const hierarchy = hierarchyQuery.data;
  const departmentCount = useMemo(
    () => new Set(teams.map((team) => team.department)).size,
    [teams],
  );

  const createTeam = useMutation({
    mutationFn: (payload) => api.post('/teams', payload).then((response) => response.data),
    onSuccess: () => {
      toast.success('Team created');
      setForm(EMPTY_TEAM);
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['organization-hierarchy'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Unable to create team')),
  });

  function submitTeam(event) {
    event.preventDefault();
    createTeam.mutate({
      ...form,
      lead_employee_id: form.lead_employee_id || null,
      parent_team_id: form.parent_team_id || null,
    });
  }

  if (hierarchyQuery.isLoading) {
    return <div className="rounded-lg bg-white p-8 text-sm text-slate-500 shadow-sm">Loading organization hierarchy...</div>;
  }

  if (hierarchyQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {errorMessage(hierarchyQuery.error, 'Unable to load organization hierarchy')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Summary icon={Building2} label="Teams" value={teams.length} />
        <Summary icon={Network} label="Departments" value={departmentCount} />
        <Summary icon={Users} label="Reporting roots" value={hierarchy?.reporting_tree?.length || 0} />
      </div>

      {hierarchy?.orphaned_manager_references?.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="text-sm font-semibold">Manager records need attention</div>
            <div className="mt-1 text-xs">
              {hierarchy.orphaned_manager_references.length} manager email reference(s) do not match an employee:
              {' '}{hierarchy.orphaned_manager_references.join(', ')}
            </div>
          </div>
        </div>
      )}

      <section className="rounded-lg bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Teams and departments</h2>
            <p className="mt-0.5 text-xs text-slate-500">Manage budget ownership and approval-routing groups.</p>
          </div>
          <button className="btn-accent text-xs" onClick={() => setShowCreate((value) => !value)} type="button">
            <Plus className="h-4 w-4" /> {showCreate ? 'Close' : 'Create Team'}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={submitTeam} className="grid gap-3 border-b border-slate-100 bg-slate-50 p-5 md:grid-cols-3">
            <Field label="Team name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <Field label="Department" value={form.department} onChange={(value) => setForm({ ...form, department: value })} />
            <Field label="Cost center" value={form.cost_center} onChange={(value) => setForm({ ...form, cost_center: value })} />
            <SelectField
              label="Team lead"
              value={form.lead_employee_id}
              onChange={(value) => setForm({ ...form, lead_employee_id: value })}
              options={employees.map((employee) => ({ value: employee.id, label: `${employee.name} (${employee.id})` }))}
            />
            {/* <SelectField
              label="Parent team"
              value={form.parent_team_id}
              onChange={(value) => setForm({ ...form, parent_team_id: value })}
              options={teams.map((team) => ({ value: team.id, label: team.name }))}
            /> */}
            <div className="md:col-span-3 flex justify-end">
              <button className="btn-accent text-xs" disabled={createTeam.isPending} type="submit">
                {createTeam.isPending ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="tj-table min-w-[760px]">
            <thead><tr><th>Team</th><th>Department</th><th>Cost Center</th><th>Lead</th><th>Parent</th><th>Status</th></tr></thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <div className="font-semibold text-brand-700">{team.name}</div>
                    <div className="text-xs text-slate-400">{team.id} · {team.member_count || 0} member(s)</div>
                  </td>
                  <td>{team.department}</td>
                  <td>{team.cost_center}</td>
                  <td>{team.lead_employee_id || '—'}</td>
                  <td>{team.parent_team_id || 'Top level'}</td>
                  <td><span className={team.status === 'Active' ? 'pill bg-emerald-50 text-emerald-700' : 'pill bg-slate-100 text-slate-600'}>{team.status}</span></td>
                </tr>
              ))}
              {!teamsQuery.isLoading && teams.length === 0 && (
                <tr><td colSpan="6" className="py-8 text-center text-slate-400">No teams created yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Network className="h-5 w-5 text-accent-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Employee reporting hierarchy</h2>
            <p className="text-xs text-slate-500">Manager-to-direct-report relationships from Employee Master.</p>
          </div>
        </div>
        {hierarchy?.reporting_tree?.length > 0 ? (
          <ul>{hierarchy.reporting_tree.map((node) => <ReportingNode key={node.employee_id} node={node} />)}</ul>
        ) : (
          <div className="rounded-md bg-slate-50 p-6 text-center text-sm text-slate-500">No reporting hierarchy is available.</div>
        )}
      </section>
    </div>
  );
}

function Summary({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>
      <div><div className="text-2xl font-bold text-slate-900">{value}</div><div className="text-xs text-slate-500">{label}</div></div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = '' }) {
  return (
    <label><span className="label">{label}</span><input className="input mt-1" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required /></label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="input mt-1" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">None</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
