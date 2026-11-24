import type { OrderStatus } from "@/lib/account/data";
import type { ProofStatus } from "@/lib/proofs/gate";

export const PIPELINE_STATUSES: readonly OrderStatus[] = [
  "quote",
  "order",
  "artwork",
  "proof",
  "production",
  "completed",
];

export type AdminFileItem = {
  id: string;
  kind: string;
  path: string;
  createdAt: string;
};

export type AdminJob = {
  id: string;
  reference: string;
  invoiceNumber: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  vat: number;
  total: number;
  paidAt: string | null;
  archived: boolean;
  createdAt: string;
  customer: {
    id: string;
    email: string;
    fullName: string | null;
  };
  productId: string | null;
  productSlug: string | null;
  productName: string;
  divisionId: string | null;
  divisionName: string;
  csvMergeEnabled: boolean;
  hasDesign: boolean;
  quantity: number;
  configSummary: string;
  latestProof: {
    version: number;
    status: ProofStatus;
    note?: string | null;
  } | null;
  readyForProduction: boolean;
  files: AdminFileItem[];
};

export type AdminJobFilters = {
  q?: string;
  status?: string;
  product?: string;
  from?: string;
  to?: string;
  archive?: "active" | "archived" | "all";
};

export type DivisionReport = {
  divisionId: string;
  divisionName: string;
  orderCount: number;
  revenuePence: number;
};

export type AdminReports = {
  totalOrders: number;
  paidOrders: number;
  totalRevenuePence: number;
  ordersPerDivision: DivisionReport[];
};

export function filterAdminJobs(jobs: readonly AdminJob[], filters: AdminJobFilters): AdminJob[] {
  const query = (filters.q ?? "").trim().toLowerCase();
  const status = (filters.status ?? "").trim().toLowerCase();
  const product = (filters.product ?? "").trim().toLowerCase();
  const archive = filters.archive ?? "active";
  const fromDate = filters.from ? new Date(`${filters.from}T00:00:00.000Z`).getTime() : null;
  const toDate = filters.to ? new Date(`${filters.to}T23:59:59.999Z`).getTime() : null;

  return jobs.filter((job) => {
    if (archive === "active" && job.archived) return false;
    if (archive === "archived" && !job.archived) return false;
    if (status && status !== "all" && job.status !== status) return false;
    if (product && product !== "all" && job.productSlug !== product) return false;

    if (query) {
      const haystack = [
        job.id,
        job.reference,
        job.invoiceNumber,
        job.customer.email,
        job.customer.fullName ?? "",
        job.productName,
        job.divisionName,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    const createdMs = new Date(job.createdAt).getTime();
    if (fromDate !== null && !Number.isNaN(fromDate) && createdMs < fromDate) return false;
    if (toDate !== null && !Number.isNaN(toDate) && createdMs > toDate) return false;

    return true;
  });
}

/**
 * Computes the three core report totals matching the database:
 * - Total orders
 * - Total revenue (sum of paid order totals in pence; falls back cleanly to 0 if none paid)
 * - Orders per division across every division in the catalogue
 */
export function computeAdminReports(
  jobs: readonly AdminJob[],
  divisions: readonly { id: string; name: string }[],
): AdminReports {
  const byDivision = new Map<string, DivisionReport>();
  for (const division of divisions) {
    byDivision.set(division.id, {
      divisionId: division.id,
      divisionName: division.name,
      orderCount: 0,
      revenuePence: 0,
    });
  }

  let paidOrders = 0;
  let totalRevenuePence = 0;

  for (const job of jobs) {
    const isPaid = Boolean(job.paidAt);
    if (isPaid) {
      paidOrders += 1;
      totalRevenuePence += job.total;
    }

    if (job.divisionId && byDivision.has(job.divisionId)) {
      const entry = byDivision.get(job.divisionId)!;
      entry.orderCount += 1;
      if (isPaid) {
        entry.revenuePence += job.total;
      }
    }
  }

  return {
    totalOrders: jobs.length,
    paidOrders,
    totalRevenuePence,
    ordersPerDivision: [...byDivision.values()],
  };
}

export type AccountingExportRow = {
  InvoiceNumber: string;
  OrderID: string;
  OrderDate: string;
  PaidDate: string;
  CustomerEmail: string;
  CustomerName: string;
  Status: string;
  Product: string;
  Division: string;
  Quantity: number;
  Currency: string;
  SubtotalGBP: string;
  VatGBP: string;
  TotalGBP: string;
  TaxRate: string;
  Archived: boolean;
};

function penceToDecimal(pence: number): string {
  return (pence / 100).toFixed(2);
}

/** Xero-ready accounting export shape for CSV and JSON downloads. */
export function buildAccountingExportRows(jobs: readonly AdminJob[]): AccountingExportRow[] {
  return jobs.map((job) => ({
    InvoiceNumber: job.invoiceNumber,
    OrderID: job.id,
    OrderDate: job.createdAt.slice(0, 10),
    PaidDate: job.paidAt ? job.paidAt.slice(0, 10) : "",
    CustomerEmail: job.customer.email,
    CustomerName: job.customer.fullName ?? "",
    Status: job.status,
    Product: job.productName,
    Division: job.divisionName,
    Quantity: job.quantity,
    Currency: job.currency,
    SubtotalGBP: penceToDecimal(job.subtotal),
    VatGBP: penceToDecimal(job.vat),
    TotalGBP: penceToDecimal(job.total),
    TaxRate: "20% (VAT on Income)",
    Archived: job.archived,
  }));
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeAccountingCsv(rows: readonly AccountingExportRow[]): string {
  const headers: (keyof AccountingExportRow)[] = [
    "InvoiceNumber",
    "OrderID",
    "OrderDate",
    "PaidDate",
    "CustomerEmail",
    "CustomerName",
    "Status",
    "Product",
    "Division",
    "Quantity",
    "Currency",
    "SubtotalGBP",
    "VatGBP",
    "TotalGBP",
    "TaxRate",
    "Archived",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(",")),
  ];
  return lines.join("\r\n");
}
