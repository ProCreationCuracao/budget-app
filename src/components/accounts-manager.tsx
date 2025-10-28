"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/toast";
import { Wallet, Banknote, CreditCard as CreditCardIcon, Coins as CoinsIcon, PiggyBank } from "lucide-react";

const ICONS = ["wallet", "bank", "credit-card", "coins", "piggy-bank"] as const;
const TYPES = ["cash", "bank", "credit_card", "wallet"] as const;
const ICON_MAP: Record<string, ReactNode> = {
  "wallet": <Wallet className="h-4 w-4" />,
  "bank": <Banknote className="h-4 w-4" />,
  "credit-card": <CreditCardIcon className="h-4 w-4" />,
  "coins": <CoinsIcon className="h-4 w-4" />,
  "piggy-bank": <PiggyBank className="h-4 w-4" />,
};
const COLOR_SWATCHES = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899","#64748b"]; 

export default function AccountsManager() {
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);

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

  const { data: profileCurrencyRow } = useQuery<{ currency?: string }>({
    queryKey: ["profile", "currency"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {} as any;
      const { data, error } = await supabase.from("profiles").select("currency").eq("id", user.id).single();
      if (error) throw error;
      return (data as any) || {};
    },
    staleTime: 60_000,
  });

  const accountsQ = useQuery({
    queryKey: ["accounts", "manager", currentScope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id,name,type,icon,color,hidden,order_index,starting_balance,created_at,currency")
        .eq("scope", currentScope)
        .order("hidden", { ascending: true })
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
  const accounts = (accountsQ.data || []) as any[];

  const [form, setForm] = useState({ name: "", type: "cash" as any, color: "", icon: "wallet", starting_balance: "0", currency: "" });

  const createM = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        user_id: user?.id,
        name: form.name.trim() || "New Account",
        type: form.type,
        color: form.color || null,
        icon: form.icon || null,
        starting_balance: Number(form.starting_balance || 0),
        order_index: accounts.length,
        scope: currentScope,
        currency: (form.currency || profileCurrencyRow?.currency || "USD").toUpperCase(),
      };
      const { error } = await supabase.from("accounts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { showToast("Account created", "success"); },
    onError: () => { showToast("Create failed", "error"); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const updateM = useMutation({
    mutationFn: async (input: { id: string; patch: any }) => {
      const { error } = await supabase.from("accounts").update(input.patch).eq("id", input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["accounts"] });
      const prev = qc.getQueryData<any[]>(["accounts", "manager"]) || [];
      qc.setQueryData<any[]>(["accounts", "manager"], prev.map((a) => (a.id === input.id ? { ...a, ...input.patch } : a)));
      return { prev } as any;
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["accounts", "manager"], ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["accounts", "manager"] });
      showToast("Account updated", "success");
    },
  });

  const reorderM = useMutation({
    mutationFn: async (nextOrder: { id: string; order_index: number }[]) => {
      for (const item of nextOrder) {
        const { error } = await supabase.from("accounts").update({ order_index: item.order_index }).eq("id", item.id);
        if (error) throw error;
      }
    },
    onMutate: async (nextOrder) => {
      await qc.cancelQueries({ queryKey: ["accounts", "manager"] });
      const prev = qc.getQueryData<any[]>(["accounts", "manager"]) || [];
      const map = new Map(nextOrder.map((x) => [x.id, x.order_index] as const));
      const next = [...prev].map((a: any) => (map.has(a.id) ? { ...a, order_index: map.get(a.id) } : a)).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      qc.setQueryData<any[]>(["accounts", "manager"], next);
      return { prev } as any;
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["accounts", "manager"], ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["accounts", "manager"] });
      showToast("Order saved", "success");
    },
  });

  function reorderByName() {
    const ordered = [...accounts].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
    const nextOrder = ordered.map((a, i) => ({ id: a.id, order_index: i }));
    reorderM.mutate(nextOrder);
  }

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["accounts", "manager"] });
      const prev = qc.getQueryData<any[]>(["accounts", "manager"]) || [];
      qc.setQueryData<any[]>(["accounts", "manager"], prev.filter((a) => a.id !== id));
      return { prev } as any;
    },
    onError: (_e, _id, ctx) => ctx?.prev && qc.setQueryData(["accounts", "manager"], ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["accounts", "manager"] });
      showToast("Account deleted", "success");
    },
  });

  function move(id: string, dir: -1 | 1) {
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= accounts.length) return;
    const a = accounts[idx];
    const b = accounts[j];
    updateM.mutate({ id: a.id, patch: { order_index: b.order_index } });
    updateM.mutate({ id: b.id, patch: { order_index: a.order_index } });
  }

  function onDragStartRow(id: string) {
    setDragId(id);
  }
  function onDragOverRow(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDropRow(overId: string) {
    if (!dragId || dragId === overId) { setDragId(null); return; }
    const ordered = [...accounts].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const fromIdx = ordered.findIndex((a) => a.id === dragId);
    const toIdx = ordered.findIndex((a) => a.id === overId);
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); return; }
    const item = ordered.splice(fromIdx, 1)[0];
    ordered.splice(toIdx, 0, item);
    const nextOrder = ordered.map((a, i) => ({ id: a.id, order_index: i }));
    reorderM.mutate(nextOrder);
    setDragId(null);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-4">
        <div className="text-sm font-medium mb-3">Add Account</div>
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
            {TYPES.map((t) => (<option key={t} value={t}>{t.replace("_", " ")}</option>))}
          </select>
          <div className="flex items-center gap-2">
            <input type="color" value={form.color || "#64748b"} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="h-8 w-12 rounded-md border border-zinc-300 dark:border-zinc-800" />
            <div className="hidden sm:flex items-center gap-1">
              {COLOR_SWATCHES.map((c) => (
                <button key={c} onClick={() => setForm((f) => ({ ...f, color: c }))} className="h-6 w-6 rounded-md ring-1 ring-inset ring-black/10" style={{ background: c }} aria-label={`Color ${c}`} />
              ))}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((i) => (
                <button key={i} onClick={() => setForm((f) => ({ ...f, icon: i }))} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 ring-1 ring-inset", form.icon === i ? "bg-black/10 ring-black/20 dark:bg-white/10 dark:ring-white/20" : "bg-black/5 ring-black/10 dark:bg-white/5 dark:ring-white/10")}
                  aria-label={i}>
                  <span>{ICON_MAP[i]}</span>
                  <span className="text-xs capitalize hidden sm:inline">{i.replace("-", " ")}</span>
                </button>
              ))}
            </div>
          </div>
          <input type="number" inputMode="decimal" value={form.starting_balance} onChange={(e) => setForm((f) => ({ ...f, starting_balance: e.target.value }))} placeholder="Starting balance" className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
          <input value={form.currency || (profileCurrencyRow?.currency || "")} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} placeholder="Currency (e.g., USD)" className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
          <div className="sm:col-span-6">
            <button onClick={() => createM.mutate()} disabled={createM.isPending} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", createM.isPending ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-500" : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black")}>Create</button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button onClick={reorderByName} className="mb-2 rounded-md border border-zinc-300 dark:border-zinc-800 px-2 py-1 text-xs">Reorder by name</button>
      </div>
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr className="text-left">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Color</th>
              <th className="px-3 py-2">Icon</th>
              <th className="px-3 py-2">Currency</th>
              <th className="px-3 py-2">Hidden</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr
                key={a.id}
                className="border-t border-zinc-200/60 dark:border-zinc-800 cursor-move"
                draggable
                onDragStart={() => onDragStartRow(a.id)}
                onDragOver={onDragOverRow}
                onDrop={() => onDropRow(a.id)}
              >
                <td className="px-3 py-2">
                  <input defaultValue={a.name} onBlur={(e) => updateM.mutate({ id: a.id, patch: { name: e.target.value } })} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                </td>
                <td className="px-3 py-2">
                  <select defaultValue={a.type} onChange={(e) => updateM.mutate({ id: a.id, patch: { type: e.target.value } })} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
                    {TYPES.map((t) => (<option key={t} value={t}>{t.replace("_", " ")}</option>))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input defaultValue={a.color || ""} onBlur={(e) => updateM.mutate({ id: a.id, patch: { color: e.target.value || null } })} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                </td>
                <td className="px-3 py-2">
                  <select defaultValue={a.icon || "wallet"} onChange={(e) => updateM.mutate({ id: a.id, patch: { icon: e.target.value || null } })} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
                    {ICONS.map((i) => (<option key={i} value={i}>{i}</option>))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input defaultValue={a.currency || (profileCurrencyRow?.currency || "")} onBlur={(e) => updateM.mutate({ id: a.id, patch: { currency: e.target.value.toUpperCase() || null } })} className="w-24 rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
                </td>
                <td className="px-3 py-2">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" defaultChecked={!!a.hidden} onChange={(e) => updateM.mutate({ id: a.id, patch: { hidden: e.target.checked } })} />
                    <span>Hidden</span>
                  </label>
                </td>
                <td className="px-3 py-2">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => move(a.id, -1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 px-2 py-1">Up</button>
                    <button onClick={() => move(a.id, 1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 px-2 py-1">Down</button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => { if (!confirm("Delete this account?")) return; deleteM.mutate(a.id); }} className="rounded-md border border-zinc-300 dark:border-zinc-800 px-2 py-1 text-rose-600">Delete</button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-500">No accounts yet</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
