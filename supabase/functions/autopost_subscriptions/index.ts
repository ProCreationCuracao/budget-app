// Supabase Edge Function: autopost_subscriptions
// - Posts due subscription charges as transactions and advances next_charge_date
// - Idempotent via unique index on transactions(subscription_id, date)
// - Supports legacy schemas (frequency/next_due) as fallback

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Interval = "day" | "week" | "month" | "year";

function addInterval(d: Date, interval: Interval, every: number) {
  const dt = new Date(d);
  if (interval === "day") dt.setDate(dt.getDate() + every);
  else if (interval === "week") dt.setDate(dt.getDate() + every * 7);
  else if (interval === "month") dt.setMonth(dt.getMonth() + every);
  else if (interval === "year") dt.setFullYear(dt.getFullYear() + every);
  return dt;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const targetDate = dateParam ?? new Date().toISOString().slice(0, 10);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "Missing Supabase env" }), { status: 500 });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 1) Fetch due subscriptions (modern schema)
    let rows: any[] = [];
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id,user_id,name,amount,interval,every,next_charge_date,account_id,category_id,active,auto_post")
        .eq("active", true)
        .eq("auto_post", true)
        .lte("next_charge_date", targetDate)
        .limit(1000);
      if (error) throw error;
      rows = (data as any[]) || [];
    } catch (_e1) {
      // Legacy fallback: frequency/next_due
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id,user_id,name,amount,frequency,next_due,account_id,category_id,active,auto_post")
        .eq("active", true)
        .eq("auto_post", true)
        .lte("next_due", targetDate)
        .limit(1000);
      if (error) throw error;
      const freqMap = (f: string): { interval: Interval; every: number } => {
        const x = String(f || "monthly");
        if (x === "weekly") return { interval: "week", every: 1 };
        if (x === "monthly") return { interval: "month", every: 1 };
        if (x === "yearly") return { interval: "year", every: 1 };
        if (x === "quarterly") return { interval: "month", every: 3 };
        return { interval: "month", every: 1 };
      };
      rows = ((data as any[]) || []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        amount: Number(r.amount || 0),
        interval: freqMap(r.frequency).interval,
        every: freqMap(r.frequency).every,
        next_charge_date: r.next_due,
        account_id: r.account_id ?? null,
        category_id: r.category_id ?? null,
        active: r.active !== false,
        auto_post: !!r.auto_post,
      }));
    }

    // 2) Build transaction rows (only for subscriptions with account)
    const due = rows.filter((r) => r.active !== false && r.auto_post && !!r.account_id);
    const txRows = due.map((s) => ({
      user_id: s.user_id,
      date: s.next_charge_date,
      type: "expense" as const,
      amount: Number(s.amount || 0),
      account_id: s.account_id as string,
      category_id: s.category_id ?? null,
      notes: `Subscription: ${s.name}`,
      subscription_id: s.id,
    }));

    // 3) Upsert transactions idempotently on (subscription_id, date)
    if (txRows.length) {
      const { error: upErr } = await supabase
        .from("transactions")
        .upsert(txRows as any, { onConflict: "subscription_id,date", ignoreDuplicates: true });
      if (upErr) throw upErr;
    }

    // 4) Advance next_charge_date for posted subscriptions
    for (const s of due) {
      try {
        const step = Math.max(1, Number(s.every || 1));
        let d = new Date(String(s.next_charge_date) + "T00:00:00");
        d = addInterval(d, s.interval as Interval, step);
        const nextStr = d.toISOString().slice(0, 10);
        // Try modern column first
        let { error: updErr } = await supabase.from("subscriptions").update({ next_charge_date: nextStr }).eq("id", s.id);
        if (updErr) {
          // Legacy fallback
          const { error: updErr2 } = await supabase.from("subscriptions").update({ next_due: nextStr } as any).eq("id", s.id);
          if (updErr2) throw updErr2;
        }
      } catch (_e) {
        // continue advancing others
      }
    }

    return new Response(JSON.stringify({ posted: txRows.length, advanced: due.length, asOf: targetDate }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message || String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
