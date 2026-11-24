import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ConfigurationInput } from "@/lib/pricing/calculatePrice";
import type { DesignDocument } from "./model";

export type SavedDesign = {
  id: string;
  name: string;
  user_id: string;
  product_id: string;
  design_json: DesignDocument;
  config: ConfigurationInput;
};

export async function getOwnedDesign(designId: string, userId: string): Promise<SavedDesign | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("designs")
    .select("id, name, user_id, product_id, design_json, config")
    .eq("id", designId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as SavedDesign;
}
