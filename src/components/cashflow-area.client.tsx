"use client";

import dynamic from "next/dynamic";

const CashflowArea = dynamic(() => import("@/components/cashflow-area"), {
  ssr: false,
  loading: () => (
    <div className="h-48 sm:h-64 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 animate-pulse" />
  ),
});

export default function CashflowAreaClient(props: any) {
  return <CashflowArea {...props} />;
}
