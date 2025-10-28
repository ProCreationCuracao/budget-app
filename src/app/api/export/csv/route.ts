import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { buildFxConverter } from "@/lib/fx";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerActionClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");
  const type = params.get("type"); // income | expense | all
  const accountId = params.get("account_id");
  const categoryId = params.get("category_id");
  const search = params.get("search");

  // Base currency from profile and fx converter
  const { data: profile } = await supabase
    .from("profiles")
    .select("currency")
    .eq("id", session.user.id)
    .single();
  const baseCurrency = ((profile?.currency as string | null) ?? "USD").toUpperCase();
  const { data: fxRows } = await supabase
    .from("fx_rates")
    .select("date,from_currency,to_currency,rate")
    .eq("user_id", session.user.id);
  const convertFx = buildFxConverter((fxRows || []) as any);
  const conv = (amount: number, from: string | null | undefined, dateISO: string) => {
    const src = (from || baseCurrency).toUpperCase();
    const v = convertFx(amount, src, baseCurrency, dateISO);
    return v == null ? (src === baseCurrency ? amount : 0) : v;
  };

  let q = supabase
    .from("transactions")
    .select("date,amount,type,notes,currency,categories:category_id(name,type),accounts:account_id(name)")
    .order("date", { ascending: true });
  if (dateFrom) q = q.gte("date", dateFrom);
  if (dateTo) q = q.lte("date", dateTo);
  if (type && type !== "all") q = q.eq("type", type);
  if (accountId) q = q.eq("account_id", accountId);
  if (categoryId) q = q.eq("category_id", categoryId);
  if (search) q = q.ilike("notes", `%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []).map((t: any) => {
    const original = Number(t.amount || 0);
    const converted = conv(original, (t as any).currency, String(t.date));
    const account = Array.isArray(t.accounts) ? t.accounts[0]?.name : t.accounts?.name;
    const category = Array.isArray(t.categories) ? t.categories[0]?.name : t.categories?.name;
    return {
      Date: t.date,
      Amount: original,
      OriginalCurrency: (t.currency as string | null) || baseCurrency,
      ConvertedAmount: converted,
      BaseCurrency: baseCurrency,
      Type: t.type,
      Account: account,
      Category: category,
      Notes: t.notes ?? "",
    };
  });
  const header = ["Date","Amount","Original Currency","Converted Amount","Base Currency","Type","Account","Category","Notes"].join(",");
  const body = rows.map((r) => [r.Date, r.Amount, r.OriginalCurrency, r.ConvertedAmount, r.BaseCurrency, r.Type, sanitize(r.Account), sanitize(r.Category), sanitize(r.Notes)].map(csvEscape).join(",")).join("\n");
  const csv = header + "\n" + body + (rows.length ? "\n" : "");
  const filename = `transactions-${new Date().toISOString().slice(0,10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
      "Cache-Control": "no-store",
    },
  });
}

function csvEscape(value: any) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function sanitize(s: string | undefined) {
  return (s ?? "").replace(/\r?\n/g, " ").trim();
}
