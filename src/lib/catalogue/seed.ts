import type { Catalogue, Orientation, ProductConfig } from "./types";

const orientations: Orientation[] = ["landscape", "portrait"];
const volumeTiers = [
  { min: 1, discount: 0 },
  { min: 100, discount: 0.1 },
  { min: 500, discount: 0.2 },
  { min: 1000, discount: 0.3 },
];

function areaConfig(
  basePerCm2: number,
  minUnit: number,
  minMm: [number, number],
  maxMm: [number, number],
  presets: [number, number][],
  materials: ProductConfig["materials"],
  csvMerge = false,
): ProductConfig {
  return {
    pricing: { model: "area", base_per_cm2: basePerCm2, min_unit: minUnit },
    sizes: { mode: "custom", min_mm: minMm, max_mm: maxMm, presets },
    materials,
    orientations,
    tiers: volumeTiers,
    vat_rate: 0.2,
    designer: { enabled: true, csv_merge: csvMerge },
  };
}

function flatConfig(
  flatUnit: number,
  minUnit: number,
  minMm: [number, number],
  maxMm: [number, number],
  presets: [number, number][],
  materials: ProductConfig["materials"],
  csvMerge = false,
): ProductConfig {
  return {
    pricing: { model: "flat", flat_unit: flatUnit, min_unit: minUnit },
    sizes: { mode: "custom", min_mm: minMm, max_mm: maxMm, presets },
    materials,
    orientations,
    tiers: volumeTiers,
    vat_rate: 0.2,
    designer: { enabled: true, csv_merge: csvMerge },
  };
}

export const seedCatalogue: Catalogue = {
  divisions: [
    {
      id: "div-labels",
      slug: "labels-stickers",
      name: "Labels & stickers",
      description: "Custom-cut labels, sheet labels and short-run sticker runs.",
      sort: 1,
      products: [
        {
          id: "prod-custom-labels",
          divisionId: "div-labels",
          slug: "custom-labels",
          name: "Custom-cut labels",
          description: "Any shape, any size, with print-safe artwork and a clean cut line.",
          active: true,
          config: areaConfig(
            0.012,
            0.15,
            [20, 20],
            [300, 300],
            [[50, 50], [100, 50], [100, 100]],
            [
              { id: "vinyl", name: "Gloss vinyl", mult: 1 },
              { id: "paper", name: "Matte paper", mult: 0.8 },
              { id: "clear", name: "Clear polyester", mult: 1.35 },
            ],
          ),
          template: {
            id: "tpl-custom-labels",
            productId: "prod-custom-labels",
            name: "Custom label",
            baseSize: [100, 100],
            printArea: { x: 3, y: 3, w: 94, h: 94 },
            bleedMm: 3,
            dpi: 300,
            placeholders: [
              { id: "headline", label: "Headline", default: "YOUR BRAND", min_font_mm: 4, max_font_mm: 18 },
              { id: "detail", label: "Detail", default: "Made with care", min_font_mm: 2, max_font_mm: 8 },
            ],
          },
        },
        {
          id: "prod-label-sheets",
          divisionId: "div-labels",
          slug: "label-sheets",
          name: "Printed label sheets",
          description: "Organised A4 and A3 sheets for retail, dispatch and product marking.",
          active: true,
          config: areaConfig(
            0.008,
            0.25,
            [100, 100],
            [420, 594],
            [[210, 297], [297, 420]],
            [
              { id: "paper", name: "Uncoated paper", mult: 1 },
              { id: "vinyl", name: "Weatherproof vinyl", mult: 1.45 },
            ],
          ),
          template: {
            id: "tpl-label-sheets",
            productId: "prod-label-sheets",
            name: "A4 label sheet",
            baseSize: [210, 297],
            printArea: { x: 10, y: 10, w: 190, h: 277 },
            bleedMm: 2,
            dpi: 300,
            placeholders: [
              { id: "title", label: "Product title", default: "PRODUCT NAME", min_font_mm: 4, max_font_mm: 14 },
              { id: "code", label: "Product code", default: "DH-001", min_font_mm: 3, max_font_mm: 9 },
            ],
          },
        },
      ],
    },
    {
      id: "div-race",
      slug: "race-event-numbers",
      name: "Race & event numbers",
      description: "Bib numbers, event boards and variable-data race artwork.",
      sort: 2,
      products: [
        {
          id: "prod-race-numbers",
          divisionId: "div-race",
          slug: "race-numbers",
          name: "Race bib numbers",
          description: "High-contrast bib numbers with optional CSV name and number merge.",
          active: true,
          config: flatConfig(
            0.28,
            0.15,
            [80, 60],
            [200, 150],
            [[120, 80], [150, 100]],
            [
              { id: "paper", name: "Sturdy bib paper", mult: 1 },
              { id: "vinyl", name: "Waterproof vinyl", mult: 1.3 },
            ],
            true,
          ),
          template: {
            id: "tpl-race-numbers",
            productId: "prod-race-numbers",
            name: "Race bib",
            baseSize: [120, 80],
            printArea: { x: 8, y: 8, w: 104, h: 64 },
            bleedMm: 3,
            dpi: 300,
            placeholders: [
              { id: "number", label: "Race number", default: "027", min_font_mm: 25, max_font_mm: 55, tracking_mm: 1 },
              { id: "name", label: "Athlete name", default: "ALEX MORGAN", min_font_mm: 5, max_font_mm: 12 },
            ],
          },
        },
        {
          id: "prod-event-boards",
          divisionId: "div-race",
          slug: "event-number-boards",
          name: "Event number boards",
          description: "Reusable course markers and oversized event numbering.",
          active: true,
          config: flatConfig(
            0.85,
            0.5,
            [150, 100],
            [400, 300],
            [[200, 150], [300, 200]],
            [
              { id: "board", name: "Fluted polyboard", mult: 1 },
              { id: "aluminium", name: "Aluminium composite", mult: 1.8 },
            ],
          ),
          template: {
            id: "tpl-event-boards",
            productId: "prod-event-boards",
            name: "Course marker",
            baseSize: [200, 150],
            printArea: { x: 10, y: 10, w: 180, h: 130 },
            bleedMm: 2,
            dpi: 300,
            placeholders: [
              { id: "number", label: "Marker number", default: "04", min_font_mm: 30, max_font_mm: 80 },
              { id: "label", label: "Marker label", default: "CHECKPOINT", min_font_mm: 6, max_font_mm: 16 },
            ],
          },
        },
      ],
    },
    {
      id: "div-mtb",
      slug: "mtb-boards",
      name: "MTB boards",
      description: "Custom race boards and number plates built for the trail.",
      sort: 3,
      products: [
        {
          id: "prod-mtb-boards",
          divisionId: "div-mtb",
          slug: "mtb-boards",
          name: "Custom MTB number boards",
          description: "Lightweight, high-impact number boards with rider and event branding.",
          active: true,
          config: flatConfig(
            1.2,
            0.8,
            [150, 100],
            [400, 300],
            [[200, 150], [300, 200]],
            [
              { id: "poly", name: "4 mm polyboard", mult: 1 },
              { id: "composite", name: "Aluminium composite", mult: 1.65 },
            ],
          ),
          template: {
            id: "tpl-mtb-boards",
            productId: "prod-mtb-boards",
            name: "MTB race board",
            baseSize: [200, 150],
            printArea: { x: 10, y: 10, w: 180, h: 130 },
            bleedMm: 2,
            dpi: 300,
            placeholders: [
              { id: "number", label: "Rider number", default: "17", min_font_mm: 35, max_font_mm: 85 },
              { id: "name", label: "Rider name", default: "RIDER NAME", min_font_mm: 6, max_font_mm: 15 },
            ],
          },
        },
      ],
    },
    {
      id: "div-stamps",
      slug: "stamps",
      name: "Stamps",
      description: "Rubber stamps for packaging, paperwork and product marks.",
      sort: 4,
      products: [
        {
          id: "prod-custom-stamps",
          divisionId: "div-stamps",
          slug: "custom-stamps",
          name: "Custom rubber stamps",
          description: "Precise text and logo stamps with a durable timber or self-inking body.",
          active: true,
          config: flatConfig(
            2.5,
            1.5,
            [40, 20],
            [120, 80],
            [[60, 30], [80, 40], [100, 50]],
            [
              { id: "wood", name: "Timber mount", mult: 1 },
              { id: "self-inking", name: "Self-inking body", mult: 1.55 },
            ],
          ),
          template: {
            id: "tpl-custom-stamps",
            productId: "prod-custom-stamps",
            name: "Rubber stamp",
            baseSize: [60, 30],
            printArea: { x: 5, y: 5, w: 50, h: 20 },
            bleedMm: 2,
            dpi: 300,
            placeholders: [
              { id: "line1", label: "First line", default: "APPROVED", min_font_mm: 4, max_font_mm: 12 },
              { id: "line2", label: "Second line", default: "DIGITAL HEROES", min_font_mm: 2, max_font_mm: 6 },
            ],
          },
        },
      ],
    },
    {
      id: "div-trophies",
      slug: "trophies",
      name: "Trophies",
      description: "Engraved plates, award bases and recognition products.",
      sort: 5,
      products: [
        {
          id: "prod-trophy-plates",
          divisionId: "div-trophies",
          slug: "trophy-plates",
          name: "Engraved trophy plates",
          description: "Personalised metal plates for awards, trophies and presentation pieces.",
          active: true,
          config: areaConfig(
            0.02,
            0.45,
            [30, 15],
            [200, 100],
            [[80, 40], [100, 50], [120, 60]],
            [
              { id: "brass", name: "Brass effect", mult: 1 },
              { id: "silver", name: "Silver effect", mult: 1.1 },
              { id: "black", name: "Black anodised", mult: 1.25 },
            ],
          ),
          template: {
            id: "tpl-trophy-plates",
            productId: "prod-trophy-plates",
            name: "Engraved plate",
            baseSize: [80, 40],
            printArea: { x: 5, y: 5, w: 70, h: 30 },
            bleedMm: 2,
            dpi: 300,
            placeholders: [
              { id: "title", label: "Award title", default: "PARTICIPATION", min_font_mm: 4, max_font_mm: 10 },
              { id: "recipient", label: "Recipient", default: "RECIPIENT NAME", min_font_mm: 3, max_font_mm: 7 },
            ],
          },
        },
      ],
    },
    {
      id: "div-laser",
      slug: "laser-cut-work",
      name: "Laser-cut work",
      description: "Precision-cut panels, signage and custom fabricated shapes.",
      sort: 6,
      products: [
        {
          id: "prod-laser-panels",
          divisionId: "div-laser",
          slug: "laser-cut-panels",
          name: "Custom laser-cut panels",
          description: "Print, engrave and cut custom panels in acrylic, wood and card.",
          active: true,
          config: areaConfig(
            0.018,
            0.6,
            [50, 50],
            [600, 600],
            [[100, 100], [200, 150], [300, 200]],
            [
              { id: "acrylic", name: "3 mm acrylic", mult: 1 },
              { id: "wood", name: "3 mm birch ply", mult: 0.85 },
              { id: "card", name: "Card stock", mult: 0.55 },
            ],
          ),
          template: {
            id: "tpl-laser-panels",
            productId: "prod-laser-panels",
            name: "Laser-cut panel",
            baseSize: [200, 150],
            printArea: { x: 8, y: 8, w: 184, h: 134 },
            bleedMm: 2,
            dpi: 300,
            placeholders: [
              { id: "headline", label: "Headline", default: "MAKE YOUR MARK", min_font_mm: 6, max_font_mm: 22 },
              { id: "detail", label: "Detail", default: "Precision cut", min_font_mm: 3, max_font_mm: 9 },
            ],
          },
        },
      ],
    },
  ],
};
