"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { showToast } from "@/components/toast";
import { buildFxConverter } from "@/lib/fx";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LogoAvatar from "@/components/logo-avatar";

type Interval = "day" | "week" | "month" | "year";

type Subscription = {
  id: string;
  name: string;
  amount: number;
  interval: Interval;
  every: number;
  next_charge_date: string;
  account_id: string | null;
  category_id: string | null;
  active: boolean;
  auto_post?: boolean;
  logo_url?: string | null;
  merchant?: string | null;
  accounts?: { name?: string; currency?: string } | null;
  categories?: { name?: string } | null;
};

type Account = { id: string; name: string; currency?: string };

type Category = { id: string; name: string };

function deriveDomain(name: string) {
  const key = String(name || "").toLowerCase();
  const map: Record<string, string> = { netflix: "netflix.com", spotify: "spotify.com", apple: "apple.com", amazon: "amazon.com", adobe: "adobe.com", google: "google.com", microsoft: "microsoft.com", github: "github.com", dropbox: "dropbox.com", slack: "slack.com", notion: "notion.so", atlassian: "atlassian.com", figma: "figma.com", openai: "openai.com" };
  for (const k of Object.keys(map)) { if (key.includes(k)) return map[k]; }
  const safe = key.replace(/[^a-z0-9]/g, "");
  return safe ? `${safe}.com` : "";
}

export default function SubscriptionsClient({ currency, locale, startOfMonth, initialSubs }: { currency: string; locale: string; startOfMonth: number; initialSubs?: Subscription[] }) {
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);

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
  const { data: profileDualRow } = useQuery<{ show_dual_currency?: boolean }>({
    queryKey: ["profile", "dual"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {} as any;
      const { data, error } = await supabase.from("profiles").select("show_dual_currency").eq("id", user.id).single();
      if (error) throw error;
      return (data as any) || {};
    },
    staleTime: 60_000,
  });
  const showDual = !!profileDualRow?.show_dual_currency;
  const [dualOverride, setDualOverride] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dual-display");
      if (raw === "1") setDualOverride(true);
      else if (raw === "0") setDualOverride(false);
    } catch {}
  }, []);
  const showDualEffective = (dualOverride ?? showDual);

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["accounts", currentScope],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("accounts").select("id,name,currency").eq("scope", currentScope).order("name");
        if (error) throw error;
        return data ?? [];
      } catch (_e) {
        const { data, error } = await supabase.from("accounts").select("id,name,currency").order("name");
        if (error) throw error;
        return data ?? [];
      }
    },
    staleTime: 60_000,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories", "expense", currentScope],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("id,name")
          .eq("scope", currentScope)
          .eq("type", "expense")
          .order("name");
        if (error) throw error;
        return data ?? [];
      } catch (_e) {
        const { data, error } = await supabase
          .from("categories")
          .select("id,name")
          .eq("type", "expense")
          .order("name");
        if (error) throw error;
        return data ?? [];
      }
    },
    staleTime: 60_000,
  });

  const subsQuery = useQuery<Subscription[]>({
    queryKey: ["subscriptions", currentScope],
    queryFn: async () => {
      const baseSelect = "id,name,amount,interval,every,next_charge_date,account_id,category_id,active,auto_post,logo_url,merchant";
      // Try modern shape first (with scope + next_charge_date)
      try {
        const { data, error } = await supabase
          .from("subscriptions")
          .select(baseSelect)
          .eq("scope", currentScope)
          .order("next_charge_date", { ascending: true });
        if (error) throw error;
        return (data as any) ?? [];
      } catch (_err1: any) {
        // Retry without scope filter (older DBs)
        try {
          const { data, error } = await supabase
            .from("subscriptions")
            .select(baseSelect)
            .order("next_charge_date", { ascending: true });
          if (error) throw error;
          return (data as any) ?? [];
        } catch (_err2: any) {
          // Legacy fallback: frequency/next_due
          const { data, error } = await supabase
            .from("subscriptions")
            .select("id,name,amount,frequency,next_due,account_id,category_id,logo_url,merchant")
            .order("next_due", { ascending: true });
          if (error) throw error;
          const rows = (data as any[]) || [];
          const mapped: Subscription[] = rows.map((r) => {
            const freq: string = (r.frequency || "monthly").toString();
            const mapping: Record<string, { interval: Interval; every: number }> = {
              weekly: { interval: "week", every: 1 },
              monthly: { interval: "month", every: 1 },
              yearly: { interval: "year", every: 1 },
              quarterly: { interval: "month", every: 3 },
            };
            const m = mapping[freq] || { interval: "month" as Interval, every: 1 };
            return {
              id: r.id,
              name: r.name,
              amount: Number(r.amount || 0),
              interval: m.interval,
              every: m.every,
              next_charge_date: r.next_due,
              account_id: r.account_id ?? null,
              category_id: r.category_id ?? null,
              active: true,
              auto_post: false,
              logo_url: r.logo_url ?? null,
              merchant: r.merchant ?? null,
            } as Subscription;
          });
          return mapped;
        }
      }
    },
    initialData: initialSubs as Subscription[] | undefined,
  });
  const subs = subsQuery.data ?? [];

  // FX conversion utilities
  const fxRatesQ = useQuery<any[]>({
    queryKey: ["fx_rates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fx_rates").select("date,from_currency,to_currency,rate");
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
  const accCurrencyMap = useMemo(() => new Map((accounts || []).map((a: any) => [a.id, (a.currency || "USD").toUpperCase()] as const)), [accounts]);
  const accNameMap = useMemo(() => new Map((accounts || []).map((a: any) => [a.id, a.name] as const)), [accounts]);
  const catNameMap = useMemo(() => new Map((categories || []).map((c: any) => [c.id, c.name] as const)), [categories]);

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

  function addInterval(d: Date, interval: Interval, every: number) {
    const dt = new Date(d);
    if (interval === "day") dt.setDate(dt.getDate() + every);
    else if (interval === "week") dt.setDate(dt.getDate() + every * 7);
    else if (interval === "month") dt.setMonth(dt.getMonth() + every);
    else if (interval === "year") dt.setFullYear(dt.getFullYear() + every);
    return dt;
  }
  function subInterval(d: Date, interval: Interval, every: number) {
    return addInterval(d, interval, -every);
  }

  type DueItem = { id: string; subId: string; name: string; amount: number; date: string; account?: string | null; category?: string | null; accountId?: string | null; categoryId?: string | null; interval: Interval; every: number; autoPost?: boolean };
  const dueItems = useMemo<DueItem[]>(() => {
    const items: DueItem[] = [];
    const start = new Date(startStr + "T00:00:00");
    const end = new Date(nextStartStr + "T00:00:00");
    for (const s of subs) {
      if (s.active === false) continue;
      const step = Math.max(1, Number(s.every || 1));
      let occ = new Date(s.next_charge_date + "T00:00:00");
      while (occ >= start) {
        occ = subInterval(occ, s.interval, step);
      }
      occ = addInterval(occ, s.interval, step);
      while (occ < end) {
        items.push({ id: s.id + "-" + occ.toISOString().slice(0,10), subId: s.id, name: s.name, amount: Number(s.amount || 0), date: occ.toISOString().slice(0,10), account: accNameMap.get(s.account_id || "") ?? null, category: catNameMap.get(s.category_id || "") ?? null, accountId: s.account_id ?? null, categoryId: s.category_id ?? null, interval: s.interval, every: step, autoPost: !!s.auto_post });
        occ = addInterval(occ, s.interval, step);
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    return items;
  }, [subs, startStr, nextStartStr]);
  const dueTotal = useMemo(() => dueItems.reduce((sum, it) => sum + conv(Number(it.amount || 0), accCurrencyMap.get(it.accountId || ""), it.date), 0), [dueItems, conv, accCurrencyMap]);
  const next7Total = useMemo(() => {
    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + 7);
    return dueItems
      .filter((it) => {
        const d = new Date(String(it.date) + "T00:00:00");
        return d >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) && d <= end;
      })
      .reduce((sum, it) => sum + conv(Number(it.amount || 0), accCurrencyMap.get(it.accountId || ""), it.date), 0);
  }, [dueItems, conv, accCurrencyMap]);
  const activeCount = useMemo(() => subs.filter((s) => s.active !== false).length, [subs]);

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("subscriptions").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, active }) => {
      await qc.cancelQueries({ queryKey: ["subscriptions", currentScope] });
      const prev = qc.getQueryData<Subscription[]>(["subscriptions", currentScope]) ?? [];
      qc.setQueryData<Subscription[]>(["subscriptions", currentScope], prev.map((s) => (s.id === id ? { ...s, active } : s)));
      return { prev } as any;
    },
    onError: (e: any, _v, ctx) => { ctx?.prev && qc.setQueryData(["subscriptions", currentScope], ctx.prev); showToast(e?.message || "Failed to update subscription"); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["subscriptions", currentScope] }),
  });

  const chargeNowMutation = useMutation({
    mutationFn: async (s: Subscription) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !s.account_id) return;
      await supabase.from("transactions").insert({ user_id: user.id, date: s.next_charge_date, type: "expense", amount: Number(s.amount || 0), account_id: s.account_id, category_id: s.category_id, notes: `Subscription: ${s.name}`, scope: currentScope, tags: ["subscription"], currency: accCurrencyMap.get(s.account_id as string) || currency, subscription_id: s.id });
      let d = new Date(String(s.next_charge_date) + "T00:00:00");
      d = addInterval(d, s.interval, Math.max(1, Number(s.every || 1)));
      const nextStr = d.toISOString().slice(0, 10);
      try {
        const { error } = await supabase.from("subscriptions").update({ next_charge_date: nextStr }).eq("id", s.id);
        if (error) throw error;
      } catch (_e) {
        await supabase.from("subscriptions").update({ next_due: nextStr } as any).eq("id", s.id);
      }
    },
    onMutate: async (s) => {
      await qc.cancelQueries({ queryKey: ["subscriptions", currentScope] });
      const prev = qc.getQueryData<Subscription[]>(["subscriptions", currentScope]) ?? [];
      const step = Math.max(1, Number(s.every || 1));
      let d = new Date(String(s.next_charge_date) + "T00:00:00");
      d = addInterval(d, s.interval, step);
      const nextStr = d.toISOString().slice(0, 10);
      qc.setQueryData<Subscription[]>(["subscriptions", currentScope], prev.map((x) => (x.id === s.id ? { ...x, next_charge_date: nextStr } : x)));
      return { prev } as any;
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["subscriptions", currentScope], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["subscriptions", currentScope] }),
  });

  const postMany = useMutation({
    mutationFn: async (items: DueItem[]) => {
      if (!items.length) return;
      const { data: { user } } = await supabase.auth.getUser();
      const rows = items
        .filter((it) => !!it.accountId)
        .map((it) => ({
          user_id: user?.id,
          date: it.date,
          type: "expense" as const,
          amount: Number(it.amount || 0),
          account_id: it.accountId as string,
          category_id: it.categoryId ?? null,
          notes: `Subscription: ${it.name}`,
          tags: ["subscription"],
          scope: currentScope,
          currency: accCurrencyMap.get(it.accountId as string) || currency,
          subscription_id: it.subId,
        }));
      if (!rows.length) return;
      const { error } = await supabase.from("transactions").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: (_data, items) => {
      setPosted((prev) => {
        const next = new Set(prev);
        for (const it of items) next.add(it.id);
        return next;
      });
      (async () => {
        // Advance next_charge_date per subscription to after the last posted item
        const bySub = new Map<string, { last: string; interval: Interval; every: number }>();
        for (const it of items) {
          const prev = bySub.get(it.subId);
          if (!prev || it.date > prev.last) bySub.set(it.subId, { last: it.date, interval: it.interval, every: it.every });
        }
        for (const [subId, info] of bySub.entries()) {
          let d = new Date(info.last + "T00:00:00");
          d = addInterval(d, info.interval, info.every);
          const nextStr = d.toISOString().slice(0, 10);
          try {
            const { error } = await supabase.from("subscriptions").update({ next_charge_date: nextStr }).eq("id", subId);
            if (error) throw error;
          } catch (_e) {
            await supabase.from("subscriptions").update({ next_due: nextStr } as any).eq("id", subId);
          }
        }
        qc.invalidateQueries({ queryKey: ["subscriptions", currentScope] });
      })();
    },
  });

  const [posted, setPosted] = useState<Set<string>>(new Set());

  const toggleAutoPost = useMutation({
    mutationFn: async ({ id, auto_post }: { id: string; auto_post: boolean }) => {
      const { error } = await supabase.from("subscriptions").update({ auto_post }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, auto_post }) => {
      await qc.cancelQueries({ queryKey: ["subscriptions", currentScope] });
      const prev = qc.getQueryData<Subscription[]>(["subscriptions", currentScope]) ?? [];
      qc.setQueryData<Subscription[]>(["subscriptions", currentScope], prev.map((s) => (s.id === id ? { ...s, auto_post } : s)));
      return { prev } as any;
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["subscriptions", currentScope], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["subscriptions", currentScope] }),
  });

  // Auto-post due items for subscriptions with auto_post enabled
  const autoPostItems = useMemo(() => dueItems.filter((it) => !!it.autoPost && !!it.accountId && !posted.has(it.id)), [dueItems, posted]);
  useEffect(() => {
    if (autoPostItems.length) {
      postMany.mutate(autoPostItems);
    }
    // Only trigger when list length changes to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPostItems.length]);

  const insertMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      amount: number;
      interval: Interval;
      every: number;
      next_charge_date: string;
      account_id: string | null;
      category_id: string | null;
      merchant?: string | null;
      logo_url?: string | null;
    }) => {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Not authenticated");
      // Try modern insert first (with scope + new columns)
      try {
        const { error } = await supabase.from("subscriptions").insert({
          user_id: user.id,
          name: input.name,
          amount: input.amount,
          interval: input.interval,
          every: input.every,
          next_charge_date: input.next_charge_date,
          account_id: input.account_id,
          category_id: input.category_id,
          merchant: input.merchant || null,
          logo_url: input.logo_url || null,
          scope: currentScope,
        } as any);
        if (error) throw error;
        return;
      } catch (_e1) {
        // Retry without scope column
        try {
          const { error } = await supabase.from("subscriptions").insert({
            user_id: user.id,
            name: input.name,
            amount: input.amount,
            interval: input.interval,
            every: input.every,
            next_charge_date: input.next_charge_date,
            account_id: input.account_id,
            category_id: input.category_id,
            merchant: input.merchant || null,
            logo_url: input.logo_url || null,
          } as any);
          if (error) throw error;
          return;
        } catch (_e2) {
          // Legacy schema fallback (frequency/next_due)
          const freq = (() => {
            if (input.interval === "week" && input.every === 1) return "weekly";
            if (input.interval === "month" && input.every === 3) return "quarterly";
            if (input.interval === "month" && input.every === 1) return "monthly";
            if (input.interval === "year" && input.every === 1) return "yearly";
            // fallback approximate mapping
            if (input.interval === "day") return "monthly";
            return "monthly";
          })();
          const { error } = await supabase.from("subscriptions").insert({
            user_id: user.id,
            name: input.name,
            amount: input.amount,
            frequency: freq,
            next_due: input.next_charge_date,
            account_id: input.account_id,
            category_id: input.category_id,
            merchant: input.merchant || null,
            logo_url: input.logo_url || null,
          } as any);
          if (error) throw error;
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["subscriptions", currentScope] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["subscriptions", currentScope] });
      const prev = qc.getQueryData<Subscription[]>(["subscriptions", currentScope]) ?? [];
      qc.setQueryData<Subscription[]>(["subscriptions", currentScope], prev.filter((s) => s.id !== id));
      return { prev };
    },
    onError: (e: any, _id, ctx) => { ctx?.prev && qc.setQueryData(["subscriptions", currentScope], ctx.prev); showToast(e?.message || "Failed to delete subscription"); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["subscriptions", currentScope] }),
  });

  const [form, setForm] = useState({
    name: "",
    amount: "",
    interval: "month" as Interval,
    every: "1",
    next_charge_date: new Date().toISOString().slice(0, 10),
    account_id: "",
    category_id: "",
    merchant: "",
    logo_url: "",
  });
  const [autoLogo, setAutoLogo] = useState(true);

  const canSubmit = form.name && form.amount && form.next_charge_date && !insertMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button aria-label="Previous period" onClick={() => setOffset((o) => o - 1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2 py-1 text-sm hover:bg-white/80 dark:hover:bg-zinc-900">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-medium">This period</h2>
            <button aria-label="Next period" onClick={() => setOffset((o) => o + 1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2 py-1 text-sm hover:bg-white/80 dark:hover:bg-zinc-900">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-zinc-500">{startStr} – {nextStartStr}</div>
            <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" checked={!!(dualOverride ?? showDual)} onChange={(e) => {
                const on = e.target.checked;
                setDualOverride(on);
                try { localStorage.setItem("dual-display", on ? "1" : "0"); } catch {}
              }} /> Dual display
              <button onClick={() => { setDualOverride(null); try { localStorage.removeItem("dual-display"); } catch {} }} className="hover:underline">Reset</button>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-md bg-white/10 ring-1 ring-inset ring-white/10 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Total due</div>
            <div className="text-sm font-medium">{formatCurrency(dueTotal, currency, locale)}</div>
          </div>
          <div className="rounded-md bg-white/10 ring-1 ring-inset ring-white/10 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Charges</div>
            <div className="text-sm font-medium">{dueItems.length}</div>
          </div>
          <div className="rounded-md bg-white/10 ring-1 ring-inset ring-white/10 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Next 7 days</div>
            <div className="text-sm font-medium">{formatCurrency(next7Total, currency, locale)}</div>
          </div>
          <div className="rounded-md bg-white/10 ring-1 ring-inset ring-white/10 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Active</div>
            <div className="text-sm font-medium">{activeCount}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {dueItems.filter((it) => !it.accountId).length > 0 ? `${dueItems.filter((it) => !it.accountId).length} missing account` : ""}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => postMany.mutate(dueItems.filter((it) => !!it.accountId && !posted.has(it.id)))}
              disabled={postMany.isPending || dueItems.filter((it) => !!it.accountId && !posted.has(it.id)).length === 0}
              className={cn(
                "rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-3 py-1.5 text-sm",
                postMany.isPending || dueItems.filter((it) => !!it.accountId && !posted.has(it.id)).length === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/80 dark:hover:bg-zinc-900"
              )}
            >
              Post all due
            </button>
            <button
              onClick={async () => {
                const ids = subs.filter((s) => s.active !== false).map((s) => s.id);
                if (!ids.length) return;
                await supabase.from("subscriptions").update({ active: false }).in("id", ids);
                qc.invalidateQueries({ queryKey: ["subscriptions", currentScope] });
              }}
              className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-3 py-1.5 text-sm hover:bg-white/80 dark:hover:bg-zinc-900"
            >
              Pause all active
            </button>
          </div>
        </div>
        <div className="mt-2 divide-y divide-zinc-200/60 dark:divide-zinc-800 rounded-md border border-zinc-200/60 dark:border-zinc-800">
          {dueItems.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-500">No charges this period</div>
          ) : (
            dueItems.map((it, idx) => (
              <motion.div key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12, delay: idx * 0.03 }} className="flex items-center justify-between px-3 py-2" tabIndex={0} role="button" aria-disabled={postMany.isPending || !it.accountId || posted.has(it.id)} aria-label={`${it.name} on ${it.date}`} onKeyDown={(e) => {
                const eligible = !(postMany.isPending || !it.accountId || posted.has(it.id));
                const key = e.key.toLowerCase();
                if (!eligible) return;
                if (key === 'enter' || key === ' ' || key === 'p') { e.preventDefault(); postMany.mutate([it]); }
              }}>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{it.name}</div>
                  <div className="text-xs text-zinc-500 truncate">{it.date} {it.account ? `· ${it.account}` : "· No account"} {it.category ? `· ${it.category}` : ""}</div>
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const src = accCurrencyMap.get(it.accountId || "") || currency;
                    const converted = conv(Number(it.amount || 0), src, it.date);
                    const same = src === currency;
                    const missing = !same && (convertFx(1, src, currency, it.date) == null);
                    return (
                      <div className="text-right leading-tight">
                        <div className="text-sm font-medium inline-flex items-center gap-1">{formatCurrency(converted, currency, locale)}{missing ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" title="No FX rate for this date; treated as 0" /> : null}</div>
                        {showDualEffective && !same ? <div className="text-[10px] text-zinc-500 tabular">{formatCurrency(Number(it.amount || 0), src, locale)}</div> : null}
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => postMany.mutate([it])}
                    disabled={postMany.isPending || !it.accountId || posted.has(it.id)}
                    className={cn(
                      "rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-2 py-1 text-xs",
                      postMany.isPending || !it.accountId || posted.has(it.id) ? "opacity-50 cursor-not-allowed" : "hover:bg-white/80 dark:hover:bg-zinc-900"
                    )}
                  >
                    {posted.has(it.id) ? "Posted" : "Post"}
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-4">
        <div className="text-sm font-medium mb-3">Add Subscription</div>
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
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
            value={form.interval}
            onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value as Interval }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
          <input
            type="number"
            min={1}
            placeholder="Every"
            value={form.every}
            onChange={(e) => setForm((f) => ({ ...f, every: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          />
          <input
            type="date"
            value={form.next_charge_date}
            onChange={(e) => setForm((f) => ({ ...f, next_charge_date: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="Merchant"
            value={form.merchant}
            onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          />
          <input
            type="url"
            placeholder="Logo URL (optional)"
            value={form.logo_url}
            onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={autoLogo} onChange={(e) => setAutoLogo(e.target.checked)} /> Auto logo
          </label>
          <select
            value={form.account_id}
            onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          >
            <option value="">Account</option>
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select
            value={form.category_id}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
          >
            <option value="">Category</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="sm:col-span-7">
            <button
              disabled={!canSubmit}
              onClick={() => {
                insertMutation.mutate({
                  name: form.name,
                  amount: Number(form.amount || 0),
                  interval: form.interval,
                  every: Number(form.every || 1),
                  next_charge_date: form.next_charge_date,
                  account_id: form.account_id || null,
                  category_id: form.category_id || null,
                  merchant: form.merchant || null,
                  logo_url: (() => {
                    if (form.logo_url) return form.logo_url;
                    if (!autoLogo || !form.merchant) return null;
                    const domain = deriveDomain(form.merchant);
                    return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : null;
                  })() as any,
                });
                setForm((f) => ({ ...f, name: "", amount: "" }));
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                canSubmit ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}
            >
              Add subscription
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr className="text-left">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Every</th>
              <th className="px-3 py-2">Next charge</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const days = Math.ceil((new Date(String(s.next_charge_date)).getTime() - new Date().getTime()) / (1000*60*60*24));
              const dueBadge = days <= 3 ? (days <= 0 ? "Due" : `Due in ${days}d`) : null;
              return (
                <tr key={s.id} className="border-top border-zinc-200/60 dark:border-zinc-800 border-t">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <LogoAvatar logoUrl={s.logo_url || undefined} name={s.merchant || s.name} />
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[160px]" title={s.name}>{s.name}</div>
                        <div className="text-[11px] text-zinc-500 truncate max-w-[180px]">{s.merchant || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">every {s.every} {s.interval}{s.every > 1 ? "s" : ""}</td>
                  <td className="px-3 py-2">
                    <div className="inline-flex items-center gap-2">
                      <span>{s.next_charge_date}</span>
                      {dueBadge ? <span className={"text-[10px] px-2 py-0.5 rounded-full " + (days <= 3 ? "bg-amber-500/15 text-amber-600 animate-pulse" : "bg-zinc-500/10 text-zinc-600")}>{dueBadge}</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">{accNameMap.get(s.account_id || "") ?? "-"}</td>
                  <td className="px-3 py-2">{catNameMap.get(s.category_id || "") ?? "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {(() => {
                      const srcCur = accCurrencyMap.get(s.account_id || "") || currency;
                      const converted = conv(Number(s.amount || 0), srcCur, String(s.next_charge_date));
                      const same = srcCur === currency;
                      const missing = !same && (convertFx(1, srcCur, currency, String(s.next_charge_date)) == null);
                      return (
                        <div className="leading-tight">
                          <div className="inline-flex items-center gap-1">{formatCurrency(converted, currency, locale)}{missing ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" title="No FX rate for this date; treated as 0" /> : null}</div>
                          {showDualEffective && !same ? <div className="text-[10px] text-zinc-500 tabular">{formatCurrency(Number(s.amount || 0), srcCur, locale)}</div> : null}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => toggleAutoPost.mutate({ id: s.id, auto_post: !s.auto_post })}
                        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      >
                        {s.auto_post ? "Auto-post: On" : "Auto-post: Off"}
                      </button>
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: s.id, active: !s.active })}
                        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      >
                        {s.active ? "Pause" : "Resume"}
                      </button>
                      <button
                        onClick={() => chargeNowMutation.mutate(s)}
                        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      >
                        Charge now
                      </button>
                      <button
                        onClick={async () => {
                          let d = new Date(String(s.next_charge_date) + "T00:00:00");
                          d = addInterval(d, s.interval, Math.max(1, Number(s.every || 1)));
                          const nextStr = d.toISOString().slice(0, 10);
                          await supabase.from("subscriptions").update({ next_charge_date: nextStr }).eq("id", s.id);
                          qc.invalidateQueries({ queryKey: ["subscriptions"] });
                        }}
                        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      >
                        Skip once
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(s.id)}
                        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {subs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">No subscriptions yet</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
