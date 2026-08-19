import { useQuery } from '@tanstack/react-query';
import { ClipboardList, FileEdit, Plus, Upload } from 'lucide-react';
import api from '../../api';
import { SubMenu } from '../dashboard/components';
import EmployeeForm from './EmployeeForm';
import EmployeeListing from './EmployeeListing';
import EmployeeUploadCard from './EmployeeUploadCard';

export default function EmployeeMasterPanel({ action = 'listing', itemId }) {
  const { data: employeesResponse } = useQuery({
    queryKey: ['employees', 'submenu'],
    queryFn: () => api.get('/employees', { params: { page: 1, limit: 1 } }).then((res) => res.data),
    retry: 1,
  });
  const firstEmployeeId = employeesResponse?.items?.[0]?.id || itemId;

  return (
    <div className="space-y-5">
      <SubMenu
        items={[
          { path: '/employee-master', label: 'Listing', icon: ClipboardList, end: true },
          { path: '/employee-master/create', label: 'Create', icon: Plus },
          firstEmployeeId && { path: `/employee-master/${firstEmployeeId}/edit`, label: 'Edit', icon: FileEdit },
          { path: '/employee-master/upload', label: 'Excel Upload', icon: Upload },
        ].filter(Boolean)}
      />

      {action === 'listing' && <EmployeeListing />}
      {action === 'create' && <EmployeeForm mode="create" />}
      {action === 'edit' && <EmployeeForm mode="edit" employeeId={itemId} />}
      {action === 'upload' && <EmployeeUploadCard />}
    </div>
  );
}
