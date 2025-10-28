"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function FxRatesManager({ baseCurrency }: { baseCurrency: string }) {
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), from: baseCurrency || "USD", to: baseCurrency || "USD", rate: "1" });

  const fxQ = useQuery<any[]>({
    queryKey: ["fx_rates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fx_rates").select("id,date,from_currency,to_currency,rate").order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const rates = fxQ.data ?? [];

  const addM = useMutation({
    mutationFn: async (input: { date: string; from: string; to: string; rate: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const payload = {
        user_id: user.id,
        date: input.date,
        from_currency: input.from.toUpperCase(),
        to_currency: input.to.toUpperCase(),
        rate: Number(input.rate || 0),
      };
      const { error } = await supabase.from("fx_rates").upsert(payload, { onConflict: "user_id,date,from_currency,to_currency" });
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["fx_rates"] });
      const prev = qc.getQueryData<any[]>(["fx_rates"]) ?? [];
      const next = [
        { id: `temp-${Date.now()}`, date: vars.date, from_currency: vars.from.toUpperCase(), to_currency: vars.to.toUpperCase(), rate: Number(vars.rate || 0) },
        ...prev,
      ];
      qc.setQueryData(["fx_rates"], next);
      return { prev } as any;
    },
    onError: (_e,_v,ctx) => ctx?.prev && qc.setQueryData(["fx_rates"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fx_rates"] }),
  });

  const delM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fx_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["fx_rates"] });
      const prev = qc.getQueryData<any[]>(["fx_rates"]) ?? [];
      qc.setQueryData<any[]>(["fx_rates"], prev.filter((r) => r.id !== id));
      return { prev } as any;
    },
    onError: (_e,_v,ctx) => ctx?.prev && qc.setQueryData(["fx_rates"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["fx_rates"] }),
  });

  const canSubmit = useMemo(() => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(form.date);
    const f = /^[A-Z]{3}$/.test((form.from || "").toUpperCase());
    const t = /^[A-Z]{3}$/.test((form.to || "").toUpperCase());
    const r = Number(form.rate || 0) > 0;
    return d && f && t && r && !addM.isPending;
  }, [form, addM.isPending]);

  return (
    <div className="space-y-3">
      <div className="text-sm text-zinc-500">Base currency: <span className="font-medium">{(baseCurrency || "USD").toUpperCase()}</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="rounded-md bg-zinc-900/40 border border-zinc-800 px-2 py-1 text-sm" />
        <input value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value.toUpperCase() }))} placeholder="From (e.g., EUR)" className="rounded-md bg-zinc-900/40 border border-zinc-800 px-2 py-1 text-sm" />
        <input value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value.toUpperCase() }))} placeholder="To (e.g., USD)" className="rounded-md bg-zinc-900/40 border border-zinc-800 px-2 py-1 text-sm" />
        <input type="number" inputMode="decimal" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} placeholder="Rate" className="rounded-md bg-zinc-900/40 border border-zinc-800 px-2 py-1 text-sm" />
        <button onClick={() => canSubmit && addM.mutate({ date: form.date, from: form.from, to: form.to, rate: Number(form.rate) })} disabled={!canSubmit} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", canSubmit ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black" : "bg-zinc-800 text-zinc-500")}>Add/Update</button>
      </div>

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr className="text-left">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Pair</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-t border-zinc-200/60 dark:border-zinc-800">
                <td className="px-3 py-2">{r.date}</td>
                <td className="px-3 py-2">{r.from_currency} → {r.to_currency}</td>
                <td className="px-3 py-2">{Number(r.rate || 0)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => delM.mutate(r.id)} className="rounded-md border border-zinc-300 dark:border-zinc-800 px-2 py-1 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {rates.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-zinc-500">No FX rates yet</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
