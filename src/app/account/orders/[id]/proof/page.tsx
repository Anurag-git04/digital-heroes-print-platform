import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProofActions } from "@/components/proof-actions";
import { requireUser } from "@/lib/auth/current-user";
import { latestProof, proofStage, type ProofStatus } from "@/lib/proofs/gate";
import { signProofImages } from "@/lib/proofs/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Proof approval" };

const statusLabels: Record<ProofStatus, string> = {
  pending: "Awaiting your review",
  approved: "Approved",
  changes_requested: "Changes requested",
};

const statusStyles: Record<ProofStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-800",
  changes_requested: "bg-red-100 text-red-800",
};

type ProofRow = {
  id: string;
  version: number;
  status: ProofStatus;
  image_path: string | null;
  note: string | null;
  created_at: string;
};

type ApprovalRow = {
  id: string;
  version: number;
  action: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function ProofContent({ orderId }: { orderId: string }) {
  const user = await requireUser();
  // User-scoped client: row level security decides whether this order is visible at all.
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, status, paid_at")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.user_id !== user.id) {
    notFound();
  }

  const [{ data: proofData }, { data: approvalData }, { data: item }] = await Promise.all([
    supabase
      .from("proofs")
      .select("id, version, status, image_path, note, created_at")
      .eq("order_id", orderId)
      .order("version", { ascending: false }),
    supabase
      .from("proof_approvals")
      .select("id, version, action, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase.from("order_items").select("design_id, product_id").eq("order_id", orderId).limit(1).maybeSingle(),
  ]);

  const proofs = (proofData ?? []) as ProofRow[];
  const approvals = (approvalData ?? []) as ApprovalRow[];
  const latest = latestProof(proofs);
  const stage = proofStage(proofs);
  const urls = await signProofImages(proofs.flatMap((proof) => (proof.image_path ? [proof.image_path] : [])));

  let editHref: string | null = null;
  let revisionReady = false;

  if (item?.design_id && item.product_id) {
    const [{ data: product }, { data: design }] = await Promise.all([
      supabase.from("products").select("slug").eq("id", item.product_id).maybeSingle(),
      supabase.from("designs").select("updated_at").eq("id", item.design_id).maybeSingle(),
    ]);
    editHref = product?.slug
      ? `/design/${product.slug}?${new URLSearchParams({
          design: item.design_id,
          returnTo: `/account/orders/${orderId}/proof`,
        })}`
      : null;
    // Same rule the server enforces in createProofVersion: the design must be saved after the latest proof.
    revisionReady = Boolean(
      design?.updated_at && latest && new Date(design.updated_at) > new Date(latest.created_at),
    );
  }

  const latestUrl = latest?.image_path ? urls.get(latest.image_path) : undefined;

  return (
    <>
      <Link href="/account" className="text-sm font-semibold text-[var(--accent)]">
        ← Back to account
      </Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        Order {order.id.slice(0, 8).toUpperCase()}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Approve your proof.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
        Check spelling, colours and placement. Production files are only prepared once the latest proof is approved.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-7">
          {latest ? (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Version {latest.version}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[latest.status]}`}>
                  {statusLabels[latest.status]}
                </span>
              </div>
              {latestUrl ? (
                // Signed, short-lived URL from a private bucket; next/image optimisation does not apply.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={latestUrl}
                  alt={`Proof version ${latest.version}`}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] object-contain"
                />
              ) : (
                <p className="rounded-xl bg-[var(--paper)] p-8 text-center text-sm text-[var(--muted)]">
                  The proof image could not be loaded. Refresh the page to try again.
                </p>
              )}
              {latest.note && latest.status === "changes_requested" && (
                <p className="mt-4 rounded-xl bg-[var(--paper)] p-4 text-sm leading-6">
                  <span className="font-semibold">Your note:</span> {latest.note}
                </p>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <h2 className="text-lg font-semibold">No proof yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
                Generate a proof from your saved design to review exactly how it will print.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-8">
          <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
            <ProofActions
              orderId={order.id}
              stage={stage}
              editHref={editHref}
              revisionReady={revisionReady}
              nextVersion={(latest?.version ?? 0) + 1}
            />
          </section>

          {proofs.length > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">Version history</h2>
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {proofs.map((proof) => (
                  <li key={proof.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="font-medium">v{proof.version}</span>
                    <span className="text-[var(--muted)]">{formatDate(proof.created_at)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[proof.status]}`}>
                      {statusLabels[proof.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {approvals.length > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">Approval log</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {approvals.map((entry) => (
                  <li key={entry.id}>
                    <span className="font-medium">
                      {entry.action === "approved" ? "Approved" : "Requested changes on"} v{entry.version}
                    </span>
                    <span className="block text-[var(--muted)]">
                      {user.email} · {formatDate(entry.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

async function ProofRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProofContent orderId={id} />;
}

export default function ProofPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 lg:px-10 lg:py-20">
      <Suspense fallback={<div className="h-[520px] animate-pulse rounded-2xl bg-[var(--line)]" />}>
        <ProofRoute params={params} />
      </Suspense>
    </main>
  );
}
