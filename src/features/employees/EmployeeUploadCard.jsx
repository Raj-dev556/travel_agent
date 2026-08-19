import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import api from '../../api';
import { getApiErrorMessage, SectionCard } from '../dashboard/components';

export default function EmployeeUploadCard() {
  const fileRef = useRef(null);
  const qc = useQueryClient();
  const [result, setResult] = useState(null);

  async function downloadTemplate() {
    try {
      const response = await api.get('/employees/template/download', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'employees-template.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to download template'));
    }
  }

  const uploadEmployees = useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/employees/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((res) => res.data);
    },
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`Processed ${data.processed}, failed ${data.failed}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Upload failed'));
    },
  });

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadEmployees.mutate(file);
    event.target.value = '';
  }

  return (
    <SectionCard
      title="Excel Bulk Upload"
      actions={<button onClick={downloadTemplate} className="btn-ghost text-xs" type="button"><Download className="w-4 h-4" /> Template</button>}
    >
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-md bg-white border border-slate-200 flex items-center justify-center text-accent-600">
            <FileSpreadsheet className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900">Upload employee Excel file</div>
            <div className="mt-1 text-xs text-slate-500">
              Employee ID, Team ID and Manager Email can be blank. Manager Email is only optional for a top-level employee.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn-accent text-xs"
                onClick={() => fileRef.current?.click()}
                disabled={uploadEmployees.isPending}
                type="button"
              >
                <Upload className="w-4 h-4" /> {uploadEmployees.isPending ? 'Uploading...' : 'Choose File'}
              </button>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Rows are validated before commit and upserted by Employee ID.</p>
      {result && (
        <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-semibold text-emerald-700">Processed: {result.processed}</span>
            <span className={result.failed ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>Failed: {result.failed}</span>
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-3 space-y-1 text-xs text-red-600">
              {result.errors.slice(0, 5).map((item) => (
                <div key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
