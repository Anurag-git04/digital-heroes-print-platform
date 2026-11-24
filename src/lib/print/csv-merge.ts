import JSZip from "jszip";
import Papa from "papaparse";
import type { DesignDocument } from "@/lib/designer/model";
import { buildPrintFileName, sanitizeSlug } from "./naming";
import { renderPrintPdf } from "./render-pdf";

/** Cap per-run CSV merge rows so serverless routes finish well within maxDuration (60s). */
export const MAX_CSV_ROWS = 200;

export class CsvMergeError extends Error {}

export type ParsedCsvRows = {
  headers: string[];
  rows: Record<string, string>[];
};

/**
 * Parses and validates a CSV string for variable-data merge.
 * Requires non-empty rows, at least one matching placeholder column, and <= MAX_CSV_ROWS rows.
 */
export function parseMergeCsv(
  csvText: string,
  requiredColumns: string[] = [],
): ParsedCsvRows {
  const trimmed = csvText.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new CsvMergeError("The CSV file is empty. Upload a CSV with a header row and at least one data row.");
  }

  const parsed = Papa.parse<Record<string, unknown>>(trimmed, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const fatalErrors = parsed.errors.filter((err) => err.code !== "UndetectableDelimiter");
  if (fatalErrors.length > 0) {
    const first = fatalErrors[0];
    throw new CsvMergeError(
      `Invalid CSV format${first?.row !== undefined ? ` on row ${first.row + 2}` : ""}: ${first?.message ?? "check quotes and commas."}`,
    );
  }

  const headers = (parsed.meta.fields ?? []).map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (headers.length === 0) {
    throw new CsvMergeError("The CSV must include a header row (for example: number,name).");
  }

  const normalizedRequired = requiredColumns.map((col) => col.trim().toLowerCase()).filter(Boolean);
  const missing = normalizedRequired.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    throw new CsvMergeError(
      `CSV is missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Found: ${headers.join(", ")}.`,
    );
  }

  const rows: Record<string, string>[] = [];
  for (const raw of parsed.data) {
    const row: Record<string, string> = {};
    let hasValue = false;
    for (const header of headers) {
      const value = raw[header] == null ? "" : String(raw[header]).trim();
      row[header] = value;
      if (value) hasValue = true;
    }
    if (hasValue) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    throw new CsvMergeError("The CSV contains headers but no data rows.");
  }

  if (rows.length > MAX_CSV_ROWS) {
    throw new CsvMergeError(
      `CSV has ${rows.length} rows, which exceeds the ${MAX_CSV_ROWS}-row limit per batch. Split the file into smaller batches and run again.`,
    );
  }

  return { headers, rows };
}

/** Applies one CSV row's values to matching placeholder elements in a design clone. */
export function applyRowToDesign(
  design: DesignDocument,
  row: Record<string, string>,
): DesignDocument {
  return {
    ...design,
    elements: design.elements.map((element) => {
      if (element.kind === "placeholder" && element.placeholderId) {
        const key = element.placeholderId.toLowerCase();
        if (key in row && row[key] !== "") {
          return { ...element, text: row[key] };
        }
      }
      return element;
    }),
  };
}

export type CsvMergeParams = {
  orderId: string;
  productType: string;
  design: DesignDocument;
  bleedMm: number;
  images: ReadonlyMap<string, Uint8Array>;
  csvText: string;
  date?: Date;
};

export type CsvMergeResult = {
  zipBuffer: Buffer;
  fileCount: number;
  fileNames: string[];
};

/**
 * Generates one print-ready PDF per CSV row (with shrink-to-fit applied per row)
 * and bundles them into a zip archive named by the order convention.
 */
export async function generateCsvMergeZip(params: CsvMergeParams): Promise<CsvMergeResult> {
  const placeholderIds = params.design.elements.flatMap((el) =>
    el.kind === "placeholder" && el.placeholderId ? [el.placeholderId.toLowerCase()] : [],
  );

  const { rows } = parseMergeCsv(params.csvText, placeholderIds);
  const zip = new JSZip();
  const fileNames: string[] = [];
  const usedNames = new Set<string>();
  const date = params.date ?? new Date();

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowDesign = applyRowToDesign(params.design, row);
    const pdfBytes = await renderPrintPdf(rowDesign, {
      bleedMm: params.bleedMm,
      images: params.images,
    });

    const rowIndex = String(index + 1).padStart(3, "0");
    const identifier = row.number || row.name || Object.values(row).find(Boolean) || rowIndex;
    const outputTag = `row-${rowIndex}-${sanitizeSlug(identifier, rowIndex).slice(0, 24)}`;
    let fileName = buildPrintFileName({
      orderId: params.orderId,
      productType: params.productType,
      output: outputTag,
      extension: "pdf",
      date,
    });

    if (usedNames.has(fileName)) {
      fileName = buildPrintFileName({
        orderId: params.orderId,
        productType: params.productType,
        output: `${outputTag}-${rowIndex}`,
        extension: "pdf",
        date,
      });
    }

    usedNames.add(fileName);
    fileNames.push(fileName);
    zip.file(fileName, pdfBytes);
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    zipBuffer,
    fileCount: fileNames.length,
    fileNames,
  };
}
