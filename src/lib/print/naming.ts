/**
 * Order-based file naming convention (PRD Section 07 & Roadmap Page 2/9):
 *   {OrderID}/{OrderID}_{ProductType}_{Date}_{Output}.{ext}
 */

export function sanitizeSlug(value: string, fallback = "item"): string {
  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || fallback;
}

export function formatOrderTag(orderId: string): string {
  const cleaned = orderId.replace(/[^a-zA-Z0-9-]/g, "");
  return cleaned.slice(0, 8).toUpperCase() || "ORDER";
}

export function formatFileDate(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function buildPrintFileName(params: {
  orderId: string;
  productType: string;
  output: string;
  extension: string;
  date?: Date;
}): string {
  const orderTag = formatOrderTag(params.orderId);
  const productTag = sanitizeSlug(params.productType, "product");
  const dateTag = formatFileDate(params.date);
  const outputTag = sanitizeSlug(params.output, "output");
  const ext = params.extension.replace(/^\./, "").toLowerCase();
  return `${orderTag}_${productTag}_${dateTag}_${outputTag}.${ext}`;
}

export function buildPrintStoragePath(params: {
  orderId: string;
  productType: string;
  output: string;
  extension: string;
  date?: Date;
}): string {
  const folder = params.orderId.replace(/[^a-zA-Z0-9-]/g, "");
  const fileName = buildPrintFileName(params);
  return `${folder}/${fileName}`;
}
