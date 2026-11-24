import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { markOrderPaid } from "@/lib/checkout/orders";
import { getStripe, hasStripeConfig } from "@/lib/checkout/stripe";
import { formatMoney } from "@/lib/pricing/formatMoney";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Payment received" };

async function SuccessContent({ sessionId }: { sessionId?: string }) {
  const user = await requireUser();

  if (!sessionId || !hasStripeConfig()) {
    return <PaymentMessage title="Checkout is not complete." message="A valid Stripe session and server configuration are required." />;
  }

  let session;

  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return <PaymentMessage title="We could not verify that payment." message="Please return to your account and check the order status." />;
  }

  if (session.metadata?.userId !== user.id || session.client_reference_id !== user.id) {
    notFound();
  }

  const { paid } = await markOrderPaid(session);
  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, currency, total, status, paid_at, created_at")
    .eq("id", session.metadata?.orderId ?? "")
    .maybeSingle();

  if (!order || order.user_id !== user.id) {
    notFound();
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("id, quantity, unit_price, line_total, config, product_id")
    .eq("order_id", order.id);

  const productIds = [...new Set((items ?? []).map((item) => item.product_id))];
  const { data: products } = productIds.length > 0
    ? await supabase.from("products").select("id, name").in("id", productIds)
    : { data: [] };
  const productNames = new Map((products ?? []).map((product) => [product.id, product.name]));

  if (!paid) {
    return <PaymentMessage title="Payment is still processing." message="Stripe has not confirmed this payment yet. Refresh this page shortly." />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="grid size-14 place-items-center rounded-full bg-green-100 text-2xl text-green-700">✓</div>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Payment confirmed</p>
      <h1 className="mt-3 text-5xl font-semibold tracking-[-0.05em]">Your order is in.</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
        We have saved your configuration and payment against your account. The next step is artwork and proof approval.
      </p>

      <section className="mt-10 rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap justify-between gap-3 border-b border-[var(--line)] pb-5">
          <div><p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Order</p><p className="mt-1 font-mono text-sm font-semibold">{order.id.slice(0, 8).toUpperCase()}</p></div>
          <div><p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Paid</p><p className="mt-1 font-semibold">{formatMoney(order.total, order.currency.toUpperCase())}</p></div>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {(items ?? []).map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 py-5">
              <div>
                <p className="font-semibold">{productNames.get(item.product_id) ?? "Print product"}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Quantity {item.quantity}</p>
              </div>
              <p className="font-medium">{formatMoney(item.line_total, order.currency.toUpperCase())}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/account/orders/${order.id}/proof`} className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)]">Review your proof</Link>
        <Link href="/account" className="rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-white">Go to account</Link>
        <Link href="/products" className="rounded-full border border-[var(--line)] px-6 py-3 text-sm font-semibold">Start another order</Link>
      </div>
    </div>
  );
}

function PaymentMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 leading-7 text-[var(--muted)]">{message}</p>
      <Link href="/account" className="mt-8 inline-block rounded-full bg-[var(--ink)] px-6 py-3 font-semibold text-white">Go to account</Link>
    </div>
  );
}

export default function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 lg:px-10 lg:py-24">
      <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse rounded-2xl bg-[var(--line)]" />}>
        <SuccessPageContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SuccessPageContent({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  return <SuccessContent sessionId={session_id} />;
}
