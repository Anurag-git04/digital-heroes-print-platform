import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminJobActions } from "@/components/admin/job-actions";
import { loadAdminDashboard } from "@/lib/admin/data";
import { PIPELINE_STATUSES, type AdminJobFilters } from "@/lib/admin/helpers";
import { requireUser } from "@/lib/auth/current-user";
import { formatMoney } from "@/lib/pricing/formatMoney";

export const metadata: Metadata = {
  title: "Production dashboard",
  description: "Internal admin console for jobs, proofs, print-file generation, reports and exports.",
};

type AdminSearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

async function AdminContent({ searchParams }: { searchParams: AdminSearchParams }) {
  const user = await requireUser("admin");
  const rawParams = await searchParams;
  const archiveParam = single(rawParams.archive);
  const filters: AdminJobFilters = {
    q: single(rawParams.q),
    status: single(rawParams.status),
    product: single(rawParams.product),
    from: single(rawParams.from),
    to: single(rawParams.to),
    archive:
      archiveParam === "archived" || archiveParam === "all" ? archiveParam : "active",
  };

  const data = await loadAdminDashboard(filters);
  const maxDivisionOrders = Math.max(
    1,
    ...data.reports.ordersPerDivision.map((d) => d.orderCount),
  );

  return (
    <div className="space-y-12">
      {/* Header + accounting exports */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
            Internal console
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Production dashboard.
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Signed in as <span className="font-medium text-[var(--ink)]">{user.email}</span> (Administrator).
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <a
            href="/api/admin/export?format=csv"
            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold transition hover:border-[var(--ink)]"
          >
            ↓ Export orders CSV (Xero)
          </a>
          <a
            href="/api/admin/export?format=json"
            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold transition hover:border-[var(--ink)]"
          >
            ↓ Export orders JSON
          </a>
        </div>
      </div>

      {/* Reports: 3 core totals */}
      <section aria-labelledby="reports-heading" className="grid gap-4 lg:grid-cols-[repeat(2,minmax(0,0.8fr))_minmax(0,1.4fr)]">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <h2 id="reports-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Total orders
          </h2>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{data.reports.totalOrders}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {data.reports.paidOrders} paid · {data.reports.totalOrders - data.reports.paidOrders} unpaid quotes
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Total revenue (paid)
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">
            {formatMoney(data.reports.totalRevenuePence, "GBP")}
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">VAT-inclusive GBP across paid orders</p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Orders per division
          </p>
          <ul className="mt-4 space-y-2.5 text-xs">
            {data.reports.ordersPerDivision.map((division) => (
              <li key={division.divisionId} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 sm:grid-cols-[140px_1fr_auto]">
                <span className="truncate font-medium">{division.divisionName}</span>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--paper)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${Math.round((division.orderCount / maxDivisionOrders) * 100)}%` }}
                  />
                </div>
                <span className="tabular-nums text-[var(--muted)]">{division.orderCount}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Search & filter bar */}
      <section aria-labelledby="jobs-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              Job database
            </p>
            <h2 id="jobs-heading" className="mt-1 text-2xl font-semibold tracking-tight">
              Production queue ({data.jobs.length})
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Print-file generation and downloads unlock only when the latest proof is approved.
          </p>
        </div>

        <form
          method="get"
          action="/admin"
          className="mb-6 grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2 lg:grid-cols-6"
        >
          <label className="text-xs font-medium text-[var(--muted)] lg:col-span-2">
            Search customer or order
            <input
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Email, name, order ID…"
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="text-xs font-medium text-[var(--muted)]">
            Status
            <select
              name="status"
              defaultValue={filters.status ?? "all"}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm capitalize text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All statuses</option>
              {PIPELINE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-[var(--muted)]">
            Product
            <select
              name="product"
              defaultValue={filters.product ?? "all"}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All products</option>
              {data.products.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-[var(--muted)]">
            Archive view
            <select
              name="archive"
              defaultValue={filters.archive ?? "active"}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            >
              <option value="active">Active jobs</option>
              <option value="archived">Archived jobs</option>
              <option value="all">All jobs</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="w-full rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent)]"
            >
              Filter
            </button>
            <Link
              href="/admin"
              className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
            >
              Reset
            </Link>
          </div>

          <label className="text-xs font-medium text-[var(--muted)]">
            Date from
            <input
              type="date"
              name="from"
              defaultValue={filters.from ?? ""}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="text-xs font-medium text-[var(--muted)]">
            Date to
            <input
              type="date"
              name="to"
              defaultValue={filters.to ?? ""}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </label>
        </form>

        {data.jobs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--muted)]">
            No jobs match the current filters.
          </div>
        ) : (
          <div className="space-y-4">
            {data.jobs.map((job) => (
              <article
                key={job.id}
                className="rounded-2xl border border-[var(--line)] bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{job.reference}</span>
                      <span className="rounded-full bg-[var(--paper)] px-3 py-0.5 text-xs font-semibold capitalize">
                        {job.status}
                      </span>
                      {job.readyForProduction ? (
                        <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-800">
                          Ready for production (v{job.latestProof?.version} approved)
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-900">
                          {job.latestProof
                            ? `Proof v${job.latestProof.version} ${job.latestProof.status.replace("_", " ")} — files locked`
                            : "No approved proof — files locked"}
                        </span>
                      )}
                      {job.archived && (
                        <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-700">
                          Archived
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 text-lg font-semibold">
                      {job.productName}{" "}
                      <span className="text-sm font-normal text-[var(--muted)]">
                        · {job.divisionName}
                      </span>
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{job.configSummary}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Customer:{" "}
                      <span className="font-medium text-[var(--ink)]">
                        {job.customer.fullName ? `${job.customer.fullName} (${job.customer.email})` : job.customer.email}
                      </span>{" "}
                      · Created {formatDate(job.createdAt)}
                    </p>
                    {job.latestProof?.status === "changes_requested" && job.latestProof.note && (
                      <p className="mt-2.5 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-900">
                        <span className="font-semibold">Customer change note (v{job.latestProof.version}):</span>{" "}
                        {job.latestProof.note}
                      </p>
                    )}
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-xl font-semibold">{formatMoney(job.total, job.currency)}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {job.paidAt ? `Paid ${formatDate(job.paidAt)}` : "Unpaid quote"}
                    </p>
                  </div>
                </div>

                <AdminJobActions
                  orderId={job.id}
                  currentStatus={job.status}
                  archived={job.archived}
                  readyForProduction={job.readyForProduction}
                  hasDesign={job.hasDesign}
                  csvMergeEnabled={job.csvMergeEnabled}
                  files={job.files}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Users list */}
      <section aria-labelledby="users-heading">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Accounts
        </p>
        <h2 id="users-heading" className="mt-1 text-2xl font-semibold tracking-tight">
          Registered users ({data.users.length})
        </h2>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                <th className="px-6 py-3.5 font-semibold">Name</th>
                <th className="px-6 py-3.5 font-semibold">Email</th>
                <th className="px-6 py-3.5 font-semibold">Role</th>
                <th className="px-6 py-3.5 font-semibold">Orders</th>
                <th className="px-6 py-3.5 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--muted)]">
                    No registered users yet.
                  </td>
                </tr>
              ) : (
                data.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-3.5 font-medium">{u.fullName || "—"}</td>
                    <td className="px-6 py-3.5 text-[var(--muted)]">{u.email}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          u.role === "admin"
                            ? "bg-[var(--ink)] text-white"
                            : "bg-[var(--paper)] text-[var(--ink)]"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 tabular-nums">{u.orderCount}</td>
                    <td className="px-6 py-3.5 text-[var(--muted)]">{formatDate(u.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AdminPage({ searchParams }: { searchParams: AdminSearchParams }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-14 lg:px-10 lg:py-20">
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="h-16 w-72 animate-pulse rounded-2xl bg-[var(--line)]" />
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="h-40 animate-pulse rounded-2xl bg-[var(--line)]" />
              <div className="h-40 animate-pulse rounded-2xl bg-[var(--line)]" />
              <div className="h-40 animate-pulse rounded-2xl bg-[var(--line)]" />
            </div>
            <div className="h-72 animate-pulse rounded-2xl bg-[var(--line)]" />
          </div>
        }
      >
        <AdminContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
