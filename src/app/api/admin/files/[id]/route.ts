import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canGeneratePrintFiles } from "@/lib/proofs/access";
import { createAdminClient } from "@/lib/supabase/admin";

const fileIdSchema = z.uuid("Invalid file ID.");

/**
 * Admin-only signed download endpoint for production print files and CSV merge zips.
 * Enforces both admin role (401/403) and the proof approval gate (403).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return Response.json({ error: "Only administrators can download production files." }, { status: 403 });
  }

  const { id } = await context.params;
  const parsed = fileIdSchema.safeParse(id);
  if (!parsed.success) {
    return Response.json({ error: "Invalid file ID." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: fileRow } = await admin
    .from("files")
    .select("id, order_id, kind, path")
    .eq("id", parsed.data)
    .maybeSingle();

  if (!fileRow) {
    return Response.json({ error: "File not found." }, { status: 404 });
  }

  // Enforce approval gate on download as well as generation.
  if (!(await canGeneratePrintFiles(fileRow.order_id))) {
    return Response.json(
      { error: "Print files are locked until the latest proof is approved." },
      { status: 403 },
    );
  }

  const { data: signed, error } = await admin.storage
    .from("print-files")
    .createSignedUrl(fileRow.path, 300, { download: true });

  if (error || !signed?.signedUrl) {
    return Response.json({ error: "Could not create a download link for this file." }, { status: 500 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("download") === "1") {
    return Response.redirect(signed.signedUrl, 302);
  }

  return Response.json({
    id: fileRow.id,
    kind: fileRow.kind,
    path: fileRow.path,
    downloadUrl: signed.signedUrl,
  });
}
