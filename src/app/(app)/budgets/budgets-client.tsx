"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import BudgetRing from "@/components/budget-ring";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildFxConverter } from "@/lib/fx";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Sparkline from "@/components/sparkline";
import { showToast } from "@/components/toast";

type Budget = { id: string; name: string; amount: number; category_id: string | null; categories?: { name?: string } | null };

type Category = { id: string; name: string; type: "income" | "expense" };

export default function BudgetsClient({ currency, locale, startOfMonth, initialBudgets, initialSpent }: { currency: string; locale: string; startOfMonth: number; initialBudgets?: Budget[]; initialSpent?: Record<string, number> }) {
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const reduceMotion = useReducedMotion();
  const [comparePrev, setComparePrev] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [frozen, setFrozen] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem("budgets-frozen");
      if (raw) setFrozen(new Set(JSON.parse(raw)));
    } catch {}
  }, []);
  function persistFrozen(next: Set<string>) {
    setFrozen(new Set(next));
    try { localStorage.setItem("budgets-frozen", JSON.stringify(Array.from(next))); } catch {}
  }
  const fxRatesQ = useQuery<any[]>({
    queryKey: ["fx_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fx_rates")
        .select("date,from_currency,to_currency,rate");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const convertFx = useMemo(() => buildFxConverter((fxRatesQ.data || []) as any), [fxRatesQ.data]);
  const conv = useMemo(() => (amount: number, from: string | null | undefined, dateISO: string) => {
    const src = (from || currency).toUpperCase();
    const v = convertFx(amount, src, currency, dateISO);
    return v == null ? (src === currency ? amount : 0) : v;
  }, [convertFx, currency]);

  const { data: profileScopeRow } = useQuery<{ scope?: string }>({
    queryKey: ["profile", "scope"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {} as any;
      const { data, error } = await supabase.from("profiles").select("scope").eq("id", user.id).single();
      if (error) throw error;
      return (data as any) || {};
    },
    staleTime: 60_000,
  });
  const currentScope = (profileScopeRow?.scope as string | undefined) ?? "Personal";

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories", "expense", currentScope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,type")
        .eq("scope", currentScope)
        .eq("type", "expense")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const budgetQuery = useQuery<Budget[]>({
    queryKey: ["budgets", currentScope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("id,name,amount,category_id,categories:category_id(name)")
        .eq("scope", currentScope)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Budget[]) ?? [];
    },
    initialData: initialBudgets as Budget[] | undefined,
  });
  const budgets = budgetQuery.data ?? [];

  const { startStr, nextStartStr } = useMemo(() => {
    const now = new Date();
    const som = Math.min(Math.max(startOfMonth ?? 1, 1), 28);
    const currentSomDate = new Date(now.getFullYear(), now.getMonth(), som);
    const baseStart = now >= currentSomDate ? currentSomDate : new Date(now.getFullYear(), now.getMonth() - 1, som);
    const periodStart = new Date(baseStart.getFullYear(), baseStart.getMonth() + offset, som);
    const nextPeriodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, som);
    return {
      startStr: periodStart.toISOString().slice(0, 10),
      nextStartStr: nextPeriodStart.toISOString().slice(0, 10),
    };
  }, [startOfMonth, offset]);

  const periodStart = useMemo(() => new Date(startStr + "T00:00:00"), [startStr]);
  const periodEnd = useMemo(() => new Date(nextStartStr + "T00:00:00"), [nextStartStr]);
  const periodLabel = useMemo(() => new Date(startStr + "T00:00:00").toLocaleDateString(locale || "en-US", { month: "short", year: "numeric" }), [startStr, locale]);

  const { prevStartStr, prevEndStr } = useMemo(() => {
    const s = new Date(startStr + "T00:00:00");
    const prevStart = new Date(s.getFullYear(), s.getMonth() - 1, s.getDate());
    const prevEnd = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    return { prevStartStr: prevStart.toISOString().slice(0, 10), prevEndStr: prevEnd.toISOString().slice(0, 10) };
  }, [startStr]);

  const txsQuery = useQuery<any[]>({
    queryKey: ["period-expenses", currentScope, startStr, nextStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, type, date, category_id, currency")
        .eq("scope", currentScope)
        .eq("type", "expense")
        .gte("date", startStr)
        .lt("date", nextStartStr);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const txs = txsQuery.data ?? [];

  const prevTxsQuery = useQuery<any[]>({
    queryKey: ["period-expenses-prev", currentScope, prevStartStr, prevEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, type, date, category_id, currency")
        .eq("scope", currentScope)
        .eq("type", "expense")
        .gte("date", prevStartStr)
        .lt("date", prevEndStr);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const prevTxs = prevTxsQuery.data ?? [];

  const spentByCat = useMemo(() => {
    if (offset === 0 && (!txsQuery.data || txsQuery.isLoading) && initialSpent) {
      const m = new Map<string, number>();
      for (const [k, v] of Object.entries(initialSpent)) m.set(k, Number(v || 0));
      return m;
    }
    const m = new Map<string, number>();
    for (const t of txs || []) {
      const cid = (t as any).category_id as string | null;
      if (!cid) continue;
      m.set(cid, (m.get(cid) ?? 0) + conv(Number((t as any).amount || 0), (t as any).currency, String((t as any).date)));
    }
    return m;
  }, [txs, offset, initialSpent, txsQuery.isLoading, txsQuery.data, conv]);

  const spentByCatPrev = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of prevTxs || []) {
      const cid = (t as any).category_id as string | null;
      if (!cid) continue;
      m.set(cid, (m.get(cid) ?? 0) + conv(Number((t as any).amount || 0), (t as any).currency, String((t as any).date)));
    }
    return m;
  }, [prevTxs, conv]);

  const containerVar = useMemo(() => ({
    hidden: {},
    show: { transition: reduceMotion ? {} : { staggerChildren: 0.04 } },
  }), [reduceMotion]);
  const itemVar = useMemo(() => ({
    hidden: { opacity: 0, y: reduceMotion ? 0 : 8 },
    show: { opacity: 1, y: 0 },
  }), [reduceMotion]);

  const adjustMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const curr = qc.getQueryData<Budget[]>(["budgets", currentScope]) || [];
      const updates = curr.filter((b) => ids.includes(b.id)).map((b) => ({ id: b.id, amount: Math.round(Number(b.amount || 0) * 1.1) }));
      for (const u of updates) {
        const { error } = await supabase.from("budgets").update({ amount: u.amount }).eq("id", u.id);
        if (error) throw error;
      }
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["budgets", currentScope] });
      const prev = qc.getQueryData<Budget[]>(["budgets", currentScope]) || [];
      const next = prev.map((b) => ids.includes(b.id) ? { ...b, amount: Math.round(Number(b.amount || 0) * 1.1) } : b);
      qc.setQueryData(["budgets", currentScope], next);
      showToast("Budgets adjusted +10%", "success");
      return { prev } as any;
    },
    onError: (_e, _ids, ctx) => ctx?.prev && qc.setQueryData(["budgets", currentScope], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["budgets", currentScope] }),
  });

  const moveUnusedMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const curr = qc.getQueryData<Budget[]>(["budgets", currentScope]) || [];
      const map = new Map(curr.map((b) => [b.id, b] as const));
      let total = 0;
      for (const id of ids) {
        const b = map.get(id); if (!b) continue;
        const spent = spentByCat.get(b.category_id as any) ?? 0;
        total += Math.max(0, Number(b.amount || 0) - spent);
      }
      if (total <= 0) return;
      const existing = curr.find((b) => (b.name || "").toLowerCase() === "savings");
      if (existing) {
        const { error } = await supabase.from("budgets").update({ amount: Number(existing.amount || 0) + total }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await supabase.from("budgets").insert({ user_id: user?.id, name: "Savings", amount: total, category_id: null, scope: currentScope });
      }
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["budgets", currentScope] });
      const prev = qc.getQueryData<Budget[]>(["budgets", currentScope]) || [];
      let total = 0;
      for (const b of prev) {
        if (!ids.includes(b.id)) continue;
        const spent = spentByCat.get(b.category_id as any) ?? 0;
        total += Math.max(0, Number(b.amount || 0) - spent);
      }
      let next = prev.slice();
      const idx = next.findIndex((b) => (b.name || "").toLowerCase() === "savings");
      if (total > 0) {
        if (idx >= 0) next[idx] = { ...next[idx], amount: Number(next[idx].amount || 0) + total } as any;
        else next = [{ id: "temp_savings", name: "Savings", amount: total, category_id: null } as any, ...next];
      }
      qc.setQueryData(["budgets", currentScope], next);
      showToast(total > 0 ? `Moved ${formatCurrency(total, currency, locale)} to Savings` : "No unused to move");
      return { prev } as any;
    },
    onError: (_e, _ids, ctx) => ctx?.prev && qc.setQueryData(["budgets", currentScope], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["budgets", currentScope] }),
  });

  const insertMutation = useMutation({
    mutationFn: async (input: { name: string; amount: number; category_id: string | null }) => {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("budgets").insert({
        user_id: user.id,
        name: input.name,
        amount: input.amount,
        category_id: input.category_id,
        scope: currentScope,
      });
      if (error) throw error;
    },
    onSuccess: () => { showToast("Budget created", "success"); },
    onError: (e: any) => { showToast(e?.message || "Failed to create budget"); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["budgets", currentScope] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["budgets", currentScope] });
      const prev = qc.getQueryData<Budget[]>(["budgets", currentScope]) ?? [];
      qc.setQueryData<Budget[]>(["budgets", currentScope], prev.filter((b) => b.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => ctx?.prev && qc.setQueryData(["budgets", currentScope], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["budgets", currentScope] }),
  });

  const [form, setForm] = useState({ name: "", amount: "", category_id: "" });
  const canSubmit = form.name && form.amount && !insertMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-4">
        <div className="text-sm font-medium mb-3">Add Budget</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          />
          <select
            value={form.category_id}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          >
            <option value="">Uncategorized</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            disabled={!canSubmit}
            onClick={() => {
              insertMutation.mutate({
                name: form.name,
                amount: Number(form.amount || 0),
                category_id: form.category_id || null,
              });
              setForm({ name: "", amount: "", category_id: "" });
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              canSubmit ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            Add budget
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setOffset((o) => o - 1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2 py-1 text-sm hover:bg-white/80 dark:hover:bg-zinc-900" aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-medium">{periodLabel}</h2>
            <button onClick={() => setOffset((o) => o + 1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2 py-1 text-sm hover:bg-white/80 dark:hover:bg-zinc-900" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-zinc-500">{startStr} – {nextStartStr}</div>
            <label className="text-xs text-zinc-600 dark:text-zinc-400 inline-flex items-center gap-2">
              <input type="checkbox" checked={comparePrev} onChange={(e) => setComparePrev(e.target.checked)} /> vs last month
            </label>
          </div>
        </div>
        {selected.size > 0 ? (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800 px-2 py-1 text-xs">
            <div className="font-medium">{selected.size} selected</div>
            <button onClick={() => { const next = new Set(frozen); for (const id of selected) next.add(id); persistFrozen(next); showToast("Frozen selected"); }} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-900">Freeze</button>
            <button onClick={() => adjustMutation.mutate(Array.from(selected))} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-900">+10% adjust</button>
            <button onClick={() => moveUnusedMutation.mutate(Array.from(selected))} className="rounded border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-900">Move unused → Savings</button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-zinc-600 hover:underline">Clear</button>
          </div>
        ) : null}
        <motion.div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" variants={containerVar as any} initial="hidden" animate="show">
          {budgets.map((b) => {
            const curr = spentByCat.get(b.category_id as any) ?? 0;
            const prev = spentByCatPrev.get(b.category_id as any) ?? 0;
            const delta = curr - prev;
            const rollover = Math.max(0, Number(b.amount || 0) - prev);
            const daysElapsed = Math.max(1, Math.floor((Math.min(Date.now(), periodEnd.getTime()) - periodStart.getTime()) / (1000*60*60*24)));
            const daysTotal = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000*60*60*24)));
            const daysLeft = Math.max(0, daysTotal - daysElapsed);
            const pace = curr / daysElapsed;
            const remaining = Math.max(0, Number(b.amount || 0) - curr);
            const tooltip = `Remaining ${formatCurrency(remaining, currency, locale)}, ${daysLeft} days left, pace ${formatCurrency(pace, currency, locale)}/d`;
            const isFrozen = frozen.has(b.id);
            const isOpen = openId === b.id;
            return (
              <motion.div key={b.id} variants={itemVar as any} className={cn("flex flex-col rounded-md border border-zinc-200/60 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40", isOpen && "shadow-lg")}
                tabIndex={0}
                role="button"
                aria-expanded={isOpen}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(isOpen ? null : b.id); } }}
              >
                <div className="relative flex flex-col items-center p-2" onClick={() => setOpenId(isOpen ? null : b.id)} title={tooltip}>
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <input type="checkbox" aria-label="Select budget" checked={selected.has(b.id)} onChange={(e) => {
                      setSelected((prev) => { const next = new Set(prev); if (e.target.checked) next.add(b.id); else next.delete(b.id); return next; });
                    }} />
                    {isFrozen ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600">Frozen</span> : null}
                  </div>
                  <BudgetRing label={b.name} spent={curr} budget={Number(b.amount || 0)} currency={currency} locale={locale} />
                  {rollover > 0 ? (
                    <div className="mt-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Rollover +{formatCurrency(rollover, currency, locale, { maximumFractionDigits: 0 })}</div>
                  ) : null}
                  {comparePrev ? (
                    <div className={"mt-1 text-[10px] " + (delta <= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {delta <= 0 ? "−" : "+"}{formatCurrency(Math.abs(delta), currency, locale, { maximumFractionDigits: 0 })} vs prev
                    </div>
                  ) : null}
                </div>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={reduceMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
                      animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] as any }}
                      className="px-2 pb-2"
                    >
                      {(() => {
                        const catId = b.category_id as string | null;
                        const recents = (txs || []).filter((t: any) => (t.category_id || null) === catId).slice().sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
                        const days = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000*60*60*24)));
                        const series = Array.from({ length: days }, (_, i) => 0);
                        for (const t of (txs || [])) {
                          if ((t as any).category_id !== catId) continue;
                          const d = new Date(String((t as any).date) + "T00:00:00");
                          const idx = Math.floor((d.getTime() - periodStart.getTime()) / (1000*60*60*24));
                          if (idx >= 0 && idx < days) series[idx] += conv(Number((t as any).amount || 0), (t as any).currency, String((t as any).date));
                        }
                        const variance = Number(b.amount || 0) - curr;
                        return (
                          <div className="rounded-md bg-white/60 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800 p-2">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-medium">Details</div>
                              <motion.div initial={{ x: 8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.14 }} className={cn("text-[10px] px-2 py-0.5 rounded-full", variance >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                                {variance >= 0 ? `Remaining ${formatCurrency(variance, currency, locale, { maximumFractionDigits: 0 })}` : `Over by ${formatCurrency(Math.abs(variance), currency, locale, { maximumFractionDigits: 0 })}`}
                              </motion.div>
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <div className="text-[11px] text-zinc-500 mb-1">Trend</div>
                                <Sparkline data={series} className="h-12" stroke={variance >= 0 ? "#10b981" : "#ef4444"} />
                              </div>
                              <div>
                                <div className="text-[11px] text-zinc-500 mb-1">Recent</div>
                                <div className="space-y-1">
                                  {recents.length === 0 ? <div className="text-xs text-zinc-500">No transactions</div> : recents.map((t: any) => (
                                    <div key={t.date + String(t.amount)} className="flex items-center justify-between text-xs">
                                      <div className="truncate max-w-[60%]">{t.date}</div>
                                      <div className="tabular">{formatCurrency(conv(Number(t.amount || 0), t.currency, String(t.date)), currency, locale)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
          {budgets.length === 0 ? (
            <div className="col-span-2 text-sm text-zinc-500">No budgets yet — add one above.</div>
          ) : null}
        </motion.div>
      </div>

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr className="text-left">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => (
              <tr key={b.id} className="border-t border-zinc-200/60 dark:border-zinc-800">
                <td className="px-3 py-2">{b.name}</td>
                <td className="px-3 py-2">{b.categories?.name ?? "-"}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(b.amount || 0), currency, locale)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => deleteMutation.mutate(b.id)}
                    className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    title="Delete"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {budgets.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">No budgets yet</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
