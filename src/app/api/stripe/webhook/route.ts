import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { markOrderPaid } from "@/lib/checkout/orders";
import { getStripe } from "@/lib/checkout/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return Response.json({ error: "Missing webhook signature configuration." }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }

  try {
    await markOrderPaid(event.data.object);
    revalidatePath("/account");
    revalidatePath("/admin");
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe checkout finalization failed", error);
    return Response.json({ error: "Order finalization failed." }, { status: 500 });
  }
}
