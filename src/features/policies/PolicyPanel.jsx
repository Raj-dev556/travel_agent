import { useQuery } from '@tanstack/react-query';
import { ClipboardList, FileEdit, Plus, Upload } from 'lucide-react';
import api from '../../api';
import { SubMenu } from '../dashboard/components';
import PolicyForm from './PolicyForm';
import PolicyListing from './PolicyListing';
import PolicyUploadCard from './PolicyUploadCard';

export default function PolicyPanel({ action = 'listing', itemId }) {
  const { data: policiesResponse } = useQuery({
    queryKey: ['grade-policies', 'submenu'],
    queryFn: () => api.get('/grade-policies', { params: { page: 1, limit: 1 } }).then((res) => res.data),
    retry: 1,
  });
  const firstGrade = policiesResponse?.items?.[0]?.grade || itemId;

  return (
    <div className="space-y-5">
      <SubMenu
        items={[
          { path: '/grade-policies', label: 'Listing', icon: ClipboardList, end: true },
          { path: '/grade-policies/create', label: 'Create', icon: Plus },
          firstGrade && { path: `/grade-policies/${firstGrade}/edit`, label: 'Edit', icon: FileEdit },
          { path: '/grade-policies/upload', label: 'Excel Upload', icon: Upload },
        ].filter(Boolean)}
      />

      {action === 'listing' && <PolicyListing />}
      {action === 'create' && <PolicyForm mode="create" />}
      {action === 'edit' && <PolicyForm mode="edit" grade={itemId} />}
      {action === 'upload' && <PolicyUploadCard />}
    </div>
  );
}
