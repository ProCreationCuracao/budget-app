import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { signInWithGoogle } from "@/app/actions/auth";

export default function LoginForm() {
  async function login(formData: FormData) {
    "use server";
    const supabase = await createSupabaseServerActionClient();
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <form action={login} className="space-y-4">
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
          Sign in
        </button>
      </form>
      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Continue with Google
        </button>
      </form>
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        Don&apos;t have an account? <Link href="/signup" className="underline">Sign up</Link>
      </div>
    </div>
  );
}
