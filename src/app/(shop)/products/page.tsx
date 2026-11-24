import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { getCatalogue } from "@/lib/catalogue/data";

export const metadata: Metadata = {
  title: "Products",
  description: "Configure custom print products across all six Digital Heroes divisions.",
};

async function CatalogueContent() {
  const { divisions } = await getCatalogue();

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        The product hub
      </p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
        Built around your job, not a shelf full of SKUs.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        Every product is configured to your size, material and quantity, with a live price before you commit.
      </p>

      <div className="mt-16 space-y-16">
        {divisions.map((division) => (
          <section key={division.id}>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-4">
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">
                  Division {String(division.sort).padStart(2, "0")}
                </p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight">{division.name}</h2>
              </div>
              <Link href={`/products/${division.slug}`} className="text-sm font-semibold text-[var(--accent)]">
                View division →
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {division.products.map((product) => (
                <ProductCard key={product.id} product={product} division={division} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default function ProductsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 lg:px-10 lg:py-24">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-[var(--line)]" />}>
        <CatalogueContent />
      </Suspense>
    </main>
  );
}
