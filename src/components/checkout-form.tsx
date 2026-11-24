"use client";

import { useActionState } from "react";
import { createCheckout, type CheckoutState } from "@/lib/checkout/actions";

type CheckoutFormProps = {
  productId: string;
  widthMm: number;
  heightMm: number;
  materialId: string;
  orientation: "landscape" | "portrait";
  quantity: number;
  designId?: string;
  disabled?: boolean;
};

export function CheckoutForm({
  productId,
  widthMm,
  heightMm,
  materialId,
  orientation,
  quantity,
  designId,
  disabled = false,
}: CheckoutFormProps) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    createCheckout,
    {},
  );

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="widthMm" value={widthMm} />
      <input type="hidden" name="heightMm" value={heightMm} />
      <input type="hidden" name="materialId" value={materialId} />
      <input type="hidden" name="orientation" value={orientation} />
      <input type="hidden" name="quantity" value={quantity} />
      {designId && <input type="hidden" name="designId" value={designId} />}
      {state.error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || disabled}
        className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Opening secure checkout…" : "Continue to secure payment"}
      </button>
    </form>
  );
}
