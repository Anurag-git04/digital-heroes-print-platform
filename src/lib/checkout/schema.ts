import { z } from "zod";

export const checkoutFormSchema = z.object({
  productId: z.uuid(),
  widthMm: z.coerce.number(),
  heightMm: z.coerce.number(),
  materialId: z.string().min(1),
  orientation: z.enum(["landscape", "portrait"]),
  quantity: z.coerce.number(),
  designId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.uuid().optional(),
  ),
});

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

export function parseCheckoutForm(formData: FormData) {
  return checkoutFormSchema.safeParse({
    productId: formData.get("productId"),
    widthMm: formData.get("widthMm"),
    heightMm: formData.get("heightMm"),
    materialId: formData.get("materialId"),
    orientation: formData.get("orientation"),
    quantity: formData.get("quantity"),
    designId: formData.get("designId"),
  });
}
