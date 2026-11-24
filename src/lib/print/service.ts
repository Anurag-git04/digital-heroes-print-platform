import "server-only";

import { artworkPathBelongsToUser, type DesignDocument } from "@/lib/designer/model";
import { parseDesignDocument } from "@/lib/designer/schema";
import { canGeneratePrintFiles } from "@/lib/proofs/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { CsvMergeError, generateCsvMergeZip } from "./csv-merge";
import { buildPrintStoragePath } from "./naming";
import { renderPrintPdf } from "./render-pdf";
import { renderPrintPng } from "./render-png";

const PRINT_BUCKET = "print-files";
const ARTWORK_BUCKET = "artwork";

export class PrintError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type GeneratedFileRecord = {
  id: string;
  kind: "print_pdf" | "print_png" | "csv_merge_zip";
  path: string;
  downloadUrl: string;
};

type OrderPrintContext = {
  orderId: string;
  userId: string;
  productSlug: string;
  bleedMm: number;
  dpi: number;
  design: DesignDocument;
  images: Map<string, Uint8Array>;
};

async function loadOrderPrintContext(orderId: string): Promise<OrderPrintContext> {
  // Belt-and-suspenders: never generate production files unless the latest proof is approved.
  if (!(await canGeneratePrintFiles(orderId))) {
    throw new PrintError(
      "Print files are locked until the latest proof has been approved by the customer.",
      403,
    );
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    throw new PrintError("Order could not be found.", 404);
  }

  const { data: item } = await admin
    .from("order_items")
    .select("product_id, design_id")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!item?.design_id) {
    throw new PrintError("This order has no saved design to render.", 400);
  }

  const [{ data: product }, { data: designRow }] = await Promise.all([
    admin.from("products").select("id, slug").eq("id", item.product_id).maybeSingle(),
    admin
      .from("designs")
      .select("id, template_id, design_json")
      .eq("id", item.design_id)
      .maybeSingle(),
  ]);

  if (!product || !designRow) {
    throw new PrintError("The product or design for this order could not be loaded.", 404);
  }

  const { data: template } = await admin
    .from("templates")
    .select("bleed_mm, dpi")
    .eq("id", designRow.template_id)
    .maybeSingle();

  const parsed = parseDesignDocument(designRow.design_json);
  if (!parsed.success) {
    throw new PrintError("The saved design data is invalid and cannot be rendered.", 400);
  }

  const images = new Map<string, Uint8Array>();
  for (const element of parsed.data.elements) {
    if (
      element.kind !== "image" ||
      !element.renderable ||
      !artworkPathBelongsToUser(element.imagePath, order.user_id) ||
      !element.imagePath.toLowerCase().endsWith(".png")
    ) {
      continue;
    }

    const { data, error } = await admin.storage.from(ARTWORK_BUCKET).download(element.imagePath);
    if (!error && data) {
      images.set(element.imagePath, new Uint8Array(await data.arrayBuffer()));
    }
  }

  return {
    orderId: order.id,
    userId: order.user_id,
    productSlug: product.slug,
    bleedMm: Number(template?.bleed_mm ?? 3),
    dpi: Number(template?.dpi ?? 300),
    design: parsed.data,
    images,
  };
}

async function storeAndRecordFile(params: {
  orderId: string;
  kind: GeneratedFileRecord["kind"];
  path: string;
  contentType: string;
  bytes: Uint8Array | Buffer;
}): Promise<GeneratedFileRecord> {
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(PRINT_BUCKET)
    .upload(params.path, params.bytes, {
      contentType: params.contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new PrintError("Print file could not be uploaded to storage.", 500);
  }

  const { data: row, error: insertError } = await admin
    .from("files")
    .insert({
      order_id: params.orderId,
      kind: params.kind,
      path: params.path,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    throw new PrintError("Print file record could not be saved.", 500);
  }

  const { data: signed, error: signError } = await admin.storage
    .from(PRINT_BUCKET)
    .createSignedUrl(params.path, 600);

  if (signError || !signed?.signedUrl) {
    throw new PrintError("Print file download link could not be generated.", 500);
  }

  return {
    id: row.id,
    kind: params.kind,
    path: params.path,
    downloadUrl: signed.signedUrl,
  };
}

/** Generates and stores both print-ready PDF and DPI-accurate PNG for an approved order. */
export async function generateOrderPrintFiles(orderId: string): Promise<{
  files: GeneratedFileRecord[];
}> {
  const ctx = await loadOrderPrintContext(orderId);
  const now = new Date();

  const [pdfBytes, pngBytes] = await Promise.all([
    renderPrintPdf(ctx.design, { bleedMm: ctx.bleedMm, images: ctx.images }),
    renderPrintPng(ctx.design, { bleedMm: ctx.bleedMm, dpi: ctx.dpi, images: ctx.images }),
  ]);

  const pdfPath = buildPrintStoragePath({
    orderId: ctx.orderId,
    productType: ctx.productSlug,
    output: "print",
    extension: "pdf",
    date: now,
  });

  const pngPath = buildPrintStoragePath({
    orderId: ctx.orderId,
    productType: ctx.productSlug,
    output: `print-${ctx.dpi}dpi`,
    extension: "png",
    date: now,
  });

  const [pdfFile, pngFile] = await Promise.all([
    storeAndRecordFile({
      orderId: ctx.orderId,
      kind: "print_pdf",
      path: pdfPath,
      contentType: "application/pdf",
      bytes: pdfBytes,
    }),
    storeAndRecordFile({
      orderId: ctx.orderId,
      kind: "print_png",
      path: pngPath,
      contentType: "image/png",
      bytes: pngBytes,
    }),
  ]);

  return { files: [pdfFile, pngFile] };
}

/** Runs CSV variable-data merge for an approved order, uploads the zip, and records it in files. */
export async function generateOrderCsvMerge(
  orderId: string,
  csvText: string,
): Promise<{
  file: GeneratedFileRecord;
  fileCount: number;
  fileNames: string[];
}> {
  const ctx = await loadOrderPrintContext(orderId);
  const now = new Date();

  let merged;
  try {
    merged = await generateCsvMergeZip({
      orderId: ctx.orderId,
      productType: ctx.productSlug,
      design: ctx.design,
      bleedMm: ctx.bleedMm,
      images: ctx.images,
      csvText,
      date: now,
    });
  } catch (error) {
    if (error instanceof CsvMergeError) {
      throw new PrintError(error.message, 400);
    }
    throw error;
  }

  const zipPath = buildPrintStoragePath({
    orderId: ctx.orderId,
    productType: ctx.productSlug,
    output: "csv-merge",
    extension: "zip",
    date: now,
  });

  const file = await storeAndRecordFile({
    orderId: ctx.orderId,
    kind: "csv_merge_zip",
    path: zipPath,
    contentType: "application/zip",
    bytes: merged.zipBuffer,
  });

  return {
    file,
    fileCount: merged.fileCount,
    fileNames: merged.fileNames,
  };
}
