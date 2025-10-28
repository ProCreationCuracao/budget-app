"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AccountCard from "@/components/account-card";

export default function AccountsCarousel({ currency, locale, showHidden = false }: { currency: string; locale: string; showHidden?: boolean }) {
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();
  const [reorder, setReorder] = useState(false);
  const pressRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
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

  const accountsQ = useQuery({
    queryKey: ["accounts", "list", currentScope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id,name,type,icon,color,hidden,order_index,starting_balance,currency")
        .eq("scope", currentScope)
        .order("hidden", { ascending: true })
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const txQ = useQuery({
    queryKey: ["accounts", "balances", currentScope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("account_id, amount, type")
        .eq("scope", currentScope);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const trendQ = useQuery({
    queryKey: ["accounts", "trend", 14, currentScope],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 14);
      const startStr = start.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("transactions")
        .select("account_id, amount, type, date")
        .eq("scope", currentScope)
        .gte("date", startStr);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    const accounts = (accountsQ.data || []) as any[];
    const txs = (txQ.data || []) as any[];
    const trends = (trendQ.data || []) as any[];
    const deltaByAccount = new Map<string, number>();
    for (const t of txs) {
      const k = t.account_id as string;
      const amt = Number(t.amount || 0);
      const v = (deltaByAccount.get(k) ?? 0) + (t.type === "income" ? amt : -amt);
      deltaByAccount.set(k, v);
    }
    const trendByAccount = new Map<string, number[]>();
    const today = new Date();
    for (const a of accounts) trendByAccount.set(a.id, Array.from({ length: 14 }, () => 0));
    for (const t of trends) {
      const d = new Date(String(t.date));
      const idx = 13 - Math.min(13, Math.max(0, Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))));
      if (idx < 0 || idx > 13) continue;
      const arr = trendByAccount.get(t.account_id as string);
      if (!arr) continue;
      arr[idx] += t.type === "income" ? Number(t.amount || 0) : -Number(t.amount || 0);
    }
    const result = accounts
      .filter((a) => showHidden ? true : !a.hidden)
      .map((a) => {
        const delta = deltaByAccount.get(a.id) ?? 0;
        const balance = Number(a.starting_balance || 0) + delta;
        const trend = trendByAccount.get(a.id) ?? [];
        return { id: a.id, name: a.name, type: a.type, color: a.color, icon: a.icon, balance, trend, order_index: a.order_index, currency: a.currency };
      });
    return result;
  }, [accountsQ.data, txQ.data, trendQ.data, showHidden]);

  const reorderM = useMutation({
    mutationFn: async (nextOrder: { id: string; order_index: number }[]) => {
      for (const item of nextOrder) {
        const { error } = await supabase.from("accounts").update({ order_index: item.order_index }).eq("id", item.id);
        if (error) throw error;
      }
    },
    onMutate: async (nextOrder) => {
      await qc.cancelQueries({ queryKey: ["accounts"] });
      const prev = qc.getQueryData<any[]>(["accounts", "list", currentScope]) || [];
      const map = new Map(nextOrder.map((x) => [x.id, x.order_index] as const));
      const next = [...(prev as any[])].map((a) => (map.has(a.id) ? { ...a, order_index: map.get(a.id) } : a));
      qc.setQueryData<any[]>(["accounts", "list", currentScope], next);
      return { prev } as any;
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["accounts", "list", currentScope], ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  function move(id: string, dir: -1 | 1) {
    const ordered = [...items].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const idx = ordered.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[j];
    [ordered[idx], ordered[j]] = [ordered[j], ordered[idx]];
    const nextOrder = ordered.map((a, i) => ({ id: a.id, order_index: i }));
    reorderM.mutate(nextOrder);
  }

  function onPressStart() {
    if (reorder) return;
    if (pressRef.current) window.clearTimeout(pressRef.current);
    pressRef.current = window.setTimeout(() => setReorder(true), 500);
  }
  function onPressEnd() {
    if (pressRef.current) { window.clearTimeout(pressRef.current); pressRef.current = null; }
  }

  // Subtle parallax on horizontal scroll
  useEffect(() => {
    // Respect reduced motion
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    function schedule() {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        if (!containerRef.current) return;
        const cont = containerRef.current;
        const cRect = cont.getBoundingClientRect();
        const cCenter = cRect.left + cRect.width / 2;
        const cards = cont.querySelectorAll('[data-parallax="1"]');
        cards.forEach((el) => {
          const node = el as HTMLElement;
          const r = node.getBoundingClientRect();
          const center = r.left + r.width / 2;
          const dist = (center - cCenter) / cRect.width; // -0.5..0.5 typical
          const y = -(dist * 8); // up to ~8px lift
          const scale = 1 + (-Math.min(0.06, Math.abs(dist) * 0.04));
          node.style.willChange = "transform";
          node.style.transform = `translateY(${y.toFixed(2)}px) scale(${scale.toFixed(3)})`;
        });
      });
    }
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => schedule();
    el.addEventListener("scroll", onScroll, { passive: true });
    schedule();
    const onResize = () => schedule();
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll as any);
      window.removeEventListener("resize", onResize);
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, []);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-medium">Accounts</h2>
        {reorder ? (
          <button onClick={() => setReorder(false)} className="text-xs rounded-md border border-zinc-300 dark:border-zinc-800 px-2 py-1">Done</button>
        ) : (
          <span className="text-xs text-zinc-500">Long-press a card to reorder</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-2"
        onKeyDown={(e) => { if (reorder && e.key === "Escape") { e.preventDefault(); setReorder(false); } }}
        aria-label="Accounts list"
      >
        {items.map((it) => (
          <div
            key={it.id}
            data-parallax="1"
            onPointerDown={onPressStart}
            onPointerUp={onPressEnd}
            onPointerLeave={onPressEnd}
            tabIndex={reorder ? 0 : -1}
            role="group"
            aria-label={`Account ${it.name}${reorder ? ", reorder mode" : ""}`}
            onKeyDown={(e) => {
              if (!reorder) return;
              if (e.key === "ArrowLeft") { e.preventDefault(); move(it.id, -1); }
              if (e.key === "ArrowRight") { e.preventDefault(); move(it.id, 1); }
            }}
          >
            <AccountCard
              name={it.name}
              type={it.type}
              color={it.color}
              icon={it.icon}
              balance={it.balance}
              currency={it.currency || currency}
              locale={locale}
              trend={it.trend}
              reorderMode={reorder}
              onMoveLeft={() => move(it.id, -1)}
              onMoveRight={() => move(it.id, 1)}
            />
          </div>
        ))}
        {items.length === 0 ? (
          <div className="text-sm text-zinc-500">No accounts yet</div>
        ) : null}
      </div>
    </div>
  );
}
