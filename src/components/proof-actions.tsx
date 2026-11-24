"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  approveProofAction,
  generateProofAction,
  requestChangesAction,
  type ProofActionState,
} from "@/lib/proofs/actions";
import type { ProofStage } from "@/lib/proofs/gate";

type ProofActionsProps = {
  orderId: string;
  stage: ProofStage;
  editHref: string | null;
  /** True once the design has been saved after the latest proof (revision can be submitted). */
  revisionReady?: boolean;
  nextVersion?: number;
};

const primaryButton =
  "rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "rounded-full border border-[var(--line)] px-6 py-3 text-sm font-semibold transition hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60";

function Feedback({ state }: { state: ProofActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {state.error}
      </p>
    );
  }

  if (state.message) {
    return (
      <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
        {state.message}
      </p>
    );
  }

  return null;
}

function GenerateForm({ orderId, label, disabled = false }: { orderId: string; label: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<ProofActionState, FormData>(generateProofAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" disabled={pending || disabled} className={primaryButton}>
        {pending ? "Preparing proof…" : label}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function ReviewForms({ orderId }: { orderId: string }) {
  const [approveState, approve, approving] = useActionState<ProofActionState, FormData>(approveProofAction, {});
  const [changeState, requestChanges, requesting] = useActionState<ProofActionState, FormData>(
    requestChangesAction,
    {},
  );
  const busy = approving || requesting;

  return (
    <div className="space-y-8">
      <form action={approve} className="space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <button type="submit" disabled={busy} className={primaryButton}>
          {approving ? "Approving…" : "Approve this proof"}
        </button>
        <p className="text-xs text-[var(--muted)]">
          Approving confirms the artwork, spelling and layout. Production uses exactly what you see here.
        </p>
        <Feedback state={approveState} />
      </form>

      <form action={requestChanges} className="space-y-3 border-t border-[var(--line)] pt-6">
        <input type="hidden" name="orderId" value={orderId} />
        <label className="block text-sm font-semibold" htmlFor="change-note">
          Need something different?
        </label>
        <textarea
          id="change-note"
          name="note"
          rows={4}
          required
          minLength={3}
          maxLength={1000}
          placeholder="Describe what should change"
          className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
        />
        <button type="submit" disabled={busy} className={secondaryButton}>
          {requesting ? "Sending…" : "Request changes"}
        </button>
        <Feedback state={changeState} />
      </form>
    </div>
  );
}

export function ProofActions({ orderId, stage, editHref, revisionReady = false, nextVersion }: ProofActionsProps) {
  if (stage === "create_first") {
    return <GenerateForm orderId={orderId} label="Generate my proof" />;
  }

  if (stage === "awaiting_customer") {
    return <ReviewForms orderId={orderId} />;
  }

  if (stage === "needs_revision") {
    const versionLabel = nextVersion ? `v${nextVersion}` : "the new version";
    return (
      <div className="space-y-5">
        {revisionReady ? (
          <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm leading-6 text-green-800">
            <span className="font-semibold">Design saved.</span> Submit the revision to create proof {versionLabel}.
            The preview on the left updates once the new version is generated.
          </p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-[var(--muted)]">
            <li>
              <span className="font-semibold text-[var(--ink)]">Edit my design</span> and click{" "}
              <span className="font-semibold text-[var(--ink)]">Save design</span>.
            </li>
            <li>
              Come back here and <span className="font-semibold text-[var(--ink)]">Submit revision</span> to create
              proof {versionLabel}.
            </li>
          </ol>
        )}
        {editHref && (
          <Link href={editHref} className={`${secondaryButton} inline-block`}>
            {revisionReady ? "Edit again" : "Edit my design"}
          </Link>
        )}
        <GenerateForm orderId={orderId} label="Submit revision" disabled={!revisionReady} />
        {!revisionReady && (
          <p className="text-xs text-[var(--muted)]">Submit revision unlocks after you save your edited design.</p>
        )}
      </div>
    );
  }

  return (
    <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
      This proof is approved. Your order is cleared for production.
    </p>
  );
}
