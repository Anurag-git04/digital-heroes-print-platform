export type Orientation = "landscape" | "portrait";

export type ProductConfig = {
  pricing: {
    model: "area" | "flat";
    base_per_cm2?: number;
    flat_unit?: number;
    min_unit: number;
  };
  sizes: {
    mode: "custom" | "preset";
    min_mm: [number, number];
    max_mm: [number, number];
    presets: [number, number][];
  };
  materials: {
    id: string;
    name: string;
    mult: number;
  }[];
  orientations: Orientation[];
  tiers: {
    min: number;
    discount: number;
  }[];
  vat_rate: number;
  designer: {
    enabled: boolean;
    csv_merge: boolean;
  };
};

export type PrintPlaceholder = {
  id: string;
  label: string;
  default: string;
  min_font_mm: number;
  max_font_mm: number;
  tracking_mm?: number;
};

export type PrintTemplate = {
  id: string;
  productId: string;
  name: string;
  baseSize: [number, number];
  printArea: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  bleedMm: number;
  dpi: number;
  placeholders: PrintPlaceholder[];
};

export type CatalogueProduct = {
  id: string;
  divisionId: string;
  slug: string;
  name: string;
  description: string;
  config: ProductConfig;
  active: boolean;
  template: PrintTemplate | null;
};

export type Division = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sort: number;
  products: CatalogueProduct[];
};

export type Catalogue = {
  divisions: Division[];
};

export type ProductDetail = CatalogueProduct & {
  division: Division;
};
