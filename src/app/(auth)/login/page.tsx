import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Log in" };

async function LoginDetails({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const { message, next } = await searchParams;

  return (
    <>
      {message && (
        <p className="mt-6 rounded-xl bg-white px-4 py-3 text-sm text-[var(--muted)]">
          {message}
        </p>
      )}
      <AuthForm mode="login" action={signIn} nextPath={next} />
    </>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  return (
    <main className="flex flex-1 items-center px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
          Customer access
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Welcome back.</h1>
        <p className="mt-3 text-[var(--muted)]">Log in to manage designs, proofs and orders.</p>
        <Suspense fallback={<div className="mt-8 h-72 animate-pulse rounded-2xl bg-[var(--line)]" />}>
          <LoginDetails searchParams={searchParams} />
        </Suspense>
        <p className="mt-6 text-sm text-[var(--muted)]">
          New here?{" "}
          <Link href="/signup" className="font-medium text-[var(--ink)] underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
