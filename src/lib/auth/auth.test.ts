import { describe, expect, it, vi } from "vitest";
import { credentialsSchema, safeNextPath, signupSchema } from "./validation";
import { requireUser } from "./current-user";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("Phase 1: Auth & Role Validation", () => {
  describe("credentialsSchema", () => {
    it("validates correct email and password", () => {
      const result = credentialsSchema.safeParse({
        email: "customer@yourtest.com",
        password: "securePassword123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = credentialsSchema.safeParse({
        email: "not-an-email",
        password: "securePassword123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Enter a valid email address.");
      }
    });

    it("rejects passwords shorter than 8 characters", () => {
      const result = credentialsSchema.safeParse({
        email: "customer@yourtest.com",
        password: "short",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Use at least 8 characters for your password.",
        );
      }
    });
  });

  describe("signupSchema", () => {
    it("validates full name, email, and password", () => {
      const result = signupSchema.safeParse({
        fullName: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects short or empty full name", () => {
      const result = signupSchema.safeParse({
        fullName: "J",
        email: "jane@example.com",
        password: "password123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Enter your full name.");
      }
    });
  });

  describe("safeNextPath", () => {
    it("defaults to /account for null or non-string values", () => {
      expect(safeNextPath(null)).toBe("/account");
    });

    it("allows valid relative paths", () => {
      expect(safeNextPath("/admin")).toBe("/admin");
      expect(safeNextPath("/account/orders")).toBe("/account/orders");
    });

    it("prevents open redirects via protocol-relative or external URLs", () => {
      expect(safeNextPath("//malicious.com")).toBe("/account");
      expect(safeNextPath("https://malicious.com")).toBe("/account");
      expect(safeNextPath("javascript:alert(1)")).toBe("/account");
    });
  });

  describe("requireUser role gate", () => {
    it("redirects unauthenticated users to /login", async () => {
      const { hasSupabaseConfig } = await import("@/lib/supabase/config");
      vi.mocked(hasSupabaseConfig).mockReturnValue(false);

      await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    });
  });
});
