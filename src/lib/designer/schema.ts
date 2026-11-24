import { z } from "zod";
import { isElementWithinPrintArea, type DesignDocument, type DesignElement } from "./model";

const baseElementSchema = z.object({
  id: z.string().min(1).max(100),
  xMm: z.number().finite().min(-2000).max(4000),
  yMm: z.number().finite().min(-2000).max(4000),
  widthMm: z.number().finite().positive().max(2000),
  heightMm: z.number().finite().positive().max(2000),
  rotation: z.number().finite().min(-3600).max(3600),
  scaleX: z.number().finite().positive().min(0.0001).max(100),
  scaleY: z.number().finite().positive().min(0.0001).max(100),
  opacity: z.number().finite().min(0).max(1).default(1),
});

const textElementSchema = baseElementSchema.extend({
  kind: z.enum(["text", "placeholder"]),
  text: z.string().max(500),
  fontFamily: z.string().min(1).max(80),
  fontSizeMm: z.number().finite().positive().max(200),
  fontWeight: z.enum(["400", "700"]),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  trackingMm: z.number().finite().min(0).max(20).default(0),
  placeholderId: z.string().min(1).max(100).optional(),
  minFontMm: z.number().finite().positive().max(200).optional(),
  maxFontMm: z.number().finite().positive().max(200).optional(),
  fitWidthMm: z.number().finite().positive().max(2000).optional(),
  fitHeightMm: z.number().finite().positive().max(2000).optional(),
});

const imageElementSchema = baseElementSchema.extend({
  kind: z.literal("image"),
  imagePath: z.string().min(1).max(500).refine((path) => !path.split("/").includes("..") && !path.includes("\\")),
  mimeType: z.enum(["image/png", "application/pdf", "application/postscript"]),
  renderable: z.boolean(),
  label: z.string().max(200).optional(),
});

export const designElementSchema = z.discriminatedUnion("kind", [textElementSchema, imageElementSchema]);

const printAreaSchema = z.object({
  x: z.number().finite().min(0).max(2000),
  y: z.number().finite().min(0).max(2000),
  w: z.number().finite().positive().max(2000),
  h: z.number().finite().positive().max(2000),
});

export const designDocumentSchema: z.ZodType<DesignDocument> = z.object({
  version: z.literal(1),
  productId: z.string().min(1).max(100),
  templateId: z.string().min(1).max(100),
  widthMm: z.number().int().positive().max(2000),
  heightMm: z.number().int().positive().max(2000),
  printArea: printAreaSchema,
  elements: z.array(designElementSchema).max(200),
}).superRefine((document, context) => {
  if (
    document.printArea.x + document.printArea.w > document.widthMm + 0.01 ||
    document.printArea.y + document.printArea.h > document.heightMm + 0.01
  ) {
    context.addIssue({ code: "custom", message: "The print area must fit inside the product.", path: ["printArea"] });
  }

  const ids = new Set<string>();
  document.elements.forEach((element: DesignElement, index) => {
    if (ids.has(element.id)) {
      context.addIssue({ code: "custom", message: "Element IDs must be unique.", path: ["elements", index, "id"] });
    }
    ids.add(element.id);

    if (!isElementWithinPrintArea(element, document.printArea)) {
      context.addIssue({ code: "custom", message: "Every element must stay inside the print area.", path: ["elements", index] });
    }

    if (element.kind === "placeholder" && !element.placeholderId) {
      context.addIssue({ code: "custom", message: "Placeholder elements need a placeholder ID.", path: ["elements", index, "placeholderId"] });
    }
  });
});

export function parseDesignDocument(value: unknown) {
  return designDocumentSchema.safeParse(value);
}
