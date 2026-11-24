import { loadAdminDashboard } from "@/lib/admin/data";
import { buildAccountingExportRows, serializeAccountingCsv } from "@/lib/admin/helpers";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Admin-only accounting export (Xero-ready CSV or JSON).
 * Returns 401 when logged out, 403 for customers.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return Response.json({ error: "Only administrators can export orders." }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "json") {
    return Response.json({ error: "Format must be csv or json." }, { status: 400 });
  }

  const { allJobs } = await loadAdminDashboard({ archive: "all" });
  const rows = buildAccountingExportRows(allJobs);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, orders: rows }, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="digital-heroes-orders-${stamp}.json"`,
      },
    });
  }

  const csv = serializeAccountingCsv(rows);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="digital-heroes-orders-${stamp}.csv"`,
    },
  });
}
