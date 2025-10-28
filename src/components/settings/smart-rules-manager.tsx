"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { applySmartRules, loadSmartRules, saveSmartRules, type SmartRule } from "@/lib/smart-rules";
import { showToast } from "@/components/toast";

export default function SmartRulesManager() {
  const supabase = createSupabaseBrowserClient();
  const { data: accounts } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const { data: categories } = useQuery<{ id: string; name: string; type: "income" | "expense" }[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,type").order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const [rules, setRules] = useState<SmartRule[]>([]);
  const [cloud, setCloud] = useState<"unknown" | "on" | "off">("unknown");
  const [testNotes, setTestNotes] = useState("");
  const [testAmount, setTestAmount] = useState(0);
  const [testType, setTestType] = useState<"income" | "expense">("expense");
  const [testAccountId, setTestAccountId] = useState<string>("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/smart-rules", { cache: "no-store" });
        if (!alive) return;
        if (res.ok) {
          const data = (await res.json()) as SmartRule[];
          setRules(Array.isArray(data) ? data : []);
          setCloud("on");
        } else {
          setRules(loadSmartRules());
          setCloud("off");
        }
      } catch {
        if (!alive) return;
        setRules(loadSmartRules());
        setCloud("off");
      }
    })();
    return () => { alive = false; };
  }, []);

  async function persist(next: SmartRule[], action?: { kind: "add" | "update" | "delete"; id?: string; body?: any }) {
    if (cloud === "on") {
      try {
        if (action?.kind === "add") {
          const res = await fetch("/api/smart-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action.body) });
          if (!res.ok) throw new Error("add failed");
          const created = await res.json();
          setRules([...rules, created]);
        } else if (action?.kind === "update" && action.id) {
          const res = await fetch(`/api/smart-rules/${action.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action.body) });
          if (!res.ok) throw new Error("update failed");
          setRules(next);
        } else if (action?.kind === "delete" && action.id) {
          const res = await fetch(`/api/smart-rules/${action.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("delete failed");
          setRules(next);
        } else {
          saveSmartRules(next);
          setRules(next);
        }
        showToast("Rules saved", "success");
      } catch {
        showToast("Cloud save failed, using local storage", "error");
        saveSmartRules(next);
        setRules(next);
      }
    } else {
      saveSmartRules(next);
      setRules(next);
    }
  }

  function addRule() {
    const pr = (rules.length ? Math.max(...rules.map((r) => r.priority)) + 1 : 1);
    if (cloud === "on") {
      persist(rules, { kind: "add", body: { enabled: true, priority: pr, match: {}, action: {} } });
    } else {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const next: SmartRule = { id, enabled: true, priority: pr, match: {}, action: {} };
      persist([...rules, next]);
    }
  }

  function removeRule(id: string) {
    persist(rules.filter((r) => r.id !== id), { kind: "delete", id });
  }

  function updateRule(id: string, updater: (r: SmartRule) => SmartRule) {
    const updated = updater(rules.find((r) => r.id === id) as SmartRule);
    const next = rules.map((r) => (r.id === id ? updated : r));
    persist(next, { kind: "update", id, body: updated });
  }

  function moveRule(id: string, dir: -1 | 1) {
    const idx = rules.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= rules.length) return;
    const next = [...rules];
    const [a, b] = [next[idx], next[j]];
    const ap = a.priority;
    a.priority = b.priority;
    b.priority = ap;
    // swap positions by sorting by priority
    persist(next.sort((x, y) => x.priority - y.priority));
  }

  async function reorderRules(fromIdx: number, toIdx: number) {
    const order = [...sorted];
    const [moved] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, moved);
    const reprio = order.map((r, i) => ({ ...r, priority: i + 1 }));
    if (cloud === "on") {
      try {
        await Promise.all(
          reprio.map((r) =>
            fetch(`/api/smart-rules/${r.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ priority: r.priority }),
            })
          )
        );
        setRules(reprio);
        showToast("Rules reordered", "success");
      } catch {
        saveSmartRules(reprio);
        setRules(reprio);
        showToast("Cloud reorder failed, saved locally", "error");
      }
    } else {
      saveSmartRules(reprio);
      setRules(reprio);
    }
  }

  const sorted = useMemo(() => [...rules].sort((a, b) => a.priority - b.priority), [rules]);

  const testResult = useMemo(() => {
    const draft = {
      date: new Date().toISOString().slice(0, 10),
      amount: Number(testAmount || 0),
      type: testType,
      notes: testNotes || null,
      account_id: testAccountId || "",
      category_id: "",
    } as const;
    return applySmartRules(draft, rules, { categories: categories ?? [], accounts: accounts ?? [] });
  }, [testNotes, testAmount, testType, testAccountId, rules, accounts, categories]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Smart Rules</div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500">Cloud: {cloud === "unknown" ? "…" : cloud === "on" ? "On" : "Off"}</span>
          <button onClick={addRule} className="rounded-md border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-3 py-1.5 text-sm hover:bg-white/80 dark:hover:bg-zinc-900">Add Rule</button>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((r, i) => (
          <div
            key={r.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragIndex != null && dragIndex !== i) reorderRules(dragIndex, i); setDragIndex(null); }}
            className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 cursor-grab select-none" title="Drag to reorder">
                <GripVertical className="h-4 w-4" />
              </span>
              <input type="checkbox" checked={r.enabled} onChange={(e) => updateRule(r.id, (x) => ({ ...x, enabled: e.target.checked }))} />
              <div className="text-sm font-medium">Rule</div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => moveRule(r.id, -1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 px-2 py-1 text-xs">Up</button>
                <button onClick={() => moveRule(r.id, +1)} className="rounded-md border border-zinc-300 dark:border-zinc-800 px-2 py-1 text-xs">Down</button>
                <button onClick={() => removeRule(r.id)} className="rounded-md border border-rose-300 dark:border-rose-800 px-2 py-1 text-xs text-rose-600">Delete</button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Notes contains</div>
                <input
                  value={(r.match.notesIncludes || []).join(", ")}
                  onChange={(e) => updateRule(r.id, (x) => ({ ...x, match: { ...x.match, notesIncludes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Regex</div>
                <input
                  value={r.match.notesRegex || ""}
                  onChange={(e) => updateRule(r.id, (x) => ({ ...x, match: { ...x.match, notesRegex: e.target.value || undefined } }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Amount min</div>
                <input
                  type="number"
                  value={r.match.amountMin ?? ""}
                  onChange={(e) => updateRule(r.id, (x) => ({ ...x, match: { ...x.match, amountMin: e.target.value === "" ? undefined : Number(e.target.value) } }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Amount max</div>
                <input
                  type="number"
                  value={r.match.amountMax ?? ""}
                  onChange={(e) => updateRule(r.id, (x) => ({ ...x, match: { ...x.match, amountMax: e.target.value === "" ? undefined : Number(e.target.value) } }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Type</div>
                <select
                  value={r.match.type || ""}
                  onChange={(e) => updateRule(r.id, (x) => ({ ...x, match: { ...x.match, type: (e.target.value || undefined) as any } }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
                >
                  <option value="">Any</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Account</div>
                <select
                  value={r.match.accountId || ""}
                  onChange={(e) => updateRule(r.id, (x) => ({ ...x, match: { ...x.match, accountId: (e.target.value || undefined) as any } }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
                >
                  <option value="">Any</option>
                  {(accounts ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Set type</div>
                <select
                  value={r.action.type || ""}
                  onChange={(e) => updateRule(r.id, (x) => ({ ...x, action: { ...x.action, type: (e.target.value || undefined) as any } }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
                >
                  <option value="">No change</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Set category</div>
                <select
                  value={r.action.categoryId || ""}
                  onChange={(e) => updateRule(r.id, (x) => ({ ...x, action: { ...x.action, categoryId: (e.target.value || undefined) as any } }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
                >
                  <option value="">No change</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Set account</div>
                <select
                  value={r.action.accountId || ""}
                  onChange={(e) => updateRule(r.id, (x) => ({ ...x, action: { ...x.action, accountId: (e.target.value || undefined) as any } }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
                >
                  <option value="">No change</option>
                  {(accounts ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
        {sorted.length === 0 ? (
          <div className="text-sm text-zinc-500">No rules yet. Click Add Rule to create one.</div>
        ) : null}
      </div>

      <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-3">
        <div className="text-sm font-medium mb-2">Test rule matching</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Notes</div>
            <input value={testNotes} onChange={(e) => setTestNotes(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Amount</div>
            <input type="number" value={testAmount} onChange={(e) => setTestAmount(Number(e.target.value || 0))} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Type</div>
            <select value={testType} onChange={(e) => setTestType(e.target.value as any)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Account</div>
            <select value={testAccountId} onChange={(e) => setTestAccountId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-sm">
              <option value="">—</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Result</div>
            <div className="rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-sm">
              <div>Type: {testResult.type}</div>
              <div>Category: {categories?.find((c) => c.id === testResult.category_id)?.name || "—"}</div>
              <div>Account: {accounts?.find((a) => a.id === testResult.account_id)?.name || "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
