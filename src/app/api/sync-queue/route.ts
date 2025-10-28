import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";

// Request shape coming from offline queue
// { items: Array<{ id: string, kind: "add-transaction", payload: { type: "expense"|"income"|"transfer", amount: number, date: string, categoryId?: string, notes?: string, accountId?: string, fromAccountId?: string, toAccountId?: string } }> }

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerActionClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    const uid = session.user.id;

    const body = (await req.json()) as any;
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) return NextResponse.json({ ok: true, processedIds: [] });

    // Load accounts and currencies once
    const { data: accountRows, error: accErr } = await supabase
      .from("accounts")
      .select("id,currency")
      .order("created_at", { ascending: true });
    if (accErr) return NextResponse.json({ ok: false, error: accErr.message }, { status: 500 });
    const accountId = accountRows?.[0]?.id as string | undefined;
    if (!accountId) return NextResponse.json({ ok: false, error: "no_account" }, { status: 400 });
    const accCurrency = new Map<string, string>();
    for (const a of accountRows || []) accCurrency.set(a.id as string, (a as any).currency || "USD");

    const processed: string[] = [];
    const retry: string[] = [];

    // Resolve category helper: accepts categoryId which may be a UUID or a name; fallback by name.
    async function resolveCategoryId(kind: "income" | "expense", categoryId?: string): Promise<string | null> {
      if (!categoryId) return null;
      const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoryId);
      if (looksUuid) return categoryId;
      const { data } = await supabase
        .from("categories")
        .select("id")
        .eq("name", categoryId)
        .eq("type", kind)
        .limit(1)
        .maybeSingle();
      return (data as any)?.id ?? null;
    }

    // Build inserts for supported items and track unsupported to retry later
    const inserts: any[] = [];
    const supportedIds: string[] = [];

    for (const item of items) {
      if (!item || item.kind !== "add-transaction") { retry.push(item?.id); continue; }
      const p = item.payload || {};
      if (!p.amount || !p.date) { retry.push(item.id); continue; }
      if (p.type === "transfer") {
        const fromAcc = p.fromAccountId || accountId;
        const toAcc = p.toAccountId || accountId;
        if (!fromAcc || !toAcc || fromAcc === toAcc) { retry.push(item.id); continue; }
        // Represent transfer as two rows: expense from source, income to destination
        const transferGroup = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
        inserts.push({
          date: p.date,
          amount: p.amount,
          type: "expense",
          category_id: null,
          account_id: fromAcc,
          notes: p.notes ?? null,
          user_id: uid,
          currency: accCurrency.get(fromAcc) || "USD",
          transfer_group: transferGroup,
        });
        inserts.push({
          date: p.date,
          amount: p.amount,
          type: "income",
          category_id: null,
          account_id: toAcc,
          notes: p.notes ?? null,
          user_id: uid,
          currency: accCurrency.get(toAcc) || "USD",
          transfer_group: transferGroup,
        });
        supportedIds.push(item.id);
        continue;
      }
      // income/expense
      const catId = await resolveCategoryId(p.type, p.categoryId);
      const acc = p.accountId || accountId;
      if (!acc) { retry.push(item.id); continue; }
      inserts.push({
        date: p.date,
        amount: p.amount,
        type: p.type, // "income" | "expense"
        category_id: catId,
        account_id: acc,
        notes: p.notes ?? null,
        user_id: uid,
        currency: accCurrency.get(acc) || "USD",
      });
      supportedIds.push(item.id);
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("transactions").insert(inserts);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      processed.push(...supportedIds);
    }

    // Items left in retry include unsupported or invalid; client will keep them queued
    return NextResponse.json({ ok: true, processedIds: processed, retry });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
