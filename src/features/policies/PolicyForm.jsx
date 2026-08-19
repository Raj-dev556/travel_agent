import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import api from '../../api';
import { getApiErrorMessage, SectionCard, SelectInput, TextInput } from '../dashboard/components';

const EMPTY_POLICY_FORM = {
  grade: 'G5',
  domestic: 'Economy',
  international: 'Premium Economy',
  hotel: '3 Star',
  perDiemInr: '4500',
  perDiemUsd: '110',
  advance: '175000',
  cab: '3500',
  visa: 'Y',
};

export default function PolicyForm({ mode, grade }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_POLICY_FORM);
  const isEdit = mode === 'edit';

  const { data: policy, isLoading, isError, error } = useQuery({
    queryKey: ['grade-policy', grade],
    queryFn: () => api.get(`/grade-policies/${grade}`).then((res) => res.data),
    enabled: isEdit && Boolean(grade),
  });

  useEffect(() => {
    if (isEdit && policy) {
      setForm({
        grade: policy.grade || 'G5',
        domestic: policy.domestic || 'Economy',
        international: policy.international || 'Premium Economy',
        hotel: policy.hotel || '3 Star',
        perDiemInr: String(policy.perDiemInr ?? ''),
        perDiemUsd: String(policy.perDiemUsd ?? ''),
        advance: String(policy.advance ?? ''),
        cab: String(policy.cab ?? ''),
        visa: policy.visa || 'Y',
      });
    }
    if (!isEdit) setForm(EMPTY_POLICY_FORM);
  }, [isEdit, policy]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  const savePolicy = useMutation({
    mutationFn: (payload) => (
      isEdit
        ? api.put(`/grade-policies/${grade}`, payload).then((res) => res.data)
        : api.post('/grade-policies', payload).then((res) => res.data)
    ),
    onSuccess: () => {
      toast.success(isEdit ? 'Grade policy updated' : 'Grade policy created');
      qc.invalidateQueries({ queryKey: ['grade-policies'] });
      qc.invalidateQueries({ queryKey: ['grade-policy', grade] });
      navigate('/grade-policies');
    },
    onError: (mutationError) => {
      toast.error(getApiErrorMessage(mutationError, 'Unable to save grade policy'));
    },
  });

  function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      grade: form.grade,
      domestic: form.domestic,
      international: form.international,
      hotel: form.hotel,
      perDiemInr: Number(form.perDiemInr),
      perDiemUsd: Number(form.perDiemUsd),
      advance: Number(form.advance),
      cab: Number(form.cab),
      visa: form.visa,
    };
    if (isEdit) delete payload.grade;
    savePolicy.mutate(payload);
  }

  if (isEdit && isLoading) {
    return <SectionCard title="Edit Grade Policy"><div className="py-8 text-sm text-slate-400">Loading grade policy...</div></SectionCard>;
  }

  if (isEdit && isError) {
    return <SectionCard title="Edit Grade Policy"><div className="py-8 text-sm text-red-500">{getApiErrorMessage(error, 'Unable to load grade policy')}</div></SectionCard>;
  }

  return (
    <SectionCard
      title={isEdit ? `Edit Grade Policy - ${form.grade}` : 'Create Grade Policy'}
      actions={
        <button form="policy-form" className="btn-accent text-xs" disabled={savePolicy.isPending}>
          <Plus className="w-4 h-4" /> {savePolicy.isPending ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </button>
      }
    >
      <form id="policy-form" onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-3">
        <SelectInput label="Grade" value={form.grade} onChange={(value) => updateField('grade', value)} options={['G5', 'G4', 'G3', 'G2']} disabled={isEdit} required />
        <SelectInput label="Domestic Class" value={form.domestic} onChange={(value) => updateField('domestic', value)} options={['Economy', 'Premium Economy', 'Business']} required />
        <SelectInput label="International Class" value={form.international} onChange={(value) => updateField('international', value)} options={['Economy', 'Premium Economy', 'Business', 'First']} required />
        <SelectInput label="Hotel Star" value={form.hotel} onChange={(value) => updateField('hotel', value)} options={['3 Star', '4 Star', '5 Star']} required />
        <TextInput label="Domestic Per-Diem" value={form.perDiemInr} onChange={(value) => updateField('perDiemInr', value)} type="number" required />
        <TextInput label="International Per-Diem" value={form.perDiemUsd} onChange={(value) => updateField('perDiemUsd', value)} type="number" required />
        <TextInput label="Max Advance" value={form.advance} onChange={(value) => updateField('advance', value)} type="number" required />
        <TextInput label="Cab Allowance" value={form.cab} onChange={(value) => updateField('cab', value)} type="number" required />
        <SelectInput label="Visa Eligible" value={form.visa} onChange={(value) => updateField('visa', value)} options={['Y', 'N']} required />
      </form>
    </SectionCard>
  );
}
