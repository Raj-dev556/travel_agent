import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { Download, FileEdit, ToggleRight } from 'lucide-react';
import api from '../../api';
import { FilterRow, getApiErrorMessage, SectionCard } from '../dashboard/components';

export default function EmployeeListing() {
  const [filters, setFilters] = useState({ search: '', unit: '', grade: '', department: '' });
  const params = useMemo(
    () => Object.fromEntries(
      Object.entries({ ...filters, page: 1, limit: 100 }).filter(([, value]) => value !== ''),
    ),
    [filters],
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['employees', params],
    queryFn: () => api.get('/employees', { params }).then((res) => res.data),
  });
  const employees = data?.items || [];

  return (
    <SectionCard title="Employee Listing" actions={<button className="btn-ghost text-xs"><Download className="w-4 h-4" /> Export Excel</button>}>
      <FilterRow
        fields={[
          { name: 'search', placeholder: 'Search name, email, employee ID' },
          { name: 'unit', placeholder: 'Unit' },
          { name: 'grade', placeholder: 'Grade' },
          { name: 'department', placeholder: 'Department' },
        ]}
        values={filters}
        onChange={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
      />
      <div className="mt-4 overflow-x-auto">
        <table className="tj-table min-w-[960px]">
          <thead>
            <tr>
              <th>Employee ID</th><th>Name</th><th>Email</th><th>Unit</th><th>Grade</th><th>Team</th><th>Manager</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td className="font-semibold text-brand-700">{employee.id}</td>
                <td>{employee.name}<div className="text-xs text-slate-400">{employee.designation}</div></td>
                <td>{employee.email}</td>
                <td>{employee.unit}</td>
                <td><span className="pill bg-brand-50 text-brand-700">{employee.grade}</span></td>
                <td>{employee.team_id || <span className="text-slate-400">Unassigned</span>}</td>
                <td>{employee.manager}</td>
                <td>
                  <button className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${employee.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`} type="button">
                    <ToggleRight className="w-4 h-4" /> {employee.status}
                  </button>
                </td>
                <td><NavLink to={`/employee-master/${employee.id}/edit`} className="btn-ghost text-xs"><FileEdit className="w-4 h-4" /> Edit</NavLink></td>
              </tr>
            ))}
            {isLoading && <tr><td colSpan="9" className="py-8 text-center text-slate-400">Loading employees...</td></tr>}
            {isError && <tr><td colSpan="9" className="py-8 text-center text-red-500">{getApiErrorMessage(error, 'Unable to load employees')}</td></tr>}
            {!isLoading && !isError && employees.length === 0 && <tr><td colSpan="9" className="py-8 text-center text-slate-400">No employees found.</td></tr>}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
