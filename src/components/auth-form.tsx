"use client";

import { useActionState } from "react";
import type { AuthState } from "@/lib/auth/actions";

type AuthFormProps = {
  mode: "login" | "signup";
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  nextPath?: string;
};

export function AuthForm({ mode, action, nextPath }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {nextPath && <input type="hidden" name="next" value={nextPath} />}
      {isSignup && (
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Full name</span>
          <input
            name="fullName"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
          />
        </label>
      )}
      <label className="block">
        <span className="mb-2 block text-sm font-medium">Email address</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={8}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Please wait…" : isSignup ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
