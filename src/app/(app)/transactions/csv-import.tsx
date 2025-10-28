"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { applySmartRulesWithTrace, loadSmartRules } from "@/lib/smart-rules";
import { formatCurrency } from "@/lib/format";

export default function CsvImport({ currency, locale }: { currency: string; locale: string }) {
  const supabase = createSupabaseBrowserClient();
  const qc = useQueryClient();
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pulse, setPulse] = useState(false);
  const [fallbackAccountId, setFallbackAccountId] = useState("");
  const [fallbackCategoryId, setFallbackCategoryId] = useState("");
  const [applyRules, setApplyRules] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const { data: accounts } = useQuery<{ id: string; name: string; currency?: string }[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id,name,currency");
      if (error) throw error;
      return data ?? [];
    },
  });

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

  // Allow FAB to open this panel and focus the file input
  useEffect(() => {
    function open() {
      try {
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setPulse(true);
        setTimeout(() => setPulse(false), 1200);
        inputRef.current?.focus();
        inputRef.current?.click();
      } catch {}
    }
    const onOpen = () => open();
    window.addEventListener("app:open-import", onOpen as any);
    if (typeof location !== "undefined" && location.hash === "#import") {
      setTimeout(open, 100);
    }
    function onHashChange() { if (location.hash === "#import") open(); }
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("app:open-import", onOpen as any);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);
  const { data: categories } = useQuery<{ id: string; name: string; type: "income" | "expense" }[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,type");
      if (error) throw error;
      return data ?? [];
    },
  });

  const importMutation = useMutation({
    mutationFn: async (toInsert: any[]) => {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Not authenticated");
      const accCurrency = new Map((accounts ?? []).map((a) => [a.id, (a.currency || "USD").toUpperCase()] as const));
      // insert in chunks
      const chunkSize = 150;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize).map((r) => ({
          ...r,
          user_id: user.id,
          scope: currentScope,
          currency: accCurrency.get(r.account_id) || "USD",
        }));
        const { error } = await supabase.from("transactions").insert(chunk);
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  function parseFile(file: File) {
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result: any) => {
        const raw = result.data as any[];
        // normalize
        const acctByName = new Map((accounts ?? []).map((a) => [a.name.toLowerCase(), a.id]));
        const catByName = new Map((categories ?? []).map((c) => [c.name.toLowerCase(), c.id]));
        const rules = applyRules ? loadSmartRules() : [];

        function pick(obj: any, ...keys: string[]) {
          for (const k of keys) {
            const found = Object.keys(obj).find((x) => x.toLowerCase() === k.toLowerCase());
            if (found) return obj[found];
          }
          return undefined;
        }

        const normalized = raw
          .map((r) => {
            const date = pick(r, "date", "posted_at", "transaction_date", "time") || "";
            let amountStr = pick(r, "amount", "amt", "value", "transaction_amount") || "";
            const notes = pick(r, "notes", "description", "memo", "name") || "";
            const accountName = (pick(r, "account", "account_name") || "").toString();
            const categoryName = (pick(r, "category", "category_name") || "").toString();
            const typeRaw = (pick(r, "type", "txn_type") || "").toString().toLowerCase();

            let amount = Number((amountStr || "").toString().replace(/[^0-9\-\.]/g, ""));
            let type: "income" | "expense" = "expense";
            if (typeRaw.includes("income") || typeRaw.includes("credit")) type = "income";
            if (typeRaw.includes("expense") || typeRaw.includes("debit")) type = "expense";
            if (!typeRaw && amount > 0) type = "income"; // fallback
            if (type === "expense" && amount > 0) amount = Math.abs(amount);
            if (type === "income" && amount < 0) amount = Math.abs(amount);

            const account_id = acctByName.get(accountName.toLowerCase()) || fallbackAccountId || "";
            const category_id = catByName.get(categoryName.toLowerCase()) || fallbackCategoryId || "";

            const draft = {
              date: (date || "").toString().slice(0, 10),
              amount,
              type,
              notes: notes ? String(notes) : null,
              account_id,
              category_id,
            } as const;

            const applied = applyRules
              ? applySmartRulesWithTrace(draft, rules as any, {
                  categories: (categories ?? []) as any,
                  accounts: (accounts ?? []) as any,
                }).result
              : draft;

            return {
              ...applied,
              _matched: applyRules ? (applySmartRulesWithTrace(draft, rules as any, { categories: (categories ?? []) as any, accounts: (accounts ?? []) as any }).matched) : [],
              _key: `${applied.date}_${applied.amount}_${applied.type}_${applied.account_id}_${applied.category_id}_${applied.notes ?? ""}`,
            };
          })
          .filter((x) => x.date && x.amount && x.account_id && x.category_id);

        // dedupe within file
        const seen = new Set<string>();
        const deduped = [] as any[];
        for (const r of normalized) {
          if (seen.has(r._key)) continue;
          seen.add(r._key);
          deduped.push(r);
        }

        // Check duplicates against DB by date range
        let rowsWithDup = deduped as any[];
        try {
          const minDate = deduped.reduce((m, r) => (r.date < m ? r.date : m), deduped[0]?.date || "");
          const maxDate = deduped.reduce((m, r) => (r.date > m ? r.date : m), deduped[0]?.date || "");
          if (minDate && maxDate) {
            const { data: existing } = await supabase
              .from("transactions")
              .select("date,amount,type,account_id,category_id,notes")
              .gte("date", minDate)
              .lte("date", maxDate)
              .limit(10000);
            const existingKeys = new Set((existing ?? []).map((t: any) => `${t.date}_${Number(t.amount || 0)}_${t.type}_${t.account_id}_${t.category_id}_${t.notes ?? ""}`));
            rowsWithDup = deduped.map((r) => ({ ...r, _dup: existingKeys.has(r._key) }));
          }
        } catch {}

        setRows(rowsWithDup);
        const matchedCount = rowsWithDup.filter((r) => (r._matched?.length ?? 0) > 0).length;
        const dupCount = rowsWithDup.filter((r) => r._dup).length;
        setSummary(`${rowsWithDup.length} valid rows, ${matchedCount} with rules applied, ${dupCount} duplicates in DB`);
        setParsing(false);
      },
      error: () => setParsing(false),
    });
  }

  const canImport = rows.length > 0 && !importMutation.isPending;

  return (
    <div id="import" ref={containerRef} className={cn("rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur p-4", pulse ? "ring-2 ring-[hsl(var(--accent))]" : "") }>
      <div className="text-sm font-medium mb-3">Import CSV</div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          ref={inputRef}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) parseFile(f);
          }}
        />
        <select
          value={fallbackAccountId}
          onChange={(e) => setFallbackAccountId(e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
        >
          <option value="">Fallback account (optional)</option>
          {(accounts ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select
          value={fallbackCategoryId}
          onChange={(e) => setFallbackCategoryId(e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
        >
          <option value="">Fallback category (optional)</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={applyRules} onChange={(e) => setApplyRules(e.target.checked)} /> Apply smart rules
        </label>
        <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} /> Skip duplicates
        </label>
        <button
          disabled={!canImport}
          onClick={() => importMutation.mutate(rows.filter((r) => !skipDuplicates || !r._dup).map(({ _key, _matched, _dup, ...r }) => r))}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            canImport ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed"
          )}
        >
          Import {rows.length ? `(${skipDuplicates ? rows.filter((r) => !r._dup).length : rows.length})` : ""}
        </button>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">{parsing ? "Parsing…" : summary}</div>
      </div>

      {rows.length > 0 ? (
        <div className="mt-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800 overflow-hidden">
          <div className="bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-sm font-medium grid grid-cols-5">
            <div>Date</div>
            <div>Notes</div>
            <div>Account</div>
            <div>Category</div>
            <div className="text-right">Amount</div>
          </div>
          <div className="divide-y divide-zinc-200/60 dark:divide-zinc-800">
            {rows.slice(0, 50).map((r) => (
              <div key={r._key} className="grid grid-cols-5 items-center px-3 py-2 text-sm">
                <div>{r.date}</div>
                <div className="truncate" title={r.notes || ""}>
                  {(r.notes || "").toString()}
                  {(r._matched?.length ?? 0) > 0 ? (
                    <span className="ml-2 text-[10px] text-emerald-600">{r._matched.length} rule(s)</span>
                  ) : null}
                  {r._dup ? (
                    <span className="ml-2 text-[10px] text-rose-600">dup</span>
                  ) : null}
                </div>
                <div>{(accounts ?? []).find((a) => a.id === r.account_id)?.name || ""}</div>
                <div>{(categories ?? []).find((c) => c.id === r.category_id)?.name || ""}</div>
                <div className={cn("text-right font-medium", r.type === "income" ? "text-emerald-600" : "text-rose-600")}>
                  {formatCurrency(Number(r.amount || 0) * (r.type === "expense" ? -1 : 1), currency, locale)}
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 text-xs text-zinc-500">
            Showing {Math.min(50, rows.length)} of {rows.length}
          </div>
        </div>
      ) : null}
    </div>
  );
}
