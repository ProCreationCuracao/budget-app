import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerActionClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const date = (req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0,10)).trim();
  const daysParam = Number(req.nextUrl.searchParams.get("days") || 1);
  const days = isFinite(daysParam) && daysParam > 1 ? Math.min(365, Math.floor(daysParam)) : 1;

  // Base currency from profile
  const { data: profile, error: pErr } = await supabase
    .from("profiles").select("currency").eq("id", session.user.id).single();
  if (pErr || !profile) return NextResponse.json({ ok: false, error: pErr?.message || "profile" }, { status: 500 });
  const base = ((profile.currency as string | null) ?? "USD").toUpperCase();

  // Collect distinct currencies to fetch: account currencies + transaction currencies
  const pairs = new Set<string>();
  const { data: accounts } = await supabase.from("accounts").select("currency").eq("user_id", session.user.id);
  for (const a of (accounts || [])) {
    const c = ((a as any).currency as string | null)?.toUpperCase();
    if (c && c !== base) pairs.add(`${c}|${base}`);
  }
  const { data: txCurs } = await supabase
    .from("transactions")
    .select("currency")
    .eq("user_id", session.user.id)
    .limit(2000);
  for (const t of (txCurs || [])) {
    const c = ((t as any).currency as string | null)?.toUpperCase();
    if (c && c !== base) pairs.add(`${c}|${base}`);
  }

  // Fetch each pair from Frankfurter and upsert
  const results: any[] = [];
  for (const key of pairs) {
    const [from, to] = key.split("|");
    try {
      if (days === 1) {
        const url = `https://api.frankfurter.app/${encodeURIComponent(date)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const rate = Number(json?.rates?.[to]);
        if (!isFinite(rate) || rate <= 0) continue;
        const payload = { user_id: session.user.id, date, from_currency: from, to_currency: to, rate };
        const { error } = await supabase.from("fx_rates").upsert(payload, { onConflict: "user_id,date,from_currency,to_currency" });
        if (error) throw error;
        results.push({ from, to, date, rate });
      } else {
        const start = new Date(date + "T00:00:00");
        start.setDate(start.getDate() - (days - 1));
        const startStr = start.toISOString().slice(0,10);
        const url = `https://api.frankfurter.app/${encodeURIComponent(startStr)}..${encodeURIComponent(date)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const rates = json?.rates || {};
        for (const d of Object.keys(rates)) {
          const rate = Number(rates[d]?.[to]);
          if (!isFinite(rate) || rate <= 0) continue;
          const payload = { user_id: session.user.id, date: d, from_currency: from, to_currency: to, rate };
          const { error } = await supabase.from("fx_rates").upsert(payload, { onConflict: "user_id,date,from_currency,to_currency" });
          if (error) throw error;
          results.push({ from, to, date: d, rate });
        }
      }
    } catch (e: any) {
      // Skip silently per pair
    }
  }
  return NextResponse.json({ ok: true, updated: results.length, results });
}
