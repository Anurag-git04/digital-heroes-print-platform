import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Print examples organised by division across labels, race numbers, MTB boards, stamps, trophies and laser-cut work.",
};

type GalleryDivision = {
  slug: string;
  name: string;
  number: string;
  summary: string;
  items: Array<{
    src: string;
    title: string;
    specs: string;
    description: string;
  }>;
};

const galleryByDivision: GalleryDivision[] = [
  {
    slug: "labels-stickers",
    name: "Labels & stickers",
    number: "01",
    summary: "Custom-cut vinyl and paper labels printed at 300 DPI with 3 mm bleed.",
    items: [
      {
        src: "/gallery/labels.svg",
        title: "Small-batch custom labels",
        specs: "50 × 50 mm · Gloss vinyl · 3 mm bleed",
        description: "Custom shapes, matte paper and gloss vinyl finishes with a clean cut line.",
      },
    ],
  },
  {
    slug: "race-event-numbers",
    name: "Race & event numbers",
    number: "02",
    summary: "High-contrast bib numbers and course boards powered by CSV variable-data merge.",
    items: [
      {
        src: "/gallery/race.svg",
        title: "Race bib 027",
        specs: "120 × 80 mm · Sturdy bib paper · CSV merge",
        description: "Per-row variable numbering and shrink-to-fit athlete names generated server-side.",
      },
    ],
  },
  {
    slug: "mtb-boards",
    name: "MTB boards",
    number: "03",
    summary: "Trail-ready number plates built in 4 mm polyboard and aluminium composite.",
    items: [
      {
        src: "/gallery/mtb.svg",
        title: "Trail number board",
        specs: "200 × 150 mm · 4 mm polyboard · 2 mm bleed",
        description: "Weather-resistant boards with bold rider numbering built for fast, muddy stages.",
      },
    ],
  },
  {
    slug: "stamps",
    name: "Stamps",
    number: "04",
    summary: "Crisp rubber impressions on timber mounts or self-inking bodies.",
    items: [
      {
        src: "/gallery/stamps.svg",
        title: "Approval stamp",
        specs: "60 × 30 mm · Timber mount · 300 DPI",
        description: "Clean custom typography and marks for packaging, paperwork and studio dispatch.",
      },
    ],
  },
  {
    slug: "trophies",
    name: "Trophies",
    number: "05",
    summary: "Engraved brass, silver and black anodised award plates.",
    items: [
      {
        src: "/gallery/trophies.svg",
        title: "Participation plate",
        specs: "80 × 40 mm · Brass effect · Engraved",
        description: "Personalised metal award plates with recipient details and event dates.",
      },
    ],
  },
  {
    slug: "laser-cut-work",
    name: "Laser-cut work",
    number: "06",
    summary: "Precision-cut acrylic, birch ply and card panels from a single production file.",
    items: [
      {
        src: "/gallery/laser.svg",
        title: "Precision-cut panel",
        specs: "200 × 150 mm · 3 mm acrylic · 2 mm bleed",
        description: "Printed, engraved and cut in one consistent workflow for signage and studio runs.",
      },
    ],
  },
];

export default function GalleryPage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-14 lg:px-10 lg:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
        Live work
      </p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
        Made properly. Seen up close.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
        Real finishes, formats and production details organised by each of our six print divisions.
      </p>

      {/* Quick division jump navigation */}
      <nav aria-label="Gallery divisions" className="mt-8 flex flex-wrap gap-2">
        {galleryByDivision.map((division) => (
          <a
            key={division.slug}
            href={`#${division.slug}`}
            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {division.number} · {division.name}
          </a>
        ))}
      </nav>

      {/* Grouped by division */}
      <div className="mt-14 space-y-16">
        {galleryByDivision.map((division, divisionIndex) => (
          <section
            key={division.slug}
            id={division.slug}
            aria-labelledby={`gallery-${division.slug}`}
            className="scroll-mt-8 border-t border-[var(--line)] pt-8"
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">
                  Division {division.number}
                </p>
                <h2
                  id={`gallery-${division.slug}`}
                  className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl"
                >
                  {division.name}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  {division.summary}
                </p>
              </div>
              <Link
                href={`/products/${division.slug}`}
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-dark)]"
              >
                Configure {division.name.toLowerCase()} →
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {division.items.map((item) => (
                <article
                  key={item.src}
                  className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white"
                >
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={item.src}
                      alt={`${item.title} — ${division.name}`}
                      fill
                      priority={divisionIndex === 0}
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                      {item.specs}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {item.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
