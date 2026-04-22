import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/cn";

type Status = "pending" | "active" | "done";

export function Stage({
  index,
  title,
  status,
  summary,
  children,
}: {
  index: number;
  title: string;
  status: Status;
  summary?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <motion.section
      layout
      transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        "rounded-2xl border bg-canvas-raised",
        status === "active" ? "border-hairline-strong shadow-[0_1px_0_rgba(0,0,0,0.02)]" : "border-hairline",
        status === "pending" && "opacity-60"
      )}
    >
      <header className="flex items-center gap-4 px-6 py-4">
        <div
          className={cn(
            "tabular w-7 h-7 rounded-full grid place-items-center text-[12px] font-medium",
            status === "done" && "bg-accent text-canvas",
            status === "active" && "bg-ink text-canvas",
            status === "pending" && "bg-hairline text-muted"
          )}
        >
          {status === "done" ? (
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
          ) : (
            String(index).padStart(2, "0")
          )}
        </div>

        <h3 className={cn("serif text-[18px] leading-none flex-1", status === "pending" && "text-muted")}>
          {title}
        </h3>

        <AnimatePresence initial={false} mode="popLayout">
          {status === "done" && summary && (
            <motion.div
              key="summary"
              layout
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center gap-3 text-[12.5px] text-muted"
            >
              {summary}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence initial={false}>
        {status === "active" && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-hairline">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
