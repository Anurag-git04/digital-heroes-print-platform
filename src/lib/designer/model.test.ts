import { describe, expect, it } from "vitest";
import { seedCatalogue } from "@/lib/catalogue/seed";
import { isElementWithinPrintArea, scalePrintArea, type DesignTextElement } from "./model";
import { designDocumentSchema } from "./schema";

const printArea = { x: 5, y: 5, w: 40, h: 40 };

function textElement(overrides: Partial<DesignTextElement> = {}): DesignTextElement {
  return {
    id: "text-1",
    kind: "text",
    xMm: 25,
    yMm: 25,
    widthMm: 20,
    heightMm: 10,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    text: "HELLO",
    fontFamily: "Arial",
    fontSizeMm: 6,
    fontWeight: "700",
    fill: "#111111",
    trackingMm: 0,
    ...overrides,
  };
}

describe("designer print constraints", () => {
  it("scales the template print area with the configured product size", () => {
    const product = seedCatalogue.divisions[0].products[0];
    expect(scalePrintArea(product.template!, 200, 100)).toEqual({ x: 6, y: 3, w: 188, h: 94 });
  });

  it("accepts an element inside the print area", () => {
    expect(isElementWithinPrintArea(textElement(), printArea)).toBe(true);
  });

  it("rejects movement, scaling and rotation beyond the print area", () => {
    expect(isElementWithinPrintArea(textElement({ xMm: 1 }), printArea)).toBe(false);
    expect(isElementWithinPrintArea(textElement({ widthMm: 42 }), printArea)).toBe(false);
    expect(isElementWithinPrintArea(textElement({ widthMm: 30, heightMm: 30, rotation: 45 }), printArea)).toBe(false);
  });

  it("validates the complete saved document", () => {
    const valid = {
      version: 1,
      productId: "product-1",
      templateId: "template-1",
      widthMm: 50,
      heightMm: 50,
      printArea,
      elements: [textElement()],
    };
    expect(designDocumentSchema.safeParse(valid).success).toBe(true);
    expect(designDocumentSchema.safeParse({ ...valid, elements: [textElement({ xMm: 0 })] }).success).toBe(false);
  });
});
