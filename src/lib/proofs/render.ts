import sharp from "sharp";
import type { DesignDocument, DesignElement } from "@/lib/designer/model";

/** Pixels rendered per millimetre for proof previews (screen proofs, not print files). */
const PROOF_PX_PER_MM = 8;

export type ProofSvgOptions = {
  version: number;
  /** imagePath -> data URI for renderable artwork (PNG). */
  images: ReadonlyMap<string, string>;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function px(valueMm: number) {
  return Math.round(valueMm * PROOF_PX_PER_MM * 1000) / 1000;
}

function safeFontFamily(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9 ,-]/g, "").trim();
  return `${cleaned || "Inter"}, Arial, sans-serif`;
}

function renderText(element: Extract<DesignElement, { kind: "text" | "placeholder" }>) {
  const lines = (element.text || " ").split("\n");
  const fontPx = px(element.fontSizeMm);
  const lineHeight = fontPx * 1.2;
  const cx = px(element.xMm);
  const cy = px(element.yMm);
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
    `letter-spacing="${px(element.trackingMm)}">${tspans}</text></g>`
  );
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

  const label = escapeXml(element.label ?? "Artwork placeholder");
  return (
    `<g transform="rotate(${element.rotation} ${cx} ${cy})">` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#efede7" stroke="#9a958b" stroke-width="3" stroke-dasharray="14 8"/>` +
    `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(12, Math.min(width, height) / 8)}" fill="#565149">${label}</text></g>`
  );
}

/** Pure: builds the proof SVG from design JSON. Exported for unit tests. */
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
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${watermarkSize}" fill="#000000" fill-opacity="0.07" transform="rotate(-20 ${width / 2} ${height / 2})">PROOF v${options.version}</text>` +
    `</svg>`
  );
}

export async function renderProofPng(design: DesignDocument, options: ProofSvgOptions) {
  const svg = buildProofSvg(design, options);
  return sharp(Buffer.from(svg), { limitInputPixels: 50_000_000 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
