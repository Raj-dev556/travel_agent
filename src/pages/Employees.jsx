import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

export default function Employees() {
  const qc = useQueryClient();
  const fileRef = useRef(null);

  const { data } = useQuery({
    queryKey: ['employees'], queryFn: () => api.get('/employees').then((r) => r.data.data),
  });

  async function downloadTemplate() {
    const res = await api.get('/employees/template/download', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = 'employees-template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData(); form.append('file', file);
    try {
      const { data } = await api.post('/employees/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Processed ${data.processed}, failed ${data.failed}`);
      qc.invalidateQueries({ queryKey: ['employees'] });
    } catch (e2) {
      toast.error(e2.response?.data?.error?.message || 'Upload failed');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Employees</h1>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="btn-ghost"><Download className="w-4 h-4" /> Template</button>
          <button onClick={() => fileRef.current?.click()} className="btn-primary">
            <Upload className="w-4 h-4" /> Bulk upload
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={upload} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500 border-b border-slate-100">
            <tr>
              <th className="p-4">Employee ID</th><th>Name</th><th>Email</th>
              <th>Department</th><th>Designation</th><th>Mobile</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((e) => (
              <tr key={e._id} className="border-b border-slate-50">
                <td className="p-4 font-mono text-xs">{e.employeeCode}</td>
                <td>{e.fullName}</td><td>{e.email}</td>
                <td>{e.department || '—'}</td><td>{e.designation || '—'}</td><td>{e.mobile || '—'}</td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan="6" className="p-10 text-center text-slate-400">Upload an Excel to populate employees.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
