"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getProductById } from "@/lib/catalogue/data";
import { getCurrentUser } from "@/lib/auth/current-user";
import { calculatePrice } from "@/lib/pricing/calculatePrice";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCheckoutForm } from "./schema";
import { getStripe, hasStripeConfig } from "./stripe";

export type CheckoutState = {
  error?: string;
};

export async function createCheckout(
  _previousState: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!hasStripeConfig()) {
    return { error: "Checkout is not configured yet. Add the Stripe test keys to continue." };
  }

  const parsed = parseCheckoutForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your product configuration." };
  }

  const values = parsed.data;
  const product = await getProductById(values.productId);

  if (!product) {
    return { error: "That product is no longer available." };
  }

  let price;

  try {
    price = calculatePrice(product, values);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid product configuration." };
  }

  const supabase = createAdminClient();

  if (values.designId) {
    const { data: design } = await supabase
      .from("designs")
      .select("id, user_id, product_id")
      .eq("id", values.designId)
      .maybeSingle();

    if (!design || design.user_id !== user.id || design.product_id !== product.id) {
      return { error: "That design could not be verified for this order." };
    }
  }

  const configSnapshot = {
    widthMm: values.widthMm,
    heightMm: values.heightMm,
    materialId: values.materialId,
    orientation: values.orientation,
    quantity: values.quantity,
    productSlug: product.slug,
    productName: product.name,
    vatRate: product.config.vat_rate,
  };
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      status: "quote",
      currency: "gbp",
      subtotal: price.subtotal,
      vat: price.vat,
      total: price.total,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { error: "The order could not be created. Please try again." };
  }

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    design_id: values.designId ?? null,
    config: configSnapshot,
    quantity: values.quantity,
    unit_price: price.unitPrice,
    line_total: price.subtotal,
  });

  if (itemError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return { error: "The order line could not be saved. Please try again." };
  }

  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const material = product.config.materials.find((item) => item.id === values.materialId);
  const cancelQuery = new URLSearchParams({
    product: product.slug,
    w: String(values.widthMm),
    h: String(values.heightMm),
    material: values.materialId,
    orientation: values.orientation,
    qty: String(values.quantity),
  });

  let checkoutUrl: string | null = null;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      currency: "gbp",
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        orderId: order.id,
        userId: user.id,
        productId: product.id,
      },
      payment_intent_data: {
        metadata: { orderId: order.id, userId: user.id },
      },
      line_items: [
        {
          quantity: values.quantity,
          price_data: {
            currency: "gbp",
            unit_amount: price.unitPrice,
            product_data: {
              name: product.name,
              description: `${values.widthMm} × ${values.heightMm} mm · ${material?.name ?? values.materialId}`,
            },
          },
        },
        ...(price.vat > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "gbp",
                  unit_amount: price.vat,
                  product_data: {
                    name: `VAT (${Math.round(product.config.vat_rate * 100)}%)`,
                  },
                },
              },
            ]
          : []),
      ],
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?${cancelQuery}`,
    });

    const { error: sessionError } = await supabase
      .from("orders")
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", order.id);

    if (sessionError || !session.url) {
      return { error: "The secure checkout session could not be prepared." };
    }

    checkoutUrl = session.url;
  } catch {
    return { error: "The secure checkout session could not be prepared. Please try again." };
  }

  if (!checkoutUrl) {
    return { error: "The secure checkout session could not be prepared." };
  }

  redirect(checkoutUrl);
}
