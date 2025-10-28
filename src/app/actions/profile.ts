"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createSupabaseServerActionClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const display_name = String(formData.get("display_name") ?? "");
  const currency = String(formData.get("currency") ?? "");
  const locale = String(formData.get("locale") ?? "");
  const start_of_month = Number(formData.get("start_of_month") ?? 1);
  const theme = String(formData.get("theme") ?? "system");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name, currency, locale, start_of_month, theme })
    .eq("id", session.user.id);

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}
