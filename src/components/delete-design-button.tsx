"use client";

import { useActionState, useState } from "react";
import { deleteDesignAction, type DeleteDesignState } from "@/lib/account/actions";

export function DeleteDesignButton({ designId }: { designId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<DeleteDesignState, FormData>(
    deleteDesignAction,
    {},
  );

  return (
    <div className="flex flex-col items-end gap-1.5">
      {confirming ? (
        <div className="flex items-center gap-2">
          <form action={action}>
            <input type="hidden" name="designId" value={designId} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Confirm delete"}
            </button>
          </form>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs font-medium text-red-700 transition hover:underline"
        >
          Delete
        </button>
      )}

      {state.error && (
        <p role="alert" className="text-right text-xs text-red-700">
          {state.error}
        </p>
      )}
    </div>
  );
}
