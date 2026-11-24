/**
 * Pure proof-state helpers. No I/O here so the approval-gate rules can be unit tested.
 *
 * Rule (roadmap "never cut"): print files are locked until the HIGHEST-version proof
 * of an order has status "approved". An older approved version never unlocks anything.
 */
export type ProofStatus = "pending" | "approved" | "changes_requested";

export type ProofSummary = {
  id: string;
  version: number;
  status: ProofStatus;
};

export type ProofStage = "create_first" | "awaiting_customer" | "needs_revision" | "approved";

export function latestProof<T extends { version: number }>(proofs: readonly T[]): T | null {
  let latest: T | null = null;
  for (const proof of proofs) {
    if (!latest || proof.version > latest.version) {
      latest = proof;
    }
  }
  return latest;
}

export function isLatestProofApproved(proofs: readonly ProofSummary[]): boolean {
  return latestProof(proofs)?.status === "approved";
}

export function proofStage(proofs: readonly ProofSummary[]): ProofStage {
  const latest = latestProof(proofs);

  if (!latest) return "create_first";
  if (latest.status === "approved") return "approved";
  if (latest.status === "changes_requested") return "needs_revision";
  return "awaiting_customer";
}

export function nextProofVersion(proofs: readonly ProofSummary[]): number {
  return (latestProof(proofs)?.version ?? 0) + 1;
}

/** Order statuses in which a proof may still be created or revised. */
export const PROOFABLE_ORDER_STATUSES = ["order", "artwork", "proof"] as const;

/** Status steps to walk (each logged in order_status_history) to reach "proof". */
export function statusPathToProof(current: string): string[] {
  if (current === "order") return ["artwork", "proof"];
  if (current === "artwork") return ["proof"];
  return [];
}
