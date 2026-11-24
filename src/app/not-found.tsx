import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        404 · Not found
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
        We couldn&apos;t find that page.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-[var(--muted)]">
        The link may be out of date, or that order belongs to a different account.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/products"
          className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)]"
        >
          Browse products
        </Link>
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
