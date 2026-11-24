"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import type { OrderStatus } from "@/lib/account/data";
import {
  advanceOrderStatusAction,
  toggleArchiveOrderAction,
  type AdminActionState,
} from "@/lib/admin/actions";
import { PIPELINE_STATUSES, type AdminFileItem } from "@/lib/admin/helpers";

type JobActionsProps = {
  orderId: string;
  currentStatus: OrderStatus;
  archived: boolean;
  readyForProduction: boolean;
  hasDesign: boolean;
  csvMergeEnabled: boolean;
  files: AdminFileItem[];
};

const KIND_LABELS: Record<string, string> = {
  print_pdf: "Print PDF",
  print_png: "300 DPI PNG",
  csv_merge_zip: "CSV Merge ZIP",
};

export function AdminJobActions({
  orderId,
  currentStatus,
  archived,
  readyForProduction,
  hasDesign,
  csvMergeEnabled,
  files,
}: JobActionsProps) {
  const router = useRouter();
  const [statusState, statusAction, statusPending] = useActionState<AdminActionState, FormData>(
    advanceOrderStatusAction,
    {},
  );
  const [archiveState, archiveAction, archivePending] = useActionState<AdminActionState, FormData>(
    toggleArchiveOrderAction,
    {},
  );

  const [generating, setGenerating] = useState(false);
  const [merging, setMerging] = useState(false);
  const [printMessage, setPrintMessage] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  async function handleGeneratePrintFiles() {
    setGenerating(true);
    setPrintError(null);
    setPrintMessage(null);

    try {
      const response = await fetch("/api/print/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        files?: Array<{ kind: string; path: string }>;
      };

      if (!response.ok) {
        setPrintError(payload.error ?? "Print files could not be generated.");
        return;
      }

      setPrintMessage(`Generated ${payload.files?.length ?? 2} print files.`);
      router.refresh();
    } catch {
      setPrintError("Network error while generating print files.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCsvMerge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = csvInputRef.current?.files?.[0];
    if (!file) {
      setPrintError("Choose a CSV file first.");
      return;
    }

    setMerging(true);
    setPrintError(null);
    setPrintMessage(null);

    try {
      const formData = new FormData();
      formData.set("orderId", orderId);
      formData.set("csv", file);

      const response = await fetch("/api/print/generate", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        fileCount?: number;
      };

      if (!response.ok) {
        setPrintError(payload.error ?? "CSV merge failed.");
        return;
      }

      setPrintMessage(`CSV merge complete: ${payload.fileCount ?? 0} PDFs packaged in zip.`);
      if (csvInputRef.current) csvInputRef.current.value = "";
      router.refresh();
    } catch {
      setPrintError("Network error during CSV merge.");
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="mt-5 space-y-4 border-t border-[var(--line)] pt-4">
      {/* Pipeline stage advance bar */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Advance pipeline
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PIPELINE_STATUSES.map((stage) => {
            const isCurrent = stage === currentStatus;
            return (
              <form key={stage} action={statusAction}>
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="toStatus" value={stage} />
                <button
                  type="submit"
                  disabled={statusPending || isCurrent}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                    isCurrent
                      ? "bg-[var(--ink)] text-white"
                      : "border border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                  }`}
                >
                  {stage}
                </button>
              </form>
            );
          })}

          <form action={archiveAction} className="ml-auto">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="archived" value={archived ? "false" : "true"} />
            <button
              type="submit"
              disabled={archivePending}
              className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              {archived ? "Restore" : "Archive"}
            </button>
          </form>
        </div>
        {(statusState.error || archiveState.error) && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {statusState.error ?? archiveState.error}
          </p>
        )}
        {(statusState.message || archiveState.message) && (
          <p role="status" className="mt-2 text-xs text-green-800">
            {statusState.message ?? archiveState.message}
          </p>
        )}
      </div>

      {/* Production print files + CSV merge */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={handleGeneratePrintFiles}
          disabled={generating || !readyForProduction || !hasDesign}
          title={
            !readyForProduction
              ? "Locked until customer approves the latest proof"
              : !hasDesign
                ? "Order has no attached design"
                : "Generate print-ready PDF and 300 DPI PNG"
          }
          className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {generating ? "Generating PDF & PNG…" : "Generate print PDF & PNG"}
        </button>

        {hasDesign && (
          <button
            type="button"
            onClick={() => setShowCsvPanel((prev) => !prev)}
            disabled={!readyForProduction}
            title={
              readyForProduction
                ? "Upload a CSV to generate one PDF per row in a zip"
                : "Locked until customer approves the latest proof"
            }
            className="rounded-full border border-[var(--line)] px-4 py-1.5 text-xs font-semibold transition hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {csvMergeEnabled ? "CSV variable-data merge" : "CSV merge (optional)"}
          </button>
        )}

        {files.map((file) => (
          <a
            key={file.id}
            href={`/api/admin/files/${file.id}?download=1`}
            className="inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-green-50 px-3.5 py-1.5 text-xs font-semibold text-green-900 transition hover:bg-green-100"
          >
            ↓ {KIND_LABELS[file.kind] ?? file.kind}
          </a>
        ))}
      </div>

      {showCsvPanel && readyForProduction && (
        <form
          onSubmit={handleCsvMerge}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-xs"
        >
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            required
            className="max-w-xs text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[var(--ink)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
          />
          <button
            type="submit"
            disabled={merging}
            className="rounded-full bg-[var(--ink)] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {merging ? "Merging CSV…" : "Run CSV merge (max 200 rows)"}
          </button>
        </form>
      )}

      {printError && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {printError}
        </p>
      )}
      {printMessage && (
        <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-800">
          {printMessage}
        </p>
      )}
    </div>
  );
}
