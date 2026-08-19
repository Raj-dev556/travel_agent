import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileEdit, Plus } from 'lucide-react';
import api from '../../api';
import { FieldLabel, getApiErrorMessage, SectionCard, SelectInput, TextInput } from '../dashboard/components';

const EMPTY_EMPLOYEE_FORM = {
  id: '',
  name: '',
  email: '',
  department: '',
  unit: 'North',
  grade: 'G5',
  team_id: '',
  manager: '',
  designation: '',
  designation_code: '',
  roles: ['Employee'],
  joined: '',
  mobile: '',
  status: 'Active',
};

export default function EmployeeForm({ mode, employeeId }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const isEdit = mode === 'edit';
  const { data: teamsResponse } = useQuery({
    queryKey: ['teams', 'employee-form'],
    queryFn: () => api.get('/teams', { params: { page: 1, limit: 500 } }).then((res) => res.data),
  });
  const teams = teamsResponse?.items || [];
  const { data: designationsResponse } = useQuery({
    queryKey: ['designations', 'employee-form'],
    queryFn: () => api.get('/designations', { params: { status: 'Active', page: 1, limit: 500 } }).then((res) => res.data),
  });
  const designations = designationsResponse?.items || [];

  const { data: employee, isLoading, isError, error } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}`).then((res) => res.data),
    enabled: isEdit && Boolean(employeeId),
  });

  useEffect(() => {
    if (isEdit && employee) {
      setForm({
        id: employee.id || '',
        name: employee.name || '',
        email: employee.email || '',
        department: employee.department || '',
        unit: employee.unit || 'North',
        grade: employee.grade || 'G5',
        team_id: employee.team_id || '',
        manager: employee.manager || '',
        designation: employee.designation || '',
        designation_code: employee.designation_code || '',
        roles: employee.roles?.length ? employee.roles : ['Employee'],
        joined: employee.joined || '',
        mobile: employee.mobile || '',
        status: employee.status || 'Active',
      });
    }
    if (!isEdit) setForm(EMPTY_EMPLOYEE_FORM);
  }, [employee, isEdit]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setFormError('');
  }

  const saveEmployee = useMutation({
    mutationFn: (payload) => (
      isEdit
        ? api.put(`/employees/${employeeId}`, payload).then((res) => res.data)
        : api.post('/employees', payload).then((res) => res.data)
    ),
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Employee updated' : 'Employee created');
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employee', employeeId] });
      navigate('/employee-master');
    },
    onError: (mutationError) => {
      const detail = mutationError?.response?.data?.detail;
      if (Array.isArray(detail)) {
        const aliases = {
          full_name: 'name', name: 'name',
          manager_email: 'manager', manager: 'manager',
          date_of_joining: 'joined', joined: 'joined',
          employee_id: 'id', employeeId: 'id',
        };
        const nextErrors = {};
        detail.forEach((item) => {
          const apiField = item.loc?.at(-1);
          const formField = aliases[apiField] || apiField;
          if (formField && Object.hasOwn(form, formField)) {
            const label = {
              name: 'Full Name', email: 'Email', department: 'Department',
              unit: 'Unit', grade: 'Grade', team_id: 'Primary Team',
              manager: 'Manager Email', designation: 'Designation Name',
              designation_code: 'Designation Master', roles: 'Portal Roles',
              joined: 'Date of Joining', mobile: 'Mobile', status: 'Status',
            }[formField] || formField;
            nextErrors[formField] = `${label}: ${item.msg}`;
          }
        });
        setFieldErrors(nextErrors);
        const firstError = Object.values(nextErrors)[0];
        setFormError(firstError || 'Please correct the highlighted employee fields.');
        toast.error(firstError || 'Please correct the highlighted employee fields.');
        return;
      }
      const errorMessage = getApiErrorMessage(mutationError, 'Unable to save employee');
      if (/email.*already exists/i.test(errorMessage)) {
        setFieldErrors({ email: errorMessage });
      }
      setFormError(errorMessage);
      toast.error(errorMessage);
    },
  });

  function handleSubmit(event) {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    const payload = {
      id: form.id,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      department: form.department.trim(),
      unit: form.unit,
      grade: form.grade,
      team_id: form.team_id || null,
      manager: form.manager.trim().toLowerCase() || null,
      designation: form.designation.trim(),
      designation_code: form.designation_code || null,
      roles: form.roles,
      joined: form.joined,
      mobile: form.mobile.trim(),
      status: form.status,
    };
    delete payload.id;
    saveEmployee.mutate(payload);
  }

  if (isEdit && isLoading) {
    return <SectionCard title="Edit Employee"><div className="py-8 text-sm text-slate-400">Loading employee...</div></SectionCard>;
  }

  if (isEdit && isError) {
    return <SectionCard title="Edit Employee"><div className="py-8 text-sm text-red-500">{getApiErrorMessage(error, 'Unable to load employee')}</div></SectionCard>;
  }

  return (
    <SectionCard
      title={isEdit ? `Edit Employee - ${form.id}` : 'Create Employee'}
      actions={
        <button form="employee-form" className="btn-accent text-xs" disabled={saveEmployee.isPending}>
          {isEdit ? <FileEdit className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {saveEmployee.isPending ? 'Saving...' : isEdit ? 'Save Employee' : 'Create Employee'}
        </button>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        {formError && <div role="alert" className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
        <TextInput
          label="Employee ID"
          value={isEdit ? form.id : ''}
          placeholder="Auto generated on save"
          disabled
        />
        <TextInput label="Full Name" error={fieldErrors.name} value={form.name} onChange={(value) => updateField('name', value)} required />
        <TextInput label="Email" error={fieldErrors.email} value={form.email} onChange={(value) => updateField('email', value)} type="email" required />
        <TextInput label="Department" error={fieldErrors.department} value={form.department} onChange={(value) => updateField('department', value)} required />
        <SelectInput label="Unit" value={form.unit} onChange={(value) => updateField('unit', value)} options={['North', 'West', 'South', 'Corporate']} required />
        <SelectInput label="Grade" value={form.grade} onChange={(value) => updateField('grade', value)} options={['G5', 'G4', 'G3', 'G2']} required />
        <label className="block">
          <FieldLabel label="Primary Team" />
          <select className="input mt-1" value={form.team_id} onChange={(event) => updateField('team_id', event.target.value)}>
            <option value="">Unassigned</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.id})</option>)}
          </select>
        </label>
        <TextInput label="Manager Email" error={fieldErrors.manager} value={form.manager} onChange={(value) => updateField('manager', value)} type="email" placeholder="Optional for top-level employee" />
        <label className="block">
          <FieldLabel label="Designation Master" />
          <select
            className="input mt-1"
            value={form.designation_code}
            onChange={(event) => {
              const code = event.target.value;
              const selected = designations.find((item) => item.code === code);
              updateField('designation_code', code);
              if (selected) updateField('designation', selected.name);
            }}
          >
            <option value="">Manual designation</option>
            {designations.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
          </select>
        </label>
        <TextInput label="Designation Name" error={fieldErrors.designation} value={form.designation} onChange={(value) => updateField('designation', value)} required />
        <TextInput label="Date of Joining" error={fieldErrors.joined} value={form.joined} onChange={(value) => updateField('joined', value)} type="date" required />
        <TextInput label="Mobile" error={fieldErrors.mobile} value={form.mobile} onChange={(value) => updateField('mobile', value)} required />
        <SelectInput label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={['Active', 'Inactive']} required />
        <fieldset className="sm:col-span-2">
          <FieldLabel label="Portal Roles" required />
          <div className="mt-2 grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {['Employee', 'Reporting Manager', 'Finance Approver', 'Travel Desk', 'HR Admin', 'Company Admin', 'Visa Operations'].map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.roles.includes(role)}
                  onChange={(event) => updateField('roles', event.target.checked
                    ? [...new Set([...form.roles, role])]
                    : form.roles.filter((item) => item !== role))}
                />
                {role}
              </label>
            ))}
          </div>
          {fieldErrors.roles && <span className="mt-1 block text-xs text-red-600">{fieldErrors.roles}</span>}
        </fieldset>
        <div className="sm:col-span-2 mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <NavLink className="btn-ghost" to="/employee-master">Cancel</NavLink>
          <button className="btn-accent" type="submit" disabled={saveEmployee.isPending}>
            {isEdit ? <FileEdit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {saveEmployee.isPending ? 'Saving...' : isEdit ? 'Save Employee' : 'Create Employee'}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
