import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedCatalogue } from "@/lib/catalogue/seed";

const ORDER_A_ID = "11111111-1111-4111-8111-111111111111";
const NEW_ORDER_ID = "22222222-2222-4222-8222-222222222222";
const DESIGN_A_ID = "33333333-3333-4333-8333-333333333333";
const CLONED_DESIGN_ID = "44444444-4444-4444-8444-444444444444";
const USER_A = { id: "user-a", email: "alice@example.com", fullName: "Alice", role: "customer" as const };
const USER_B = { id: "user-b", email: "bob@example.com", fullName: "Bob", role: "customer" as const };

const customLabelsProduct = seedCatalogue.divisions[0].products[0];

const state = vi.hoisted(() => ({
  currentUser: null as null | { id: string; email: string; fullName: string | null; role: "customer" | "admin" },
  queriedTables: [] as string[],
  orderRow: null as Record<string, unknown> | null,
  orderItemRows: [] as Record<string, unknown>[],
  proofRows: [] as Record<string, unknown>[],
  designRows: [] as Record<string, unknown>[],
  insertedDesigns: [] as Record<string, unknown>[],
  insertedOrders: [] as Record<string, unknown>[],
  insertedOrderItems: [] as Record<string, unknown>[],
  deletedDesignIds: [] as string[],
  stripeCreateArgs: null as Record<string, unknown> | null,
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ origin: "http://localhost:3000" })),
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: () => true,
}));

vi.mock("@/lib/catalogue/data", () => ({
  getCatalogue: async () => seedCatalogue,
  getProductById: async (id: string) => {
    for (const div of seedCatalogue.divisions) {
      const found = div.products.find((p) => p.id === id);
      if (found) return { ...found, division: div };
    }
    return null;
  },
}));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: async () => state.currentUser,
}));

vi.mock("@/lib/checkout/stripe", () => ({
  hasStripeConfig: () => true,
  getStripe: () => ({
    checkout: {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          state.stripeCreateArgs = args;
          return { id: "cs_test_reorder", url: "https://checkout.stripe.test/reorder" };
        },
      },
    },
  }),
}));

// User-scoped client mock (tracks every table queried so we can assert `files` is never touched).
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      state.queriedTables.push(table);
      let isDelete = false;
      const filters: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        delete: () => {
          isDelete = true;
          return chain;
        },
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        },
        in: () => chain,
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "designs") {
            const match = state.designRows.find((d) => d.id === filters.id);
            if (isDelete) {
              if (!match || match.user_id !== filters.user_id) {
                return { data: null, error: null };
              }
              state.deletedDesignIds.push(String(match.id));
              return { data: { id: match.id }, error: null };
            }
            return { data: match ?? null, error: null };
          }
          if (table === "orders") return { data: state.orderRow, error: null };
          if (table === "order_items") return { data: state.orderItemRows[0] ?? null, error: null };
          if (table === "profiles") {
            return {
              data: state.currentUser
                ? { ...state.currentUser, full_name: state.currentUser.fullName, created_at: "2026-11-24T00:00:00Z" }
                : null,
              error: null,
            };
          }
          return { data: null, error: null };
        },
        then: (resolve: (val: { data: unknown[]; error: null }) => void) => {
          if (table === "orders") return resolve({ data: state.orderRow ? [state.orderRow] : [], error: null });
          if (table === "order_items") {
            const filtered = filters.design_id
              ? state.orderItemRows.filter((i) => i.design_id === filters.design_id)
              : state.orderItemRows;
            return resolve({ data: filtered, error: null });
          }
          if (table === "proofs") return resolve({ data: state.proofRows, error: null });
          if (table === "designs") return resolve({ data: state.designRows, error: null });
          return resolve({ data: [], error: null });
        },
      };
      return chain;
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === "designs") return { data: state.designRows[0] ?? null, error: null };
            return { data: null, error: null };
          },
        }),
      }),
      insert: (payload: Record<string, unknown>) => {
        if (table === "designs") {
          state.insertedDesigns.push(payload);
          return {
            select: () => ({
              single: async () => ({ data: { id: CLONED_DESIGN_ID }, error: null }),
            }),
          };
        }
        if (table === "orders") {
          state.insertedOrders.push(payload);
          return {
            select: () => ({
              single: async () => ({ data: { id: NEW_ORDER_ID }, error: null }),
            }),
          };
        }
        if (table === "order_items") {
          state.insertedOrderItems.push(payload);
          return Promise.resolve({ error: null });
        }
        return Promise.resolve({ error: null });
      },
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
}));

import { deleteDesignAction, reorderOrderAction } from "./actions";
import { getOwnedOrderReceipt, loadCustomerDashboard } from "./data";

describe("Phase 7: Customer dashboard, isolation & one-click reorder", () => {
  beforeEach(() => {
    state.currentUser = USER_A;
    state.queriedTables = [];
    state.insertedDesigns = [];
    state.insertedOrders = [];
    state.insertedOrderItems = [];
    state.deletedDesignIds = [];
    state.stripeCreateArgs = null;

    state.orderRow = {
      id: ORDER_A_ID,
      user_id: USER_A.id,
      status: "proof",
      currency: "gbp",
      subtotal: 2700,
      vat: 540,
      total: 3240,
      paid_at: "2026-11-24T10:00:00Z",
      archived: false,
      created_at: "2026-11-24T09:50:00Z",
    };
    state.orderItemRows = [
      {
        id: "item-1",
        order_id: ORDER_A_ID,
        product_id: customLabelsProduct.id,
        design_id: DESIGN_A_ID,
        quantity: 100,
        unit_price: 27,
        line_total: 2700,
        config: {
          widthMm: 50,
          heightMm: 50,
          materialId: "vinyl",
          orientation: "landscape",
          quantity: 100,
        },
      },
    ];
    state.proofRows = [
      {
        id: "proof-1",
        order_id: ORDER_A_ID,
        version: 1,
        status: "approved",
        note: null,
        created_at: "2026-11-24T10:15:00Z",
      },
    ];
    state.designRows = [
      {
        id: DESIGN_A_ID,
        user_id: USER_A.id,
        product_id: customLabelsProduct.id,
        template_id: customLabelsProduct.template!.id,
        name: "Brand Sticker",
        design_json: { version: 1, elements: [] },
        config: {
          widthMm: 50,
          heightMm: 50,
          materialId: "vinyl",
          orientation: "landscape",
          quantity: 100,
        },
        created_at: "2026-11-24T09:40:00Z",
        updated_at: "2026-11-24T09:45:00Z",
      },
    ];
  });

  it("blocks a second customer from reading the first customer's order receipt", async () => {
    const receiptForOwner = await getOwnedOrderReceipt(ORDER_A_ID, USER_A);
    expect(receiptForOwner).not.toBeNull();
    expect(receiptForOwner?.order.total).toBe(3240);
    expect(receiptForOwner?.order.invoiceNumber).toBe("INV-11111111");

    // Second customer tries to open User A's order URL -> must return null (page calls notFound()).
    const receiptForSecondUser = await getOwnedOrderReceipt(ORDER_A_ID, USER_B);
    expect(receiptForSecondUser).toBeNull();

    // Non-UUID order IDs are also rejected cleanly.
    expect(await getOwnedOrderReceipt("not-a-uuid", USER_A)).toBeNull();
  });

  it("loads all six customer dashboard modules and never queries production files", async () => {
    const dashboard = await loadCustomerDashboard(USER_A);

    expect(dashboard.profile.email).toBe(USER_A.email);
    expect(dashboard.orders).toHaveLength(1);
    expect(dashboard.savedDesigns).toHaveLength(1);
    expect(dashboard.savedDesigns[0].config.materialName).toBe("Gloss vinyl");
    expect(dashboard.activeProofs).toHaveLength(1);
    expect(dashboard.activeProofs[0].latestProof?.version).toBe(1);
    expect(dashboard.invoices).toHaveLength(1);
    expect(dashboard.orders[0].canReorder).toBe(true);

    // Production print files must stay hidden from customers.
    expect(state.queriedTables).not.toContain("files");
  });

  it("hides another customer's orders and designs from a second user's dashboard", async () => {
    state.currentUser = USER_B;
    const dashboard = await loadCustomerDashboard(USER_B);

    expect(dashboard.orders).toHaveLength(0);
    expect(dashboard.savedDesigns).toHaveLength(0);
    expect(dashboard.activeProofs).toHaveLength(0);
    expect(dashboard.invoices).toHaveLength(0);
  });

  it("blocks a second customer from reordering the first customer's order", async () => {
    state.currentUser = USER_B;
    const formData = new FormData();
    formData.set("orderId", ORDER_A_ID);

    const result = await reorderOrderAction({}, formData);
    expect(result.error).toMatch(/could not find that order/i);
    expect(state.insertedOrders).toHaveLength(0);
  });

  it("clones design, recomputes price server-side, creates a new order, and redirects to Stripe Checkout", async () => {
    // Even if the stored historical order had a stale/lower total, reorder must recompute via calculatePrice.
    state.orderRow!.total = 1;
    const formData = new FormData();
    formData.set("orderId", ORDER_A_ID);

    await expect(reorderOrderAction({}, formData)).rejects.toThrow(
      "REDIRECT:https://checkout.stripe.test/reorder",
    );

    // Original design cloned into a fresh row.
    expect(state.insertedDesigns).toHaveLength(1);
    expect(state.insertedDesigns[0].name).toBe("Brand Sticker (Reorder)");

    // New order created with freshly recomputed server totals (50x50mm vinyl x 100 = 2700 + 540 VAT = 3240).
    expect(state.insertedOrders).toHaveLength(1);
    expect(state.insertedOrders[0]).toMatchObject({
      user_id: USER_A.id,
      status: "quote",
      subtotal: 2700,
      vat: 540,
      total: 3240,
    });

    // Order item links to the new order and cloned design.
    expect(state.insertedOrderItems).toHaveLength(1);
    expect(state.insertedOrderItems[0]).toMatchObject({
      order_id: NEW_ORDER_ID,
      design_id: CLONED_DESIGN_ID,
      quantity: 100,
      unit_price: 27,
      line_total: 2700,
    });

    // Stripe Checkout started directly without opening the designer.
    expect(state.stripeCreateArgs).not.toBeNull();
  });

  it("blocks a second customer from deleting the first customer's saved design", async () => {
    state.currentUser = USER_B;
    const formData = new FormData();
    formData.set("designId", DESIGN_A_ID);

    const result = await deleteDesignAction({}, formData);
    expect(result.error).toMatch(/could not find that design/i);
    expect(state.deletedDesignIds).toHaveLength(0);
  });

  it("protects designs attached to a paid order from deletion", async () => {
    state.currentUser = USER_A;
    const formData = new FormData();
    formData.set("designId", DESIGN_A_ID);

    const result = await deleteDesignAction({}, formData);
    expect(result.error).toMatch(/attached to a paid order/i);
    expect(state.deletedDesignIds).toHaveLength(0);
  });

  it("allows the owner to delete their own unattached draft design via RLS-scoped client", async () => {
    state.currentUser = USER_A;
    state.orderItemRows = []; // Not attached to any paid order
    const formData = new FormData();
    formData.set("designId", DESIGN_A_ID);

    const result = await deleteDesignAction({}, formData);
    expect(result.error).toBeUndefined();
    expect(state.deletedDesignIds).toEqual([DESIGN_A_ID]);
  });
});
