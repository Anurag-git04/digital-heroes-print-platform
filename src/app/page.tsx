import Link from "next/link";
import { Suspense } from "react";
import { ProductConfigurator } from "@/components/product-configurator";
import { getCatalogue } from "@/lib/catalogue/data";

async function DivisionGrid() {
  const { divisions } = await getCatalogue();

  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
      {divisions.map((division) => (
        <Link
          key={division.id}
          href={`/products/${division.slug}`}
          className="group bg-[var(--paper)] p-6 transition hover:bg-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted)]">
              {String(division.sort).padStart(2, "0")}
            </span>
            <span className="text-lg transition group-hover:translate-x-1 group-hover:text-[var(--accent)]">→</span>
          </div>
          <h2 className="mt-10 text-2xl font-medium tracking-tight">{division.name}</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{division.description}</p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            {division.products.length} {division.products.length === 1 ? "product" : "products"}
          </p>
        </Link>
      ))}
    </div>
  );
}

async function FeaturedCalculator() {
  const { divisions } = await getCatalogue();
  const product = divisions[0]?.products[0];

  if (!product) {
    return null;
  }

  return (
    <section className="mt-24 border-t border-[var(--line)] pt-16">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
            Instant price calculator
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Know your price before you order.
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
          Change the size, material or quantity. Volume savings and VAT update instantly.
        </p>
      </div>
      <ProductConfigurator product={product} compact />
    </section>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      <section>
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
          Six divisions. One print platform.
        </p>
        <h1 className="max-w-5xl text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl lg:text-8xl">
          From first idea to print-ready.
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          Configure your product, design inside the print area, approve a proof
          and order with confidence.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/products"
            className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)]"
          >
            Explore products
          </Link>
          <Link
            href="/gallery"
            className="rounded-full border border-[var(--line)] px-6 py-3 text-sm font-semibold transition hover:border-[var(--ink)]"
          >
            View live work
          </Link>
        </div>
      </section>

      <section className="mt-20" aria-labelledby="divisions-heading">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="divisions-heading" className="text-sm font-semibold uppercase tracking-[0.2em]">
            Choose your division
          </h2>
          <span className="text-sm text-[var(--muted)]">One platform, six specialist teams</span>
        </div>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-[var(--line)]" />}>
          <DivisionGrid />
        </Suspense>
      </section>

      <Suspense fallback={<div className="mt-24 h-96 animate-pulse rounded-2xl bg-[var(--line)]" />}>
        <FeaturedCalculator />
      </Suspense>
    </main>
  );
}
