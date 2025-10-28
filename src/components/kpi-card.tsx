"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import AnimatedNumber from "@/components/animated-number";
import { formatCurrency, formatPercent } from "@/lib/format";

export function KpiCard({
  title,
  value,
  subtitle,
  iconKind,
  delta,
  deltaClassName,
  className,
  children,
  animatedValue,
  formatKind,
  currency,
  locale,
}: {
  title: string;
  value: string;
  subtitle?: string;
  iconKind?: "income" | "spend" | "net" | "savings";
  delta?: string;
  deltaClassName?: string;
  className?: string;
  children?: ReactNode;
  animatedValue?: number;
  formatKind?: "currency" | "percent";
  currency?: string;
  locale?: string;
}) {
  const prevRef = useRef<number | null>(null);
  const [glow, setGlow] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (animatedValue == null) return;
    const prev = prevRef.current;
    prevRef.current = animatedValue;
    if (prev == null) return;
    if (animatedValue > prev) {
      setGlow(true);
      const id = setTimeout(() => setGlow(false), 320);
      return () => clearTimeout(id);
    }
  }, [animatedValue]);
  const numberFormatter = useMemo(() => {
    if (formatKind === "currency") {
      return (n: number) => formatCurrency(n, currency || "USD", locale || "en-US");
    }
    if (formatKind === "percent") {
      return (n: number) => formatPercent(n, locale || "en-US");
    }
    return (n: number) => String(n);
  }, [formatKind, currency, locale]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">{title}</div>
        {iconKind ? (
          <div className="h-8 w-8 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center text-zinc-700 dark:text-zinc-200">
            {iconKind === "income" ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : iconKind === "spend" ? (
              <ArrowDownRight className="h-4 w-4" />
            ) : iconKind === "net" ? (
              <Wallet className="h-4 w-4" />
            ) : (
              <PiggyBank className="h-4 w-4" />
            )}
          </div>
        ) : null}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tracking-tight tabular", glow ? "ring-2 ring-[hsl(var(--accent)/0.35)] rounded-md" : "")}>
        {mounted && animatedValue != null && formatKind ? (
          <AnimatedNumber value={animatedValue} format={numberFormatter} />
        ) : (
          value
        )}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {delta ? (
          <span className={cn("text-xs font-medium", deltaClassName)}>{delta}</span>
        ) : null}
        {subtitle ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>
        ) : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </motion.div>
  );
}
