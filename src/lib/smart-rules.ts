"use client";

export type SmartRuleMatch = {
  notesIncludes?: string[]; // case-insensitive contains
  notesRegex?: string; // optional regex string
  amountMin?: number;
  amountMax?: number;
  accountId?: string;
  type?: "income" | "expense";
};

export type SmartRuleAction = {
  type?: "income" | "expense";
  categoryId?: string;
  categoryName?: string; // optional; will be resolved at apply time
  accountId?: string;
};

export type SmartRule = {
  id: string;
  enabled: boolean;
  priority: number; // lower runs first
  match: SmartRuleMatch;
  action: SmartRuleAction;
};

const KEY = "smart-rules-v1";

export function loadSmartRules(): SmartRule[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r && typeof r === "object");
  } catch {
    return [];
  }
}

export function saveSmartRules(rules: SmartRule[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rules));
  } catch {}
}

export type ApplyContext = {
  categories: { id: string; name: string; type: "income" | "expense" }[];
  accounts: { id: string; name: string }[];
};

export type TxDraft = {
  date: string;
  amount: number;
  type: "income" | "expense";
  notes: string | null;
  account_id: string;
  category_id: string;
};

export type ApplyTrace = { result: TxDraft; matched: string[] };

export function applySmartRulesWithTrace(draft: TxDraft, rules: SmartRule[], ctx: ApplyContext): ApplyTrace {
  if (!rules?.length) return { result: draft, matched: [] };
  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);
  let out = { ...draft };
  const matched: string[] = [];
  for (const rule of sorted) {
    if (matches(out, rule.match)) {
      matched.push(rule.id);
      out = applyAction(out, rule.action, ctx);
    }
  }
  return { result: out, matched };
}

export function applySmartRules(draft: TxDraft, rules: SmartRule[], ctx: ApplyContext): TxDraft {
  return applySmartRulesWithTrace(draft, rules, ctx).result;
}

function matches(d: TxDraft, m: SmartRuleMatch): boolean {
  if (m.type && d.type !== m.type) return false;
  if (m.accountId && d.account_id !== m.accountId) return false;
  if (m.amountMin != null && d.amount < m.amountMin) return false;
  if (m.amountMax != null && d.amount > m.amountMax) return false;
  if (m.notesIncludes && m.notesIncludes.length > 0) {
    const n = (d.notes || "").toLowerCase();
    const ok = m.notesIncludes.some((s) => n.includes(s.toLowerCase()));
    if (!ok) return false;
  }
  if (m.notesRegex) {
    try {
      const re = new RegExp(m.notesRegex, "i");
      if (!re.test(d.notes || "")) return false;
    } catch {
      // ignore invalid regex
    }
  }
  return true;
}

function applyAction(d: TxDraft, a: SmartRuleAction, ctx: ApplyContext): TxDraft {
  let out = { ...d };
  if (a.type) out.type = a.type;
  if (a.accountId) out.account_id = a.accountId;
  if (a.categoryId) out.category_id = a.categoryId;
  if (!a.categoryId && a.categoryName) {
    const targetList = ctx.categories.filter((c) => !a.type || c.type === a.type);
    const found = targetList.find((c) => c.name.toLowerCase() === a.categoryName!.toLowerCase());
    if (found) out.category_id = found.id;
  }
  return out;
}
