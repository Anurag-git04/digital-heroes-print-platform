import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { getCatalogue } from "@/lib/catalogue/data";

export const metadata: Metadata = { title: "Product division" };

async function DivisionContent({ divisionSlug }: { divisionSlug: string }) {
  const { divisions } = await getCatalogue();
  const division = divisions.find((item) => item.slug === divisionSlug);

  if (!division) {
    notFound();
  }

  return (
    <>
      <Link href="/products" className="text-sm font-semibold text-[var(--accent)]">← All products</Link>
      <div className="mt-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
          Division {String(division.sort).padStart(2, "0")}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">{division.name}</h1>
        <p className="mt-6 text-lg leading-8 text-[var(--muted)]">{division.description}</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {division.products.map((product) => (
          <ProductCard key={product.id} product={product} division={division} />
        ))}
      </div>
    </>
  );
}

export default function DivisionPage({ params }: { params: Promise<{ division: string }> }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 lg:px-10 lg:py-24">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-[var(--line)]" />}>
        <DivisionPageContent params={params} />
      </Suspense>
    </main>
  );
}

async function DivisionPageContent({ params }: { params: Promise<{ division: string }> }) {
  const { division } = await params;
  return <DivisionContent divisionSlug={division} />;
}
