"use client";

import { WalletMinimal, CreditCard, Banknote, Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export type AccountType = "cash" | "bank" | "credit_card" | "wallet";

export default function AccountCard({
  name,
  type,
  color,
  icon,
  balance,
  currency,
  locale,
  trend,
  reorderMode,
  onMoveLeft,
  onMoveRight,
}: {
  name: string;
  type: AccountType;
  color?: string | null;
  icon?: string | null;
  balance: number;
  currency: string;
  locale: string;
  trend?: number[];
  reorderMode?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}) {
  const TypeIcon = type === "credit_card" ? CreditCard : type === "bank" ? Banknote : type === "wallet" ? WalletMinimal : Coins;
  const stroke = color || undefined;
  return (
    <div className="relative min-w-[220px] rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-3 soft-shadow transition-transform duration-150 hover:-translate-y-0.5 focus-within:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset ring-black/10 dark:ring-white/10" style={stroke ? { color: stroke } : undefined}>
            <TypeIcon className="h-4 w-4" />
          </span>
          <div className="text-sm font-medium truncate max-w-[140px]" title={name}>{name}</div>
        </div>
      </div>
      <div className="mt-2 text-lg font-semibold tabular">{formatCurrency(balance, currency, locale)}</div>
      {Array.isArray(trend) && trend.length > 0 ? (
        <div className="mt-2 h-8 w-full overflow-hidden rounded-md bg-black/5 dark:bg-white/5">
          <SparklineInline data={trend} />
        </div>
      ) : null}
      {reorderMode ? (
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <button aria-label="Move left" onClick={onMoveLeft} className="rounded-md ring-1 ring-inset ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-zinc-900/60 p-1">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button aria-label="Move right" onClick={onMoveRight} className="rounded-md ring-1 ring-inset ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-zinc-900/60 p-1">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SparklineInline({ data }: { data: number[] }) {
  // Minimal inline sparkline (no deps)
  const max = Math.max(1, ...data.map((v) => Math.abs(v)));
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * 100;
    const y = 100 - ((v + max) / (2 * max)) * 100;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <polyline fill="none" stroke="hsl(var(--accent))" strokeWidth="2" points={pts} />
    </svg>
  );
}
