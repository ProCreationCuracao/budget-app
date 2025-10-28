import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateProfile } from "@/app/actions/profile";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("email, display_name, currency, locale, start_of_month, theme")
    .eq("id", session.user.id)
    .single();

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  return (
    <div className="min-h-[60vh] p-6 grid place-items-start">
      <div className="w-full max-w-xl rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur border border-zinc-200/60 dark:border-zinc-800 p-6 shadow-md">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Welcome</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Let's set up your preferences</p>
        </div>
        <form action={updateProfile} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Display name</label>
            <input
              name="display_name"
              type="text"
              defaultValue={profile?.display_name ?? ''}
              placeholder="e.g., Alex"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-600 dark:bg-zinc-950 dark:border-zinc-800"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Currency</label>
              <input
                name="currency"
                type="text"
                defaultValue={profile?.currency ?? 'USD'}
                placeholder="USD, EUR, GBP"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-600 dark:bg-zinc-950 dark:border-zinc-800"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Locale</label>
              <input
                name="locale"
                type="text"
                defaultValue={profile?.locale ?? 'en-US'}
                placeholder="en-US, fr-FR"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-600 dark:bg-zinc-950 dark:border-zinc-800"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Start of month</label>
              <select
                name="start_of_month"
                defaultValue={String(profile?.start_of_month ?? 1)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-600 dark:bg-zinc-950 dark:border-zinc-800"
              >
                {Array.from({ length: 28 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Theme</label>
              <select
                name="theme"
                defaultValue={profile?.theme ?? 'system'}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-600 dark:bg-zinc-950 dark:border-zinc-800"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="amoled">AMOLED</option>
              </select>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              className="w-full sm:w-auto rounded-md bg-zinc-900 text-white px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:bg-white dark:text-black"
            >
              Save and continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
