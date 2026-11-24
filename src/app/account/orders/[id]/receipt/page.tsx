import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintReceiptButton } from "@/components/print-receipt-button";
import { requireUser } from "@/lib/auth/current-user";
import { getOwnedOrderReceipt } from "@/lib/account/data";
import { formatMoney } from "@/lib/pricing/formatMoney";

export const metadata: Metadata = { title: "Order receipt" };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}

async function ReceiptContent({ orderId }: { orderId: string }) {
  const user = await requireUser();
  const receipt = await getOwnedOrderReceipt(orderId, user);

  if (!receipt) {
    notFound();
  }

  const { order, customer, items, latestProof } = receipt;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link href="/account" className="text-sm font-semibold text-[var(--accent)]">
          ← Back to account
        </Link>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/account/orders/${order.id}/proof`}
            className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold transition hover:border-[var(--ink)]"
          >
            View proof
          </Link>
          <PrintReceiptButton />
        </div>
      </div>

      <article className="rounded-2xl border border-[var(--line)] bg-white p-8 sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[var(--line)] pb-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="relative grid size-9 place-items-center rounded-xl bg-[#1f4d36] text-sm font-bold tracking-tight text-[#f5f3ee]">
                DH
                <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--accent)]" />
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.16em]">
                Digital Heroes
              </span>
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">
              Web-to-Print Production Platform · VAT Receipt
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {order.paidAt ? "Paid receipt" : "Order quote"}
            </p>
            <h1 className="mt-1 font-mono text-2xl font-semibold">{order.invoiceNumber}</h1>
            <p className="mt-1 text-xs text-[var(--muted)]">Order ref: {order.reference}</p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-[var(--line)] py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Billed to
            </p>
            <p className="mt-2 font-semibold">{customer.fullName || "Registered customer"}</p>
            <p className="mt-0.5 text-[var(--muted)]">{customer.email}</p>
          </div>

          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Order dates
            </p>
            <p className="mt-2">
              <span className="text-[var(--muted)]">Issued:</span> {formatDate(order.createdAt)}
            </p>
            {order.paidAt && (
              <p className="mt-0.5">
                <span className="text-[var(--muted)]">Paid:</span> {formatDate(order.paidAt)}
              </p>
            )}
            <p className="mt-0.5 capitalize">
              <span className="text-[var(--muted)]">Status:</span> {order.status}
              {latestProof ? ` · Proof v${latestProof.version} (${latestProof.status.replace("_", " ")})` : ""}
            </p>
          </div>
        </section>

        <section className="overflow-x-auto py-6">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                <th className="pb-3 font-semibold">Item &amp; specification</th>
                <th className="pb-3 text-right font-semibold">Qty</th>
                <th className="pb-3 text-right font-semibold">Unit ex. VAT</th>
                <th className="pb-3 text-right font-semibold">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-4 pr-4">
                    <p className="font-semibold">{item.productName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {[
                        item.config.widthMm && item.config.heightMm
                          ? `${item.config.widthMm} × ${item.config.heightMm} mm`
                          : null,
                        item.config.materialName ?? null,
                        item.config.orientation ?? null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Custom print job"}
                    </p>
                  </td>
                  <td className="py-4 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-4 text-right tabular-nums">
                    {formatMoney(item.unitPrice, order.currency)}
                  </td>
                  <td className="py-4 text-right font-medium tabular-nums">
                    {formatMoney(item.lineTotal, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="flex justify-end border-t border-[var(--line)] pt-6">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Subtotal ex. VAT</dt>
              <dd className="tabular-nums">{formatMoney(order.subtotal, order.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">VAT (20%)</dt>
              <dd className="tabular-nums">{formatMoney(order.vat, order.currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-[var(--line)] pt-3 text-base font-semibold">
              <dt>Total ({order.currency})</dt>
              <dd className="tabular-nums">{formatMoney(order.total, order.currency)}</dd>
            </div>
          </dl>
        </section>

        <footer className="mt-10 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]">
          Thank you for ordering with Digital Heroes. Use your browser&apos;s Print dialog to save this receipt as a PDF.
        </footer>
      </article>
    </div>
  );
}

async function ReceiptRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptContent orderId={id} />;
}

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-14 lg:px-10 lg:py-20 print:px-0 print:py-0">
      <Suspense fallback={<div className="mx-auto h-[520px] max-w-3xl animate-pulse rounded-2xl bg-[var(--line)]" />}>
        <ReceiptRoute params={params} />
      </Suspense>
    </main>
  );
}
