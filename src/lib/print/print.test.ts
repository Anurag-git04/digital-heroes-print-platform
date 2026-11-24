import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { DesignDocument } from "@/lib/designer/model";
import { CsvMergeError, generateCsvMergeZip, MAX_CSV_ROWS, parseMergeCsv } from "./csv-merge";
import { mmToPt, mmToPx } from "./fitting";
import { renderPrintPdf } from "./render-pdf";
import { renderPrintPng } from "./render-png";

const raceBibDesign: DesignDocument = {
  version: 1,
  productId: "20000000-0000-4000-8000-000000000003",
  templateId: "30000000-0000-4000-8000-000000000003",
  widthMm: 120,
  heightMm: 80,
  printArea: { x: 8, y: 8, w: 104, h: 64 },
  elements: [
    {
      id: "number",
      kind: "placeholder",
      placeholderId: "number",
      xMm: 60,
      yMm: 32,
      widthMm: 96,
      heightMm: 36,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      text: "027",
      fontFamily: "Inter",
      fontSizeMm: 30,
      fontWeight: "700",
      fill: "#111111",
      trackingMm: 1,
      minFontMm: 12,
      maxFontMm: 34,
      fitWidthMm: 96,
      fitHeightMm: 36,
    },
    {
      id: "name",
      kind: "placeholder",
      placeholderId: "name",
      xMm: 60,
      yMm: 60,
      widthMm: 96,
      heightMm: 14,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      text: "ALEX MORGAN",
      fontFamily: "Inter",
      fontSizeMm: 10,
      fontWeight: "400",
      fill: "#222222",
      trackingMm: 0,
      minFontMm: 4,
      maxFontMm: 12,
      fitWidthMm: 96,
      fitHeightMm: 14,
    },
  ],
};

describe("print-ready PDF and PNG generation", () => {
  it("renders a print-ready PDF with bleed and TrimBox metadata", async () => {
    const pdfBytes = await renderPrintPdf(raceBibDesign, {
      bleedMm: 3,
      images: new Map(),
    });
    const doc = await PDFDocument.load(pdfBytes);
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    const trim = page.getTrimBox();

    expect(width).toBeCloseTo(mmToPt(126), 1);
    expect(height).toBeCloseTo(mmToPt(86), 1);
    expect(trim.x).toBeCloseTo(mmToPt(3), 1);
    expect(trim.y).toBeCloseTo(mmToPt(3), 1);
    expect(trim.width).toBeCloseTo(mmToPt(120), 1);
    expect(trim.height).toBeCloseTo(mmToPt(80), 1);
  });

  it("renders a 300 DPI PNG with bleed dimensions and density metadata", async () => {
    const png = await renderPrintPng(raceBibDesign, {
      bleedMm: 3,
      dpi: 300,
      images: new Map(),
    });
    const meta = await sharp(png).metadata();

    expect(meta.format).toBe("png");
    expect(meta.width).toBe(mmToPx(126, 300));
    expect(meta.height).toBe(mmToPx(86, 300));
    expect(meta.density).toBe(300);
  }, 60_000);
});

describe("CSV variable-data merge", () => {
  it("generates a zip of 20 named PDFs from a 20-row CSV including long athlete names", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      const name =
        i === 0
          ? "ALEXANDER BARTHOLOMEW MONTGOMERY-FITZWILLIAM"
          : `ATHLETE ${i + 1}`;
      return `${num},${name}`;
    });
    const csvText = ["number,name", ...rows].join("\n");

    const result = await generateCsvMergeZip({
      orderId: "60a61082-780c-4263-8882-cbacb0b9fa1c",
      productType: "race-numbers",
      design: raceBibDesign,
      bleedMm: 3,
      images: new Map(),
      csvText,
      date: new Date(Date.UTC(2026, 10, 24)),
    });

    expect(result.fileCount).toBe(20);
    expect(result.fileNames).toHaveLength(20);
    expect(result.fileNames[0]).toBe("60A61082_race-numbers_20261124_row-001-001.pdf");
    expect(result.fileNames[19]).toBe("60A61082_race-numbers_20261124_row-020-020.pdf");

    const zip = await JSZip.loadAsync(result.zipBuffer);
    const entries = Object.keys(zip.files);
    expect(entries).toHaveLength(20);

    // Verify the first PDF (with the very long name) is a valid PDF with bleed.
    const firstPdfBytes = await zip.file(result.fileNames[0])!.async("uint8array");
    const doc = await PDFDocument.load(firstPdfBytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(mmToPt(126), 1);
  }, 60_000);

  it("rejects empty CSV, missing columns, and batches over 200 rows", () => {
    expect(() => parseMergeCsv("", ["number", "name"])).toThrow(CsvMergeError);
    expect(() => parseMergeCsv("number\n001", ["number", "name"])).toThrow(
      /missing required column: name/i,
    );

    const tooMany = [
      "number,name",
      ...Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `${i + 1},Runner ${i + 1}`),
    ].join("\n");
    expect(() => parseMergeCsv(tooMany, ["number", "name"])).toThrow(/200-row limit/i);

    const rows301 = [
      "number,name",
      ...Array.from({ length: 301 }, (_, i) => `${i + 1},Runner ${i + 1}`),
    ].join("\n");
    expect(() => parseMergeCsv(rows301, ["number", "name"])).toThrow(/301 rows.*200-row limit/i);
  });
});
