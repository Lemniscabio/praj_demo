import { useApp, type Surface } from "../lib/store";
import { cn } from "../lib/cn";

const items: { id: Surface; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: "fit",
    label: "Model Fitting",
    hint: "Ingest · Configure · Fit",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17 9 11l4 4 8-9" />
        <circle cx="9" cy="11" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="13" cy="15" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="21" cy="6" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "scenario1",
    label: "Scenario 1",
    hint: "Batch Tracking",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V6m0 14h16M8 16l4-6 3 3 5-8" />
      </svg>
    ),
  },
  {
    id: "scenario2",
    label: "Scenario 2",
    hint: "Tech Transfer",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h10l3 3h3v10H4z" />
        <path d="M8 7V4h6v3" />
      </svg>
    ),
  },
];

export function Rail() {
  const surface = useApp((s) => s.surface);
  const setSurface = useApp((s) => s.setSurface);

  return (
    <aside className="shrink-0 w-[240px] border-r border-hairline bg-canvas flex flex-col">
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-ink text-canvas grid place-items-center">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 14c2-6 10-6 12 0" />
              <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="serif text-[15px] text-ink font-medium">Lemnisca</div>
            <div className="text-[11px] text-muted tracking-wide uppercase">Bioprocess Studio</div>
          </div>
        </div>
      </div>

      <nav className="px-3 flex flex-col gap-0.5">
        {items.map((it) => {
          const active = surface === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setSurface(it.id)}
              className={cn(
                "group press flex items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                "transition-colors duration-150",
                active
                  ? "bg-canvas-raised text-ink shadow-[0_0_0_1px_var(--color-hairline)]"
                  : "text-muted hover:text-ink hover:bg-canvas-raised/60"
              )}
            >
              <span className={cn("transition-colors", active ? "text-accent" : "text-muted-soft group-hover:text-ink-soft")}>
                {it.icon}
              </span>
              <span className="flex-1 leading-tight">
                <span className="block text-[13.5px] font-medium">{it.label}</span>
                <span className="block text-[11.5px] text-muted-soft">{it.hint}</span>
              </span>
              {active && <span className="w-1 h-1 rounded-full bg-accent" />}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-5 py-5 text-[11px] text-muted-soft leading-relaxed">
        <div className="h-px bg-hairline mb-4" />
        <div>Praj case study</div>
        <div className="tabular">21 Apr 2026 · v0.1</div>
      </div>
    </aside>
  );
}
