import { createAdminClient } from "@/lib/supabase/admin";
import { isLatestProofApproved, type ProofSummary } from "./gate";

/**
 * The approval gate. True only when the highest-version proof of the order is approved.
 * Fails closed: any lookup error means print files stay locked.
 */
export async function canGeneratePrintFiles(orderId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("proofs")
      .select("id, version, status")
      .eq("order_id", orderId);

    if (error || !data) {
      return false;
    }

    return isLatestProofApproved(data as ProofSummary[]);
  } catch {
    return false;
  }
}

export type PrintAccessResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Single entry point every print-file route must call before doing any work.
 * Admin role check first, then the approval gate.
 */
export async function authorizePrintGeneration(
  orderId: string,
  role: "admin" | "customer" | null,
): Promise<PrintAccessResult> {
  if (!role) {
    return { ok: false, status: 401, error: "Sign in to continue." };
  }

  if (role !== "admin") {
    return { ok: false, status: 403, error: "Only administrators can generate print files." };
  }

  if (!(await canGeneratePrintFiles(orderId))) {
    return {
      ok: false,
      status: 403,
      error: "Print files are locked until the latest proof has been approved by the customer.",
    };
  }

  return { ok: true };
}
