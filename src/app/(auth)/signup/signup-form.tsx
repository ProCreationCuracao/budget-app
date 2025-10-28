import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";

export default function SignupForm() {
  async function signup(formData: FormData) {
    "use server";
    const supabase = await createSupabaseServerActionClient();
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const { error, data } = await supabase.auth.signUp({ email, password });
    if (error) {
      redirect(`/signup?error=${encodeURIComponent(error.message)}`);
    }
    if (!data.session) {
      redirect("/login?msg=Check your email to verify your account");
    }
    redirect("/dashboard");
  }

  return (
    <form action={signup} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Email</label>
        <input
          name="email"
          type="email"
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-600 dark:bg-zinc-950 dark:border-zinc-800"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Password</label>
        <input
          name="password"
          type="password"
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-600 dark:bg-zinc-950 dark:border-zinc-800"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-md bg-zinc-900 text-white py-2 text-sm font-medium hover:bg-zinc-800 dark:bg-white dark:text-black"
      >
        Create account
      </button>
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account? <Link href="/login" className="underline">Sign in</Link>
      </div>
    </form>
  );
}
