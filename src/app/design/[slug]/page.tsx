import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DesignerCanvasLoader } from "@/components/designer/designer-loader";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getProductBySlug } from "@/lib/catalogue/data";
import { calculatePrice, configurationSchema, type ConfigurationInput } from "@/lib/pricing/calculatePrice";
import { formatMoney } from "@/lib/pricing/formatMoney";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { parseDesignDocument } from "@/lib/designer/schema";
import type { DesignDocument } from "@/lib/designer/model";
import { getOwnedDesign } from "@/lib/designer/store";

export const metadata: Metadata = { title: "Design your print" };

type DesignSearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

async function DesignContent({ slug, searchParams }: { slug: string; searchParams: DesignSearchParams }) {
  const product = await getProductBySlug(slug);
  if (!product?.template) notFound();

  const params = await searchParams;
  const designId = single(params.design);
  const user = await getCurrentUser();
  let initialDesign: DesignDocument | null = null;
  let initialDesignId: string | undefined;
  let savedConfiguration: ConfigurationInput | undefined;

  if (designId) {
    const currentPath = `/design/${slug}?${new URLSearchParams({ design: designId })}`;
    if (!user) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) notFound();

    const saved = await getOwnedDesign(designId, user.id);
    if (!saved || saved.product_id !== product.id) notFound();
    const parsedDocument = parseDesignDocument(saved.design_json);
    const parsedConfiguration = configurationSchema.safeParse(saved.config);
    if (!parsedDocument.success || !parsedConfiguration.success) notFound();
    initialDesign = parsedDocument.data;
    initialDesignId = saved.id;
    savedConfiguration = parsedConfiguration.data;
  }

  const firstPreset = product.config.sizes.presets[0] ?? product.config.sizes.min_mm;
  const defaults: ConfigurationInput = {
    widthMm: firstPreset[0],
    heightMm: firstPreset[1],
    materialId: product.config.materials[0]?.id ?? "",
    orientation: product.config.orientations[0] ?? "landscape",
    quantity: 100,
  };
  const parsedQuery = configurationSchema.safeParse({
    widthMm: Number(single(params.w)),
    heightMm: Number(single(params.h)),
    materialId: single(params.material),
    orientation: single(params.orientation),
    quantity: Number(single(params.qty)),
  });
  let configuration = savedConfiguration ?? (parsedQuery.success ? parsedQuery.data : defaults);

  try {
    calculatePrice(product, configuration);
  } catch {
    configuration = defaults;
  }

  const price = calculatePrice(product, configuration);
  const canPersist = Boolean(user && hasSupabaseConfig() && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const loginHref = `/login?next=${encodeURIComponent(`/design/${slug}`)}`;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <Link href={`/products/${product.division.slug}/${product.slug}`} className="text-sm font-semibold text-[var(--accent)]">← Back to configurator</Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">{product.division.name}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Design your {product.name.toLowerCase()}.</h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">Place text and artwork inside the print area. Long template fields shrink automatically, and every saved element stays in millimetres.</p>
        </div>
        <div className="rounded-2xl bg-[var(--ink)] px-6 py-4 text-white">
          <p className="text-xs text-white/60">Configured total</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(price.total)}</p>
          <p className="mt-1 text-xs text-white/60">{configuration.quantity} units · {configuration.widthMm} × {configuration.heightMm} mm</p>
        </div>
      </div>

      <DesignerCanvasLoader
        product={product}
        configuration={configuration}
        initialDesign={initialDesign}
        initialDesignId={initialDesignId}
        canPersist={canPersist}
        loginHref={loginHref}
      />
    </>
  );
}

export default function DesignPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: DesignSearchParams }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12 lg:px-10 lg:py-20">
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-2xl bg-[var(--line)]" />}>
        <DesignRoute params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DesignRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: DesignSearchParams }) {
  const { slug } = await params;
  return <DesignContent slug={slug} searchParams={searchParams} />;
}
