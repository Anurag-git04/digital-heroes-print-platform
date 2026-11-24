import { z } from "zod";

export type AuthState = {
  error?: string;
  message?: string;
};

export const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters for your password."),
});

export const signupSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80),
});

export function safeNextPath(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/account";
}
