"use client";

import { useActionState } from "react";
import { reorderOrderAction, type ReorderState } from "@/lib/account/actions";

type ReorderButtonProps = {
  orderId: string;
  compact?: boolean;
};

export function ReorderButton({ orderId, compact = false }: ReorderButtonProps) {
  const [state, action, pending] = useActionState<ReorderState, FormData>(reorderOrderAction, {});

  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className={
          compact
            ? "rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            : "rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {pending ? "Starting checkout…" : "Reorder in one click"}
      </button>
      {state.error && (
        <span role="alert" className="text-xs text-red-700">
          {state.error}
        </span>
      )}
    </form>
  );
}
