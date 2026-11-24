import { describe, expect, it } from "vitest";
import { checkoutFormSchema } from "./schema";

const validCheckout = {
  productId: "20000000-0000-4000-8000-000000000001",
  widthMm: "100",
  heightMm: "50",
  materialId: "vinyl",
  orientation: "landscape",
  quantity: "100",
  designId: "",
};

describe("checkoutFormSchema", () => {
  it("parses form values and discards client-supplied prices", () => {
    const result = checkoutFormSchema.parse({
      ...validCheckout,
      total: 1,
      unitPrice: 1,
    });

    expect(result.quantity).toBe(100);
    expect(result.designId).toBeUndefined();
    expect(result).not.toHaveProperty("total");
    expect(result).not.toHaveProperty("unitPrice");
  });

  it("rejects invalid product identifiers", () => {
    expect(
      checkoutFormSchema.safeParse({ ...validCheckout, productId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});
