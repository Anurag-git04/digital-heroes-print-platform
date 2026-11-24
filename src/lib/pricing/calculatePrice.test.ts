import { describe, expect, it } from "vitest";
import type { ProductConfig } from "@/lib/catalogue/types";
import { calculatePrice } from "./calculatePrice";

const config: ProductConfig = {
  pricing: {
    model: "area",
    base_per_cm2: 0.01,
    min_unit: 0.05,
  },
  sizes: {
    mode: "custom",
    min_mm: [20, 20],
    max_mm: [300, 300],
    presets: [[50, 50], [100, 100]],
  },
  materials: [
    { id: "vinyl", name: "Gloss vinyl", mult: 1 },
    { id: "paper", name: "Matte paper", mult: 0.8 },
  ],
  orientations: ["landscape", "portrait"],
  tiers: [
    { min: 1, discount: 0 },
    { min: 100, discount: 0.1 },
    { min: 500, discount: 0.2 },
    { min: 1000, discount: 0.3 },
  ],
  vat_rate: 0.2,
  designer: { enabled: true, csv_merge: false },
};

const baseOptions = {
  widthMm: 100,
  heightMm: 100,
  materialId: "vinyl",
  orientation: "landscape" as const,
  quantity: 1,
};

describe("calculatePrice", () => {
  it("calculates area pricing and VAT in integer pence", () => {
    expect(calculatePrice({ config }, baseOptions)).toEqual({
      unitPrice: 100,
      discount: 0,
      discountPercent: 0,
      discountAmount: 0,
      subtotal: 100,
      vat: 20,
      total: 120,
    });
  });

  it("applies the selected material multiplier", () => {
    const result = calculatePrice(
      { config },
      { ...baseOptions, materialId: "paper" },
    );

    expect(result.unitPrice).toBe(80);
    expect(result.total).toBe(96);
  });

  it("enforces the minimum unit price", () => {
    const result = calculatePrice(
      { config },
      { ...baseOptions, widthMm: 20, heightMm: 20 },
    );

    expect(result.unitPrice).toBe(5);
  });

  it("applies volume discounts at 100, 500 and 1000, and not at 99, 499 or 999", () => {
    const result99 = calculatePrice({ config }, { ...baseOptions, quantity: 99 });
    const result100 = calculatePrice({ config }, { ...baseOptions, quantity: 100 });
    const result499 = calculatePrice({ config }, { ...baseOptions, quantity: 499 });
    const result500 = calculatePrice({ config }, { ...baseOptions, quantity: 500 });
    const result999 = calculatePrice({ config }, { ...baseOptions, quantity: 999 });
    const result1000 = calculatePrice({ config }, { ...baseOptions, quantity: 1000 });

    expect(result99.unitPrice).toBe(100);
    expect(result99.discountPercent).toBe(0);
    expect(result100.unitPrice).toBe(90);
    expect(result100.unitPrice).toBeLessThan(result99.unitPrice);
    expect(result100.discountPercent).toBe(10);
    expect(result100.discount).toBe(1000);
    expect(result100.total).toBe(10800);

    expect(result499.unitPrice).toBe(90);
    expect(result499.discountPercent).toBe(10);
    expect(result500.unitPrice).toBe(80);
    expect(result500.discountPercent).toBe(20);

    expect(result999.unitPrice).toBe(80);
    expect(result999.discountPercent).toBe(20);
    expect(result1000.unitPrice).toBe(70);
    expect(result1000.discountPercent).toBe(30);
  });

  it("supports passing qty as third argument: calculatePrice(product, options, qty)", () => {
    const result = calculatePrice({ config }, baseOptions, 100);

    expect(result.unitPrice).toBe(90);
    expect(result.subtotal).toBe(9000);
    expect(result.vat).toBe(1800);
    expect(result.total).toBe(10800);
  });

  it("supports flat per-unit products", () => {
    const flatConfig: ProductConfig = {
      ...config,
      pricing: { model: "flat", flat_unit: 0.35, min_unit: 0.1 },
    };

    expect(
      calculatePrice({ config: flatConfig }, { ...baseOptions, quantity: 100 }).unitPrice,
    ).toBe(32);
  });

  it("rejects invalid materials and impossible sizes", () => {
    expect(() =>
      calculatePrice({ config }, { ...baseOptions, materialId: "unknown" }),
    ).toThrow("Choose a valid material.");
    expect(() =>
      calculatePrice({ config }, { ...baseOptions, widthMm: 500 }),
    ).toThrow("Size must be between");
  });
});
