# Digital Heroes — Web-to-Print Platform (PRD Level 2)

A custom, transactional web-to-print storefront and production console built for a six-division print house: **Labels & stickers**, **Race & event numbers**, **MTB boards**, **Stamps**, **Trophies**, and **Laser-cut work**.

Customers configure parameter-driven products with live integer-pence pricing, design artwork inside print-safe boundaries in the browser, pay via Stripe Checkout, review and approve versioned digital proofs, download VAT receipts, and reorder in one click. Staff manage every job through a six-stage pipeline with server-side PDF/PNG print-file generation, CSV variable-data merge, reports, and accounting exports.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend & Routing | Next.js 16 (App Router, Turbopack, Cache Components), React 19, TypeScript, Tailwind CSS v4 |
| Auth & Database | Supabase Auth (Email/Password), PostgreSQL with Row Level Security (RLS), Private Storage Buckets |
| Web-to-Print Designer | Fabric.js v7 (client-only dynamic import, canonical millimetre coordinates) |
| Payments | Stripe Checkout (Test Mode, server-recomputed `price_data`, signed webhook + success fallback) |
| Print-File Engine | `pdf-lib` + `@pdf-lib/fontkit` (bundled Inter TTF fonts), `sharp` (300 DPI PNG), `papaparse`, `jszip` |
| Email Notifications | Resend SDK with automatic `console.log` fallback when `RESEND_API_KEY` is omitted |
| Validation & Testing | Zod v4, Vitest (12 test suites, 61 unit tests), ESLint |

---

## Architecture & Database Schema

All schema, security, storage, and catalogue seed files live in [`supabase/`](./supabase/):

1. [`supabase/schema.sql`](./supabase/schema.sql) — 11 tables, indexes, `handle_new_user()` signup trigger, and `is_admin()` helper.
2. [`supabase/rls.sql`](./supabase/rls.sql) — Row Level Security enabled on every table.
3. [`supabase/storage.sql`](./supabase/storage.sql) — 3 private storage buckets (`artwork`, `proofs`, `print-files`).
4. [`supabase/seed.sql`](./supabase/seed.sql) — 6 divisions, 8 parameter-driven products (JSONB `config`), and 8 print templates.

### Tables & Relationships

| Table | Purpose | RLS Access Rule |
|---|---|---|
| `profiles` | User accounts linked to `auth.users` (`role`: `customer` \| `admin`) | Owner or admin read; customer update locked to `role = 'customer'` (cannot self-promote) |
| `divisions` | The 6 print divisions (`sort`, `slug`, `name`) | Public read; admin manage |
| `products` | Parameter-driven products with JSONB `config` (sizes, materials, tiers, VAT) | Public read (`active = true`); admin manage |
| `templates` | Print area (`{x,y,w,h}` mm), bleed (mm), DPI (300), variable placeholders | Public read; admin manage |
| `designs` | Customer saved designs (canonical mm `design_json` + config snapshot) | Owner read/write/delete; admin read |
| `orders` | Customer orders (`quote` → `order` → `artwork` → `proof` → `production` → `completed`) | Owner or admin select; writes via server `service_role` only |
| `order_items` | Line items with full config snapshot, `design_id`, `quantity`, integer pence totals | Owner (via parent order) or admin select; server writes only |
| `proofs` | Versioned proofs (`v1`, `v2`, …) with `unique (order_id, version)` | Owner (via parent order) or admin select; server writes only |
| `proof_approvals` | Immutable audit log of who approved or requested changes, version, timestamp | Owner (via parent order) or admin select; server writes only |
| `order_status_history` | Every pipeline transition (`from_status`, `to_status`, `changed_by`, timestamp) | Owner (via parent order) or admin select; server writes only |
| `files` | Generated production PDFs, 300 DPI PNGs, and CSV merge zips | **Admin only** (`public.is_admin()`) — customers have zero access |

### Private Storage Buckets
- `artwork` (private, 4 MB cap): customer uploads stored under `{user_id}/{uuid}-{name}.{ext}`
- `proofs` (private, 10 MB cap): rendered proof previews stored under `{order_id}/v{n}.png`
- `print-files` (private, 50 MB cap): production outputs stored under `{order_id}/{OrderID}_{ProductType}_{Date}_{Output}.{ext}`

---

## Documented Assumptions & Architectural Decisions

Where the PRD left implementation details open, the following consistent decisions were made and enforced across database, server, and UI:

| Topic | Decision |
|---|---|
| **VAT rate** | Single configurable rate stored per product (`0.20` = 20%). Storefront shows VAT-inclusive totals; checkout and receipts show full ex-VAT subtotal, VAT, and total breakdown in integer pence. |
| **Currency** | Single currency (`GBP`) in config to ensure clean Stripe Checkout test-mode compatibility. |
| **Quote stage** | No separate quote request form. Creating a checkout inserts an order row with `status = 'quote'`; confirmed Stripe payment advances it to `order` and logs `order_status_history`. |
| **Pipeline statuses** | Fixed 6-stage pipeline: `quote → order → artwork → proof → production → completed`. Every transition is written to `order_status_history`. Jobs cannot advance to `production` or `completed` until the latest proof is approved (`canGeneratePrintFiles`). |
| **Bleed & DPI** | Labels and Race numbers: **3 mm bleed / 300 DPI**. All other divisions: **2 mm bleed / 300 DPI**. Stored on each `templates` row and enforced in PDF (`TrimBox`/`BleedBox` + crop marks) and PNG (`density: 300`). |
| **Volume discount tiers** | Automatic per-unit tiers at `100` (10% off), `500` (20% off), and `1000` (30% off) — not applied at `99`, `499`, or `999`. Recomputed strictly on the server at checkout and reorder. |
| **Saved designs summary** | PRD's *"Score / configuration of saved designs"* is implemented as a structured configuration summary (size in mm, material, quantity, template) on every saved design card in `/account`, with owner-only RLS deletion for draft designs (designs attached to paid orders are protected). |
| **AI / PDF artwork uploads** | Uploads accept PNG, SVG, PDF, and AI up to 4 MB with magic-byte validation. SVG is converted to PNG via `sharp` for canvas preview; AI and PDF cannot be rendered natively in-browser, so they display a labelled placeholder card and are preserved for production. |
| **Customer vs. Admin files** | Customers can view/approve proofs and print VAT receipts. Production files (`public.files` and `print-files` bucket) are admin-only and locked behind `canGeneratePrintFiles(orderId)`. |
| **Order-based file naming** | `{OrderID}/{OrderID}_{ProductType}_{Date}_{Output}.{ext}` (e.g. `60A61082_race-numbers_20261124_row-001-027.pdf`). |
| **Accounting / Xero export** | No live Xero OAuth API. Admin can export all orders as Xero-ready CSV or JSON via `/api/admin/export?format=csv\|json`. |
| **Subscriptions** | None — strictly transactional per-order Stripe Checkout. |
| **Next.js 16 Proxy convention** | Next.js 16 deprecated `middleware.ts` in favour of `src/proxy.ts`. Route protection for `/account` and `/admin` lives in [`src/proxy.ts`](./src/proxy.ts) plus server-component `requireUser()` defense-in-depth. |

---

## Environment Variables

Copy [`.env.example`](./.env.example) to `.env.local` and fill in your values (never commit `.env.local`):

| Variable | Source | Safe in Browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **NO — server-only** (`import "server-only"`) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (Test mode) | **NO — server-only** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys (Test mode) | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI locally (`whsec_...`) / Stripe Dashboard webhook on Vercel | **NO — server-only** |
| `RESEND_API_KEY` | Optional — Resend API Keys (falls back to `console.log` if empty) | **NO — server-only** |
| `RESEND_FROM_EMAIL` | Optional — Verified Resend sender (defaults to `Digital Heroes <onboarding@resend.dev>`) | **NO — server-only** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; your Vercel URL in production | Yes |

---

## Local Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Provision Supabase:**
   - Create a new Supabase project and run the SQL files in order in the SQL Editor:
     1. `supabase/schema.sql`
     2. `supabase/rls.sql`
     3. `supabase/storage.sql`
     4. `supabase/seed.sql`
   - Under **Authentication → Providers → Email**, enable Email and disable **Confirm email** for testing.
   - Under **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000` and add `http://localhost:3000/**` to **Redirect URLs**.
3. **Configure environment:**
   - Copy `.env.example` to `.env.local` and populate your Supabase and Stripe Test Mode keys.
4. **Run the app & local Stripe webhook listener:**
   ```bash
   npm run dev
   ```
   In a second terminal (optional locally, since `/checkout/success` also verifies sessions as a fallback):
   ```bash
   stripe listen --events checkout.session.completed --forward-to localhost:3000/api/stripe/webhook
   ```
5. **Create test accounts & promote admin:**
   - Sign up `customer@yourtest.com` and `admin@yourtest.com` at `/signup`.
   - Promote the admin in Supabase SQL Editor:
     ```sql
     update public.profiles set role = 'admin' where email = 'admin@yourtest.com';
     ```
6. **Verify tests & production build:**
   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

---

## Test Credentials & Demo Data Note

> **Before submitting:** replace the password placeholders below with the actual passwords of your test accounts (and include them in your submission email).

| Role | Email | Password |
|---|---|---|
| **Customer** | `customer@yourtest.com` | *(add test password before submitting)* |
| **Customer 2 (isolation check)** | `customer2@yourtest.com` | *(add test password before submitting)* |
| **Administrator** | `admin@yourtest.com` | *(add test password before submitting)* |

**Demo data note:** Sample paid orders, saved designs, and approved/pending proofs exist under `customer@yourtest.com` so reviewers can immediately inspect `/account` (all 6 modules, printable receipts, one-click reorder) and `/admin` (filters, ready-for-production indicators, print-file downloads, CSV merge, reports, and Xero exports).

---

## PRD Feature Coverage (Sections 01–16)

| PRD Section | Implementation |
|---|---|
| **03. User Roles** | Public storefront, authenticated Customer (`/account`), and role-gated Admin (`/admin` + server/API 403 checks + PostgreSQL RLS). |
| **04. Catalogue & Configuration** | 6 divisions, 8 parameter-driven products in JSONB `config` (no one-SKU-per-size), dynamic sizing & Zod validation. |
| **05. Pricing & Checkout** | Pure integer-pence `calculatePrice` shared by browser & server, automatic tiers at 100/500/1000, Stripe Checkout, idempotent signed webhook + success fallback, Xero-ready CSV/JSON export. |
| **06. Web-to-Print Designer** | Fabric.js client-only canvas in millimetres, print-area clamping on move/scale/rotate, shrink-to-fit template placeholders, private PNG/SVG/PDF/AI upload (4 MB cap), save & exact reload. |
| **07. Print-File & Variable-Data Engine** | Node.js route (`maxDuration = 60`), `pdf-lib` + embedded Inter TTF fonts + bleed/`TrimBox`/crop marks, 300 DPI PNG via `sharp`, font-metric shrink-to-fit + horizontal tracking, CSV merge zip (`papaparse` + `jszip`, 200-row cap), `OrderID_ProductType_Date_Output.ext` naming. |
| **08. Proof & Version Control** | Versioned proofs (`v1`, `v2`, …), customer Approve / Request changes with note, `proof_approvals` audit log, `canGeneratePrintFiles(orderId)` approval gate locking print routes (`403`) and production stage advancement. |
| **09–10. Customer Dashboard & Reorder** | All 6 modules on `/account`, printable VAT receipt `/account/orders/[id]/receipt`, one-click reorder cloning design + recomputing server price directly into Stripe Checkout, strict cross-user RLS isolation. |
| **11. Production Dashboard** | `/admin` searchable/filterable job queue, archive toggle, ready-for-production badge, pipeline advance with `order_status_history` + email, signed print-file downloads, CSV merge UI, 3 report totals, users list, accounting CSV/JSON export. |
| **12–13. UI/UX & Technical** | Mobile-first responsive layout (360–1280 px), WCAG AA contrast, `Space Grotesk` + `Inter` typography, subtle `prefers-reduced-motion`-safe animations, division-grouped gallery, `error.tsx` / `not-found.tsx` / `loading.tsx`, Resend email with `console.log` fallback. |

---

## Intentional Scope Decisions (What Was Simplified & Why)

- **Printable HTML VAT receipt instead of server-generated invoice PDF:** `/account/orders/[id]/receipt` uses dedicated `@media print` styling (`print:hidden` navigation) so customers can print or Save as PDF directly from any browser without extra serverless memory overhead.
- **Reports focused on the three core totals:** Total orders (paid vs unpaid), total paid revenue (GBP), and orders per division across all 6 divisions, directly matching database aggregates.
- **Static gallery assets in `/public/gallery`:** Vector SVG mockups organised by all 6 divisions load instantaneously with zero storage egress.
- **Xero-ready CSV & JSON export instead of live Xero OAuth API:** Keeps submission self-contained with zero third-party OAuth sandbox dependency while exporting accounting-structured rows.
- **Resend email fallback:** Sends live emails when `RESEND_API_KEY` is provided and logs structured messages to the server console otherwise so transactional flows never fail on missing SMTP credentials.

---

## Deploying to Vercel

1. Push this repository to a **new private GitHub repository** (confirm `.env.local` is ignored by `git status`).
2. Import the repository into a **new Vercel account**.
3. In **Vercel → Settings → Environment Variables**, add every variable from `.env.example` for **Production** (set `NEXT_PUBLIC_SITE_URL` to your `https://<your-app>.vercel.app` URL).
4. Deploy once, then:
   - **Supabase → Authentication → URL Configuration:** Set **Site URL** to `https://<your-app>.vercel.app` and add `https://<your-app>.vercel.app/**` to **Redirect URLs** (keep `http://localhost:3000/**` too).
   - **Stripe → Developers → Webhooks:** Add endpoint `https://<your-app>.vercel.app/api/stripe/webhook`, subscribe to `checkout.session.completed`, copy its signing secret (`whsec_...`) into Vercel as `STRIPE_WEBHOOK_SECRET`, and redeploy.
5. Run the **Appendix D / PRD Section 16** checklist on the live Vercel URL from a fresh browser on both desktop and phone.
