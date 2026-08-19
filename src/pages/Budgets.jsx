import { useQuery } from '@tanstack/react-query';
import api from '../api';

const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function Budgets() {
  const { data } = useQuery({ queryKey: ['budget-summary'], queryFn: () => api.get('/budgets/summary').then((r) => r.data) });

  const totals = data?.totals || { allocated: 0, consumed: 0, actual: 0 };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Budgets</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <Tile title="Allocated" value={fmtINR(totals.allocated)} />
        <Tile title="Consumed (tentative)" value={fmtINR(totals.consumed)} />
        <Tile title="Actuals (Zoho)" value={fmtINR(totals.actual)} />
      </div>

      <Section title="Unit budgets">
        <Table
          rows={data?.units || []}
          columns={[
            { key: 'unit', label: 'Unit', get: (r) => r.unit?.name || '—' },
            { key: 'financialYear', label: 'FY' },
            { key: 'allocatedINR', label: 'Allocated', get: (r) => fmtINR(r.allocatedINR) },
            { key: 'consumedINR', label: 'Consumed', get: (r) => fmtINR(r.consumedINR) },
            { key: 'actualINR', label: 'Actual', get: (r) => fmtINR(r.actualINR) },
            { key: 'balance', label: 'Balance',
              get: (r) => fmtINR((r.allocatedINR || 0) - Math.max(r.consumedINR || 0, r.actualINR || 0)) },
          ]}
        />
      </Section>

      <Section title="Project budgets (PO)">
        <Table
          rows={data?.projects || []}
          columns={[
            { key: 'projectCode', label: 'Project Code' },
            { key: 'projectName', label: 'Project' },
            { key: 'unit', label: 'Unit', get: (r) => r.unit?.name || '—' },
            { key: 'poValueINR', label: 'PO Value', get: (r) => fmtINR(r.poValueINR) },
            { key: 'consumedINR', label: 'Consumed', get: (r) => fmtINR(r.consumedINR) },
            { key: 'actualINR', label: 'Actual', get: (r) => fmtINR(r.actualINR) },
          ]}
        />
      </Section>
    </div>
  );
}

const Tile = ({ title, value }) => (
  <div className="card p-5"><div className="text-xs text-slate-500">{title}</div><div className="text-2xl font-bold">{value}</div></div>
);

const Section = ({ title, children }) => (
  <section className="card p-5">
    <h3 className="font-semibold mb-3 text-slate-800">{title}</h3>{children}
  </section>
);

const Table = ({ rows, columns }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="text-left text-slate-500 border-b border-slate-100">
        <tr>{columns.map((c) => <th key={c.key} className="py-2 pr-4">{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r._id} className="border-b border-slate-50">
            {columns.map((c) => <td key={c.key} className="py-2 pr-4">{c.get ? c.get(r) : r[c.key]}</td>)}
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={columns.length} className="py-6 text-center text-slate-400">No data</td></tr>}
      </tbody>
    </table>
  </div>
);
