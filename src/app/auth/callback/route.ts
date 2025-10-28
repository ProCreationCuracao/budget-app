import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerActionClient();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const url = new URL("/login", req.url);
      url.searchParams.set("error", error.message);
      return NextResponse.redirect(url);
    }
    return NextResponse.redirect(new URL(next, process.env.NEXT_PUBLIC_APP_URL || req.url));
  }

  const url = new URL("/login", req.url);
  url.searchParams.set("error", "Missing OAuth code");
  return NextResponse.redirect(url);
}
