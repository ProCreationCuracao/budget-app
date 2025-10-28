import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignupForm from "./signup-form";

export default async function SignupPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur border border-zinc-200/60 dark:border-zinc-800 p-6 shadow-md">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Start tracking your budget</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
