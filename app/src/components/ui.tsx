import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-canvas-raised rounded-2xl border border-hairline", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {eyebrow && (
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted">{eyebrow}</div>
      )}
      <h2 className="serif text-[28px] leading-[1.1] text-ink">{title}</h2>
      {sub && <p className="text-[14px] text-muted max-w-[60ch] leading-relaxed">{sub}</p>}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cn(
        "press inline-flex items-center justify-center gap-2 rounded-full font-medium",
        "transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
        size === "sm" ? "px-3 h-8 text-[12.5px]" : "px-4 h-10 text-[13.5px]",
        variant === "primary" &&
          "bg-ink text-canvas hover:bg-ink-soft",
        variant === "ghost" &&
          "bg-canvas-raised text-ink border border-hairline hover:border-hairline-strong",
        variant === "quiet" &&
          "bg-transparent text-muted hover:text-ink",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Pill({ tone = "muted", children }: { tone?: "muted" | "accent" | "signal" | "lattice"; children: ReactNode }) {
  const tones = {
    muted: "bg-hairline/60 text-ink-soft",
    accent: "bg-accent-wash text-accent border border-accent-soft/60",
    signal: "bg-signal-wash text-signal border border-signal-soft/60",
    lattice: "bg-lattice-soft/40 text-ink-soft",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-[11px] font-medium tracking-wide", tones[tone])}>
      {children}
    </span>
  );
}
