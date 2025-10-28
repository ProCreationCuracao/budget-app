"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import BudgetRing from "@/components/budget-ring";
import NumericKeypad from "@/components/transactions/numeric-keypad";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Goal = { id: string; name: string; target_amount: number; target_date: string | null };

type Contribution = { id: string; goal_id: string; date: string; amount: number };

export default function GoalsClient({ currency, locale, startOfMonth, initialGoals, initialContribs, initialPeriodTotals }: { currency: string; locale: string; startOfMonth: number; initialGoals?: Goal[]; initialContribs?: Contribution[]; initialPeriodTotals?: Record<string, number> }) {
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [quickAddGoalId, setQuickAddGoalId] = useState<string | null>(null);
  const [quickAmount, setQuickAmount] = useState<string>("");
  const [celebrateGoalId, setCelebrateGoalId] = useState<string | null>(null);
  const [shimmerGoalId, setShimmerGoalId] = useState<string | null>(null);
  const [detailGoalId, setDetailGoalId] = useState<string | null>(null);
  const [whatIfMonthly, setWhatIfMonthly] = useState<number>(0);
  const [whatIfDate, setWhatIfDate] = useState<string>("");

  const goalsQuery = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("id,name,target_amount,target_date")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Goal[]) ?? [];
    },
    initialData: initialGoals as Goal[] | undefined,
  });
  const goals = goalsQuery.data ?? [];

  const contribsQuery = useQuery<Contribution[]>({
    queryKey: ["goal_contributions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_contributions")
        .select("id,goal_id,date,amount")
        .order("date", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data as unknown as Contribution[]) ?? [];
    },
    initialData: initialContribs as Contribution[] | undefined,
  });
  const contribs = contribsQuery.data ?? [];

  // Average monthly contributions for each goal (last 3 months)
  const avgMonthlyByGoal = useMemo(() => {
    const now = new Date();
    const keys: string[] = [];
    for (let m = 2; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const sums = new Map<string, number[]>();
    for (const c of contribs) {
      const d = new Date(String(c.date));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const idx = keys.indexOf(key);
      if (idx === -1) continue;
      const arr = sums.get(c.goal_id) ?? [0, 0, 0];
      arr[idx] += Number(c.amount || 0);
      sums.set(c.goal_id, arr);
    }
    const avg = new Map<string, number>();
    for (const [gid, arr] of sums.entries()) {
      avg.set(gid, (arr[0] + arr[1] + arr[2]) / 3);
    }
    return avg;
  }, [contribs]);

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

  const contribsPeriodQuery = useQuery<Contribution[]>({
    queryKey: ["goal_contributions_period", startStr, nextStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_contributions")
        .select("goal_id,date,amount")
        .gte("date", startStr)
        .lt("date", nextStartStr)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data as any) as Contribution[];
    },
  });

  const totalsByGoal = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contribs) {
      map.set(c.goal_id, (map.get(c.goal_id) ?? 0) + Number(c.amount || 0));
    }
    return map;
  }, [contribs]);

  const periodTotalsByGoal = useMemo(() => {
    if (offset === 0 && contribsPeriodQuery.isLoading && initialPeriodTotals) {
      const m = new Map<string, number>();
      for (const [k, v] of Object.entries(initialPeriodTotals)) m.set(k, Number(v || 0));
      return m;
    }
    const map = new Map<string, number>();
    for (const c of (contribsPeriodQuery.data ?? [])) {
      map.set(c.goal_id, (map.get(c.goal_id) ?? 0) + Number(c.amount || 0));
    }
    return map;
  }, [contribsPeriodQuery.data, contribsPeriodQuery.isLoading, initialPeriodTotals, offset]);

  const createGoal = useMutation({
    mutationFn: async (input: { name: string; target_amount: number; target_date: string | null }) => {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("goals").insert({
        user_id: user.id,
        name: input.name,
        target_amount: input.target_amount,
        target_date: input.target_date,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const addContribution = useMutation({
    mutationFn: async (input: { goal_id: string; date: string; amount: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("goal_contributions").insert({ ...input, user_id: user?.id });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["goal_contributions"] });
      await qc.cancelQueries({ queryKey: ["goal_contributions_period", startStr, nextStartStr] });
      const prevAll = qc.getQueryData<Contribution[]>(["goal_contributions"]) ?? [];
      const optimistic: Contribution = { id: "temp-"+Math.random().toString(36).slice(2), goal_id: input.goal_id, date: input.date, amount: input.amount };
      qc.setQueryData<Contribution[]>(["goal_contributions"], [optimistic, ...prevAll]);
      const prevPeriod = qc.getQueryData<Contribution[]>(["goal_contributions_period", startStr, nextStartStr]) ?? [];
      qc.setQueryData<Contribution[]>(["goal_contributions_period", startStr, nextStartStr], [optimistic, ...prevPeriod]);
      return { prevAll, prevPeriod } as any;
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevAll) qc.setQueryData(["goal_contributions"], ctx.prevAll);
      if (ctx?.prevPeriod) qc.setQueryData(["goal_contributions_period", startStr, nextStartStr], ctx.prevPeriod);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["goal_contributions"] });
      qc.invalidateQueries({ queryKey: ["goal_contributions_period", startStr, nextStartStr] });
    },
  });

  const updateGoal = useMutation({
    mutationFn: async (input: { id: string; name: string; target_amount: number; target_date: string | null }) => {
      const { error } = await supabase
        .from("goals")
        .update({ name: input.name, target_amount: input.target_amount, target_date: input.target_date })
        .eq("id", input.id);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["goals"] });
      const prev = qc.getQueryData<Goal[]>(["goals"]) ?? [];
      const next = prev.map((g) => (g.id === vars.id ? { ...g, name: vars.name, target_amount: vars.target_amount, target_date: vars.target_date } : g));
      qc.setQueryData<Goal[]>(["goals"], next);
      return { prev } as any;
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["goals"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["goals"] });
      const prev = qc.getQueryData<Goal[]>(["goals"]) ?? [];
      qc.setQueryData<Goal[]>(["goals"], prev.filter((g) => g.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => ctx?.prev && qc.setQueryData(["goals"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const [goalForm, setGoalForm] = useState({ name: "", target_amount: "", target_date: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", target_amount: "", target_date: "" });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setOffset((o) => o - 1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2 py-1 text-sm hover:bg-white/80 dark:hover:bg-zinc-900">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-medium">This period</h2>
            <button onClick={() => setOffset((o) => o + 1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2 py-1 text-sm hover:bg-white/80 dark:hover:bg-zinc-900">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="text-xs text-zinc-500">{startStr} – {nextStartStr}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {goals.map((g, idx) => {
            const saved = totalsByGoal.get(g.id) ?? 0;
            const target = Number(g.target_amount || 0);
            const remaining = Math.max(0, target - saved);
            const avg = avgMonthlyByGoal.get(g.id) ?? 0;
            let etaText = "";
            if (avg > 0 && remaining > 0) {
              const months = Math.ceil(remaining / avg);
              const eta = new Date();
              eta.setMonth(eta.getMonth() + months);
              etaText = `ETA ${eta.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}`;
            }
            let trackText = "";
            if (g.target_date) {
              const monthsLeft = Math.max(1, (new Date(g.target_date).getFullYear() - new Date().getFullYear()) * 12 + (new Date(g.target_date).getMonth() - new Date().getMonth()));
              const need = monthsLeft > 0 ? remaining / monthsLeft : remaining;
              trackText = avg >= need ? "On track" : "Behind";
            }
            const daysTo = g.target_date ? Math.max(0, Math.ceil((new Date(String(g.target_date) + 'T00:00:00').getTime() - Date.now()) / (1000*60*60*24))) : null;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: idx * 0.04 }} className="rounded-2xl glass border border-white/10 p-3 flex flex-col items-center relative">
                <div className="absolute right-2 top-2 flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setQuickAddGoalId((id) => id === g.id ? null : g.id); setQuickAmount(""); }}
                    className="rounded-md bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 px-2 py-1 text-[11px]"
                  >Add</button>
                  <button
                    onClick={() => {
                      if (detailGoalId === g.id) { setDetailGoalId(null); return; }
                      setDetailGoalId(g.id);
                      const savedNow = totalsByGoal.get(g.id) ?? 0;
                      const remainingNow = Math.max(0, Number(g.target_amount || 0) - savedNow);
                      const avg = avgMonthlyByGoal.get(g.id) ?? 0;
                      const def = avg > 0 ? avg : Math.max(0, Math.round(remainingNow / 6));
                      setWhatIfMonthly(def);
                      setWhatIfDate(g.target_date || "");
                    }}
                    className="rounded-md bg-white/10 hover:bg-white/15 ring-1 ring-inset ring-white/10 px-2 py-1 text-[11px]"
                  >Details</button>
                </div>
                <AnimatePresence initial={false}>
                  {celebrateGoalId === g.id ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      {[...Array(8)].map((_, i) => (
                        <motion.span
                          key={i}
                          initial={{ y: 6, opacity: 0, scale: 0.8 }}
                          animate={{ y: -24 - i * 4, opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.8, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] as any }}
                          className="absolute text-lg"
                          style={{ left: `${12.5 * i}%` }}
                          aria-hidden
                        >🎉</motion.span>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <div aria-label={`Goal ${g.name}, ${Math.round((saved/Math.max(1,target))*100)}% complete, ${remaining.toLocaleString()} remaining`} className="w-full flex flex-col items-center">
                  <BudgetRing label={g.name} spent={saved} budget={target} currency={currency} locale={locale} shimmer={shimmerGoalId === g.id} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-500 w-full">
                  <div>
                    <div className="uppercase tracking-wider text-[10px]">Target</div>
                    <div className="text-zinc-300">{formatCurrency(target, currency, locale, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="text-right">
                    <div className="uppercase tracking-wider text-[10px]">Left</div>
                    <div className="text-zinc-300">{formatCurrency(remaining, currency, locale, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div>
                    <div className="uppercase tracking-wider text-[10px]">Target date</div>
                    <div className="text-zinc-300">{g.target_date || "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="uppercase tracking-wider text-[10px]">Days</div>
                    <div className="text-zinc-300">{daysTo != null ? `${daysTo}d` : "—"}</div>
                  </div>
                </div>
                {trackText ? (
                  <div className={"mt-1 text-[10px] px-2 py-0.5 rounded-full " + (trackText === 'On track' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>
                    {trackText}
                  </div>
                ) : null}
                <AnimatePresence initial={false}>
                  {quickAddGoalId === g.id ? (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 w-full rounded-md border border-zinc-200/60 dark:border-zinc-800 p-2 bg-white/60 dark:bg-zinc-900/60">
                      <div className="text-xs mb-1">Add to savings</div>
                      <NumericKeypad value={quickAmount} onChange={setQuickAmount} />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button onClick={() => { setQuickAddGoalId(null); setQuickAmount(""); }} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs">Cancel</button>
                        <button
                          onClick={() => {
                            const amt = Number(quickAmount || 0);
                            if (!isFinite(amt) || amt <= 0) return;
                            const today = new Date().toISOString().slice(0,10);
                            addContribution.mutate({ goal_id: g.id, amount: amt, date: today });
                            if (saved < target && saved + amt >= target) {
                              setCelebrateGoalId(g.id);
                              window.setTimeout(() => setCelebrateGoalId(null), 1500);
                            }
                            setShimmerGoalId(g.id);
                            window.setTimeout(() => setShimmerGoalId(null), 1000);
                            setQuickAddGoalId(null);
                            setQuickAmount("");
                          }}
                          className="rounded-md bg-zinc-900 text-white dark:bg-white dark:text-black px-3 py-1.5 text-xs"
                        >Save</button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {detailGoalId === g.id ? (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 w-full rounded-md border border-zinc-200/60 dark:border-zinc-800 p-2 bg-white/60 dark:bg-zinc-900/60">
                      <div className="text-xs font-medium mb-2">Projection</div>
                      <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={(function(){
                            const points: { x: string; y: number }[] = [];
                            let acc = saved;
                            const targetAmt = target;
                            let d = new Date();
                            for (let i=0;i<24 && acc < targetAmt;i++) {
                              const label = d.toLocaleDateString(locale, { month: 'short' });
                              points.push({ x: label, y: acc });
                              acc += Math.max(0, whatIfMonthly);
                              d.setMonth(d.getMonth()+1);
                            }
                            points.push({ x: d.toLocaleDateString(locale, { month: 'short' }), y: Math.min(acc, targetAmt) });
                            return points;
                          })()} margin={{ left: 6, right: 6, bottom: 6, top: 6 }}>
                            <XAxis dataKey="x" hide tickLine={false} axisLine={false} interval={2} />
                            <YAxis hide domain={[0, Math.max(target, saved)]} />
                            <Tooltip formatter={(v: any) => formatCurrency(Number(v||0), currency, locale)} labelFormatter={() => ""} />
                            <ReferenceLine y={target} stroke="currentColor" strokeOpacity={0.2} />
                            <Line type="monotone" dataKey="y" stroke="currentColor" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="text-xs">
                          <div className="text-[10px] uppercase tracking-wider mb-1">Monthly contribution</div>
                          <input type="range" min={0} max={Math.max(100, Math.round(Math.max(0, target - saved)))} value={whatIfMonthly} onChange={(e) => setWhatIfMonthly(Number(e.target.value || 0))} className="w-full" />
                          <div className="text-[11px] text-zinc-500">{formatCurrency(whatIfMonthly, currency, locale)}</div>
                        </label>
                        <label className="text-xs">
                          <div className="text-[10px] uppercase tracking-wider mb-1">Target date</div>
                          <input type="date" value={whatIfDate} onChange={(e) => {
                            const next = e.target.value;
                            setWhatIfDate(next);
                            if (next) {
                              const months = Math.max(1, (new Date(next).getFullYear() - new Date().getFullYear()) * 12 + (new Date(next).getMonth() - new Date().getMonth()));
                              const remain = Math.max(0, target - saved);
                              setWhatIfMonthly(Math.round(remain / months));
                            }
                          }} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1" />
                        </label>
                      </div>
                      <div className="mt-3">
                        <div className="text-xs font-medium mb-1">History</div>
                        <div className="max-h-28 overflow-auto divide-y divide-zinc-200/60 dark:divide-zinc-800 rounded-md border border-zinc-200/60 dark:border-zinc-800">
                          {(() => {
                            const list = (contribs || []).filter((c) => c.goal_id === g.id).slice(0, 8);
                            if (!list.length) return <div className="px-2 py-2 text-xs text-zinc-500">No contributions yet</div>;
                            return list.map((c) => (
                              <div key={c.id} className="px-2 py-1.5 text-xs flex items-center justify-between">
                                <span className="text-zinc-500">{c.date}</span>
                                <span className="font-medium">{formatCurrency(Number(c.amount || 0), currency, locale)}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
        {goals.length === 0 ? (
          <div className="col-span-2 text-sm text-zinc-500">No goals yet — add one below.</div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-4">
        <div className="text-sm font-medium mb-3">Create Goal</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            placeholder="Name"
            value={goalForm.name}
            onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Target Amount"
            value={goalForm.target_amount}
            onChange={(e) => setGoalForm((f) => ({ ...f, target_amount: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          />
          <input
            type="date"
            value={goalForm.target_date}
            onChange={(e) => setGoalForm((f) => ({ ...f, target_date: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          />
          <button
            onClick={() => {
              createGoal.mutate({
                name: goalForm.name,
                target_amount: Number(goalForm.target_amount || 0),
                target_date: goalForm.target_date || null,
              });
              setGoalForm({ name: "", target_amount: "", target_date: "" });
            }}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black")}
          >
            Add goal
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr className="text-left">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 text-right">Saved</th>
              <th className="px-3 py-2 text-right">Target</th>
              <th className="px-3 py-2">Target date</th>
              <th className="px-3 py-2 w-40">Add contribution</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {goals.map((g) => {
              const saved = totalsByGoal.get(g.id) ?? 0;
              const periodSaved = periodTotalsByGoal.get(g.id) ?? 0;
              return (
                <tr key={g.id} className="border-t border-zinc-200/60 dark:border-zinc-800">
                  <td className="px-3 py-2">
                    {editingId === g.id ? (
                      <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                    ) : (
                      g.name
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(saved, currency, locale)}
                    <div className="text-[10px] text-zinc-500">{formatCurrency(periodSaved, currency, locale)} this period</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editingId === g.id ? (
                      <input type="number" inputMode="decimal" value={editForm.target_amount} onChange={(e) => setEditForm((f) => ({ ...f, target_amount: e.target.value }))} className="w-28 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                    ) : (
                      formatCurrency(Number(g.target_amount || 0), currency, locale)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === g.id ? (
                      <input type="date" value={editForm.target_date} onChange={(e) => setEditForm((f) => ({ ...f, target_date: e.target.value }))} className="w-36 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                    ) : (
                      g.target_date ?? "-"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <InlineContribForm
                      onAdd={(amount, date) => addContribution.mutate({ goal_id: g.id, amount, date })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {saved >= Number(g.target_amount || 0) ? (
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px]">Completed</span>
                      ) : null}
                      {editingId === g.id ? (
                        <>
                          <button
                            onClick={() => {
                              updateGoal.mutate({ id: g.id, name: editForm.name, target_amount: Number(editForm.target_amount || 0), target_date: editForm.target_date || null });
                              setEditingId(null);
                            }}
                            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(g.id); setEditForm({ name: g.name, target_amount: String(g.target_amount ?? ""), target_date: g.target_date ?? "" }); }}
                            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteGoal.mutate(g.id)}
                            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {goals.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">No goals yet</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InlineContribForm({ onAdd }: { onAdd: (amount: number, date: string) => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const can = amount && date;
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-28 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-36 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
      />
      <button
        disabled={!can}
        onClick={() => onAdd(Number(amount || 0), date)}
        className={cn(
          "rounded-md px-2 py-1 text-xs font-medium",
          can ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed"
        )}
      >
        Add
      </button>
    </div>
  );
}
