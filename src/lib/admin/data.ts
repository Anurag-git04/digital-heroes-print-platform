import "server-only";

import type { OrderStatus } from "@/lib/account/data";
import { getCatalogue } from "@/lib/catalogue/data";
import { isLatestProofApproved, latestProof, type ProofStatus } from "@/lib/proofs/gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import {
  computeAdminReports,
  filterAdminJobs,
  type AdminFileItem,
  type AdminJob,
  type AdminJobFilters,
  type AdminReports,
} from "./helpers";

export type AdminUserSummary = {
  id: string;
  email: string;
  fullName: string | null;
  role: "customer" | "admin";
  createdAt: string;
  orderCount: number;
};

export type AdminDashboardData = {
  jobs: AdminJob[];
  allJobs: AdminJob[];
  reports: AdminReports;
  users: AdminUserSummary[];
  products: Array<{ slug: string; name: string }>;
};

function summarizeConfig(raw: unknown, materials: Map<string, string>, qty: number) {
  if (!raw || typeof raw !== "object") return `${qty} units`;
  const obj = raw as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof obj.widthMm === "number" && typeof obj.heightMm === "number") {
    parts.push(`${obj.widthMm} × ${obj.heightMm} mm`);
  }
  if (typeof obj.materialId === "string") {
    parts.push(materials.get(obj.materialId) ?? obj.materialId);
  }
  if (typeof obj.orientation === "string") {
    parts.push(obj.orientation);
  }
  parts.push(`${qty} units`);
  return parts.join(" · ");
}

/**
 * Loads all admin console data. Call ONLY after verifying admin role on the server.
 */
export async function loadAdminDashboard(filters: AdminJobFilters = {}): Promise<AdminDashboardData> {
  const catalogue = await getCatalogue();
  const divisions = catalogue.divisions.map((d) => ({ id: d.id, name: d.name }));
  const productsList: Array<{ slug: string; name: string }> = [];

  const productLookup = new Map<
    string,
    {
      name: string;
      slug: string;
      divisionId: string;
      divisionName: string;
      csvMerge: boolean;
      materials: Map<string, string>;
    }
  >();

  for (const division of catalogue.divisions) {
    for (const product of division.products) {
      productsList.push({ slug: product.slug, name: product.name });
      productLookup.set(product.id, {
        name: product.name,
        slug: product.slug,
        divisionId: division.id,
        divisionName: division.name,
        csvMerge: Boolean(product.config.designer.csv_merge),
        materials: new Map(product.config.materials.map((m) => [m.id, m.name])),
      });
    }
  }

  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      jobs: [],
      allJobs: [],
      reports: computeAdminReports([], divisions),
      users: [],
      products: productsList,
    };
  }

  const admin = createAdminClient();
  const [
    { data: orderRows },
    { data: itemRows },
    { data: proofRows },
    { data: fileRows },
    { data: profileRows },
  ] = await Promise.all([
    admin
      .from("orders")
      .select("id, user_id, status, currency, subtotal, vat, total, paid_at, archived, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("order_items")
      .select("id, order_id, product_id, design_id, config, quantity")
      .order("created_at", { ascending: true }),
    admin
      .from("proofs")
      .select("id, order_id, version, status")
      .order("version", { ascending: false }),
    admin
      .from("files")
      .select("id, order_id, kind, path, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const profilesById = new Map(
    (profileRows ?? []).map((p) => [
      p.id,
      {
        id: p.id,
        email: p.email ?? "",
        fullName: p.full_name ?? null,
        role: (p.role === "admin" ? "admin" : "customer") as "admin" | "customer",
        createdAt: p.created_at,
      },
    ]),
  );

  const firstItemByOrder = new Map<
    string,
    { product_id: string; design_id: string | null; config: unknown; quantity: number }
  >();
  for (const item of itemRows ?? []) {
    if (!firstItemByOrder.has(item.order_id)) {
      firstItemByOrder.set(item.order_id, item);
    }
  }

  const proofsByOrder = new Map<
    string,
    Array<{ id: string; version: number; status: ProofStatus }>
  >();
  for (const p of proofRows ?? []) {
    const list = proofsByOrder.get(p.order_id) ?? [];
    list.push({ id: p.id, version: p.version, status: p.status as ProofStatus });
    proofsByOrder.set(p.order_id, list);
  }

  const filesByOrder = new Map<string, AdminFileItem[]>();
  for (const f of fileRows ?? []) {
    const list = filesByOrder.get(f.order_id) ?? [];
    list.push({ id: f.id, kind: f.kind, path: f.path, createdAt: f.created_at });
    filesByOrder.set(f.order_id, list);
  }

  const orderCountByUser = new Map<string, number>();

  const allJobs: AdminJob[] = (orderRows ?? []).map((order) => {
    orderCountByUser.set(order.user_id, (orderCountByUser.get(order.user_id) ?? 0) + 1);
    const customer = profilesById.get(order.user_id) ?? {
      id: order.user_id,
      email: "Unknown user",
      fullName: null,
    };
    const item = firstItemByOrder.get(order.id);
    const productMeta = item ? productLookup.get(item.product_id) : undefined;
    const orderProofs = proofsByOrder.get(order.id) ?? [];
    const latest = latestProof(orderProofs);
    const reference = order.id.slice(0, 8).toUpperCase();

    return {
      id: order.id,
      reference,
      invoiceNumber: `INV-${reference}`,
      status: order.status as OrderStatus,
      currency: (order.currency ?? "gbp").toUpperCase(),
      subtotal: order.subtotal,
      vat: order.vat,
      total: order.total,
      paidAt: order.paid_at ?? null,
      archived: Boolean(order.archived),
      createdAt: order.created_at,
      customer: {
        id: customer.id,
        email: customer.email,
        fullName: customer.fullName,
      },
      productId: item?.product_id ?? null,
      productSlug: productMeta?.slug ?? null,
      productName: productMeta?.name ?? "Custom print order",
      divisionId: productMeta?.divisionId ?? null,
      divisionName: productMeta?.divisionName ?? "Unassigned",
      csvMergeEnabled: productMeta?.csvMerge ?? false,
      hasDesign: Boolean(item?.design_id),
      quantity: item?.quantity ?? 0,
      configSummary: item
        ? summarizeConfig(item.config, productMeta?.materials ?? new Map(), item.quantity)
        : "No line items",
      latestProof: latest ? { version: latest.version, status: latest.status } : null,
      readyForProduction: isLatestProofApproved(orderProofs),
      files: filesByOrder.get(order.id) ?? [],
    };
  });

  const users: AdminUserSummary[] = [...profilesById.values()].map((p) => ({
    ...p,
    orderCount: orderCountByUser.get(p.id) ?? 0,
  }));

  return {
    jobs: filterAdminJobs(allJobs, filters),
    allJobs,
    reports: computeAdminReports(allJobs, divisions),
    users,
    products: productsList,
  };
}
