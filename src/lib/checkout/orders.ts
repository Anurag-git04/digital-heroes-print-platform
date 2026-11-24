import type Stripe from "stripe";
import { sendOrderPaidEmail } from "@/lib/email/send";
import { formatMoney } from "@/lib/pricing/formatMoney";
import { createAdminClient } from "@/lib/supabase/admin";

export async function markOrderPaid(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;

  if (!orderId) {
    throw new Error("Checkout session is missing its order reference.");
  }

  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, user_id, status, currency, total, paid_at")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (error || !order) {
    throw new Error("Order for this checkout session could not be found.");
  }

  if (session.payment_status !== "paid") {
    return { order, paid: false };
  }

  if (
    session.amount_total !== order.total ||
    session.currency?.toLowerCase() !== order.currency.toLowerCase()
  ) {
    throw new Error("Checkout total does not match the order record.");
  }

  if (!order.paid_at) {
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "order",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .is("paid_at", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      throw new Error("The paid order could not be updated.");
    }

    if (updatedOrder) {
      const { error: historyError } = await supabase.from("order_status_history").insert({
        order_id: order.id,
        from_status: order.status,
        to_status: "order",
        changed_by: order.user_id,
      });

      if (historyError) {
        throw new Error("The order status history could not be recorded.");
      }

      const recipientEmail =
        session.customer_details?.email ??
        session.customer_email ??
        (
          await supabase
            .from("profiles")
            .select("email")
            .eq("id", order.user_id)
            .maybeSingle()
        ).data?.email;

      if (recipientEmail) {
        await sendOrderPaidEmail({
          to: recipientEmail,
          orderReference: order.id.slice(0, 8).toUpperCase(),
          totalFormatted: formatMoney(order.total, order.currency.toUpperCase()),
        });
      }
    }
  }

  return { order, paid: true };
}
