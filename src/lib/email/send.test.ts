import { afterEach, describe, expect, it, vi } from "vitest";
import { sendOrderPaidEmail, sendOrderStatusEmail, sendProofStatusEmail } from "./send";

describe("Phase 9: Resend email fallback", () => {
  const originalKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalKey;
    }
    vi.restoreAllMocks();
  });

  it("logs to console and continues without throwing when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const paid = await sendOrderPaidEmail({
      to: "customer@yourtest.com",
      orderReference: "60A61082",
      totalFormatted: "£32.40",
    });
    const proof = await sendProofStatusEmail({
      to: "customer@yourtest.com",
      orderReference: "60A61082",
      version: 1,
      action: "approved",
    });
    const status = await sendOrderStatusEmail({
      to: "customer@yourtest.com",
      orderReference: "60A61082",
      fromStatus: "production",
      toStatus: "completed",
    });

    expect(paid).toEqual({ delivered: false, fallback: true });
    expect(proof).toEqual({ delivered: false, fallback: true });
    expect(status).toEqual({ delivered: false, fallback: true });
    expect(logSpy).toHaveBeenCalledTimes(3);
  });
});
