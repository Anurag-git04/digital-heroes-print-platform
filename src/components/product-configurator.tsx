"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogueProduct } from "@/lib/catalogue/types";
import { calculatePrice } from "@/lib/pricing/calculatePrice";
import { formatMoney } from "@/lib/pricing/formatMoney";

type ProductConfiguratorProps = {
  product: CatalogueProduct;
  compact?: boolean;
};

export function ProductConfigurator({ product, compact = false }: ProductConfiguratorProps) {
  const config = product.config;
  const firstPreset = config.sizes.presets[0] ?? config.sizes.min_mm;
  const [widthMm, setWidthMm] = useState(firstPreset[0]);
  const [heightMm, setHeightMm] = useState(firstPreset[1]);
  const [materialId, setMaterialId] = useState(config.materials[0].id);
  const [orientation, setOrientation] = useState(config.orientations[0]);
  const [quantity, setQuantity] = useState(100);

  const pricing = useMemo(() => {
    try {
      return {
        price: calculatePrice(product, {
          widthMm,
          heightMm,
          materialId,
          orientation,
          quantity,
        }),
        error: null,
      };
    } catch (error) {
      return {
        price: null,
        error: error instanceof Error ? error.message : "Check your configuration.",
      };
    }
  }, [heightMm, materialId, orientation, product, quantity, widthMm]);

  const query = new URLSearchParams({
    w: String(widthMm),
    h: String(heightMm),
    material: materialId,
    orientation,
    qty: String(quantity),
  });
  const destination = config.designer.enabled
    ? `/design/${product.slug}?${query}`
    : `/checkout?product=${product.slug}&${query}`;

  return (
    <div className={`grid gap-8 ${compact ? "" : "lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"}`}>
      <div className="min-w-0 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-7">
        {!compact && (
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Live configurator
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Make it yours.</h2>
          </div>
        )}

        <div className="space-y-7">
          <fieldset>
            <legend className="text-sm font-semibold">Size</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {config.sizes.presets.map(([width, height]) => {
                const active = width === widthMm && height === heightMm;
                return (
                  <button
                    key={`${width}-${height}`}
                    type="button"
                    onClick={() => {
                      setWidthMm(width);
                      setHeightMm(height);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      active
                        ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                        : "border-[var(--line)] hover:border-[var(--ink)]"
                    }`}
                  >
                    {width} × {height} mm
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-2 block text-[var(--muted)]">Width (mm)</span>
                <input
                  type="number"
                  min={config.sizes.min_mm[0]}
                  max={config.sizes.max_mm[0]}
                  value={widthMm}
                  onChange={(event) => setWidthMm(Number(event.target.value))}
                  className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="text-sm">
                <span className="mb-2 block text-[var(--muted)]">Height (mm)</span>
                <input
                  type="number"
                  min={config.sizes.min_mm[1]}
                  max={config.sizes.max_mm[1]}
                  value={heightMm}
                  onChange={(event) => setHeightMm(Number(event.target.value))}
                  className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Material
              <select
                value={materialId}
                onChange={(event) => setMaterialId(event.target.value)}
                className="mt-3 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 font-normal outline-none focus:border-[var(--accent)]"
              >
                {config.materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Quantity
              <input
                type="number"
                min={1}
                max={100000}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="mt-3 w-full rounded-xl border border-[var(--line)] px-3 py-3 font-normal outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Orientation</legend>
            <div className="mt-3 flex gap-2">
              {config.orientations.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setOrientation(option)}
                  className={`rounded-full border px-4 py-2 text-sm capitalize transition ${
                    orientation === option
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--line)] hover:border-[var(--ink)]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <aside className="flex min-w-0 flex-col rounded-2xl bg-[var(--ink)] p-6 text-white sm:p-8">
        <div className="relative mb-8 grid min-h-48 place-items-center overflow-hidden rounded-xl border border-white/15 bg-white/5 p-6">
          <div
            className="grid aspect-video w-full max-w-xs place-items-center border border-dashed border-white/35 bg-white text-center text-[var(--ink)] shadow-2xl"
            style={{ aspectRatio: `${widthMm || 1} / ${heightMm || 1}` }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent)]">
                Digital Heroes
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight">
                {product.template?.placeholders[0]?.default ?? product.name}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {widthMm} × {heightMm} mm
              </p>
            </div>
          </div>
        </div>

        {pricing.price ? (
          <div aria-live="polite">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">Total including VAT</p>
                <p className="mt-1 text-4xl font-semibold tracking-[-0.04em]">
                  {formatMoney(pricing.price.total)}
                </p>
              </div>
              {pricing.price.discountPercent > 0 && (
                <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold">
                  {pricing.price.discountPercent}% volume saving
                </span>
              )}
            </div>
            <dl className="mt-6 space-y-2 border-t border-white/15 pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-white/80">Unit price ex. VAT</dt>
                <dd>{formatMoney(pricing.price.unitPrice)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/80">Subtotal</dt>
                <dd>{formatMoney(pricing.price.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/80">VAT</dt>
                <dd>{formatMoney(pricing.price.vat)}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p role="alert" className="rounded-xl bg-red-400/15 p-4 text-sm text-red-100">
            {pricing.error}
          </p>
        )}

        <Link
          href={destination}
          aria-disabled={!pricing.price}
          onClick={(event) => {
            if (!pricing.price) event.preventDefault();
          }}
          className="mt-8 rounded-full bg-[var(--accent)] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {config.designer.enabled ? "Design & continue" : "Upload & continue"}
        </Link>
        <p className="mt-3 text-center text-xs text-white/75">
          Price confirmed securely on the server at checkout.
        </p>
      </aside>
    </div>
  );
}
