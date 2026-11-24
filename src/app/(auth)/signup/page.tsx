import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signUp } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
          Start a print project
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Create your account.</h1>
        <p className="mt-3 text-[var(--muted)]">Save designs, approve proofs and reorder in one click.</p>
        <AuthForm mode="signup" action={signUp} />
        <p className="mt-6 text-sm text-[var(--muted)]">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-[var(--ink)] underline underline-offset-4">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
