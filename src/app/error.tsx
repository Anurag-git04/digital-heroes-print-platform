"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        Something went wrong
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
        We hit a snag loading this page.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-[var(--muted)]">
        Your saved designs and orders are safe. Try reloading this view, or head back to the storefront.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-[var(--line)] bg-white px-6 py-3 text-sm font-semibold transition hover:border-[var(--ink)]"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
