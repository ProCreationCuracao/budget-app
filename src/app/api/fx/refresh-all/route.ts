import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const vercelCron = req.headers.get("x-vercel-cron") === "1";
  const secretOk = (req.nextUrl.searchParams.get("secret") || "") === (process.env.CRON_SECRET || "");
  if (!vercelCron && !secretOk) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE as string | undefined;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Missing SUPABASE env (URL or SERVICE_ROLE)" }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const date = (req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0,10)).trim();

  // Load all profiles and their base currency
  const { data: profiles, error: pErr } = await admin.from("profiles").select("id,currency");
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  let updated = 0;
  const results: any[] = [];

  for (const prof of (profiles || [])) {
    const userId = (prof as any).id as string;
    const base = (((prof as any).currency as string | null) ?? "USD").toUpperCase();

    // Collect distinct from-currencies from accounts and recent transactions (last 90d)
    const { data: accountRows } = await admin.from("accounts").select("currency").eq("user_id", userId);
    const accCurs = new Set<string>();
    for (const a of (accountRows || [])) {
      const c = ((a as any).currency as string | null)?.toUpperCase();
      if (c && c !== base) accCurs.add(c);
    }
    const ninety = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
    const { data: txRows } = await admin.from("transactions").select("currency").eq("user_id", userId).gte("date", ninety).limit(5000);
    for (const t of (txRows || [])) {
      const c = ((t as any).currency as string | null)?.toUpperCase();
      if (c && c !== base) accCurs.add(c);
    }

    for (const from of accCurs) {
      try {
        const api = `https://api.frankfurter.app/${encodeURIComponent(date)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(base)}`;
        const resp = await fetch(api, { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const rate = Number(json?.rates?.[base]);
        if (!isFinite(rate) || rate <= 0) continue;
        const payload = {
          user_id: userId,
          date,
          from_currency: from,
          to_currency: base,
          rate,
        };
        const { error } = await admin.from("fx_rates").upsert(payload, { onConflict: "user_id,date,from_currency,to_currency" });
        if (error) throw error;
        updated++;
        results.push({ userId, from, to: base, date, rate });
      } catch (e: any) {
        // Skip errors for one pair
      }
    }
  }

  return NextResponse.json({ ok: true, updated, resultsCount: results.length });
}
