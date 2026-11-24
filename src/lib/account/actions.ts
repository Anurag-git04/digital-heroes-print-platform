"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getProductById } from "@/lib/catalogue/data";
import { getStripe, hasStripeConfig } from "@/lib/checkout/stripe";
import { calculatePrice, configurationSchema } from "@/lib/pricing/calculatePrice";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ReorderState = {
  error?: string;
};

const reorderSchema = z.object({
  orderId: z.uuid("That order could not be verified."),
});

export type DeleteDesignState = {
  error?: string;
};

const deleteDesignSchema = z.object({
  designId: z.uuid("That design could not be verified."),
});

/**
 * Deletes a saved design using the user-scoped Supabase client (so PostgreSQL RLS
 * policy `delete own designs` enforces `user_id = auth.uid()`), plus an explicit
 * ownership check and a guard preventing deletion of designs attached to paid orders.
 */
export async function deleteDesignAction(
  _previous: DeleteDesignState,
  formData: FormData,
): Promise<DeleteDesignState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=%2Faccount");
  }

  const parsed = deleteDesignSchema.safeParse({ designId: formData.get("designId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid design reference." };
  }

  const designId = parsed.data.designId;
  const userClient = await createClient();

  // Verify ownership through RLS + explicit user_id check.
  const { data: design } = await userClient
    .from("designs")
    .select("id, user_id")
    .eq("id", designId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!design || design.user_id !== user.id) {
    return { error: "We could not find that design on your account." };
  }

  // Protect designs attached to paid orders so proofs and print-file generation never break.
  const { data: linkedItems } = await userClient
    .from("order_items")
    .select("order_id")
    .eq("design_id", designId);

  const linkedOrderIds = (linkedItems ?? []).map((item) => item.order_id);
  if (linkedOrderIds.length > 0) {
    const { data: paidOrders } = await userClient
      .from("orders")
      .select("id")
      .in("id", linkedOrderIds)
      .not("paid_at", "is", null)
      .limit(1);

    if ((paidOrders ?? []).length > 0) {
      return {
        error: "This design is attached to a paid order and is kept for production and reorders.",
      };
    }
  }

  // Delete via user-scoped client so PostgreSQL RLS enforces `user_id = auth.uid()`.
  const { data: deleted, error: deleteError } = await userClient
    .from("designs")
    .delete()
    .eq("id", designId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (deleteError || !deleted) {
    return { error: "That design could not be deleted. Please try again." };
  }

  revalidatePath("/account");
  return {};
}

/**
 * One-click reorder: verifies ownership via the RLS-protected client, clones the saved
 * design (if present), recomputes pricing server-side via calculatePrice, creates a brand-new
 * order row (leaving the original intact), and starts Stripe Checkout without the designer.
 */
export async function reorderOrderAction(
  _previous: ReorderState,
  formData: FormData,
): Promise<ReorderState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=%2Faccount");
  }

  if (!hasStripeConfig()) {
    return { error: "Checkout is not configured yet. Add Stripe test keys to reorder." };
  }

  const parsed = reorderSchema.safeParse({ orderId: formData.get("orderId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order reference." };
  }

  // Read source order via user-scoped client (RLS enforced) + explicit user_id check.
  const userClient = await createClient();
  const { data: sourceOrder } = await userClient
    .from("orders")
    .select("id, user_id")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (!sourceOrder || sourceOrder.user_id !== user.id) {
    return { error: "We could not find that order on your account." };
  }

  const { data: sourceItem } = await userClient
    .from("order_items")
    .select("id, product_id, design_id, config, quantity")
    .eq("order_id", sourceOrder.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!sourceItem) {
    return { error: "This order has no line items to reorder." };
  }

  const product = await getProductById(sourceItem.product_id);
  if (!product) {
    return { error: "That product is no longer available to reorder." };
  }

  const rawConfig = (sourceItem.config ?? {}) as Record<string, unknown>;
  const parsedConfig = configurationSchema.safeParse({
    widthMm: Number(rawConfig.widthMm),
    heightMm: Number(rawConfig.heightMm),
    materialId: rawConfig.materialId,
    orientation: rawConfig.orientation,
    quantity: Number(sourceItem.quantity ?? rawConfig.quantity),
  });

  if (!parsedConfig.success) {
    return { error: "The saved configuration on this order could not be revalidated." };
  }

  let price;
  try {
    // Recompute price strictly on the server — never reuse stored totals.
    price = calculatePrice(product, parsedConfig.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Product options are no longer valid.",
    };
  }

  const admin = createAdminClient();
  let clonedDesignId: string | null = null;

  if (sourceItem.design_id) {
    const { data: sourceDesign } = await admin
      .from("designs")
      .select("id, user_id, product_id, template_id, name, design_json, config")
      .eq("id", sourceItem.design_id)
      .maybeSingle();

    if (sourceDesign && sourceDesign.user_id === user.id) {
      const baseName = sourceDesign.name.replace(/\s*\(Reorder\)$/i, "").slice(0, 88);
      const { data: clonedDesign, error: cloneError } = await admin
        .from("designs")
        .insert({
          user_id: user.id,
          product_id: sourceDesign.product_id,
          template_id: sourceDesign.template_id,
          name: `${baseName} (Reorder)`,
          design_json: sourceDesign.design_json,
          config: parsedConfig.data,
        })
        .select("id")
        .single();

      if (cloneError || !clonedDesign) {
        return { error: "Your saved artwork could not be cloned for reorder." };
      }

      clonedDesignId = clonedDesign.id;
    }
  }

  const configSnapshot = {
    widthMm: parsedConfig.data.widthMm,
    heightMm: parsedConfig.data.heightMm,
    materialId: parsedConfig.data.materialId,
    orientation: parsedConfig.data.orientation,
    quantity: parsedConfig.data.quantity,
    productSlug: product.slug,
    productName: product.name,
    vatRate: product.config.vat_rate,
    reorderedFromOrderId: sourceOrder.id,
  };

  const { data: newOrder, error: orderError } = await admin
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

  if (orderError || !newOrder) {
    return { error: "The new reorder could not be created. Please try again." };
  }

  const { error: itemError } = await admin.from("order_items").insert({
    order_id: newOrder.id,
    product_id: product.id,
    design_id: clonedDesignId,
    config: configSnapshot,
    quantity: parsedConfig.data.quantity,
    unit_price: price.unitPrice,
    line_total: price.subtotal,
  });

  if (itemError) {
    await admin.from("orders").delete().eq("id", newOrder.id);
    return { error: "The reorder line item could not be saved." };
  }

  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const material = product.config.materials.find((m) => m.id === parsedConfig.data.materialId);

  let checkoutUrl: string | null = null;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      currency: "gbp",
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        orderId: newOrder.id,
        userId: user.id,
        productId: product.id,
        reorderedFrom: sourceOrder.id,
      },
      payment_intent_data: {
        metadata: { orderId: newOrder.id, userId: user.id },
      },
      line_items: [
        {
          quantity: parsedConfig.data.quantity,
          price_data: {
            currency: "gbp",
            unit_amount: price.unitPrice,
            product_data: {
              name: `${product.name} (Reorder)`,
              description: `${parsedConfig.data.widthMm} × ${parsedConfig.data.heightMm} mm · ${material?.name ?? parsedConfig.data.materialId}`,
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
      cancel_url: `${origin}/account`,
    });

    const { error: sessionError } = await admin
      .from("orders")
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", newOrder.id);

    if (sessionError || !session.url) {
      return { error: "The checkout session for your reorder could not be prepared." };
    }

    checkoutUrl = session.url;
  } catch {
    return { error: "Could not start Stripe Checkout for this reorder. Please try again." };
  }

  revalidatePath("/account");
  redirect(checkoutUrl);
}
