import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout-form";
import { requireUser } from "@/lib/auth/current-user";
import { getProductById, getProductBySlug } from "@/lib/catalogue/data";
import { calculatePrice, configurationSchema } from "@/lib/pricing/calculatePrice";
import { formatMoney } from "@/lib/pricing/formatMoney";
import { hasStripeConfig } from "@/lib/checkout/stripe";

export const metadata: Metadata = { title: "Checkout" };

type CheckoutSearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

async function CheckoutContent({ searchParams }: { searchParams: CheckoutSearchParams }) {
  await requireUser();
  const params = await searchParams;
  const productSlug = single(params.product);

  if (!productSlug) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">No product selected.</h1>
        <p className="mt-4 text-[var(--muted)]">Choose a product and configure it before checkout.</p>
        <Link href="/products" className="mt-8 inline-block rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-white">
          Browse products
        </Link>
      </div>
    );
  }

  const product = (await getProductBySlug(productSlug)) ?? (await getProductById(productSlug));

  if (!product) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Product not found.</h1>
        <Link href="/products" className="mt-8 inline-block font-semibold text-[var(--accent)]">Back to products</Link>
      </div>
    );
  }

  const parsed = configurationSchema.safeParse({
    widthMm: Number(single(params.w)),
    heightMm: Number(single(params.h)),
    materialId: single(params.material),
    orientation: single(params.orientation),
    quantity: Number(single(params.qty)),
  });

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Check your configuration.</h1>
        <p className="mt-4 text-[var(--muted)]">Some product options are missing or invalid.</p>
        <Link href={`/products/${product.division.slug}/${product.slug}`} className="mt-8 inline-block font-semibold text-[var(--accent)]">
          Reconfigure product
        </Link>
      </div>
    );
  }

  let price;

  try {
    price = calculatePrice(product, parsed.data);
  } catch (error) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Check your configuration.</h1>
        <p className="mt-4 text-[var(--muted)]">{error instanceof Error ? error.message : "Invalid options."}</p>
        <Link href={`/products/${product.division.slug}/${product.slug}`} className="mt-8 inline-block font-semibold text-[var(--accent)]">
          Reconfigure product
        </Link>
      </div>
    );
  }

  const material = product.config.materials.find((item) => item.id === parsed.data.materialId);
  const stripeReady = hasStripeConfig();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link href={`/products/${product.division.slug}/${product.slug}`} className="text-sm font-semibold text-[var(--accent)]">← Back to configurator</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Order summary</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{product.name}</h1>
          <p className="mt-3 leading-7 text-[var(--muted)]">{product.description}</p>
          <dl className="mt-8 grid gap-4 border-t border-[var(--line)] pt-6 text-sm sm:grid-cols-2">
            <div><dt className="text-[var(--muted)]">Size</dt><dd className="mt-1 font-medium">{parsed.data.widthMm} × {parsed.data.heightMm} mm</dd></div>
            <div><dt className="text-[var(--muted)]">Material</dt><dd className="mt-1 font-medium">{material?.name}</dd></div>
            <div><dt className="text-[var(--muted)]">Orientation</dt><dd className="mt-1 font-medium capitalize">{parsed.data.orientation}</dd></div>
            <div><dt className="text-[var(--muted)]">Quantity</dt><dd className="mt-1 font-medium">{parsed.data.quantity}</dd></div>
          </dl>
        </section>

        <aside className="h-fit rounded-2xl bg-[var(--ink)] p-6 text-white sm:p-8">
          <p className="text-sm text-white/60">Total including VAT</p>
          <p className="mt-1 text-4xl font-semibold tracking-[-0.04em]">{formatMoney(price.total)}</p>
          <dl className="mt-6 space-y-2 border-t border-white/15 pt-5 text-sm">
            <div className="flex justify-between"><dt className="text-white/60">Subtotal</dt><dd>{formatMoney(price.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-white/60">VAT</dt><dd>{formatMoney(price.vat)}</dd></div>
            {price.discountPercent > 0 && <div className="flex justify-between"><dt className="text-white/60">Volume saving</dt><dd>{price.discountPercent}%</dd></div>}
          </dl>
          <CheckoutForm
            productId={product.id}
            widthMm={parsed.data.widthMm}
            heightMm={parsed.data.heightMm}
            materialId={parsed.data.materialId}
            orientation={parsed.data.orientation}
            quantity={parsed.data.quantity}
            designId={single(params.design)}
            disabled={!stripeReady}
          />
          {!stripeReady && (
            <p className="mt-3 text-center text-xs text-amber-200">Stripe test keys are required to enable payment.</p>
          )}
          <p className="mt-4 text-center text-xs leading-5 text-white/50">
            Secure Stripe checkout. The final price is recalculated on the server.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default function CheckoutPage({ searchParams }: { searchParams: CheckoutSearchParams }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 lg:px-10 lg:py-24">
      <Suspense fallback={<div className="mx-auto h-96 max-w-5xl animate-pulse rounded-2xl bg-[var(--line)]" />}>
        <CheckoutContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
