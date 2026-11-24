import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateOrderCsvMerge, generateOrderPrintFiles, PrintError } from "@/lib/print/service";
import { authorizePrintGeneration } from "@/lib/proofs/access";

// Heavy route: runs on the default Node.js runtime (pdf-lib and sharp need it).
// `runtime` segment config is not allowed with Cache Components, so only the time limit is set.
export const maxDuration = 60;

const MAX_CSV_BYTES = 4 * 1024 * 1024;

const jsonBodySchema = z.object({
  orderId: z.uuid("Send a valid order ID."),
  csvText: z.string().max(MAX_CSV_BYTES).optional(),
});

const orderIdSchema = z.uuid("Send a valid order ID.");

async function extractRequestInput(request: Request): Promise<
  | { ok: true; orderId: string; csvText?: string }
  | { ok: false; status: number; error: string }
> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return { ok: false, status: 400, error: "Could not read the uploaded form data." };
    }

    const parsedId = orderIdSchema.safeParse(formData.get("orderId"));
    if (!parsedId.success) {
      return { ok: false, status: 400, error: "Send a valid order ID." };
    }

    const csvField = formData.get("csv");
    if (csvField instanceof File) {
      if (csvField.size === 0) {
        return { ok: false, status: 400, error: "The uploaded CSV file is empty." };
      }
      if (csvField.size > MAX_CSV_BYTES) {
        return { ok: false, status: 413, error: "CSV file must be 4 MB or smaller." };
      }
      const csvText = await csvField.text();
      return { ok: true, orderId: parsedId.data, csvText };
    }

    if (typeof csvField === "string" && csvField.trim().length > 0) {
      return { ok: true, orderId: parsedId.data, csvText: csvField };
    }

    return { ok: true, orderId: parsedId.data };
  }

  const rawJson = await request.json().catch(() => null);
  const parsed = jsonBodySchema.safeParse(rawJson);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message ?? "Send a valid order ID.",
    };
  }

  return { ok: true, orderId: parsed.data.orderId, csvText: parsed.data.csvText };
}

/**
 * Generates print-ready PDF + 300 DPI PNG, or a CSV variable-data merge zip (one PDF per row).
 * Always checks admin role and canGeneratePrintFiles(orderId) before rendering.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const input = await extractRequestInput(request);

  if (!input.ok) {
    return Response.json({ error: input.error }, { status: input.status });
  }

  const access = await authorizePrintGeneration(input.orderId, user?.role ?? null);
  if (!access.ok) {
    return Response.json({ error: access.error }, { status: access.status });
  }

  try {
    if (input.csvText !== undefined) {
      const result = await generateOrderCsvMerge(input.orderId, input.csvText);
      return Response.json({
        mode: "csv_merge",
        file: result.file,
        fileCount: result.fileCount,
        fileNames: result.fileNames,
      });
    }

    const result = await generateOrderPrintFiles(input.orderId);
    return Response.json({
      mode: "single",
      files: result.files,
    });
  } catch (error) {
    if (error instanceof PrintError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("Print generation failed", error);
    return Response.json(
      { error: "Print file generation failed. Please try again." },
      { status: 500 },
    );
  }
}
