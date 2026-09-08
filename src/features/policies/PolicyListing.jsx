import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { FileEdit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api';
import { getApiErrorMessage, SectionCard } from '../dashboard/components';

export default function PolicyListing() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['grade-policies'],
    queryFn: () => api.get('/grade-policies', { params: { page: 1, limit: 100 } }).then((res) => res.data),
  });
  const policies = data?.items || [];
  const deletePolicy = useMutation({
    mutationFn: (grade) => api.delete(`/grade-policies/${encodeURIComponent(grade)}`).then((res) => res.data),
    onSuccess: (_, grade) => {
      toast.success(`${grade} grade policy deleted`);
      queryClient.invalidateQueries({ queryKey: ['grade-policies'] });
    },
    onError: (mutationError) => {
      toast.error(getApiErrorMessage(mutationError, 'Unable to delete grade policy'));
    },
  });

  function handleDelete(grade) {
    if (!window.confirm(`Delete the ${grade} grade policy?`)) return;
    deletePolicy.mutate(grade);
  }

  return (
    <SectionCard title="Policy Listing">
      <div className="overflow-x-auto">
        <table className="tj-table min-w-[1040px]">
          <thead>
            <tr>
              <th>Grade</th><th>Domestic</th><th>International</th><th>Hotel</th><th>Per-Diem INR</th><th>Per-Diem USD</th><th>Advance</th><th>Cab</th><th>Visa</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.grade}>
                <td className="font-bold text-brand-700">{policy.grade}</td>
                <td>{policy.domestic}</td>
                <td>{policy.international}</td>
                <td>{policy.hotel}</td>
                <td>{policy.perDiemInr}</td>
                <td>{policy.perDiemUsd}</td>
                <td>{policy.advance}</td>
                <td>{policy.cab}</td>
                <td>{policy.visa}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <NavLink to={`/grade-policies/${policy.grade}/edit`} className="btn-ghost text-xs"><FileEdit className="w-4 h-4" /> Edit</NavLink>
                    <button
                      type="button"
                      onClick={() => handleDelete(policy.grade)}
                      disabled={deletePolicy.isPending}
                      className="btn-ghost text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> {deletePolicy.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {isLoading && <tr><td colSpan="10" className="py-8 text-center text-slate-400">Loading grade policies...</td></tr>}
            {isError && <tr><td colSpan="10" className="py-8 text-center text-red-500">{getApiErrorMessage(error, 'Unable to load grade policies')}</td></tr>}
            {!isLoading && !isError && policies.length === 0 && <tr><td colSpan="10" className="py-8 text-center text-slate-400">No grade policies found.</td></tr>}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
