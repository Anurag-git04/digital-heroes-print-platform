import fontkit from "@pdf-lib/fontkit";
import { degrees, PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DesignDocument, DesignImageElement, DesignTextElement } from "@/lib/designer/model";
import { fitTextToBox, measureLineWidthPt, mmToPt } from "./fitting";
import { loadBundledFonts } from "./fonts";

export type RenderPdfOptions = {
  bleedMm: number;
  /** imagePath -> raw PNG bytes for renderable artwork. */
  images: ReadonlyMap<string, Uint8Array>;
};

function parseHexColor(hex: string) {
  const cleaned = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return rgb(0.07, 0.07, 0.07);
  }
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Rotates a point (dx, dy) around an origin (cx, cy) in PDF coordinate space.
 * Fabric.js rotation is clockwise in screen coords (+y down); PDF rotate is counter-clockwise (+y up),
 * so screen clockwise angle `deg` corresponds to PDF angle `-deg`.
 */
function rotateAround(cx: number, cy: number, dx: number, dy: number, pdfAngleDeg: number) {
  const rad = (pdfAngleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function drawCropMarks(page: PDFPage, trimWidthPt: number, trimHeightPt: number, bleedPt: number) {
  if (bleedPt < 2) return;
  const markLen = Math.min(bleedPt * 0.7, mmToPt(2));
  const color = rgb(0.2, 0.2, 0.2);
  const thickness = 0.4;
  const x0 = bleedPt;
  const y0 = bleedPt;
  const x1 = bleedPt + trimWidthPt;
  const y1 = bleedPt + trimHeightPt;

  const lines: Array<[number, number, number, number]> = [
    // Bottom-left
    [0, y0, markLen, y0],
    [x0, 0, x0, markLen],
    // Bottom-right
    [x1 + bleedPt - markLen, y0, x1 + bleedPt, y0],
    [x1, 0, x1, markLen],
    // Top-left
    [0, y1, markLen, y1],
    [x0, y1 + bleedPt - markLen, x0, y1 + bleedPt],
    // Top-right
    [x1 + bleedPt - markLen, y1, x1 + bleedPt, y1],
    [x1, y1 + bleedPt - markLen, x1, y1 + bleedPt],
  ];

  for (const [sx, sy, ex, ey] of lines) {
    page.drawLine({
      start: { x: sx, y: sy },
      end: { x: ex, y: ey },
      thickness,
      color,
    });
  }
}

function drawTextElement(
  page: PDFPage,
  element: DesignTextElement,
  font: PDFFont,
  bleedMm: number,
  pageHeightPt: number,
) {
  const requestedSizePt = mmToPt(element.fontSizeMm);
  const minSizePt = mmToPt(element.minFontMm ?? Math.min(element.fontSizeMm, 2));
  const maxSizePt = mmToPt(element.maxFontMm ?? Math.max(element.fontSizeMm, 2));
  const maxWidthPt = mmToPt(element.fitWidthMm ?? element.widthMm);
  const maxHeightPt = mmToPt(element.fitHeightMm ?? element.heightMm);
  const baseTrackingPt = mmToPt(element.trackingMm ?? 0);

  const fit = fitTextToBox(element.text, font, {
    requestedSizePt,
    minSizePt,
    maxSizePt,
    maxWidthPt,
    maxHeightPt,
    baseTrackingPt,
  });

  const lines = (element.text || " ").split(/\r?\n/);
  const lineHeightPt = fit.fontSizePt * 1.2;
  const totalHeightPt = lines.length * lineHeightPt;
  const cx = mmToPt(element.xMm + bleedMm);
  const cy = pageHeightPt - mmToPt(element.yMm + bleedMm);
  const pdfAngle = -(element.rotation || 0);
  const color = parseHexColor(element.fill);
  const opacity = element.opacity ?? 1;

  lines.forEach((line, index) => {
    const trimmedLine = line || " ";
    const lineWidth = measureLineWidthPt(trimmedLine, font, fit.fontSizePt, fit.trackingPt);
    // Vertical offset from centre (top line is highest y in PDF coords).
    const dy = totalHeightPt / 2 - (index + 0.85) * lineHeightPt;

    if (Math.abs(fit.trackingPt) < 0.001) {
      const dx = -lineWidth / 2;
      const pos = rotateAround(cx, cy, dx, dy, pdfAngle);
      page.drawText(trimmedLine, {
        x: pos.x,
        y: pos.y,
        size: fit.fontSizePt,
        font,
        color,
        opacity,
        rotate: degrees(pdfAngle),
      });
      return;
    }

    // Draw character-by-character when horizontal tracking is applied.
    let cursorX = -lineWidth / 2;
    for (const ch of trimmedLine) {
      const pos = rotateAround(cx, cy, cursorX, dy, pdfAngle);
      page.drawText(ch, {
        x: pos.x,
        y: pos.y,
        size: fit.fontSizePt,
        font,
        color,
        opacity,
        rotate: degrees(pdfAngle),
      });
      cursorX += font.widthOfTextAtSize(ch, fit.fontSizePt) + fit.trackingPt;
    }
  });
}

async function drawImageElement(
  pdfDoc: PDFDocument,
  page: PDFPage,
  element: DesignImageElement,
  font: PDFFont,
  images: ReadonlyMap<string, Uint8Array>,
  bleedMm: number,
  pageHeightPt: number,
) {
  const cx = mmToPt(element.xMm + bleedMm);
  const cy = pageHeightPt - mmToPt(element.yMm + bleedMm);
  const widthPt = mmToPt(element.widthMm);
  const heightPt = mmToPt(element.heightMm);
  const pdfAngle = -(element.rotation || 0);
  const pos = rotateAround(cx, cy, -widthPt / 2, -heightPt / 2, pdfAngle);
  const pngBytes = element.renderable ? images.get(element.imagePath) : undefined;

  if (pngBytes) {
    const embedded = await pdfDoc.embedPng(pngBytes);
    page.drawImage(embedded, {
      x: pos.x,
      y: pos.y,
      width: widthPt,
      height: heightPt,
      opacity: element.opacity ?? 1,
      rotate: degrees(pdfAngle),
    });
    return;
  }

  // Non-renderable artwork (e.g. AI or PDF upload): draw a clean labelled placeholder box.
  page.drawRectangle({
    x: pos.x,
    y: pos.y,
    width: widthPt,
    height: heightPt,
    color: rgb(0.94, 0.93, 0.91),
    borderColor: rgb(0.6, 0.58, 0.54),
    borderWidth: 1,
    rotate: degrees(pdfAngle),
  });

  const label = element.label ?? "Artwork file attached";
  const fit = fitTextToBox(label, font, {
    requestedSizePt: 10,
    minSizePt: 5,
    maxSizePt: 12,
    maxWidthPt: Math.max(12, widthPt - 8),
    maxHeightPt: Math.max(10, heightPt - 8),
  });
  const textWidth = font.widthOfTextAtSize(label, fit.fontSizePt);
  const textPos = rotateAround(cx, cy, -textWidth / 2, -fit.fontSizePt / 3, pdfAngle);
  page.drawText(label, {
    x: textPos.x,
    y: textPos.y,
    size: fit.fontSizePt,
    font,
    color: rgb(0.34, 0.32, 0.29),
    rotate: degrees(pdfAngle),
  });
}

/**
 * Renders a print-ready PDF from canonical millimetre design JSON with bleed,
 * TrimBox/BleedBox metadata, embedded Inter TTF fonts, and per-placeholder shrink-to-fit.
 */
export async function renderPrintPdf(
  design: DesignDocument,
  options: RenderPdfOptions,
): Promise<Uint8Array> {
  const bleedMm = Math.max(0, options.bleedMm);
  const trimWidthPt = mmToPt(design.widthMm);
  const trimHeightPt = mmToPt(design.heightMm);
  const bleedPt = mmToPt(bleedMm);
  const pageWidthPt = trimWidthPt + bleedPt * 2;
  const pageHeightPt = trimHeightPt + bleedPt * 2;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const bundled = await loadBundledFonts();
  const [regularFont, boldFont] = await Promise.all([
    pdfDoc.embedFont(bundled.regular),
    pdfDoc.embedFont(bundled.bold),
  ]);

  const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
  page.setMediaBox(0, 0, pageWidthPt, pageHeightPt);
  page.setBleedBox(0, 0, pageWidthPt, pageHeightPt);
  page.setTrimBox(bleedPt, bleedPt, trimWidthPt, trimHeightPt);

  // White print canvas across full bleed area.
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidthPt,
    height: pageHeightPt,
    color: rgb(1, 1, 1),
  });

  for (const element of design.elements) {
    if (element.kind === "image") {
      await drawImageElement(pdfDoc, page, element, regularFont, options.images, bleedMm, pageHeightPt);
    } else {
      const font = element.fontWeight === "700" ? boldFont : regularFont;
      drawTextElement(page, element, font, bleedMm, pageHeightPt);
    }
  }

  drawCropMarks(page, trimWidthPt, trimHeightPt, bleedPt);

  return pdfDoc.save();
}
