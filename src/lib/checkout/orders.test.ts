import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  orderPaidAt: null as string | null,
  statusUpdates: 0,
  historyInserts: 0,
  emailsSent: 0,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/email/send", () => ({
  sendOrderPaidEmail: async () => {
    state.emailsSent += 1;
    return { delivered: false, fallback: true };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "11111111-1111-4111-8111-111111111111",
                  user_id: "user-1",
                  status: state.orderPaidAt ? "order" : "quote",
                  currency: "gbp",
                  total: 3240,
                  paid_at: state.orderPaidAt,
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              is: () => ({
                select: () => ({
                  maybeSingle: async () => {
                    if (state.orderPaidAt) {
                      return { data: null, error: null };
                    }
                    state.orderPaidAt = "2026-11-24T12:00:00Z";
                    state.statusUpdates += 1;
                    return { data: { id: "11111111-1111-4111-8111-111111111111" }, error: null };
                  },
                }),
              }),
            }),
          }),
        };
      }
      if (table === "order_status_history") {
        return {
          insert: async () => {
            state.historyInserts += 1;
            return { error: null };
          },
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { email: "cust@example.com" }, error: null }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

import { markOrderPaid } from "./orders";

describe("Stripe webhook replay idempotency (markOrderPaid)", () => {
  beforeEach(() => {
    state.orderPaidAt = null;
    state.statusUpdates = 0;
    state.historyInserts = 0;
    state.emailsSent = 0;
  });

  it("marks paid once and ignores replayed checkout.session.completed webhooks", async () => {
    const session = {
      id: "cs_test_replay_123",
      payment_status: "paid",
      amount_total: 3240,
      currency: "gbp",
      customer_email: "cust@example.com",
      metadata: { orderId: "11111111-1111-4111-8111-111111111111" },
    } as unknown as Stripe.Checkout.Session;

    // First delivery
    const first = await markOrderPaid(session);
    expect(first.paid).toBe(true);
    expect(state.statusUpdates).toBe(1);
    expect(state.historyInserts).toBe(1);
    expect(state.emailsSent).toBe(1);

    // Replayed webhook delivery -> idempotent, zero duplicate updates/history/emails!
    const second = await markOrderPaid(session);
    expect(second.paid).toBe(true);
    expect(state.statusUpdates).toBe(1);
    expect(state.historyInserts).toBe(1);
    expect(state.emailsSent).toBe(1);
  });
});
