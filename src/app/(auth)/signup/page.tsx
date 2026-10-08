import Link from "next/link";
import { signUp } from "../actions";
import { FormField } from "@/components/form-field";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-serif text-3xl text-ink">Create your account</h1>
      <p className="mt-2 text-ink/60">Upload a CV once, tailor it for as many roles as you need.</p>

      {searchParams.error && (
        <p className="mt-4 rounded-sm border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber-dark">
          {searchParams.error}
        </p>
      )}

      <form action={signUp} className="mt-8 space-y-4">
        <FormField label="Full name" name="fullName" />
        <FormField label="Email" name="email" type="email" />
        <FormField label="Password" name="password" type="password" />
        <button
          type="submit"
          className="w-full rounded-sm bg-navy px-6 py-3 font-medium text-paper hover:bg-navy-dark"
        >
          Create account
        </button>
      </form>

      <p className="mt-6 text-sm text-ink/60">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-navy underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
