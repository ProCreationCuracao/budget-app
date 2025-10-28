"use client";

import { motion } from "framer-motion";
import { ringSweep } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export default function BudgetRing({
  label,
  spent,
  budget,
  className,
  currency,
  locale,
  shimmer,
}: {
  label: string;
  spent: number;
  budget: number;
  className?: string;
  currency?: string;
  locale?: string;
  shimmer?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (spent / Math.max(1, budget)) * 100));
  const near = pct >= 80 && pct < 100;
  const over = pct >= 100;
  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <div className="relative" style={{ width: 88, height: 88 }}>
        <motion.div
        className={cn("ring", (near || over) ? "ring-pulse" : undefined, over ? "[--primary:350_85%_55%]" : undefined)}
        style={{ width: 88, height: 88, ['--ring-glow' as any]: (near ? 0.35 : over ? 0.45 : 0.2) } as any}
        initial={ringSweep.initial}
        animate={ringSweep.animate(pct)}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] as any }}
        />
        {shimmer ? (
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] as any }}
          >
            <motion.div
              initial={{ x: -60 }}
              animate={{ x: 148 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] as any }}
              className="absolute top-1/2 -translate-y-1/2 h-8 w-16 bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full blur-md mix-blend-screen"
            />
          </motion.div>
        ) : null}
      </div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 max-w-[88px] text-center truncate" title={label}>{label}</div>
      <div className="text-sm font-medium tabular">
        {formatCurrency(spent, currency || "USD", locale || "en-US", { maximumFractionDigits: 0 })} / {formatCurrency(budget, currency || "USD", locale || "en-US", { maximumFractionDigits: 0 })}
      </div>
      <div className={cn("mt-1 text-[10px] px-2 py-0.5 rounded-full", over ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600")}> 
        {over
          ? `Over by ${formatCurrency(Math.max(0, spent - budget), currency || "USD", locale || "en-US", { maximumFractionDigits: 0 })}`
          : `Remaining ${formatCurrency(Math.max(0, budget - spent), currency || "USD", locale || "en-US", { maximumFractionDigits: 0 })}`}
      </div>
      {near && !over ? (
        <div className="mt-1 text-[10px] text-amber-500">Near limit</div>
      ) : null}
      {over ? (
        <div className="mt-1 text-[10px] text-rose-500">Over budget</div>
      ) : null}
    </div>
  );
}
