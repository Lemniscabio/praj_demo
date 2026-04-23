import { useEffect, useRef, useState } from "react";

/**
 * Rotary batch picker. Scroll to rotate: a visible ring of batches revolves
 * around a fixed pointer at the top. When the wheel stops, the ring snaps
 * to park the nearest batch precisely at the pointer.
 *
 * `rotation` is measured in fractional batches (continuous). Each batch
 * occupies SPACING_DEG of visible arc so numbers stay comfortably spaced
 * regardless of total batch count.
 */
const VISIBLE_SLOTS = 10;
const SPACING_DEG = 360 / VISIBLE_SLOTS;
const WINDOW_SLOTS = 5;
const SENSITIVITY = 1 / 60;          // fractional batches per pixel of wheel deltaY
const WHEEL_END_MS = 140;            // idle delay before auto-snap fires
const SNAP_DURATION = 240;           // ms
const SLOT_RADIUS = 9;               // uniform — no active-state resizing

export function BatchDial({
  batches,
  value,
  onChange,
  size = 150,
}: {
  batches: number[];
  value: number | null;
  onChange: (b: number) => void;
  size?: number;
}) {
  const n = batches.length;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [rotation, setRotation] = useState(() => {
    if (!n) return 0;
    const idx = batches.findIndex((b) => b === value);
    return Math.max(0, idx);
  });

  // Mirror rotation to a ref so wheel/snap handlers always see the latest.
  const rotationRef = useRef(rotation);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  const wheelTimerRef = useRef<number | null>(null);
  const snapRafRef = useRef<number | null>(null);

  const cancelSnap = () => {
    if (snapRafRef.current != null) {
      cancelAnimationFrame(snapRafRef.current);
      snapRafRef.current = null;
    }
  };

  const startSnap = () => {
    cancelSnap();
    const startRot = rotationRef.current;
    const target = Math.round(startRot);
    if (Math.abs(target - startRot) < 0.001) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / SNAP_DURATION);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setRotation(startRot + (target - startRot) * eased);
      if (p < 1) snapRafRef.current = requestAnimationFrame(tick);
      else snapRafRef.current = null;
    };
    snapRafRef.current = requestAnimationFrame(tick);
  };

  const activeIdx = n > 0 ? ((Math.round(rotation) % n) + n) % n : 0;

  useEffect(() => {
    if (!n) return;
    if (batches[activeIdx] !== value) onChange(batches[activeIdx]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  // External value change → animate rotation to that batch via shortest arc.
  useEffect(() => {
    if (!n) return;
    const idx = batches.findIndex((b) => b === value);
    if (idx < 0 || idx === activeIdx) return;
    cancelSnap();
    const curr = rotationRef.current;
    const currMod = ((curr % n) + n) % n;
    let delta = idx - currMod;
    if (delta > n / 2) delta -= n;
    if (delta < -n / 2) delta += n;
    const target = curr + delta;
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / SNAP_DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      setRotation(curr + (target - curr) * eased);
      if (p < 1) snapRafRef.current = requestAnimationFrame(tick);
      else snapRafRef.current = null;
    };
    snapRafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, n]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || n === 0) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelSnap();
      setRotation((r) => r + e.deltaY * SENSITIVITY);
      if (wheelTimerRef.current != null) window.clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = window.setTimeout(() => { startSnap(); }, WHEEL_END_MS);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelTimerRef.current != null) window.clearTimeout(wheelTimerRef.current);
      cancelSnap();
    };
  }, [n]);

  if (n === 0) return null;

  const r = size / 2;
  const ringR = r - 18;
  const pointerY = r - (ringR - 12);

  const circularOffset = (i: number) => {
    let d = i - activeIdx;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  // Each batch sits at (i - rotation) * SPACING_DEG clockwise from the top.
  // Positions are rendered directly from `rotation` — no spring animation,
  // so circles never lag, bunch, or appear to shrink under rapid scroll.
  const positionFor = (i: number) => {
    const off = circularOffset(i);
    const fractional = rotation - activeIdx;
    const degFromTop = (off - fractional) * SPACING_DEG;
    const rad = ((degFromTop - 90) * Math.PI) / 180;
    return { x: r + ringR * Math.cos(rad), y: r + ringR * Math.sin(rad), off };
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ display: "block", touchAction: "none", cursor: "ns-resize" }}
      role="slider"
      aria-label="Batch picker — scroll to rotate"
    >
      <circle cx={r} cy={r} r={r - 2} fill="#FBFAF7" stroke="#E7E5E0" strokeWidth={1} />
      <circle cx={r} cy={r} r={ringR + 6} fill="none" stroke="#E7E5E0" strokeDasharray="1.5 3" opacity={0.6} />

      {batches.map((b, i) => {
        const { x, y, off } = positionFor(i);
        if (Math.abs(off) > WINDOW_SLOTS) return null;

        const active = off === 0;
        const dist = Math.abs(off);
        const fade = active ? 1 : Math.max(0.25, 1 - dist / (WINDOW_SLOTS + 1));

        return (
          <g key={`batch-${b}`} transform={`translate(${x} ${y})`} opacity={fade}>
            <circle
              cx={0}
              cy={0}
              r={SLOT_RADIUS}
              fill={active ? "#1C1E22" : "transparent"}
              stroke={active ? "#1C1E22" : "#D8D5CE"}
              strokeWidth={1}
              onClick={() => onChange(b)}
              className="cursor-pointer"
            />
            <text
              x={0}
              y={3.5}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={active ? 600 : 500}
              fill={active ? "#FBFAF7" : "#6B7280"}
              fontFamily="JetBrains Mono, monospace"
              onClick={() => onChange(b)}
              className="cursor-pointer select-none"
            >
              {b}
            </text>
          </g>
        );
      })}

      <line x1={r} y1={r} x2={r} y2={pointerY} stroke="#1C1E22" strokeWidth={1.6} strokeLinecap="round" />

      <circle cx={r} cy={r} r={14} fill="#1C1E22" />
      <text
        x={r}
        y={r + 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="#FBFAF7"
        fontFamily="JetBrains Mono, monospace"
      >
        {value ?? "—"}
      </text>
    </svg>
  );
}
