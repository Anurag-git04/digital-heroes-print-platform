import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DeleteDesignButton } from "@/components/delete-design-button";
import { ReorderButton } from "@/components/reorder-button";
import { requireUser } from "@/lib/auth/current-user";
import {
  loadCustomerDashboard,
  type OrderStatus,
  type SavedConfigSummary,
} from "@/lib/account/data";
import { formatMoney } from "@/lib/pricing/formatMoney";
import type { ProofStatus } from "@/lib/proofs/gate";

export const metadata: Metadata = {
  title: "Customer dashboard",
  description: "Track orders, review proofs, reuse saved designs, download receipts and reorder in one click.",
};

const ORDER_STATUS_META: Record<OrderStatus, { label: string; style: string }> = {
  quote: { label: "Quote / unpaid", style: "bg-stone-100 text-stone-700" },
  order: { label: "Order confirmed", style: "bg-blue-100 text-blue-800" },
  artwork: { label: "Artwork", style: "bg-purple-100 text-purple-800" },
  proof: { label: "Proof review", style: "bg-amber-100 text-amber-900" },
  production: { label: "In production", style: "bg-indigo-100 text-indigo-800" },
  completed: { label: "Completed", style: "bg-green-100 text-green-800" },
};

const PROOF_STATUS_META: Record<ProofStatus, { label: string; style: string }> = {
  pending: { label: "Awaiting approval", style: "bg-amber-100 text-amber-900" },
  approved: { label: "Approved", style: "bg-green-100 text-green-800" },
  changes_requested: { label: "Changes requested", style: "bg-red-100 text-red-800" },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function formatConfigSummary(config: SavedConfigSummary, fallbackQty?: number) {
  const parts: string[] = [];
  if (config.widthMm && config.heightMm) {
    parts.push(`${config.widthMm} × ${config.heightMm} mm`);
  }
  if (config.materialName) {
    parts.push(config.materialName);
  }
  if (config.orientation) {
    parts.push(config.orientation);
  }
  const qty = config.quantity ?? fallbackQty;
  if (qty) {
    parts.push(`${qty} units`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Custom specification";
}

async function AccountContent() {
  const user = await requireUser();
  const dashboard = await loadCustomerDashboard(user);
  const reorderableOrders = dashboard.orders.filter((order) => order.canReorder && Boolean(order.paidAt));

  return (
    <div className="space-y-12">
      {/* Header + quick actions */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
            Customer dashboard
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Hello{dashboard.profile.fullName ? `, ${dashboard.profile.fullName}` : ""}.
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Track live jobs, approve proofs, download receipts, reuse saved designs and reorder past runs in one click.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/products"
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)]"
          >
            New print order
          </Link>
        </div>
      </div>

      {/* Module 1: Account & Profile Status */}
      <section aria-labelledby="profile-heading" className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="profile-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Account status
            </h2>
            <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-800">
              Active
            </span>
          </div>
          <p className="mt-3 text-lg font-semibold">{dashboard.profile.fullName || "Registered customer"}</p>
          <p className="mt-1 truncate text-sm text-[var(--muted)]">{dashboard.profile.email}</p>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Role: <span className="font-medium capitalize text-[var(--ink)]">{dashboard.profile.role}</span>
            {dashboard.profile.memberSince && <> · Joined {formatDate(dashboard.profile.memberSince)}</>}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Total orders</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{dashboard.orders.length}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">{dashboard.invoices.length} paid</p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Active proofs</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{dashboard.activeProofs.length}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">Versioned approvals</p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Saved designs</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{dashboard.savedDesigns.length}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">Ready to reuse</p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Invoices</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{dashboard.invoices.length}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">Printable VAT receipts</p>
        </div>
      </section>

      {/* Module 2: Active Proofs & Version State */}
      <section aria-labelledby="proofs-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Proof control</p>
            <h2 id="proofs-heading" className="mt-1 text-2xl font-semibold tracking-tight">
              Active proofs &amp; version state
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)]">Production unlocks only once the latest proof version is approved.</p>
        </div>

        {dashboard.activeProofs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-sm text-[var(--muted)]">
            No active proofs yet. Once you pay for a designed order, your versioned proofs appear here.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {dashboard.activeProofs.map((order) => {
              const primaryItem = order.items[0];
              const proofMeta = order.latestProof ? PROOF_STATUS_META[order.latestProof.status] : null;

              return (
                <article
                  key={order.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white p-6"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold uppercase text-[var(--muted)]">
                        Order {order.reference}
                      </span>
                      {proofMeta ? (
                        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${proofMeta.style}`}>
                          v{order.latestProof!.version} · {proofMeta.label}
                        </span>
                      ) : (
                        <span className="rounded-full bg-stone-100 px-3 py-0.5 text-xs font-semibold text-stone-700">
                          Ready to generate v1
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">
                      {primaryItem?.productName ?? "Print job"}
                    </h3>
                    {primaryItem && (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {formatConfigSummary(primaryItem.config, primaryItem.quantity)}
                      </p>
                    )}
                    {order.latestProof?.note && order.latestProof.status === "changes_requested" && (
                      <p className="mt-3 rounded-xl bg-[var(--paper)] px-3 py-2 text-xs text-[var(--muted)]">
                        Note: {order.latestProof.note}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                    <span className="text-xs text-[var(--muted)]">
                      {order.latestProof
                        ? `Updated ${formatDate(order.latestProof.createdAt)}`
                        : `Paid ${formatDate(order.paidAt)}`}
                    </span>
                    <Link
                      href={`/account/orders/${order.id}/proof`}
                      className="rounded-full border border-[var(--ink)] px-4 py-1.5 text-xs font-semibold transition hover:bg-[var(--ink)] hover:text-white"
                    >
                      {order.latestProof ? "View proof & history" : "Generate proof v1"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Module 3 & Module 6: Order History with Live Status & One-Click Reorder */}
      <section aria-labelledby="orders-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Order history &amp; reorder</p>
            <h2 id="orders-heading" className="mt-1 text-2xl font-semibold tracking-tight">
              Your orders
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)]">
            One-click reorder clones your saved design, recalculates live pricing, and opens checkout directly.
          </p>
        </div>

        {dashboard.orders.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center">
            <p className="font-medium">You have not placed an order yet.</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Configure a product and design your artwork to get started.
            </p>
            <Link
              href="/products"
              className="mt-5 inline-block rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {dashboard.orders.map((order) => {
              const statusMeta = ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.quote;
              const primaryItem = order.items[0];

              return (
                <article
                  key={order.id}
                  className="rounded-2xl border border-[var(--line)] bg-white p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-sm font-semibold">{order.reference}</span>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${statusMeta.style}`}>
                          {statusMeta.label}
                        </span>
                        {order.latestProof && (
                          <span className="text-xs text-[var(--muted)]">
                            Proof v{order.latestProof.version} ({PROOF_STATUS_META[order.latestProof.status].label})
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold">
                        {primaryItem?.productName ?? "Custom print order"}
                      </h3>
                      {primaryItem && (
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {formatConfigSummary(primaryItem.config, primaryItem.quantity)}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Placed {formatDate(order.createdAt)}
                        {order.paidAt && <> · Paid {formatDate(order.paidAt)}</>}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-xl font-semibold">{formatMoney(order.total, order.currency)}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        inc. {formatMoney(order.vat, order.currency)} VAT
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
                    {order.paidAt && (order.hasDesign || order.latestProof) && (
                      <Link
                        href={`/account/orders/${order.id}/proof`}
                        className="rounded-full border border-[var(--line)] px-4 py-1.5 text-xs font-semibold transition hover:border-[var(--ink)]"
                      >
                        Proof approval
                      </Link>
                    )}
                    {order.paidAt && (
                      <Link
                        href={`/account/orders/${order.id}/receipt`}
                        className="rounded-full border border-[var(--line)] px-4 py-1.5 text-xs font-semibold transition hover:border-[var(--ink)]"
                      >
                        Invoice / Receipt
                      </Link>
                    )}
                    {order.canReorder && <ReorderButton orderId={order.id} compact />}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Module 4: Saved Designs with Configuration Summary */}
      <section aria-labelledby="designs-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Artwork library</p>
            <h2 id="designs-heading" className="mt-1 text-2xl font-semibold tracking-tight">
              Saved designs &amp; configuration summary
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)]">Every saved design stores its size, material, quantity and template.</p>
        </div>

        {dashboard.savedDesigns.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-sm text-[var(--muted)]">
            You have no saved designs yet. Open any product configurator and click &ldquo;Design &amp; continue&rdquo; to save artwork.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboard.savedDesigns.map((design) => (
              <article
                key={design.id}
                className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-white p-6"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                    {design.productName}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{design.name}</h3>
                  <dl className="mt-4 space-y-1.5 border-t border-[var(--line)] pt-4 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--muted)]">Size</dt>
                      <dd className="font-medium">
                        {design.config.widthMm && design.config.heightMm
                          ? `${design.config.widthMm} × ${design.config.heightMm} mm`
                          : "Template default"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--muted)]">Material</dt>
                      <dd className="font-medium">{design.config.materialName ?? "Default"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--muted)]">Quantity</dt>
                      <dd className="font-medium">{design.config.quantity ?? 100} units</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--muted)]">Template</dt>
                      <dd className="font-medium">{design.templateName}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                  <span className="text-xs text-[var(--muted)]">Saved {formatDate(design.updatedAt)}</span>
                  <div className="flex items-center gap-4">
                    {design.productSlug && (
                      <Link
                        href={`/design/${design.productSlug}?design=${design.id}`}
                        className="text-xs font-semibold text-[var(--accent)] hover:underline"
                      >
                        Open in designer →
                      </Link>
                    )}
                    <DeleteDesignButton designId={design.id} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Module 5: Downloadable Invoices / Receipts + Quick Reorder Summary */}
      <section aria-labelledby="invoices-heading" className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Billing records</p>
          <h2 id="invoices-heading" className="mt-1 text-2xl font-semibold tracking-tight">
            Invoices &amp; receipts
          </h2>

          {dashboard.invoices.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
              Paid order receipts will appear here as printable VAT invoices.
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
              <ul className="divide-y divide-[var(--line)]">
                {dashboard.invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 text-sm"
                  >
                    <div>
                      <p className="font-mono font-semibold">{invoice.invoiceNumber}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        Paid {formatDate(invoice.paidAt)} · {invoice.items[0]?.productName ?? "Print order"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold">{formatMoney(invoice.total, invoice.currency)}</span>
                      <Link
                        href={`/account/orders/${invoice.id}/receipt`}
                        className="rounded-full border border-[var(--line)] px-4 py-1.5 text-xs font-semibold transition hover:border-[var(--ink)]"
                      >
                        View / Print PDF
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Fast repeat jobs</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">One-click reorder</h2>
          <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-6">
            {reorderableOrders.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Complete your first paid order to unlock one-click reorders without reopening the designer.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {reorderableOrders.slice(0, 4).map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold">{order.items[0]?.productName ?? order.reference}</p>
                      <p className="text-xs text-[var(--muted)]">
                        Order {order.reference} · {order.items[0]?.quantity ?? 1} units
                      </p>
                    </div>
                    <ReorderButton orderId={order.id} compact />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--muted)]">
              Proofs and receipts stay on your account. High-resolution production files are accessible to print-house staff only.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-14 lg:px-10 lg:py-20">
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="h-20 w-72 animate-pulse rounded-2xl bg-[var(--line)]" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--line)]" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-2xl bg-[var(--line)]" />
          </div>
        }
      >
        <AccountContent />
      </Suspense>
    </main>
  );
}
