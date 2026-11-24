import "server-only";

import { getCatalogue } from "@/lib/catalogue/data";
import { latestProof, type ProofStatus } from "@/lib/proofs/gate";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type OrderStatus =
  | "quote"
  | "order"
  | "artwork"
  | "proof"
  | "production"
  | "completed";

export type SavedConfigSummary = {
  widthMm?: number;
  heightMm?: number;
  materialId?: string;
  materialName?: string;
  orientation?: string;
  quantity?: number;
  productSlug?: string;
  productName?: string;
  vatRate?: number;
};

export type CustomerOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productSlug: string | null;
  designId: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  config: SavedConfigSummary;
};

export type CustomerOrderSummary = {
  id: string;
  reference: string;
  invoiceNumber: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  vat: number;
  total: number;
  paidAt: string | null;
  archived: boolean;
  createdAt: string;
  items: CustomerOrderItem[];
  latestProof: {
    version: number;
    status: ProofStatus;
    note: string | null;
    createdAt: string;
  } | null;
  hasDesign: boolean;
  canReorder: boolean;
};

export type CustomerSavedDesign = {
  id: string;
  name: string;
  productId: string;
  productName: string;
  productSlug: string | null;
  templateName: string;
  config: SavedConfigSummary;
  createdAt: string;
  updatedAt: string;
};

export type CustomerDashboardData = {
  profile: {
    id: string;
    email: string;
    fullName: string | null;
    role: "customer" | "admin";
    memberSince: string | null;
  };
  orders: CustomerOrderSummary[];
  savedDesigns: CustomerSavedDesign[];
  activeProofs: CustomerOrderSummary[];
  invoices: CustomerOrderSummary[];
};

export type OrderReceiptData = {
  order: {
    id: string;
    reference: string;
    invoiceNumber: string;
    status: OrderStatus;
    currency: string;
    subtotal: number;
    vat: number;
    total: number;
    paidAt: string | null;
    createdAt: string;
  };
  customer: {
    email: string;
    fullName: string | null;
  };
  items: CustomerOrderItem[];
  latestProof: {
    version: number;
    status: ProofStatus;
  } | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseConfigSummary(
  raw: unknown,
  materialLookup: Map<string, string>,
): SavedConfigSummary {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const obj = raw as Record<string, unknown>;
  const materialId = typeof obj.materialId === "string" ? obj.materialId : undefined;
  return {
    widthMm: typeof obj.widthMm === "number" ? obj.widthMm : undefined,
    heightMm: typeof obj.heightMm === "number" ? obj.heightMm : undefined,
    materialId,
    materialName: materialId ? (materialLookup.get(materialId) ?? materialId) : undefined,
    orientation: typeof obj.orientation === "string" ? obj.orientation : undefined,
    quantity: typeof obj.quantity === "number" ? obj.quantity : undefined,
    productSlug: typeof obj.productSlug === "string" ? obj.productSlug : undefined,
    productName: typeof obj.productName === "string" ? obj.productName : undefined,
    vatRate: typeof obj.vatRate === "number" ? obj.vatRate : undefined,
  };
}

/**
 * Loads all six customer dashboard modules using the user-scoped Supabase client
 * (RLS-enforced). Production print files (`files` table) are never queried here.
 */
export async function loadCustomerDashboard(user: {
  id: string;
  email: string;
  fullName: string | null;
  role: "customer" | "admin";
}): Promise<CustomerDashboardData> {
  if (!hasSupabaseConfig()) {
    return {
      profile: { ...user, memberSince: null },
      orders: [],
      savedDesigns: [],
      activeProofs: [],
      invoices: [],
    };
  }

  const [supabase, catalogue] = await Promise.all([createClient(), getCatalogue()]);

  const productsById = new Map<
    string,
    { name: string; slug: string; templateName: string; materials: Map<string, string> }
  >();
  for (const division of catalogue.divisions) {
    for (const product of division.products) {
      productsById.set(product.id, {
        name: product.name,
        slug: product.slug,
        templateName: product.template?.name ?? product.name,
        materials: new Map(product.config.materials.map((m) => [m.id, m.name])),
      });
    }
  }

  const [{ data: profileRow }, { data: orderRows }, { data: designRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, user_id, status, currency, subtotal, vat, total, paid_at, archived, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("designs")
      .select("id, user_id, name, product_id, template_id, config, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  // Belt-and-suspenders ownership filter in addition to RLS.
  const ownedOrders = (orderRows ?? []).filter((o) => o.user_id === user.id);
  const ownedDesigns = (designRows ?? []).filter((d) => d.user_id === user.id);
  const orderIds = ownedOrders.map((o) => o.id);

  const [{ data: itemRows }, { data: proofRows }] =
    orderIds.length > 0
      ? await Promise.all([
          supabase
            .from("order_items")
            .select("id, order_id, product_id, design_id, config, quantity, unit_price, line_total")
            .in("order_id", orderIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("proofs")
            .select("id, order_id, version, status, note, created_at")
            .in("order_id", orderIds)
            .order("version", { ascending: false }),
        ])
      : [{ data: [] }, { data: [] }];

  const itemsByOrder = new Map<string, CustomerOrderItem[]>();
  for (const row of itemRows ?? []) {
    const productMeta = productsById.get(row.product_id);
    const config = parseConfigSummary(row.config, productMeta?.materials ?? new Map());
    const item: CustomerOrderItem = {
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      productName: productMeta?.name ?? config.productName ?? "Print product",
      productSlug: productMeta?.slug ?? config.productSlug ?? null,
      designId: row.design_id ?? null,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      lineTotal: row.line_total,
      config,
    };
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(row.order_id, list);
  }

  const proofsByOrder = new Map<
    string,
    Array<{ id: string; version: number; status: ProofStatus; note: string | null; created_at: string }>
  >();
  for (const row of proofRows ?? []) {
    const list = proofsByOrder.get(row.order_id) ?? [];
    list.push({
      id: row.id,
      version: row.version,
      status: row.status as ProofStatus,
      note: row.note ?? null,
      created_at: row.created_at,
    });
    proofsByOrder.set(row.order_id, list);
  }

  const orders: CustomerOrderSummary[] = ownedOrders.map((order) => {
    const items = itemsByOrder.get(order.id) ?? [];
    const latest = latestProof(proofsByOrder.get(order.id) ?? []);
    const reference = order.id.slice(0, 8).toUpperCase();
    const hasDesign = items.some((item) => Boolean(item.designId));
    const canReorder = items.length > 0 && Boolean(items[0]?.productId);

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
      items,
      latestProof: latest
        ? {
            version: latest.version,
            status: latest.status,
            note: latest.note,
            createdAt: latest.created_at,
          }
        : null,
      hasDesign,
      canReorder,
    };
  });

  const savedDesigns: CustomerSavedDesign[] = ownedDesigns.map((design) => {
    const productMeta = productsById.get(design.product_id);
    return {
      id: design.id,
      name: design.name,
      productId: design.product_id,
      productName: productMeta?.name ?? "Print product",
      productSlug: productMeta?.slug ?? null,
      templateName: productMeta?.templateName ?? "Standard template",
      config: parseConfigSummary(design.config, productMeta?.materials ?? new Map()),
      createdAt: design.created_at,
      updatedAt: design.updated_at,
    };
  });

  const activeProofs = orders.filter(
    (order) => Boolean(order.paidAt) && (order.hasDesign || order.latestProof !== null),
  );
  const invoices = orders.filter((order) => Boolean(order.paidAt));

  return {
    profile: {
      id: user.id,
      email: profileRow?.email ?? user.email,
      fullName: profileRow?.full_name ?? user.fullName,
      role: profileRow?.role === "admin" ? "admin" : "customer",
      memberSince: profileRow?.created_at ?? null,
    },
    orders,
    savedDesigns,
    activeProofs,
    invoices,
  };
}

/**
 * Loads a single order receipt via the user-scoped client (RLS enforced)
 * and checks ownership explicitly. Returns null if missing or owned by another user.
 */
export async function getOwnedOrderReceipt(
  orderId: string,
  user: { id: string; email: string; fullName: string | null },
): Promise<OrderReceiptData | null> {
  if (!UUID_REGEX.test(orderId) || !hasSupabaseConfig()) {
    return null;
  }

  const [supabase, catalogue] = await Promise.all([createClient(), getCatalogue()]);
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, user_id, status, currency, subtotal, vat, total, paid_at, created_at")
    .eq("id", orderId)
    .maybeSingle();

  // Strictly enforce ownership: a second customer must never see this order.
  if (error || !order || order.user_id !== user.id) {
    return null;
  }

  const [{ data: itemRows }, { data: proofRows }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, order_id, product_id, design_id, config, quantity, unit_price, line_total")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("proofs")
      .select("id, version, status")
      .eq("order_id", order.id)
      .order("version", { ascending: false }),
  ]);

  const productsById = new Map<
    string,
    { name: string; slug: string; materials: Map<string, string> }
  >();
  for (const division of catalogue.divisions) {
    for (const product of division.products) {
      productsById.set(product.id, {
        name: product.name,
        slug: product.slug,
        materials: new Map(product.config.materials.map((m) => [m.id, m.name])),
      });
    }
  }

  const items: CustomerOrderItem[] = (itemRows ?? []).map((row) => {
    const productMeta = productsById.get(row.product_id);
    const config = parseConfigSummary(row.config, productMeta?.materials ?? new Map());
    return {
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      productName: productMeta?.name ?? config.productName ?? "Print product",
      productSlug: productMeta?.slug ?? config.productSlug ?? null,
      designId: row.design_id ?? null,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      lineTotal: row.line_total,
      config,
    };
  });

  const latest = latestProof(
    (proofRows ?? []).map((p) => ({
      id: p.id,
      version: p.version,
      status: p.status as ProofStatus,
    })),
  );
  const reference = order.id.slice(0, 8).toUpperCase();

  return {
    order: {
      id: order.id,
      reference,
      invoiceNumber: `INV-${reference}`,
      status: order.status as OrderStatus,
      currency: (order.currency ?? "gbp").toUpperCase(),
      subtotal: order.subtotal,
      vat: order.vat,
      total: order.total,
      paidAt: order.paid_at ?? null,
      createdAt: order.created_at,
    },
    customer: {
      email: user.email,
      fullName: user.fullName,
    },
    items,
    latestProof: latest ? { version: latest.version, status: latest.status } : null,
  };
}
