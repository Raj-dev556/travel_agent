import { NavLink } from 'react-router-dom';

export function SubMenu({ items }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-card">
      {items.map(({ path, label, icon: Icon, end }) => (
        <NavLink key={path} to={path} end={end} className={({ isActive }) => `${isActive ? 'btn-accent' : 'btn-ghost'} text-xs`}>
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
    </div>
  );
}

export function SectionCard({ title, actions, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      {(title || actions) && <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-base font-bold text-slate-900">{title}</h2>{actions}</div>}
      {children}
    </section>
  );
}

export function FilterRow({ fields, values = {}, onChange }) {
  return <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-4">{fields.map((field) => {
    const config = typeof field === 'string' ? { name: field, placeholder: field } : field;
    return <input key={config.name} className="input" placeholder={config.placeholder} value={values[config.name] || ''} onChange={(event) => onChange?.(config.name, event.target.value)} />;
  })}</div>;
}

export function FieldLabel({ label, required }) {
  return <span className="label">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>;
}

export function TextInput({ label, value = '', onChange, type = 'text', disabled = false, required = false, placeholder, error }) {
  return <label className="block"><FieldLabel label={label} required={required} /><input className={`input mt-1 ${error ? 'border-red-400' : ''}`} type={type} value={value} onChange={(event) => onChange?.(event.target.value)} disabled={disabled} required={required} placeholder={placeholder} />{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>;
}

export function SelectInput({ label, options, value = '', onChange, required = false, disabled = false }) {
  return <label className="block"><FieldLabel label={label} required={required} /><select className="input mt-1" value={value} onChange={(event) => onChange?.(event.target.value)} required={required} disabled={disabled}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export function getApiErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail || error?.response?.data?.error?.message;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ');
  return detail || error?.message || fallback;
}
