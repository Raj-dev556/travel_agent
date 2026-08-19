import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../api';
import { WorkflowCard, WorkflowInput, WorkflowSelect } from './components';
import { apiErrorMessage } from './utils';

const NEXT_STATUS = { 'Documents Pending': 'Documents Received', 'Documents Received': 'Appointment Scheduled', 'Appointment Scheduled': 'Submitted', Submitted: 'In Process', 'In Process': 'Approved', Approved: 'Passport Received', 'Passport Received': 'Delivered' };

export default function VisaWorkflow() {
  const queryClient = useQueryClient();
  const trips = useQuery({ queryKey: ['trips', 'visa'], queryFn: () => api.get('/trips', { params: { limit: 500 } }).then((response) => response.data.items) });
  const visas = useQuery({ queryKey: ['visas'], queryFn: () => api.get('/visas').then((response) => response.data.items) });
  const [form, setForm] = useState({ trip_id: '', employee_id: '', destination_country: '', visa_type: 'Business', fee: 0 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['visas'] });
  const createVisa = useMutation({ mutationFn: (data) => api.post('/visas', data), onSuccess: () => { toast.success('Visa application created'); refresh(); }, onError: (error) => toast.error(apiErrorMessage(error, 'Unable to create visa')) });
  const advanceVisa = useMutation({ mutationFn: ({ id, status }) => api.put(`/visas/${id}`, { status }), onSuccess: () => { toast.success('Visa status updated'); refresh(); }, onError: (error) => toast.error(apiErrorMessage(error, 'Unable to update visa')) });
  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <WorkflowCard title="Visa Operations">
      <form className="mb-5 grid gap-3 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); createVisa.mutate({ ...form, fee: Number(form.fee), currency: 'INR', required_documents: [] }); }}>
        <WorkflowSelect label="Trip" value={form.trip_id} onChange={update('trip_id')} options={(trips.data || []).map((trip) => trip.id)} empty="Select trip" />
        <WorkflowInput label="Traveler employee ID" value={form.employee_id} onChange={update('employee_id')} />
        <WorkflowInput label="Destination country" value={form.destination_country} onChange={update('destination_country')} />
        <WorkflowSelect label="Visa type" value={form.visa_type} onChange={update('visa_type')} options={['Business', 'Tourist', 'Transit', 'Work', 'Other']} />
        <WorkflowInput label="Fee" type="number" value={form.fee} onChange={update('fee')} />
        <div className="flex items-end"><button className="btn-accent w-full">Create Application</button></div>
      </form>
      <div className="overflow-x-auto"><table className="tj-table"><thead><tr><th>Visa ID</th><th>Trip</th><th>Employee</th><th>Country</th><th>Type</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {(visas.data || []).map((visa) => <tr key={visa.id}><td className="font-semibold text-brand-700">{visa.id}</td><td>{visa.trip_id}</td><td>{visa.employee_id}</td><td>{visa.destination_country}</td><td>{visa.visa_type}</td><td>{visa.status}</td><td>{NEXT_STATUS[visa.status] ? <button className="btn-accent text-xs" onClick={() => advanceVisa.mutate({ id: visa.id, status: NEXT_STATUS[visa.status] })}>Move to {NEXT_STATUS[visa.status]}</button> : 'Complete'}</td></tr>)}
      </tbody></table></div>
    </WorkflowCard>
  );
}
