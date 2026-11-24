"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getProductById } from "@/lib/catalogue/data";
import { calculatePrice, configurationSchema } from "@/lib/pricing/calculatePrice";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { artworkPathBelongsToUser, scalePrintArea } from "./model";
import { parseDesignDocument } from "./schema";

const saveFormSchema = z.object({
  productId: z.string().min(1).max(100),
  designId: z.preprocess((value) => value === "" ? undefined : value, z.uuid().optional()),
  name: z.string().trim().min(1).max(100),
  widthMm: z.coerce.number(),
  heightMm: z.coerce.number(),
  materialId: z.string().min(1),
  orientation: z.enum(["landscape", "portrait"]),
  quantity: z.coerce.number(),
  designJson: z.string().min(2).max(500_000),
});

export type SaveDesignResult = {
  designId?: string;
  error?: string;
};

export async function saveDesign(formData: FormData): Promise<SaveDesignResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Sign in to save this design." };
  }

  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Supabase is required to save designs and artwork." };
  }

  const parsedForm = saveFormSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsedForm.success) {
    return { error: parsedForm.error.issues[0]?.message ?? "Check the design details." };
  }

  const values = parsedForm.data;
  const product = await getProductById(values.productId);

  if (!product?.template) {
    return { error: "This product does not have a design template." };
  }

  const parsedConfiguration = configurationSchema.safeParse({
    widthMm: values.widthMm,
    heightMm: values.heightMm,
    materialId: values.materialId,
    orientation: values.orientation,
    quantity: values.quantity,
  });

  if (!parsedConfiguration.success) {
    return { error: "Check the product configuration." };
  }

  try {
    calculatePrice(product, parsedConfiguration.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid product configuration." };
  }

  let json: unknown;

  try {
    json = JSON.parse(values.designJson);
  } catch {
    return { error: "The design data is not valid JSON." };
  }

  const parsedDocument = parseDesignDocument(json);

  if (!parsedDocument.success) {
    return { error: parsedDocument.error.issues[0]?.message ?? "The design contains invalid elements." };
  }

  const document = parsedDocument.data;

  if (document.productId !== product.id || document.templateId !== product.template.id) {
    return { error: "The design does not match this product template." };
  }

  if (document.widthMm !== parsedConfiguration.data.widthMm || document.heightMm !== parsedConfiguration.data.heightMm) {
    return { error: "The design size does not match the configured product size." };
  }

  const expectedPrintArea = scalePrintArea(product.template, document.widthMm, document.heightMm);
  const areaDifference = (["x", "y", "w", "h"] as const).some(
    (key) => Math.abs(document.printArea[key] - expectedPrintArea[key]) > 0.01,
  );

  if (areaDifference) {
    return { error: "The print area does not match the product template." };
  }

  for (const element of document.elements) {
    if (element.kind === "image" && !artworkPathBelongsToUser(element.imagePath, user.id)) {
      return { error: "Artwork must belong to your account." };
    }
  }

  const supabase = createAdminClient();
  const designValues = {
    name: values.name,
    design_json: document,
    config: parsedConfiguration.data,
    updated_at: new Date().toISOString(),
  };

  if (values.designId) {
    const { data: existing } = await supabase
      .from("designs")
      .select("id, user_id, product_id")
      .eq("id", values.designId)
      .maybeSingle();

    if (!existing || existing.user_id !== user.id || existing.product_id !== product.id) {
      return { error: "This saved design could not be verified." };
    }

    const { error } = await supabase.from("designs").update(designValues).eq("id", values.designId);

    if (error) {
      return { error: "The design could not be updated." };
    }

    revalidatePath("/account");
    return { designId: values.designId };
  }

  const { data: design, error } = await supabase
    .from("designs")
    .insert({
      ...designValues,
      user_id: user.id,
      product_id: product.id,
      template_id: product.template.id,
    })
    .select("id")
    .single();

  if (error || !design) {
    return { error: "The design could not be saved." };
  }

  revalidatePath("/account");
  return { designId: design.id };
}

export async function getArtworkPreviewUrl(path: string): Promise<{ url?: string; error?: string }> {
  const user = await getCurrentUser();

  if (!user || !artworkPathBelongsToUser(path, user.id) || !path.toLowerCase().endsWith(".png")) {
    return { error: "Artwork could not be verified." };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from("artwork").createSignedUrl(path, 300);

    if (error || !data?.signedUrl) {
      return { error: "Artwork could not be loaded." };
    }

    return { url: data.signedUrl };
  } catch {
    return { error: "Artwork storage is not configured." };
  }
}
