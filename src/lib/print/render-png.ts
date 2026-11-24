import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import type { DesignDocument, DesignImageElement, DesignTextElement } from "@/lib/designer/model";
import { fitTextToBox, mmToPt, mmToPx, ptToMm } from "./fitting";
import { loadBundledFonts } from "./fonts";

export type RenderPngOptions = {
  bleedMm: number;
  dpi: number;
  /** imagePath -> raw PNG bytes for renderable artwork. */
  images: ReadonlyMap<string, Uint8Array>;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeFontFamily(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9 ,-]/g, "").trim();
  return `${cleaned || "Inter"}, Arial, sans-serif`;
}

function px(valueMm: number, dpi: number) {
  return Math.round(((valueMm * dpi) / 25.4) * 1000) / 1000;
}

function renderTextSvg(
  element: DesignTextElement,
  bleedMm: number,
  dpi: number,
  fontSizeMm: number,
  trackingMm: number,
) {
  const lines = (element.text || " ").split(/\r?\n/);
  const fontPx = px(fontSizeMm, dpi);
  const lineHeight = fontPx * 1.2;
  const cx = px(element.xMm + bleedMm, dpi);
  const cy = px(element.yMm + bleedMm, dpi);
  const top = cy - (lines.length * lineHeight) / 2;
  const tspans = lines
    .map((line, index) => {
      const baseline = top + index * lineHeight + fontPx * 0.95;
      return `<tspan x="${cx}" y="${baseline}">${escapeXml(line) || " "}</tspan>`;
    })
    .join("");

  return (
    `<g transform="rotate(${element.rotation} ${cx} ${cy})" opacity="${element.opacity}">` +
    `<text text-anchor="middle" font-family="${escapeXml(safeFontFamily(element.fontFamily))}" ` +
    `font-size="${fontPx}" font-weight="${element.fontWeight}" fill="${element.fill}" ` +
    `letter-spacing="${px(trackingMm, dpi)}">${tspans}</text></g>`
  );
}

function renderImageSvg(
  element: DesignImageElement,
  images: ReadonlyMap<string, Uint8Array>,
  bleedMm: number,
  dpi: number,
) {
  const cx = px(element.xMm + bleedMm, dpi);
  const cy = px(element.yMm + bleedMm, dpi);
  const width = px(element.widthMm, dpi);
  const height = px(element.heightMm, dpi);
  const x = cx - width / 2;
  const y = cy - height / 2;
  const bytes = element.renderable ? images.get(element.imagePath) : undefined;

  if (bytes) {
    const dataUri = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
    return (
      `<g transform="rotate(${element.rotation} ${cx} ${cy})" opacity="${element.opacity}">` +
      `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" href="${dataUri}"/></g>`
    );
  }

  const label = escapeXml(element.label ?? "Artwork file attached");
  return (
    `<g transform="rotate(${element.rotation} ${cx} ${cy})">` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#efede7" stroke="#9a958b" stroke-width="4" stroke-dasharray="18 10"/>` +
    `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(18, Math.min(width, height) / 8)}" fill="#565149">${label}</text></g>`
  );
}

/**
 * Renders a production-resolution PNG (e.g. 300 DPI) with bleed and DPI metadata,
 * using the same font-metric shrink-to-fit sizing as renderPrintPdf.
 */
export async function renderPrintPng(
  design: DesignDocument,
  options: RenderPngOptions,
): Promise<Buffer> {
  const bleedMm = Math.max(0, options.bleedMm);
  const dpi = Math.max(72, Math.min(1200, Math.round(options.dpi)));
  const widthPx = mmToPx(design.widthMm + bleedMm * 2, dpi);
  const heightPx = mmToPx(design.heightMm + bleedMm * 2, dpi);

  // Measure text using the same bundled Inter fonts as the PDF renderer.
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const bundled = await loadBundledFonts();
  const [regularFont, boldFont] = await Promise.all([
    pdfDoc.embedFont(bundled.regular),
    pdfDoc.embedFont(bundled.bold),
  ]);

  const body = design.elements
    .map((element) => {
      if (element.kind === "image") {
        return renderImageSvg(element, options.images, bleedMm, dpi);
      }

      const font = element.fontWeight === "700" ? boldFont : regularFont;
      const fit = fitTextToBox(element.text, font, {
        requestedSizePt: mmToPt(element.fontSizeMm),
        minSizePt: mmToPt(element.minFontMm ?? Math.min(element.fontSizeMm, 2)),
        maxSizePt: mmToPt(element.maxFontMm ?? Math.max(element.fontSizeMm, 2)),
        maxWidthPt: mmToPt(element.fitWidthMm ?? element.widthMm),
        maxHeightPt: mmToPt(element.fitHeightMm ?? element.heightMm),
        baseTrackingPt: mmToPt(element.trackingMm ?? 0),
      });

      return renderTextSvg(element, bleedMm, dpi, ptToMm(fit.fontSizePt), ptToMm(fit.trackingPt));
    })
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">` +
    `<rect width="${widthPx}" height="${heightPx}" fill="#ffffff"/>` +
    body +
    `</svg>`;

  return sharp(Buffer.from(svg), { limitInputPixels: 100_000_000 })
    .withMetadata({ density: dpi })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
