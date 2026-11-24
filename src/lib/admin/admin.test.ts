import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAccountingExportRows,
  computeAdminReports,
  filterAdminJobs,
  serializeAccountingCsv,
  type AdminJob,
} from "./helpers";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const FILE_ID = "55555555-5555-4555-8555-555555555555";

const mockState = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; fullName: string | null; role: "customer" | "admin" },
  orderStatus: "order",
  proofApproved: true,
  updatedOrders: [] as Record<string, unknown>[],
  historyInserts: [] as Record<string, unknown>[],
  emailsSent: [] as Record<string, unknown>[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: async () => mockState.user,
}));

vi.mock("@/lib/email/send", () => ({
  sendOrderStatusEmail: async (payload: Record<string, unknown>) => {
    mockState.emailsSent.push(payload);
    return { delivered: false, fallback: true };
  },
}));

vi.mock("@/lib/proofs/access", () => ({
  canGeneratePrintFiles: async () => mockState.proofApproved,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === "orders") {
              return { data: { id: ORDER_ID, user_id: "cust-1", status: mockState.orderStatus }, error: null };
            }
            if (table === "profiles") {
              return { data: { email: "cust@example.com" }, error: null };
            }
            if (table === "files") {
              return { data: { id: FILE_ID, order_id: ORDER_ID, kind: "print_pdf", path: "o/f.pdf" }, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          mockState.updatedOrders.push(payload);
          return { error: null };
        },
      }),
      insert: async (payload: Record<string, unknown>) => {
        if (table === "order_status_history") mockState.historyInserts.push(payload);
        return { error: null };
      },
    }),
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "https://storage.test/signed" }, error: null }),
      }),
    },
  }),
}));

import { GET as exportOrdersGet } from "@/app/api/admin/export/route";
import { GET as downloadFileGet } from "@/app/api/admin/files/[id]/route";
import { advanceOrderStatusAction } from "./actions";

const sampleJobs: AdminJob[] = [
  {
    id: ORDER_ID,
    reference: "11111111",
    invoiceNumber: "INV-11111111",
    status: "proof",
    currency: "GBP",
    subtotal: 2700,
    vat: 540,
    total: 3240,
    paidAt: "2026-11-24T10:00:00Z",
    archived: false,
    createdAt: "2026-11-24T09:30:00Z",
    customer: { id: "cust-1", email: "alice@example.com", fullName: "Alice Smith" },
    productId: "p-1",
    productSlug: "custom-labels",
    productName: "Custom-cut labels",
    divisionId: "div-labels",
    divisionName: "Labels & stickers",
    csvMergeEnabled: false,
    hasDesign: true,
    quantity: 100,
    configSummary: "50 × 50 mm · Gloss vinyl · 100 units",
    latestProof: { version: 1, status: "approved" },
    readyForProduction: true,
    files: [],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    reference: "22222222",
    invoiceNumber: "INV-22222222",
    status: "completed",
    currency: "GBP",
    subtotal: 5000,
    vat: 1000,
    total: 6000,
    paidAt: "2026-11-20T12:00:00Z",
    archived: true,
    createdAt: "2026-11-20T11:00:00Z",
    customer: { id: "cust-2", email: "bob@example.com", fullName: "Bob, Runner" },
    productId: "p-2",
    productSlug: "race-numbers",
    productName: "Race bib numbers",
    divisionId: "div-race",
    divisionName: "Race & event numbers",
    csvMergeEnabled: true,
    hasDesign: true,
    quantity: 200,
    configSummary: "120 × 80 mm · Sturdy bib paper · 200 units",
    latestProof: { version: 2, status: "approved" },
    readyForProduction: true,
    files: [],
  },
];

describe("Phase 8: Admin reports, filters, exports & role enforcement", () => {
  beforeEach(() => {
    mockState.user = null;
    mockState.orderStatus = "order";
    mockState.proofApproved = true;
    mockState.updatedOrders = [];
    mockState.historyInserts = [];
    mockState.emailsSent = [];
  });

  it("computes total orders, paid revenue, and orders per division accurately", () => {
    const reports = computeAdminReports(sampleJobs, [
      { id: "div-labels", name: "Labels & stickers" },
      { id: "div-race", name: "Race & event numbers" },
      { id: "div-stamps", name: "Stamps" },
    ]);

    expect(reports.totalOrders).toBe(2);
    expect(reports.paidOrders).toBe(2);
    expect(reports.totalRevenuePence).toBe(9240);
    expect(reports.ordersPerDivision).toEqual([
      { divisionId: "div-labels", divisionName: "Labels & stickers", orderCount: 1, revenuePence: 3240 },
      { divisionId: "div-race", divisionName: "Race & event numbers", orderCount: 1, revenuePence: 6000 },
      { divisionId: "div-stamps", divisionName: "Stamps", orderCount: 0, revenuePence: 0 },
    ]);
  });

  it("filters jobs by search query, status, product, date range, and archive flag", () => {
    expect(filterAdminJobs(sampleJobs, { archive: "active" })).toHaveLength(1);
    expect(filterAdminJobs(sampleJobs, { archive: "archived" })).toHaveLength(1);
    expect(filterAdminJobs(sampleJobs, { archive: "all", q: "bob" })).toHaveLength(1);
    expect(filterAdminJobs(sampleJobs, { archive: "all", status: "proof" })).toHaveLength(1);
    expect(filterAdminJobs(sampleJobs, { archive: "all", product: "race-numbers" })).toHaveLength(1);
    expect(filterAdminJobs(sampleJobs, { archive: "all", from: "2026-11-22" })).toHaveLength(1);
  });

  it("formats Xero-ready CSV export with proper quoting", () => {
    const rows = buildAccountingExportRows(sampleJobs);
    const csv = serializeAccountingCsv(rows);

    expect(csv).toContain("InvoiceNumber,OrderID,OrderDate,PaidDate,CustomerEmail");
    expect(csv).toContain("INV-11111111");
    expect(csv).toContain('"Bob, Runner"');
    expect(csv).toContain("32.40");
  });

  it("enforces admin role on advanceOrderStatusAction and logs order_status_history", async () => {
    const formData = new FormData();
    formData.set("orderId", ORDER_ID);
    formData.set("toStatus", "production");

    // Customer must be rejected on the server.
    mockState.user = { id: "cust-1", email: "alice@example.com", fullName: "Alice", role: "customer" };
    const denied = await advanceOrderStatusAction({}, formData);
    expect(denied.error).toMatch(/administrator/i);
    expect(mockState.historyInserts).toHaveLength(0);

    // Admin advances the job, writes history, and sends email notification.
    mockState.user = { id: "admin-1", email: "admin@yourtest.com", fullName: "Admin", role: "admin" };
    const allowed = await advanceOrderStatusAction({}, formData);
    expect(allowed.error).toBeUndefined();
    expect(mockState.historyInserts).toHaveLength(1);
    expect(mockState.historyInserts[0]).toMatchObject({
      order_id: ORDER_ID,
      from_status: "order",
      to_status: "production",
      changed_by: "admin-1",
    });
    expect(mockState.emailsSent).toHaveLength(1);
  });

  it("blocks advancing a job to production or completed without an approved proof", async () => {
    mockState.user = { id: "admin-1", email: "admin@yourtest.com", fullName: "Admin", role: "admin" };
    mockState.proofApproved = false;

    const toProd = new FormData();
    toProd.set("orderId", ORDER_ID);
    toProd.set("toStatus", "production");
    const blocked = await advanceOrderStatusAction({}, toProd);

    expect(blocked.error).toMatch(/cannot move to production until the customer approves/i);
    expect(mockState.historyInserts).toHaveLength(0);

    // Moving to earlier stages (e.g. proof) is still allowed before approval.
    const toProof = new FormData();
    toProof.set("orderId", ORDER_ID);
    toProof.set("toStatus", "proof");
    const ok = await advanceOrderStatusAction({}, toProof);
    expect(ok.error).toBeUndefined();
    expect(mockState.historyInserts).toHaveLength(1);
  });

  it("returns 401/403 when non-admins call admin API routes directly", async () => {
    const req = new Request("http://localhost:3000/api/admin/export?format=csv");
    expect((await exportOrdersGet(req)).status).toBe(401);
    expect((await downloadFileGet(req, { params: Promise.resolve({ id: FILE_ID }) })).status).toBe(401);

    mockState.user = { id: "cust-1", email: "alice@example.com", fullName: "Alice", role: "customer" };
    expect((await exportOrdersGet(req)).status).toBe(403);
    expect((await downloadFileGet(req, { params: Promise.resolve({ id: FILE_ID }) })).status).toBe(403);
  });
});
