"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { sendOrderStatusEmail } from "@/lib/email/send";
import { canGeneratePrintFiles } from "@/lib/proofs/access";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminActionState = {
  error?: string;
  message?: string;
};

const advanceSchema = z.object({
  orderId: z.uuid("Invalid order ID."),
  toStatus: z.enum(["quote", "order", "artwork", "proof", "production", "completed"]),
});

const archiveSchema = z.object({
  orderId: z.uuid("Invalid order ID."),
  archived: z.enum(["true", "false"]).transform((v) => v === "true"),
});

async function requireAdminForAction() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

/**
 * Advances an order to a pipeline stage, writes order_status_history,
 * and sends a status update email (Resend or console.log fallback).
 */
export async function advanceOrderStatusAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const adminUser = await requireAdminForAction();
  if (!adminUser) {
    return { error: "Administrator access is required." };
  }

  const parsed = advanceSchema.safeParse({
    orderId: formData.get("orderId"),
    toStatus: formData.get("toStatus"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid status update." };
  }

  const { orderId, toStatus } = parsed.data;
  const supabase = createAdminClient();
  const { data: order, error: loadError } = await supabase
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (loadError || !order) {
    return { error: "Order could not be found." };
  }

  if (order.status === toStatus) {
    return { message: `Order is already in "${toStatus}".` };
  }

  // Approval gate: a job cannot enter production or completed without an approved latest proof.
  if (toStatus === "production" || toStatus === "completed") {
    const approved = await canGeneratePrintFiles(orderId);
    if (!approved) {
      return {
        error: "Cannot move to production until the customer approves the latest proof.",
      };
    }
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: toStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (updateError) {
    return { error: "Order status could not be updated." };
  }

  const { error: historyError } = await supabase.from("order_status_history").insert({
    order_id: orderId,
    from_status: order.status,
    to_status: toStatus,
    changed_by: adminUser.id,
  });

  if (historyError) {
    return { error: "Status updated, but history could not be logged." };
  }

  const { data: customer } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", order.user_id)
    .maybeSingle();

  if (customer?.email) {
    await sendOrderStatusEmail({
      to: customer.email,
      orderReference: order.id.slice(0, 8).toUpperCase(),
      fromStatus: order.status,
      toStatus,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/account");
  return { message: `Moved to ${toStatus}.` };
}

/** Archives or restores a job in the production console. */
export async function toggleArchiveOrderAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const adminUser = await requireAdminForAction();
  if (!adminUser) {
    return { error: "Administrator access is required." };
  }

  const parsed = archiveSchema.safeParse({
    orderId: formData.get("orderId"),
    archived: formData.get("archived"),
  });
  if (!parsed.success) {
    return { error: "Invalid archive request." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ archived: parsed.data.archived, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.orderId);

  if (error) {
    return { error: "Could not update archive status." };
  }

  revalidatePath("/admin");
  return { message: parsed.data.archived ? "Order archived." : "Order restored from archive." };
}
