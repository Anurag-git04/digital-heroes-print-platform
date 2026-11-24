import { cacheLife, cacheTag } from "next/cache";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createPublicClient } from "@/lib/supabase/public";
import { seedCatalogue } from "./seed";
import type {
  Catalogue,
  Division,
  PrintTemplate,
  ProductConfig,
  ProductDetail,
} from "./types";

type DivisionRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort: number;
};

type ProductRow = {
  id: string;
  division_id: string;
  slug: string;
  name: string;
  description: string | null;
  config: ProductConfig;
  active: boolean;
};

type TemplateRow = {
  id: string;
  product_id: string;
  name: string;
  base_width_mm: number;
  base_height_mm: number;
  print_area: PrintTemplate["printArea"];
  bleed_mm: number;
  dpi: number;
  placeholders: PrintTemplate["placeholders"];
};

async function fetchCatalogue(): Promise<Catalogue> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalogue");

  const supabase = createPublicClient();
  const [divisionResult, productResult, templateResult] = await Promise.all([
    supabase.from("divisions").select("id, slug, name, description, sort").order("sort"),
    supabase
      .from("products")
      .select("id, division_id, slug, name, description, config, active")
      .eq("active", true)
      .order("name"),
    supabase
      .from("templates")
      .select("id, product_id, name, base_width_mm, base_height_mm, print_area, bleed_mm, dpi, placeholders")
      .order("name"),
  ]);

  if (divisionResult.error || productResult.error || templateResult.error) {
    throw new Error(
      divisionResult.error?.message ??
        productResult.error?.message ??
        templateResult.error?.message ??
        "Could not load the catalogue.",
    );
  }

  const templatesByProduct = new Map<string, PrintTemplate>();
  for (const row of (templateResult.data ?? []) as TemplateRow[]) {
    templatesByProduct.set(row.product_id, {
      id: row.id,
      productId: row.product_id,
      name: row.name,
      baseSize: [Number(row.base_width_mm), Number(row.base_height_mm)],
      printArea: row.print_area,
      bleedMm: Number(row.bleed_mm),
      dpi: row.dpi,
      placeholders: row.placeholders,
    });
  }

  const divisions: Division[] = ((divisionResult.data ?? []) as DivisionRow[]).map(
    (division) => ({
      id: division.id,
      slug: division.slug,
      name: division.name,
      description: division.description ?? "",
      sort: division.sort,
      products: ((productResult.data ?? []) as ProductRow[])
        .filter((product) => product.division_id === division.id)
        .map((product) => ({
          id: product.id,
          divisionId: product.division_id,
          slug: product.slug,
          name: product.name,
          description: product.description ?? "",
          config: product.config,
          active: product.active,
          template: templatesByProduct.get(product.id) ?? null,
        })),
    }),
  );

  return { divisions };
}

export async function getCatalogue(): Promise<Catalogue> {
  if (!hasSupabaseConfig()) {
    return seedCatalogue;
  }

  return fetchCatalogue();
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const catalogue = await getCatalogue();

  for (const division of catalogue.divisions) {
    const product = division.products.find((item) => item.slug === slug);
    if (product) {
      return { ...product, division };
    }
  }

  return null;
}

export async function getProductById(id: string): Promise<ProductDetail | null> {
  const catalogue = await getCatalogue();

  for (const division of catalogue.divisions) {
    const product = division.products.find((item) => item.id === id);
    if (product) {
      return { ...product, division };
    }
  }

  return null;
}
