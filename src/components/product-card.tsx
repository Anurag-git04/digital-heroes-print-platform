import Link from "next/link";
import type { CatalogueProduct, Division } from "@/lib/catalogue/types";

const divisionStyles: Record<string, string> = {
  "labels-stickers": "bg-[#dce9dd] text-[#21452b]",
  "race-event-numbers": "bg-[#f4d7c9] text-[#7d2d16]",
  "mtb-boards": "bg-[#dce2ee] text-[#253653]",
  stamps: "bg-[#eadfce] text-[#59452e]",
  trophies: "bg-[#eee1ba] text-[#665315]",
  "laser-cut-work": "bg-[#dedde7] text-[#3d3656]",
};

export function ProductCard({
  product,
  division,
}: {
  product: CatalogueProduct;
  division: Division;
}) {
  return (
    <Link
      href={`/products/${division.slug}/${product.slug}`}
      className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className={`relative grid h-48 place-items-center overflow-hidden p-8 ${divisionStyles[division.slug] ?? "bg-[var(--line)]"}`}>
        <span className="absolute left-5 top-5 text-xs font-semibold uppercase tracking-[0.2em] opacity-60">
          {division.name}
        </span>
        <div className="grid aspect-square w-32 place-items-center rotate-[-5deg] rounded-lg border border-current/25 bg-white/80 shadow-lg transition duration-300 group-hover:rotate-0 group-hover:scale-105">
          <span className="px-3 text-center text-lg font-bold uppercase leading-tight tracking-tight">
            {product.name}
          </span>
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-semibold tracking-tight">{product.name}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{product.description}</p>
        <span className="mt-5 inline-flex text-sm font-semibold text-[var(--accent)]">
          Configure product <span aria-hidden="true" className="ml-2">→</span>
        </span>
      </div>
    </Link>
  );
}
