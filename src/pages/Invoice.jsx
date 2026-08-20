import { Download, FileText, Printer, Search } from 'lucide-react';

const INVOICES = [
  {
    id: 'INV-2026-0841',
    client: 'Reliance Retail Ltd',
    project: 'Mumbai client steering committee',
    bookingRef: 'TRIP-2608-001',
    type: 'Hotel',
    guest: 'Arjun Menon',
    issueDate: '2026-08-20',
    dueDate: '2026-08-27',
    amount: 73440,
    tax: 11202,
    status: 'Paid',
  },
  {
    id: 'INV-2026-0842',
    client: 'APAC Channel Partners',
    project: 'Singapore partner enablement workshop',
    bookingRef: 'TRIP-2608-002',
    type: 'Flight',
    guest: 'Rhea Iyer',
    issueDate: '2026-08-20',
    dueDate: '2026-08-30',
    amount: 162500,
    tax: 24788,
    status: 'Pending',
  },
  {
    id: 'INV-2026-0843',
    client: 'APAC Channel Partners',
    project: 'Singapore partner enablement workshop',
    bookingRef: 'TRIP-2608-002',
    type: 'Hotel',
    guest: 'Sara Fernandes',
    issueDate: '2026-08-21',
    dueDate: '2026-08-30',
    amount: 181400,
    tax: 27671,
    status: 'Pending',
  },
  {
    id: 'INV-2026-0844',
    client: 'Dummy Corp India Pvt Ltd',
    project: 'Delhi finance audit review',
    bookingRef: 'TRIP-2608-003',
    type: 'Flight',
    guest: 'Nisha Rao',
    issueDate: '2026-08-22',
    dueDate: '2026-08-29',
    amount: 44000,
    tax: 6712,
    status: 'Draft',
  },
  {
    id: 'INV-2026-0845',
    client: 'BMW India Travel Demo',
    project: 'Pune leadership offsite',
    bookingRef: 'HOTEL-DEMO-001',
    type: 'Hotel',
    guest: 'Aarav Mehta',
    issueDate: '2026-08-18',
    dueDate: '2026-08-25',
    amount: 94800,
    tax: 14461,
    status: 'Overdue',
  },
  {
    id: 'INV-2026-0846',
    client: 'Reliance Retail Ltd',
    project: 'Quarterly implementation review',
    bookingRef: 'CMP-001',
    type: 'Service Fee',
    guest: 'Arjun Menon',
    issueDate: '2026-08-19',
    dueDate: '2026-08-26',
    amount: 18500,
    tax: 3330,
    status: 'Paid',
  },
];

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const statusClass = {
  Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-100',
  Draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  Overdue: 'bg-red-50 text-red-700 ring-red-100',
};

export default function Invoice() {
  const totalAmount = INVOICES.reduce((sum, invoice) => sum + invoice.amount + invoice.tax, 0);
  const paidAmount = INVOICES.filter((invoice) => invoice.status === 'Paid').reduce((sum, invoice) => sum + invoice.amount + invoice.tax, 0);
  const pendingAmount = totalAmount - paidAmount;
  const overdueCount = INVOICES.filter((invoice) => invoice.status === 'Overdue').length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-card md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-accent-600">Finance</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">Demo invoice records for flights, hotels, taxes, and service fees.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost text-xs" type="button"><Download className="h-4 w-4" /> Export</button>
          <button className="btn-accent text-xs" type="button"><Printer className="h-4 w-4" /> Print Summary</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total Invoiced" value={formatMoney(totalAmount)} />
        <SummaryCard label="Paid" value={formatMoney(paidAmount)} />
        <SummaryCard label="Outstanding" value={formatMoney(pendingAmount)} />
        <SummaryCard label="Overdue" value={String(overdueCount)} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Invoice Register</h2>
            <p className="text-sm text-slate-500">Static demo data connected to travel bookings and client projects.</p>
          </div>
          <label className="relative block w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search invoices" />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="tj-table min-w-[1120px]">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client / Project</th>
                <th>Booking Ref</th>
                <th>Type</th>
                <th>Guest</th>
                <th>Dates</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {INVOICES.map((invoice) => {
                const total = invoice.amount + invoice.tax;
                return (
                  <tr key={invoice.id}>
                    <td>
                      <div className="font-bold text-brand-700">{invoice.id}</div>
                      <div className="text-xs text-slate-400">Issued {formatDate(invoice.issueDate)}</div>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-900">{invoice.client}</div>
                      <div className="text-xs text-slate-500">{invoice.project}</div>
                    </td>
                    <td className="font-mono text-xs">{invoice.bookingRef}</td>
                    <td>{invoice.type}</td>
                    <td>{invoice.guest}</td>
                    <td>
                      <div>{formatDate(invoice.issueDate)}</div>
                      <div className="text-xs text-slate-500">Due {formatDate(invoice.dueDate)}</div>
                    </td>
                    <td>{formatMoney(invoice.tax)}</td>
                    <td className="font-bold text-slate-900">{formatMoney(total)}</td>
                    <td>
                      <span className={`pill ring-1 ${statusClass[invoice.status] || statusClass.Draft}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-ghost text-xs" type="button">
                        <FileText className="h-4 w-4" /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
    </div>
  );
}
