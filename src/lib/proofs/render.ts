import sharp from "sharp";
import type { DesignDocument, DesignElement } from "@/lib/designer/model";
import { escapeXml, renderTextAsSvgPaths } from "@/lib/print/svg-text";

/** Pixels rendered per millimetre for proof previews (screen proofs, not print files). */
const PROOF_PX_PER_MM = 8;

export type ProofSvgOptions = {
  version: number;
  /** imagePath -> data URI for renderable artwork (PNG). */
  images: ReadonlyMap<string, string>;
};

function px(valueMm: number) {
  return Math.round(valueMm * PROOF_PX_PER_MM * 1000) / 1000;
}

function renderText(element: Extract<DesignElement, { kind: "text" | "placeholder" }>) {
  const scaleX = element.scaleX || 1;
  const scaleY = element.scaleY || 1;
  return renderTextAsSvgPaths({
    text: element.text || " ",
    cx: px(element.xMm),
    cy: px(element.yMm),
    boxWidthPx: px(element.widthMm),
    textAlign: element.textAlign ?? "left",
    fontSizePx: px(element.fontSizeMm * scaleY),
    fontWeight: element.fontWeight,
    fill: element.fill,
    opacity: element.opacity,
    rotation: element.rotation,
    trackingPx: px(element.trackingMm * scaleX),
  });
}

function renderImage(
  element: Extract<DesignElement, { kind: "image" }>,
  images: ReadonlyMap<string, string>,
) {
  const cx = px(element.xMm);
  const cy = px(element.yMm);
  const width = px(element.widthMm);
  const height = px(element.heightMm);
  const x = cx - width / 2;
  const y = cy - height / 2;
  const dataUri = element.renderable ? images.get(element.imagePath) : undefined;

  if (dataUri) {
    return (
      `<g transform="rotate(${element.rotation} ${cx} ${cy})" opacity="${element.opacity}">` +
      `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" href="${dataUri}"/></g>`
    );
  }

  const label = element.label ?? "Artwork placeholder";
  return (
    `<g transform="rotate(${element.rotation} ${cx} ${cy})">` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#efede7" stroke="#9a958b" stroke-width="3" stroke-dasharray="14 8"/>` +
    renderTextAsSvgPaths({
      text: label,
      cx,
      cy,
      fontSizePx: Math.max(12, Math.min(width, height) / 8),
      fontWeight: "400",
      fill: "#565149",
    }) +
    `</g>`
  );
}

/** Pure: builds the proof SVG from design JSON using bundled Inter vector paths. */
export function buildProofSvg(design: DesignDocument, options: ProofSvgOptions) {
  const width = px(design.widthMm);
  const height = px(design.heightMm);
  const area = design.printArea;
  const body = design.elements
    .map((element) => (element.kind === "image" ? renderImage(element, options.images) : renderText(element)))
    .join("");
  const watermarkSize = Math.max(24, Math.min(width, height) / 6);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    body +
    `<rect x="${px(area.x)}" y="${px(area.y)}" width="${px(area.w)}" height="${px(area.h)}" fill="none" stroke="#c4411a" stroke-width="2" stroke-dasharray="12 8"/>` +
    renderTextAsSvgPaths({
      text: `PROOF v${options.version}`,
      cx: width / 2,
      cy: height / 2,
      fontSizePx: watermarkSize,
      fontWeight: "700",
      fill: "#000000",
      fillOpacity: 0.08,
      rotation: -20,
    }) +
    `<!-- ${escapeXml(`v${options.version}`)} -->` +
    `</svg>`
  );
}

export async function renderProofPng(design: DesignDocument, options: ProofSvgOptions) {
  const svg = buildProofSvg(design, options);
  return sharp(Buffer.from(svg), { limitInputPixels: 50_000_000 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
