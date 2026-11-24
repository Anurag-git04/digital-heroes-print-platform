import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";

function BrandMark() {
  return (
    <span className="relative grid size-9 place-items-center rounded-xl bg-[#1f4d36] text-sm font-bold tracking-tight text-[#f5f3ee] ring-1 ring-inset ring-[#dce9dd]/30 transition group-hover:bg-[#173b29]">
      DH
      <span
        aria-hidden="true"
        className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--accent)]"
      />
    </span>
  );
}

export function SiteHeaderFallback() {
  return (
    <header className="border-b border-[var(--line)] print:hidden">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-5 lg:px-10">
        <span className="flex items-center gap-3">
          <BrandMark />
          <span className="text-sm font-semibold uppercase tracking-[0.16em]">Digital Heroes</span>
        </span>
        <span className="h-9 w-20 animate-pulse rounded-full bg-[var(--line)]" />
      </div>
    </header>
  );
}

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-[var(--line)] print:hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-10">
        <Link href="/" className="group flex items-center gap-3">
          <BrandMark />
          <span className="text-sm font-semibold uppercase tracking-[0.16em]">
            Digital Heroes
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-5 text-sm" aria-label="Main navigation">
          <Link href="/products" className="transition hover:text-[var(--accent)]">
            Products
          </Link>
          <Link href="/gallery" className="transition hover:text-[var(--accent)]">
            Gallery
          </Link>
          {user?.role === "admin" && (
            <Link href="/admin" className="transition hover:text-[var(--accent)]">
              Admin
            </Link>
          )}
          {user ? (
            <>
              <Link
                href="/account"
                className="rounded-full border border-[var(--line)] px-4 py-2 font-medium transition hover:border-[var(--ink)]"
              >
                Account
              </Link>
              <form action={signOut}>
                <button type="submit" className="text-sm text-[var(--muted)] transition hover:text-[var(--ink)]">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[var(--ink)] px-4 py-2 font-medium text-white transition hover:bg-[var(--accent)]"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
