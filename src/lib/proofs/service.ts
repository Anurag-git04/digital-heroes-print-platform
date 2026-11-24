import "server-only";

import { artworkPathBelongsToUser } from "@/lib/designer/model";
import { parseDesignDocument } from "@/lib/designer/schema";
import { sendProofStatusEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  nextProofVersion,
  PROOFABLE_ORDER_STATUSES,
  proofStage,
  statusPathToProof,
  latestProof,
  type ProofSummary,
} from "./gate";
import { renderProofPng } from "./render";

const PROOF_BUCKET = "proofs";
const ARTWORK_BUCKET = "artwork";

/** Errors safe to show to the customer. Anything else becomes a generic message. */
export class ProofError extends Error {}

type AdminClient = ReturnType<typeof createAdminClient>;

type ProofRow = ProofSummary & { created_at: string; image_path: string | null; note: string | null };

async function loadOwnedPaidOrder(admin: AdminClient, orderId: string, userId: string) {
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, status, paid_at")
    .eq("id", orderId)
    .maybeSingle();

  // Same message for "missing" and "not yours" so order IDs cannot be probed.
  if (!order || order.user_id !== userId) {
    throw new ProofError("We could not find that order.");
  }

  if (!order.paid_at) {
    throw new ProofError("Proofs are available once payment has been confirmed.");
  }

  return order as { id: string; user_id: string; status: string; paid_at: string };
}

async function loadProofs(admin: AdminClient, orderId: string) {
  const { data, error } = await admin
    .from("proofs")
    .select("id, version, status, created_at, image_path, note")
    .eq("order_id", orderId)
    .order("version", { ascending: false });

  if (error) {
    throw new Error("Proofs could not be loaded.");
  }

  return (data ?? []) as ProofRow[];
}

/** Moves the order through each status step, logging every change in order_status_history. */
async function walkOrderStatus(
  admin: AdminClient,
  orderId: string,
  from: string,
  steps: string[],
  userId: string,
) {
  let current = from;

  for (const next of steps) {
    const { data: updated, error } = await admin
      .from("orders")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", current)
      .select("id")
      .maybeSingle();

    if (error || !updated) {
      throw new ProofError("The order changed while we were working. Refresh and try again.");
    }

    const { error: historyError } = await admin.from("order_status_history").insert({
      order_id: orderId,
      from_status: current,
      to_status: next,
      changed_by: userId,
    });

    if (historyError) {
      throw new Error("Order status history could not be recorded.");
    }

    current = next;
  }
}

async function loadArtworkDataUris(
  admin: AdminClient,
  userId: string,
  paths: string[],
): Promise<Map<string, string>> {
  const images = new Map<string, string>();

  for (const path of paths) {
    if (!artworkPathBelongsToUser(path, userId) || !path.toLowerCase().endsWith(".png")) {
      continue;
    }

    const { data, error } = await admin.storage.from(ARTWORK_BUCKET).download(path);

    if (error || !data) {
      continue;
    }

    const bytes = Buffer.from(await data.arrayBuffer());
    images.set(path, `data:image/png;base64,${bytes.toString("base64")}`);
  }

  return images;
}

/**
 * Creates the first proof, or a new version after the customer asked for changes AND
 * edited their design. Returns the existing version if one is already awaiting review.
 */
export async function createProofVersion(orderId: string, userId: string) {
  const admin = createAdminClient();
  const order = await loadOwnedPaidOrder(admin, orderId, userId);

  if (!(PROOFABLE_ORDER_STATUSES as readonly string[]).includes(order.status)) {
    throw new ProofError("This order is already in production, so its proof can no longer change.");
  }

  const proofs = await loadProofs(admin, orderId);
  const stage = proofStage(proofs);

  if (stage === "awaiting_customer") {
    return { version: latestProof(proofs)!.version, created: false };
  }

  if (stage === "approved") {
    throw new ProofError("This proof has already been approved.");
  }

  const { data: item } = await admin
    .from("order_items")
    .select("design_id")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!item?.design_id) {
    throw new ProofError("This order has no saved design to proof.");
  }

  const { data: design } = await admin
    .from("designs")
    .select("id, user_id, design_json, updated_at")
    .eq("id", item.design_id)
    .maybeSingle();

  if (!design || design.user_id !== userId) {
    throw new ProofError("The design for this order could not be found.");
  }

  const latest = latestProof(proofs);

  if (stage === "needs_revision" && latest && new Date(design.updated_at) <= new Date(latest.created_at)) {
    throw new ProofError("Edit and save your design first, then submit the revision.");
  }

  const parsed = parseDesignDocument(design.design_json);

  if (!parsed.success) {
    throw new ProofError("The saved design is invalid and cannot be proofed.");
  }

  const version = nextProofVersion(proofs);
  const imagePaths = parsed.data.elements.flatMap((element) =>
    element.kind === "image" && element.renderable ? [element.imagePath] : [],
  );
  const images = await loadArtworkDataUris(admin, userId, imagePaths);
  const png = await renderProofPng(parsed.data, { version, images });
  const path = `${orderId}/v${version}.png`;
  const { error: uploadError } = await admin.storage.from(PROOF_BUCKET).upload(path, png, {
    contentType: "image/png",
    upsert: false,
  });

  if (uploadError) {
    throw new ProofError("The proof image could not be stored. Please try again.");
  }

  // unique (order_id, version) makes a concurrent double-click fail here instead of duplicating.
  const { error: insertError } = await admin.from("proofs").insert({
    order_id: orderId,
    version,
    image_path: path,
    status: "pending",
  });

  if (insertError) {
    await admin.storage.from(PROOF_BUCKET).remove([path]);
    throw new ProofError("A proof was just created for this order. Refresh the page.");
  }

  await walkOrderStatus(admin, orderId, order.status, statusPathToProof(order.status), userId);

  return { version, created: true };
}

async function loadPendingLatestProof(admin: AdminClient, orderId: string) {
  const proofs = await loadProofs(admin, orderId);
  const latest = latestProof(proofs);

  if (!latest) {
    throw new ProofError("There is no proof to review yet.");
  }

  if (latest.status !== "pending") {
    throw new ProofError("This proof version has already been answered.");
  }

  return latest;
}

export async function approveLatestProof(orderId: string, userId: string) {
  const admin = createAdminClient();
  await loadOwnedPaidOrder(admin, orderId, userId);
  const proof = await loadPendingLatestProof(admin, orderId);

  // Conditional update: only succeeds while the proof is still pending.
  const { data: updated } = await admin
    .from("proofs")
    .update({ status: "approved" })
    .eq("id", proof.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!updated) {
    throw new ProofError("This proof version has already been answered.");
  }

  const { error } = await admin.from("proof_approvals").insert({
    proof_id: proof.id,
    order_id: orderId,
    version: proof.version,
    user_id: userId,
    action: "approved",
  });

  if (error) {
    throw new Error("The approval could not be logged.");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.email) {
    await sendProofStatusEmail({
      to: profile.email,
      orderReference: orderId.slice(0, 8).toUpperCase(),
      version: proof.version,
      action: "approved",
    });
  }

  return { version: proof.version };
}

export async function requestProofChanges(orderId: string, userId: string, note: string) {
  const admin = createAdminClient();
  const order = await loadOwnedPaidOrder(admin, orderId, userId);
  const proof = await loadPendingLatestProof(admin, orderId);

  const { data: updated } = await admin
    .from("proofs")
    .update({ status: "changes_requested", note })
    .eq("id", proof.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!updated) {
    throw new ProofError("This proof version has already been answered.");
  }

  const { error } = await admin.from("proof_approvals").insert({
    proof_id: proof.id,
    order_id: orderId,
    version: proof.version,
    user_id: userId,
    action: "changes_requested",
  });

  if (error) {
    throw new Error("The change request could not be logged.");
  }

  // Order goes back to the artwork stage while the customer edits.
  if (order.status === "proof") {
    await walkOrderStatus(admin, orderId, "proof", ["artwork"], userId);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.email) {
    await sendProofStatusEmail({
      to: profile.email,
      orderReference: orderId.slice(0, 8).toUpperCase(),
      version: proof.version,
      action: "changes_requested",
    });
  }

  return { version: proof.version };
}

/** Short-lived signed links for proof images. Call only after ownership is verified. */
export async function signProofImages(paths: string[]) {
  const admin = createAdminClient();
  const urls = new Map<string, string>();

  if (paths.length === 0) {
    return urls;
  }

  const { data } = await admin.storage.from(PROOF_BUCKET).createSignedUrls(paths, 600);

  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) {
      urls.set(entry.path, entry.signedUrl);
    }
  }

  return urls;
}
