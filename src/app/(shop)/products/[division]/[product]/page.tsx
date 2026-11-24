import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductConfigurator } from "@/components/product-configurator";
import { getProductBySlug } from "@/lib/catalogue/data";

export const metadata: Metadata = { title: "Configure product" };

async function ProductContent({
  divisionSlug,
  productSlug,
}: {
  divisionSlug: string;
  productSlug: string;
}) {
  const product = await getProductBySlug(productSlug);

  if (!product || product.division.slug !== divisionSlug) {
    notFound();
  }

  return (
    <>
      <nav className="flex flex-wrap gap-2 text-sm text-[var(--muted)]" aria-label="Breadcrumb">
        <Link href="/products" className="hover:text-[var(--ink)]">Products</Link>
        <span>/</span>
        <Link href={`/products/${product.division.slug}`} className="hover:text-[var(--ink)]">
          {product.division.name}
        </Link>
        <span>/</span>
        <span className="text-[var(--ink)]">{product.name}</span>
      </nav>

      <div className="mt-10 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
          {product.division.name}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">{product.name}</h1>
        <p className="mt-6 text-lg leading-8 text-[var(--muted)]">{product.description}</p>
      </div>

      <div className="mt-10">
        <ProductConfigurator product={product} />
      </div>

      <section className="mt-12 grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Print resolution</p>
          <p className="mt-2 font-semibold">{product.template?.dpi ?? 300} DPI</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Bleed</p>
          <p className="mt-2 font-semibold">{product.template?.bleedMm ?? 3} mm</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Variable data</p>
          <p className="mt-2 font-semibold">{product.config.designer.csv_merge ? "CSV merge ready" : "Single design"}</p>
        </div>
      </section>
    </>
  );
}

export default function ProductPage({
  params,
}: {
  params: Promise<{ division: string; product: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 lg:px-10 lg:py-24">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-[var(--line)]" />}>
        <ProductPageContent params={params} />
      </Suspense>
    </main>
  );
}

async function ProductPageContent({ params }: { params: Promise<{ division: string; product: string }> }) {
  const { division, product } = await params;
  return <ProductContent divisionSlug={division} productSlug={product} />;
}
