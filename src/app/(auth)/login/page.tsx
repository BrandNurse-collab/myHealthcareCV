import Link from "next/link";
import { signIn } from "../actions";
import { FormField } from "@/components/form-field";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-serif text-3xl text-ink">Sign in</h1>
      <p className="mt-2 text-ink/60">Continue optimizing your CV.</p>

      {searchParams.error && (
        <p className="mt-4 rounded-sm border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber-dark">
          {searchParams.error}
        </p>
      )}

      <form action={signIn} className="mt-8 space-y-4">
        <FormField label="Email" name="email" type="email" />
        <FormField label="Password" name="password" type="password" />
        <button
          type="submit"
          className="w-full rounded-sm bg-navy px-6 py-3 font-medium text-paper hover:bg-navy-dark"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-sm text-ink/60">
        New here?{" "}
        <Link href="/signup" className="font-medium text-navy underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </main>
  );
}
