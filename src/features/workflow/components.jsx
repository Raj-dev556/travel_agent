export function WorkflowCard({ title, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function WorkflowInput({ label, value, onChange, type = 'text' }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="input mt-1" type={type} value={value} required onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function WorkflowSelect({ label, value, onChange, options, empty }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="input mt-1" value={value} required={!empty} onChange={(event) => onChange(event.target.value)}>
        {empty && <option value="">{empty}</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export function WorkflowStat({ label, value }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold text-slate-500">{label}</div><div className="mt-1 font-bold text-slate-900">{value}</div></div>;
}
