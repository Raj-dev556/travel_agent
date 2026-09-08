import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, FileEdit, List, Plus, Send, Stamp } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuthStore } from '../store/auth';
import { WorkflowCard as Card, WorkflowInput, WorkflowSelect, WorkflowStat as Stat } from '../features/workflow/components';
import { apiErrorMessage as message, formatMoney as money } from '../features/workflow/utils';

const Input = ({ set, ...props }) => <WorkflowInput {...props} onChange={set} />;
const Select = ({ set, ...props }) => <WorkflowSelect {...props} onChange={set} />;

export function TripWorkflow({ action = 'listing', tripId }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const isEmployee = currentUser?.roles?.includes('Employee') || currentUser?.role === 'Employee';
  const canEditTrip = (trip) => (
    currentUser?.employeeId === trip.requester_employee_id ||
    currentUser?.roles?.some((role) => ['Company Admin', 'Travel Desk', 'Super Admin'].includes(role))
  );
  const options = useQuery({ queryKey: ['trip-options'], queryFn: () => api.get('/trips/options').then((r) => r.data) });
  const employees = Array.from(new Map([
    ...(Array.isArray(options.data?.employees) ? options.data.employees : []),
    ...(Array.isArray(options.data?.users) ? options.data.users : []),
    ...(Array.isArray(options.data?.data?.employees) ? options.data.data.employees : []),
  ].map((employee) => {
    const id = employee.id || employee.employee_id || employee.employeeId;
    const name = employee.name || employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ');
    return [id, id ? { ...employee, id, name: name || id } : null];
  }).filter((entry) => entry[1]))).map(([, employee]) => employee);
  const budgets = options.data?.budgets || [];
  const trips = useQuery({ queryKey: ['trips'], queryFn: () => api.get('/trips', { params: { limit: 500 } }).then((r) => r.data) });
  const detail = useQuery({ queryKey: ['trip', tripId], queryFn: () => api.get(`/trips/${tripId}`).then((r) => r.data), enabled: Boolean(tripId) });
  const [form, setForm] = useState(() => ({
    title: '',
    traveler_ids: isEmployee && currentUser?.employeeId ? [currentUser.employeeId] : [],
    budget_id: '',
    purpose: '',
    source_city: '',
    destination_city: '',
    start_date: '',
    end_date: '',
    travel_type: 'Domestic',
    estimated_cost: '',
  }));

  useEffect(() => {
    if (!isEmployee || !currentUser?.employeeId) return;

    setForm((currentForm) => currentForm.traveler_ids.length
      ? currentForm
      : { ...currentForm, traveler_ids: [currentUser.employeeId] });
  }, [currentUser?.employeeId, isEmployee]);
  const refresh = () => { client.invalidateQueries({ queryKey: ['trips'] }); client.invalidateQueries({ queryKey: ['trip', tripId] }); };
  const create = useMutation({
    mutationFn: (f) => api.post('/trips', {
      title: f.title, requester_employee_id: f.traveler_ids[0],
      travelers: f.traveler_ids.map((employeeId) => ({
        employee_id: employeeId,
        budget_id: f.budget_id || null,
        estimated_cost: Number(f.estimated_cost) / f.traveler_ids.length,
      })),
      trip_type: f.traveler_ids.length > 1 ? 'Group' : 'Single', travel_type: f.travel_type, purpose: f.purpose,
      source_city: f.source_city, destination_city: f.destination_city,
      start_date: f.start_date, end_date: f.end_date, estimated_cost: Number(f.estimated_cost), currency: 'INR',
    }).then((r) => r.data),
    onSuccess: (trip) => { toast.success('Trip draft created'); refresh(); navigate(`/trip-lifecycle/${trip.id}/edit`); },
    onError: (e) => toast.error(message(e, 'Unable to create trip')),
  });
  const command = useMutation({
    mutationFn: ({ url, body }) => api.post(url, body).then((r) => r.data),
    onSuccess: () => { toast.success('Trip updated'); refresh(); },
    onError: (e) => toast.error(message(e, 'Unable to update trip')),
  });
  if (action === 'create') return <div className="space-y-4"><TripNavigation /><Card title="Create Trip Request"><form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}>
    <Input label="Title" value={form.title} set={(v) => setForm({ ...form, title: v })} />
    <fieldset>
      <span className="label">Travelers</span>
      <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
        {employees.map((employee) => <label key={employee.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.traveler_ids.includes(employee.id)} onChange={(event) => setForm({ ...form, traveler_ids: event.target.checked ? [...form.traveler_ids, employee.id] : form.traveler_ids.filter((id) => id !== employee.id) })} />{employee.name} ({employee.id})</label>)}
      </div>
    </fieldset>
    <Input label="Purpose" value={form.purpose} set={(v) => setForm({ ...form, purpose: v })} />
    <Select label="Travel type" value={form.travel_type} set={(v) => setForm({ ...form, travel_type: v })} options={['Domestic', 'International']} />
    <Input label="Source city" value={form.source_city} set={(v) => setForm({ ...form, source_city: v })} />
    <Input label="Destination city" value={form.destination_city} set={(v) => setForm({ ...form, destination_city: v })} />
    <Input label="Start date" type="date" value={form.start_date} set={(v) => setForm({ ...form, start_date: v })} />
    <Input label="End date" type="date" value={form.end_date} set={(v) => setForm({ ...form, end_date: v })} />
    <Select label="Budget" value={form.budget_id} set={(v) => setForm({ ...form, budget_id: v })} options={budgets.map((x) => x.id)} empty="No budget" />
    <Input label="Estimated cost" type="number" value={form.estimated_cost} set={(v) => setForm({ ...form, estimated_cost: v })} />
    <div className="md:col-span-2 flex justify-end"><button className="btn-accent" disabled={!form.traveler_ids.length}><Plus className="h-4 w-4" /> Create {form.traveler_ids.length > 1 ? 'Group ' : ''}Draft</button></div>
  </form></Card></div>;
  if (tripId && detail.isLoading) return <div className="space-y-4"><TripNavigation /><Card title="Trip">Loading trip...</Card></div>;
  if (tripId && detail.isError) return <div className="space-y-4"><TripNavigation /><Card title="Trip"><span className="text-red-600">{message(detail.error, 'Unable to load trip')}</span></Card></div>;
  if (action === 'edit' && detail.data) return <div className="space-y-4"><TripNavigation trip={detail.data} /><TripEditForm trip={detail.data} refresh={refresh} /></div>;
  if (tripId && detail.data) return <div className="space-y-4"><TripNavigation trip={detail.data} /><TripDetail trip={detail.data} command={command} /></div>;
  return <div className="space-y-4"><TripNavigation /><Card title="Persisted Trip Lifecycle" action={<Link className="btn-accent text-xs" to="/trip-lifecycle/create"><Plus className="h-4 w-4" /> Create Trip</Link>}><div className="overflow-x-auto"><table className="tj-table min-w-[980px]"><thead><tr><th>Trip</th><th>Requester</th><th>Route</th><th>Dates</th><th>Estimate</th><th>Exceptions</th><th>Status</th><th>Action</th></tr></thead><tbody>
    {(trips.data?.items || []).map((trip) => <tr key={trip.id}><td className="font-semibold text-brand-700">{trip.id}<div className="text-xs text-slate-500">{trip.title}</div></td><td>{trip.requester_employee_id}</td><td>{trip.source_city} → {trip.destination_city}</td><td>{trip.start_date} – {trip.end_date}</td><td>{money(trip.estimated_cost)}</td><td>{trip.policy_exception || trip.budget_exception ? <span className="pill bg-amber-50 text-amber-700">Approval required</span> : '—'}</td><td>{trip.status}</td><td><div className="flex gap-2">{canEditTrip(trip) && ['Draft', 'Changes Requested'].includes(trip.status) && <Link className="btn-ghost text-xs" to={`/trip-lifecycle/${trip.id}/edit`}><FileEdit className="h-4 w-4" /> Edit</Link>}<Link className="btn-ghost text-xs" to={`/trip-lifecycle/${trip.id}/approval`}>Open</Link></div></td></tr>)}
    {!trips.isLoading && !(trips.data?.items || []).length && <tr><td colSpan="8" className="py-8 text-center text-slate-400">No trips yet.</td></tr>}
  </tbody></table></div></Card></div>;
}

function TripNavigation({ trip }) {
  const user = useAuthStore((state) => state.user);
  const canEdit = trip && (
    user?.employeeId === trip.requester_employee_id ||
    user?.roles?.some((role) => ['Company Admin', 'Travel Desk', 'Super Admin'].includes(role))
  );
  return <div className="flex flex-wrap gap-2 rounded-md bg-white p-3 shadow-sm">
    <Link className="btn-ghost text-xs" to="/trip-lifecycle"><List className="h-4 w-4" /> Trip Listing</Link>
    <Link className="btn-accent text-xs" to="/trip-lifecycle/create"><Plus className="h-4 w-4" /> Create Trip</Link>
    {canEdit && ['Draft', 'Changes Requested'].includes(trip.status) && <Link className="btn-ghost text-xs" to={`/trip-lifecycle/${trip.id}/edit`}><FileEdit className="h-4 w-4" /> Edit Trip</Link>}
    {trip && <Link className="btn-ghost text-xs" to={`/trip-lifecycle/${trip.id}/approval`}><CheckCircle2 className="h-4 w-4" /> Approval & Details</Link>}
  </div>;
}

function TripEditForm({ trip, refresh }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: trip.title || '', purpose: trip.purpose || '',
    source_city: trip.source_city || '', destination_city: trip.destination_city || '',
    start_date: trip.start_date || '', end_date: trip.end_date || '',
    estimated_cost: trip.estimated_cost || 0, cost_center: trip.cost_center || '',
    project_code: trip.project_code || '',
  });
  const save = useMutation({
    mutationFn: (payload) => api.put(`/trips/${trip.id}`, { ...payload, estimated_cost: Number(payload.estimated_cost) }).then((response) => response.data),
    onSuccess: () => { toast.success('Trip updated'); refresh(); navigate(`/trip-lifecycle/${trip.id}/approval`); },
    onError: (error) => toast.error(message(error, 'Unable to update trip')),
  });
  return <Card title={`Edit Trip — ${trip.id}`} action={<span className="pill bg-slate-100 text-slate-600">{trip.status}</span>}>
    <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save.mutate(form); }}>
      <Input label="Title" value={form.title} set={(value) => setForm({ ...form, title: value })} />
      <Input label="Purpose" value={form.purpose} set={(value) => setForm({ ...form, purpose: value })} />
      <Input label="Source city" value={form.source_city} set={(value) => setForm({ ...form, source_city: value })} />
      <Input label="Destination city" value={form.destination_city} set={(value) => setForm({ ...form, destination_city: value })} />
      <Input label="Start date" type="date" value={form.start_date} set={(value) => setForm({ ...form, start_date: value })} />
      <Input label="End date" type="date" value={form.end_date} set={(value) => setForm({ ...form, end_date: value })} />
      <Input label="Estimated cost" type="number" value={form.estimated_cost} set={(value) => setForm({ ...form, estimated_cost: value })} />
      <Input label="Cost center" value={form.cost_center} set={(value) => setForm({ ...form, cost_center: value })} />
      <Input label="Project code" value={form.project_code} set={(value) => setForm({ ...form, project_code: value })} />
      <div className="flex justify-end gap-2 md:col-span-2"><Link className="btn-ghost" to="/trip-lifecycle">Cancel</Link><button className="btn-accent" disabled={save.isPending}><FileEdit className="h-4 w-4" /> {save.isPending ? 'Saving…' : 'Save Trip'}</button></div>
    </form>
  </Card>;
}

function TripDetail({ trip, command }) {
  const currentUser = useAuthStore((state) => state.user);
  const canTravelDesk = currentUser?.roles?.some((role) => ['Company Admin', 'Travel Desk', 'Super Admin'].includes(role));
  const approvals = useQuery({ queryKey: ['trip-approvals', trip.id], queryFn: () => api.get(`/trips/${trip.id}/approvals`).then((r) => r.data.items) });
  const components = useQuery({ queryKey: ['trip-components', trip.id], queryFn: () => api.get('/trip-components', { params: { trip_id: trip.id } }).then((r) => r.data.items), enabled: Boolean(canTravelDesk) });
  const [component, setComponent] = useState({ component_type: 'Flight', provider: '', description: '', start_date: trip.start_date, end_date: trip.end_date, estimated_cost: 0 });
  const addComponent = useMutation({
    mutationFn: (data) => api.post('/trip-components', {
      ...data, trip_id: trip.id, traveler_employee_id: trip.travelers[0].employee_id,
      estimated_cost: Number(data.estimated_cost), currency: 'INR', policy_compliant: !trip.policy_exception,
    }),
    onSuccess: () => { toast.success('Booking component added'); components.refetch(); },
    onError: (e) => toast.error(message(e, 'Unable to add booking component')),
  });
  const updateComponent = useMutation({
    mutationFn: ({ id, status }) => api.put(`/trip-components/${id}`, { status, actor: 'TRAVEL-DESK' }),
    onSuccess: () => { toast.success('Booking component updated'); components.refetch(); },
    onError: (e) => toast.error(message(e, 'Unable to update booking component')),
  });
  const pending = (approvals.data || []).find((x) => x.status === 'Pending');
  const canDecide = pending && (currentUser?.employeeId === pending.approver_employee_id || currentUser?.roles?.includes('Super Admin'));
  return <div className="space-y-4"><Card title={`${trip.id} — ${trip.title}`}>
    <div className="grid gap-3 md:grid-cols-4 text-sm"><Stat label="Status" value={trip.status} /><Stat label="Route" value={`${trip.source_city} → ${trip.destination_city}`} /><Stat label="Estimate" value={money(trip.estimated_cost)} /><Stat label="Approval stage" value={trip.current_approval_stage || '—'} /></div>
    <div className="mt-5 flex flex-wrap gap-2">
      {['Draft', 'Changes Requested'].includes(trip.status) && <button className="btn-accent text-xs" onClick={() => command.mutate({ url: `/trips/${trip.id}/submit` })}><Send className="h-4 w-4" /> Submit</button>}
      {canDecide && <><button className="btn-accent text-xs" onClick={() => command.mutate({ url: `/trips/${trip.id}/decision`, body: { approver_employee_id: pending.approver_employee_id, decision: 'Approve', comments: 'Approved in portal' } })}><CheckCircle2 className="h-4 w-4" /> Approve</button><button className="btn-ghost text-xs" onClick={() => command.mutate({ url: `/trips/${trip.id}/decision`, body: { approver_employee_id: pending.approver_employee_id, decision: 'Reject', comments: 'Rejected in portal' } })}>Reject</button></>}
      {pending && !canDecide && <span className="pill bg-amber-50 text-amber-700">Awaiting {pending.approver_employee_id}</span>}
      {canTravelDesk && trip.status === 'Approved' && <button className="btn-accent text-xs" onClick={() => command.mutate({ url: `/trips/${trip.id}/travel-desk`, body: { actor: 'TRAVEL-DESK', status: 'Booking In Progress' } })}><Stamp className="h-4 w-4" /> Start Booking</button>}
      {canTravelDesk && trip.status === 'Booking In Progress' && <button className="btn-accent text-xs" onClick={() => command.mutate({ url: `/trips/${trip.id}/travel-desk`, body: { actor: 'TRAVEL-DESK', status: 'Booked' } })}>Mark Booked</button>}
    </div>
  </Card><Card title="Approval history"><div className="space-y-2">{(approvals.data || []).map((x) => <div key={x.id} className="rounded border p-3 text-sm"><b>{x.stage}</b> — {x.status}<span className="ml-2 text-slate-500">{x.approver_employee_id}</span></div>)}</div></Card>
  {canTravelDesk && ['Approved', 'Booking In Progress', 'Partially Booked', 'Booked'].includes(trip.status) && <Card title="Flight, Hotel and Transport Handoff">
    <form className="mb-4 grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); addComponent.mutate(component); }}>
      <Select label="Component" value={component.component_type} set={(v) => setComponent({ ...component, component_type: v })} options={['Flight', 'Hotel', 'Ground Transport', 'Other']} />
      <Input label="Provider" value={component.provider} set={(v) => setComponent({ ...component, provider: v })} />
      <Input label="Description" value={component.description} set={(v) => setComponent({ ...component, description: v })} />
      <Input label="Start date" type="date" value={component.start_date} set={(v) => setComponent({ ...component, start_date: v })} />
      <Input label="Estimated cost" type="number" value={component.estimated_cost} set={(v) => setComponent({ ...component, estimated_cost: v })} />
      <div className="flex items-end"><button className="btn-accent w-full">Add Component</button></div>
    </form>
    <div className="space-y-2">{(components.data || []).map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded border p-3 text-sm"><b>{item.component_type}</b><span>{item.provider}</span><span className="text-slate-500">{item.description}</span><span className="pill bg-slate-100">{item.status}</span><span className="ml-auto">{money(item.actual_cost ?? item.estimated_cost)}</span>{item.status === 'Requested' && <button className="btn-accent text-xs" onClick={() => updateComponent.mutate({ id: item.id, status: 'Booked' })}>Mark Booked</button>}</div>)}</div>
  </Card>}</div>;
}
