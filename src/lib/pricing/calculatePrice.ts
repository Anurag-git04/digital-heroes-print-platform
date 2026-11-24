import { z } from "zod";
import type { Orientation, ProductConfig } from "@/lib/catalogue/types";

export const configurationSchema = z.object({
  widthMm: z.number().int().positive().max(2000),
  heightMm: z.number().int().positive().max(2000),
  materialId: z.string().min(1),
  orientation: z.enum(["landscape", "portrait"]),
  quantity: z.number().int().min(1).max(100000),
});

export type ConfigurationInput = z.infer<typeof configurationSchema>;

export type PriceResult = {
  unitPrice: number;
  discount: number;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  vat: number;
  total: number;
};

function toPence(value: number) {
  return Math.round(value * 100);
}

export function validateConfiguration(
  config: ProductConfig,
  input: ConfigurationInput,
): ConfigurationInput {
  const parsed = configurationSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid configuration.");
  }

  const options = parsed.data;
  const [minWidth, minHeight] = config.sizes.min_mm;
  const [maxWidth, maxHeight] = config.sizes.max_mm;
  const isPortrait = options.orientation === "portrait";
  const width = isPortrait ? options.heightMm : options.widthMm;
  const height = isPortrait ? options.widthMm : options.heightMm;

  if (width < minWidth || height < minHeight || width > maxWidth || height > maxHeight) {
    throw new Error(
      `Size must be between ${minWidth} × ${minHeight} mm and ${maxWidth} × ${maxHeight} mm.`,
    );
  }

  if (!config.materials.some((material) => material.id === options.materialId)) {
    throw new Error("Choose a valid material.");
  }

  if (!config.orientations.includes(options.orientation as Orientation)) {
    throw new Error("Choose a valid orientation.");
  }

  return options;
}

export function calculatePrice(
  product: { config: ProductConfig },
  input: ConfigurationInput | (Omit<ConfigurationInput, "quantity"> & { quantity?: number }),
  qty?: number,
): PriceResult {
  const effectiveInput: ConfigurationInput = {
    ...input,
    quantity: qty !== undefined ? qty : (input.quantity ?? 1),
  };
  const options = validateConfiguration(product.config, effectiveInput);
  const config = product.config;
  const material = config.materials.find((item) => item.id === options.materialId)!;
  const areaCm2 = (options.widthMm / 10) * (options.heightMm / 10);
  const baseUnitPence =
    config.pricing.model === "area"
      ? toPence(areaCm2 * (config.pricing.base_per_cm2 ?? 0))
      : toPence(config.pricing.flat_unit ?? 0);
  const materialUnitPence = Math.round(baseUnitPence * material.mult);
  const minimumUnitPence = toPence(config.pricing.min_unit);
  const unitBeforeDiscount = Math.max(materialUnitPence, minimumUnitPence);
  const tier = [...config.tiers]
    .filter((item) => options.quantity >= item.min)
    .sort((a, b) => b.min - a.min)[0];
  const discountPercent = Math.round((tier?.discount ?? 0) * 100);
  const discountRate = tier?.discount ?? 0;
  const unitPrice = Math.round(unitBeforeDiscount * (1 - discountRate));
  const subtotal = unitPrice * options.quantity;
  const vat = Math.round(subtotal * config.vat_rate);
  const discountAmount = (unitBeforeDiscount - unitPrice) * options.quantity;

  return {
    unitPrice,
    discount: discountAmount,
    discountPercent,
    discountAmount,
    subtotal,
    vat,
    total: subtotal + vat,
  };
}
