import { SectionTitle, Card, Pill } from "../components/ui";

export function Scenario2Surface() {
  return (
    <div className="px-10 py-10 max-w-[1200px] mx-auto">
      <SectionTitle
        eyebrow="Scenario 2"
        title="Tech transfer"
        sub="Moving a validated process from one site to another — matching bioreactor geometry, media vendors, and sensor calibrations so the golden trajectory holds."
      />

      <div className="mt-10 grid grid-cols-12 gap-6">
        <Card className="col-span-8 p-10">
          <div className="flex items-center gap-2 mb-6">
            <Pill tone="lattice">In design</Pill>
            <span className="text-[12px] text-muted">— wireframes pending</span>
          </div>
          <h3 className="serif text-[22px] text-ink mb-3">What this surface will do</h3>
          <ul className="space-y-3 text-[14px] text-ink-soft leading-relaxed max-w-[60ch]">
            <li>— Compare fitted model performance across two sites side-by-side.</li>
            <li>— Flag inputs whose distributions have drifted and estimate the effect on final product.</li>
            <li>— Suggest a calibration recipe: which inputs to retune first, in what order, and by how much.</li>
          </ul>
        </Card>
        <Card className="col-span-4 p-7">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-3">Next milestone</div>
          <div className="serif text-[18px] text-ink leading-snug">Lock the comparison view layout and decide on the drift-detection metric.</div>
        </Card>
      </div>
    </div>
  );
}
