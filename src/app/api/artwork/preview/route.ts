import { getCurrentUser } from "@/lib/auth/current-user";
import { artworkPathBelongsToUser } from "@/lib/designer/model";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Sign in to view artwork." }, { status: 401 });
  }

  const path = new URL(request.url).searchParams.get("path");

  if (!path || !artworkPathBelongsToUser(path, user.id)) {
    return Response.json({ error: "Invalid artwork path." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from("artwork").createSignedUrl(path, 300);

    if (error || !data?.signedUrl) {
      return Response.json({ error: "Artwork could not be loaded." }, { status: 404 });
    }

    return Response.json({ url: data.signedUrl });
  } catch {
    return Response.json({ error: "Artwork storage is not configured." }, { status: 500 });
  }
}
