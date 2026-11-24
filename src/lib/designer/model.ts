import type { PrintTemplate } from "@/lib/catalogue/types";

export const PIXELS_PER_MM = 4;

export type PrintArea = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DesignElementBase = {
  id: string;
  kind: "text" | "placeholder" | "image";
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
};

export type TextAlign = "left" | "center" | "right";

export type DesignTextElement = DesignElementBase & {
  kind: "text" | "placeholder";
  text: string;
  fontFamily: string;
  fontSizeMm: number;
  fontWeight: "400" | "700";
  fill: string;
  textAlign?: TextAlign;
  trackingMm: number;
  placeholderId?: string;
  minFontMm?: number;
  maxFontMm?: number;
  fitWidthMm?: number;
  fitHeightMm?: number;
};

export type DesignImageElement = DesignElementBase & {
  kind: "image";
  imagePath: string;
  mimeType: "image/png" | "application/pdf" | "application/postscript";
  renderable: boolean;
  label?: string;
};

export type DesignElement = DesignTextElement | DesignImageElement;

export type DesignDocument = {
  version: 1;
  productId: string;
  templateId: string;
  widthMm: number;
  heightMm: number;
  printArea: PrintArea;
  elements: DesignElement[];
};

function rounded(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function scalePrintArea(
  template: PrintTemplate,
  widthMm: number,
  heightMm: number,
): PrintArea {
  const scaleX = widthMm / template.baseSize[0];
  const scaleY = heightMm / template.baseSize[1];
  return {
    x: rounded(template.printArea.x * scaleX),
    y: rounded(template.printArea.y * scaleY),
    w: rounded(template.printArea.w * scaleX),
    h: rounded(template.printArea.h * scaleY),
  };
}

export function rotatedBounds(element: Pick<DesignElementBase, "widthMm" | "heightMm" | "rotation">) {
  const angle = (element.rotation * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  return {
    width: element.widthMm * cosine + element.heightMm * sine,
    height: element.widthMm * sine + element.heightMm * cosine,
  };
}

export function isElementWithinPrintArea(
  element: Pick<DesignElementBase, "xMm" | "yMm" | "widthMm" | "heightMm" | "rotation">,
  printArea: PrintArea,
) {
  const bounds = rotatedBounds(element);
  return (
    element.xMm - bounds.width / 2 >= printArea.x - 0.01 &&
    element.yMm - bounds.height / 2 >= printArea.y - 0.01 &&
    element.xMm + bounds.width / 2 <= printArea.x + printArea.w + 0.01 &&
    element.yMm + bounds.height / 2 <= printArea.y + printArea.h + 0.01
  );
}

export function artworkPathBelongsToUser(path: string, userId: string) {
  return path.startsWith(`${userId}/`) && !path.split("/").includes("..");
}
