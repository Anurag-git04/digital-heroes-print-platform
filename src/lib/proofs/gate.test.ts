import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isLatestProofApproved,
  latestProof,
  nextProofVersion,
  proofStage,
  statusPathToProof,
  type ProofSummary,
} from "./gate";

const proofRows = vi.hoisted(() => ({ data: [] as unknown[], error: null as unknown }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: async () => ({ data: proofRows.data, error: proofRows.error }),
      }),
    }),
  }),
}));

import { authorizePrintGeneration, canGeneratePrintFiles } from "./access";

const proof = (version: number, status: ProofSummary["status"]): ProofSummary => ({
  id: `proof-${version}`,
  version,
  status,
});

describe("approval gate (pure rules)", () => {
  it("is locked when there are no proofs", () => {
    expect(isLatestProofApproved([])).toBe(false);
    expect(proofStage([])).toBe("create_first");
  });

  it("is locked while the only proof is pending or has changes requested", () => {
    expect(isLatestProofApproved([proof(1, "pending")])).toBe(false);
    expect(isLatestProofApproved([proof(1, "changes_requested")])).toBe(false);
  });

  it("unlocks when the highest version is approved", () => {
    expect(isLatestProofApproved([proof(1, "approved")])).toBe(true);
  });

  it("stays locked when v1 is approved but a newer version is not (order of rows does not matter)", () => {
    const proofs = [proof(2, "pending"), proof(1, "approved")];
    expect(isLatestProofApproved(proofs)).toBe(false);
    expect(isLatestProofApproved([...proofs].reverse())).toBe(false);
  });

  it("request changes then approve v2 unlocks", () => {
    expect(isLatestProofApproved([proof(1, "changes_requested"), proof(2, "approved")])).toBe(true);
  });

  it("derives versions and stages", () => {
    expect(latestProof([proof(1, "approved"), proof(3, "pending")])?.version).toBe(3);
    expect(nextProofVersion([])).toBe(1);
    expect(nextProofVersion([proof(1, "changes_requested"), proof(2, "changes_requested")])).toBe(3);
    expect(proofStage([proof(1, "pending")])).toBe("awaiting_customer");
    expect(proofStage([proof(1, "changes_requested")])).toBe("needs_revision");
    expect(proofStage([proof(1, "approved")])).toBe("approved");
  });

  it("walks order status to proof through logged steps", () => {
    expect(statusPathToProof("order")).toEqual(["artwork", "proof"]);
    expect(statusPathToProof("artwork")).toEqual(["proof"]);
    expect(statusPathToProof("proof")).toEqual([]);
  });
});

describe("canGeneratePrintFiles and authorizePrintGeneration", () => {
  beforeEach(() => {
    proofRows.data = [];
    proofRows.error = null;
  });

  it("returns false before approval and true after", async () => {
    proofRows.data = [proof(1, "pending")];
    expect(await canGeneratePrintFiles("order-1")).toBe(false);

    proofRows.data = [proof(1, "approved")];
    expect(await canGeneratePrintFiles("order-1")).toBe(true);
  });

  it("fails closed when the lookup errors", async () => {
    proofRows.data = [proof(1, "approved")];
    proofRows.error = { message: "boom" };
    expect(await canGeneratePrintFiles("order-1")).toBe(false);
  });

  it("returns 401 for anonymous and 403 for customers, even when approved", async () => {
    proofRows.data = [proof(1, "approved")];
    expect(await authorizePrintGeneration("order-1", null)).toMatchObject({ ok: false, status: 401 });
    expect(await authorizePrintGeneration("order-1", "customer")).toMatchObject({ ok: false, status: 403 });
  });

  it("returns 403 for an admin before approval and ok after", async () => {
    proofRows.data = [proof(1, "pending")];
    expect(await authorizePrintGeneration("order-1", "admin")).toMatchObject({ ok: false, status: 403 });

    proofRows.data = [proof(1, "approved")];
    expect(await authorizePrintGeneration("order-1", "admin")).toEqual({ ok: true });
  });
});
