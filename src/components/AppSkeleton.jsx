function Pulse({ className }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export default function AppSkeleton() {
  return (
    <div className="min-h-screen bg-slate-100" role="status" aria-label="Loading application">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
        <Pulse className="h-8 w-36" />
        <div className="flex items-center gap-3"><Pulse className="h-8 w-24" /><Pulse className="h-9 w-9 rounded-full" /></div>
      </div>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="hidden w-64 shrink-0 bg-slate-800 p-4 md:block">
          <Pulse className="mb-7 h-7 w-28 bg-slate-700" />
          <div className="space-y-3">{Array.from({ length: 8 }, (_, index) => <Pulse key={index} className="h-9 w-full bg-slate-700" />)}</div>
        </aside>
        <main className="min-w-0 flex-1 space-y-5 p-5 md:p-6">
          <Pulse className="h-12 w-full bg-white" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="rounded-md bg-white p-4 shadow-sm"><Pulse className="mb-3 h-4 w-24" /><Pulse className="h-8 w-16" /></div>)}
          </div>
          <section className="rounded-md bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between"><Pulse className="h-6 w-44" /><Pulse className="h-9 w-28" /></div>
            <div className="space-y-3">
              <Pulse className="h-10 w-full" />
              {Array.from({ length: 6 }, (_, index) => <Pulse key={index} className="h-12 w-full bg-slate-100" />)}
            </div>
          </section>
        </main>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
