import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

type ArtworkType = {
  extension: "png" | "svg" | "pdf" | "ai";
  contentType: "image/png" | "image/svg+xml" | "application/pdf" | "application/postscript";
  renderable: boolean;
};

function inspectArtwork(buffer: Buffer, fileName: string): ArtworkType | null {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "png") {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return buffer.subarray(0, 8).equals(signature)
      ? { extension: "png", contentType: "image/png", renderable: true }
      : null;
  }

  if (extension === "pdf" || extension === "ai") {
    if (!buffer.subarray(0, 1024).toString("latin1").includes("%PDF-")) {
      return null;
    }
    return extension === "ai"
      ? { extension: "ai", contentType: "application/postscript", renderable: false }
      : { extension: "pdf", contentType: "application/pdf", renderable: false };
  }

  if (extension === "svg") {
    const source = buffer.toString("utf8");
    const hasSvg = /<svg(?:\s|>)/i.test(source);
    const hasUnsafeContent = /<script|<!doctype|<!entity|foreignobject|javascript:|on[a-z]+\s*=|(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/|file:)/i.test(source);
    return hasSvg && !hasUnsafeContent
      ? { extension: "svg", contentType: "image/svg+xml", renderable: true }
      : null;
  }

  return null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Sign in before uploading artwork." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ error: "Artwork must be 4 MB or smaller." }, { status: 413 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "The artwork upload could not be read." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose an artwork file." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Artwork must be 4 MB or smaller." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const artwork = inspectArtwork(buffer, file.name);

  if (!artwork) {
    return Response.json({ error: "Use a valid PNG, SVG, PDF or AI file." }, { status: 415 });
  }

  try {
    const supabase = createAdminClient();
    const baseName = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "artwork";
    const fileId = randomUUID();
    const originalPath = `${user.id}/${fileId}-${baseName}.${artwork.extension}`;
    const { error: originalError } = await supabase.storage.from("artwork").upload(originalPath, buffer, {
      contentType: artwork.contentType,
      upsert: false,
    });

    if (originalError) {
      return Response.json({ error: "Artwork could not be stored." }, { status: 500 });
    }

    let previewPath = originalPath;
    let previewMime = artwork.contentType;

    if (artwork.extension === "svg") {
      const png = await sharp(buffer, { limitInputPixels: 25_000_000 })
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();

      if (png.byteLength > MAX_UPLOAD_BYTES) {
        await supabase.storage.from("artwork").remove([originalPath]);
        return Response.json({ error: "The converted artwork is too large. Use a simpler SVG." }, { status: 413 });
      }

      previewPath = `${user.id}/${fileId}-${baseName}-preview.png`;
      const { error: previewError } = await supabase.storage.from("artwork").upload(previewPath, png, {
        contentType: "image/png",
        upsert: false,
      });

      if (previewError) {
        await supabase.storage.from("artwork").remove([originalPath]);
        return Response.json({ error: "The SVG preview could not be created." }, { status: 500 });
      }
      previewMime = "image/png";
    }

    let previewUrl: string | undefined;
    if (artwork.renderable) {
      const { data, error } = await supabase.storage.from("artwork").createSignedUrl(previewPath, 300);
      if (error || !data?.signedUrl) {
        await supabase.storage.from("artwork").remove([originalPath, ...(previewPath !== originalPath ? [previewPath] : [])]);
        return Response.json({ error: "The artwork preview could not be prepared." }, { status: 500 });
      }
      previewUrl = data.signedUrl;
    }

    return Response.json({
      path: previewPath,
      originalPath,
      previewUrl,
      mimeType: previewMime,
      renderable: artwork.renderable,
      label: artwork.renderable ? undefined : `${artwork.extension.toUpperCase()} artwork — production render required`,
    });
  } catch {
    return Response.json({ error: "Artwork processing failed. Try a smaller or simpler file." }, { status: 500 });
  }
}
