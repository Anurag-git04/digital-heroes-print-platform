import { describe, expect, it } from "vitest";
import { fitTextToBox, mmToPt, mmToPx, ptToMm, type FontMeasurer } from "./fitting";
import { buildPrintFileName, buildPrintStoragePath } from "./naming";

// Simple proportional mock font: each glyph is 0.6 * fontSizePt wide.
const mockFont: FontMeasurer = {
  widthOfTextAtSize: (text, size) => text.length * size * 0.6,
};

describe("unit conversions", () => {
  it("converts millimetres to points and pixels accurately", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 4);
    expect(ptToMm(72)).toBeCloseTo(25.4, 4);
    expect(mmToPx(25.4, 300)).toBe(300);
    // 100mm + 2*3mm bleed = 106mm at 300 DPI -> 1252 px
    expect(mmToPx(106, 300)).toBe(1252);
  });
});

describe("fitTextToBox", () => {
  it("keeps requested size when short text fits inside the box", () => {
    const result = fitTextToBox("027", mockFont, {
      requestedSizePt: 40,
      minSizePt: 12,
      maxSizePt: 50,
      maxWidthPt: 120,
      maxHeightPt: 60,
    });

    expect(result.fontSizePt).toBe(40);
    expect(result.trackingPt).toBe(0);
    expect(result.fits).toBe(true);
  });

  it("shrinks font size for long names without overflowing", () => {
    const result = fitTextToBox("ALEXANDER BARTHOLOMEW MONTGOMERY", mockFont, {
      requestedSizePt: 24,
      minSizePt: 8,
      maxSizePt: 24,
      maxWidthPt: 180,
      maxHeightPt: 40,
    });

    expect(result.fontSizePt).toBeLessThan(24);
    expect(result.fontSizePt).toBeGreaterThanOrEqual(8);
    expect(result.measuredWidthPt).toBeLessThanOrEqual(180.5);
    expect(result.fits).toBe(true);
  });

  it("applies negative horizontal tracking when text hits minSizePt and is still slightly wide", () => {
    // 30 chars * 10pt * 0.6 = 180pt wide at minSizePt=10; box is 160pt -> needs negative tracking.
    const result = fitTextToBox("A".repeat(30), mockFont, {
      requestedSizePt: 18,
      minSizePt: 10,
      maxSizePt: 18,
      maxWidthPt: 160,
      maxHeightPt: 30,
    });

    expect(result.fontSizePt).toBe(10);
    expect(result.trackingPt).toBeLessThan(0);
    expect(result.measuredWidthPt).toBeLessThanOrEqual(160.5);
    expect(result.fits).toBe(true);
  });

  it("shrinks multi-line text to respect box height", () => {
    const result = fitTextToBox("LINE 1\nLINE 2\nLINE 3", mockFont, {
      requestedSizePt: 20,
      minSizePt: 6,
      maxSizePt: 20,
      maxWidthPt: 200,
      maxHeightPt: 36, // 3 lines * 10pt * 1.2 = 36pt
    });

    expect(result.fontSizePt).toBe(10);
    expect(result.fits).toBe(true);
  });
});

describe("print file naming convention", () => {
  it("formats OrderID_ProductType_Date_Output.ext inside an OrderID folder", () => {
    const date = new Date(Date.UTC(2026, 10, 24));
    const fileName = buildPrintFileName({
      orderId: "60a61082-780c-4263-8882-cbacb0b9fa1c",
      productType: "race-numbers",
      output: "row-001-027",
      extension: "pdf",
      date,
    });

    expect(fileName).toBe("60A61082_race-numbers_20261124_row-001-027.pdf");

    const storagePath = buildPrintStoragePath({
      orderId: "60a61082-780c-4263-8882-cbacb0b9fa1c",
      productType: "custom-labels",
      output: "print",
      extension: "pdf",
      date,
    });

    expect(storagePath).toBe(
      "60a61082-780c-4263-8882-cbacb0b9fa1c/60A61082_custom-labels_20261124_print.pdf",
    );
  });
});
