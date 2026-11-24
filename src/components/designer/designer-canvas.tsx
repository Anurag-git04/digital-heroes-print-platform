"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Canvas, FabricImage, Rect, Textbox, type FabricObject } from "fabric";
import type { CatalogueProduct, PrintPlaceholder } from "@/lib/catalogue/types";
import type { ConfigurationInput } from "@/lib/pricing/calculatePrice";
import { getArtworkPreviewUrl, saveDesign } from "@/lib/designer/actions";
import {
  PIXELS_PER_MM,
  isElementWithinPrintArea,
  scalePrintArea,
  type DesignDocument,
  type DesignElement,
  type DesignImageElement,
  type DesignTextElement,
  type PrintArea,
  type TextAlign,
} from "@/lib/designer/model";
import { parseDesignDocument } from "@/lib/designer/schema";

export type DesignerCanvasProps = {
  product: CatalogueProduct;
  configuration: ConfigurationInput;
  initialDesign?: DesignDocument | null;
  initialDesignId?: string;
  canPersist: boolean;
  loginHref: string;
  /** When editing a design for a proof revision, link back to that proof page after saving. */
  returnHref?: string;
};

type ObjectMetadata = {
  designId: string;
  kind: "text" | "placeholder" | "image";
  imagePath?: string;
  mimeType?: DesignImageElement["mimeType"];
  renderable?: boolean;
  label?: string;
  placeholderId?: string;
  minFontMm?: number;
  maxFontMm?: number;
  fitWidthMm?: number;
  fitHeightMm?: number;
};

type MetadataObject = FabricObject & { dh?: ObjectMetadata };

type SelectionState = {
  id: string;
  text: string;
  fontFamily: string;
  fontSizeMm: number;
  fill: string;
  textAlign: TextAlign;
};

function normalizeTextAlign(value?: string): TextAlign {
  return value === "center" || value === "right" ? value : "left";
}

type ObjectSnapshot = {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
};

type UploadResponse = {
  path: string;
  originalPath: string;
  previewUrl?: string;
  mimeType: DesignImageElement["mimeType"];
  renderable: boolean;
  label?: string;
};

function metadata(object: FabricObject) {
  return (object as MetadataObject).dh;
}

function snapshot(object: FabricObject): ObjectSnapshot {
  return {
    left: object.left ?? 0,
    top: object.top ?? 0,
    scaleX: object.scaleX ?? 1,
    scaleY: object.scaleY ?? 1,
    angle: object.angle ?? 0,
  };
}

function restore(object: FabricObject, value: ObjectSnapshot) {
  object.set(value);
  object.setCoords();
}

function objectGeometry(object: FabricObject) {
  return {
    xMm: (object.left ?? 0) / PIXELS_PER_MM,
    yMm: (object.top ?? 0) / PIXELS_PER_MM,
    widthMm: object.getScaledWidth() / PIXELS_PER_MM,
    heightMm: object.getScaledHeight() / PIXELS_PER_MM,
    rotation: object.angle ?? 0,
  };
}

function fitFontSizeMm(
  text: string,
  fontFamily: string,
  fontWeight: "400" | "700",
  maxFontMm: number,
  minFontMm: number,
  maxWidthMm: number,
  maxHeightMm: number,
  trackingMm: number,
) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return minFontMm;

  const lines = (text || " ").split("\n");
  let best = minFontMm;

  for (let fontSize = maxFontMm; fontSize >= minFontMm; fontSize -= 0.25) {
    const fontSizePx = fontSize * PIXELS_PER_MM;
    context.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
    const widest = Math.max(...lines.map((line) => {
      const measured = context.measureText(line).width;
      return measured + Math.max(0, line.length - 1) * trackingMm * PIXELS_PER_MM;
    }));
    const height = lines.length * fontSizePx * 1.2;
    if (widest <= maxWidthMm * PIXELS_PER_MM && height <= maxHeightMm * PIXELS_PER_MM) {
      best = fontSize;
      break;
    }
  }

  return best;
}

function fitTextObject(object: Textbox) {
  const meta = metadata(object);
  if (!meta?.fitWidthMm || !meta.fitHeightMm || !meta.minFontMm || !meta.maxFontMm) return;
  const fontSize = fitFontSizeMm(
    object.text,
    object.fontFamily,
    object.fontWeight === 700 || object.fontWeight === "700" ? "700" : "400",
    meta.maxFontMm,
    meta.minFontMm,
    meta.fitWidthMm,
    meta.fitHeightMm,
    (object.charSpacing ?? 0) / PIXELS_PER_MM,
  );
  object.set({ fontSize: fontSize * PIXELS_PER_MM });
  object.initDimensions();
  object.setCoords();
}

function serializeObject(object: FabricObject): DesignElement | null {
  const meta = metadata(object);
  if (!meta) return null;

  const base = {
    id: meta.designId,
    xMm: Math.round(((object.left ?? 0) / PIXELS_PER_MM) * 1000) / 1000,
    yMm: Math.round(((object.top ?? 0) / PIXELS_PER_MM) * 1000) / 1000,
    widthMm: Math.round((object.getScaledWidth() / PIXELS_PER_MM) * 1000) / 1000,
    heightMm: Math.round((object.getScaledHeight() / PIXELS_PER_MM) * 1000) / 1000,
    rotation: object.angle ?? 0,
    scaleX: object.scaleX ?? 1,
    scaleY: object.scaleY ?? 1,
    opacity: object.opacity ?? 1,
  };

  if (object instanceof Textbox) {
    const element: DesignTextElement = {
      ...base,
      kind: meta.kind === "placeholder" ? "placeholder" : "text",
      text: object.text,
      fontFamily: object.fontFamily,
      fontSizeMm: (object.fontSize ?? 16) / PIXELS_PER_MM,
      fontWeight: object.fontWeight === 700 || object.fontWeight === "700" ? "700" : "400",
      fill: typeof object.fill === "string" ? object.fill : "#111111",
      textAlign: normalizeTextAlign(object.textAlign),
      trackingMm: (object.charSpacing ?? 0) / PIXELS_PER_MM,
      placeholderId: meta.placeholderId,
      minFontMm: meta.minFontMm,
      maxFontMm: meta.maxFontMm,
      fitWidthMm: meta.fitWidthMm,
      fitHeightMm: meta.fitHeightMm,
    };
    return element;
  }

  if (object instanceof FabricImage && meta.imagePath && meta.mimeType) {
    return {
      ...base,
      kind: "image",
      imagePath: meta.imagePath,
      mimeType: meta.mimeType,
      renderable: meta.renderable ?? false,
      label: meta.label,
    };
  }

  return null;
}

function makePlaceholderDataUrl(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 400;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.fillStyle = "#efede7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#9a958b";
  context.lineWidth = 5;
  context.setLineDash([18, 12]);
  context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  context.setLineDash([]);
  context.fillStyle = "#565149";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "600 28px Arial";
  context.fillText(label || "ARTWORK PLACEHOLDER", canvas.width / 2, canvas.height / 2, canvas.width - 70);
  return canvas.toDataURL("image/png");
}

async function sourceAsDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Artwork could not be loaded.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Artwork could not be read."));
    reader.readAsDataURL(blob);
  });
}

function createPlaceholder(
  placeholder: PrintPlaceholder,
  index: number,
  count: number,
  printArea: PrintArea,
) {
  const bandHeight = printArea.h / count;
  const widthMm = printArea.w * 0.88;
  const heightMm = bandHeight * 0.82;
  const fontSizeMm = fitFontSizeMm(
    placeholder.default,
    "Arial",
    "700",
    placeholder.max_font_mm,
    placeholder.min_font_mm,
    widthMm,
    heightMm,
    placeholder.tracking_mm ?? 0,
  );
  const object = new Textbox(placeholder.default, {
    left: (printArea.x + printArea.w / 2) * PIXELS_PER_MM,
    top: (printArea.y + bandHeight * (index + 0.5)) * PIXELS_PER_MM,
    width: widthMm * PIXELS_PER_MM,
    fontSize: fontSizeMm * PIXELS_PER_MM,
    fontFamily: "Arial",
    fontWeight: "700",
    fill: "#111111",
    textAlign: "center",
    charSpacing: (placeholder.tracking_mm ?? 0) * PIXELS_PER_MM,
    originX: "center",
    originY: "center",
    splitByGrapheme: false,
  });
  Object.assign(object, {
    dh: {
      designId: crypto.randomUUID(),
      kind: "placeholder",
      placeholderId: placeholder.id,
      minFontMm: placeholder.min_font_mm,
      maxFontMm: placeholder.max_font_mm,
      fitWidthMm: widthMm,
      fitHeightMm: heightMm,
    } satisfies ObjectMetadata,
  });
  return object;
}

export function DesignerCanvas({
  product,
  configuration,
  initialDesign,
  initialDesignId,
  canPersist,
  loginHref,
  returnHref,
}: DesignerCanvasProps) {
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const lastValidRef = useRef(new Map<string, ObjectSnapshot>());
  const uploadRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, startSaving] = useTransition();
  const [savedDesignId, setSavedDesignId] = useState(initialDesignId);
  const [saveMessage, setSaveMessage] = useState("");
  const [name, setName] = useState(initialDesignId ? `${product.name} saved design` : `${product.name} design`);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    for (const placeholder of product.template?.placeholders ?? []) {
      values[placeholder.id] = initialDesign?.elements.find(
        (element): element is DesignTextElement => element.kind === "placeholder" && element.placeholderId === placeholder.id,
      )?.text ?? placeholder.default;
    }
    return values;
  });

  const printArea = useMemo(() => {
    if (initialDesign) return initialDesign.printArea;
    if (!product.template) return { x: 0, y: 0, w: configuration.widthMm, h: configuration.heightMm };
    return scalePrintArea(product.template, configuration.widthMm, configuration.heightMm);
  }, [
    configuration.heightMm,
    configuration.widthMm,
    initialDesign,
    product.template,
  ]);

  // Keep latest initial props in a ref so Server Action revalidation (which sends a new
  // `product` object reference for the same product) never tears down the live canvas.
  const latestInitRef = useRef({ product, initialDesign, printArea });
  useEffect(() => {
    latestInitRef.current = { product, initialDesign, printArea };
  });

  const syncSelection = useCallback(() => {
    const object = canvasRef.current?.getActiveObject();
    if (object instanceof Textbox) {
      setSelection({
        id: metadata(object)?.designId ?? "",
        text: object.text,
        fontFamily: object.fontFamily,
        fontSizeMm: object.fontSize / PIXELS_PER_MM,
        fill: typeof object.fill === "string" ? object.fill : "#111111",
        textAlign: normalizeTextAlign(object.textAlign),
      });
    } else {
      setSelection(null);
    }
    setHasSelection(Boolean(object));
  }, []);

  useEffect(() => {
    const element = canvasElementRef.current;
    const stage = stageRef.current;
    const { product: initProduct, initialDesign: initDesign, printArea: initPrintArea } =
      latestInitRef.current;
    if (!element || !stage || !initProduct.template) return;

    let cancelled = false;
    const canvas = new Canvas(element, { width: 1, height: 1, preserveObjectStacking: true });
    (element as HTMLCanvasElement & { __designerCanvas?: Canvas }).__designerCanvas = canvas;
    canvasRef.current = canvas;
    lastValidRef.current.clear();
    const pageWidth = configuration.widthMm * PIXELS_PER_MM;
    const pageHeight = configuration.heightMm * PIXELS_PER_MM;

    const page = new Rect({
      left: pageWidth / 2,
      top: pageHeight / 2,
      width: pageWidth,
      height: pageHeight,
      originX: "center",
      originY: "center",
      fill: "#ffffff",
      stroke: "#c9c4ba",
      strokeWidth: 1,
      selectable: false,
      evented: false,
    });
    canvas.add(page);

    const bleedInset = Math.max(0, Math.min(initProduct.template.bleedMm, configuration.widthMm / 2, configuration.heightMm / 2));
    const bleedGuide = new Rect({
      left: ((configuration.widthMm - bleedInset * 2) / 2 + bleedInset) * PIXELS_PER_MM,
      top: ((configuration.heightMm - bleedInset * 2) / 2 + bleedInset) * PIXELS_PER_MM,
      width: (configuration.widthMm - bleedInset * 2) * PIXELS_PER_MM,
      height: (configuration.heightMm - bleedInset * 2) * PIXELS_PER_MM,
      originX: "center",
      originY: "center",
      fill: "transparent",
      stroke: "#c45c4b",
      strokeWidth: 1,
      strokeDashArray: [7, 6],
      selectable: false,
      evented: false,
    });
    canvas.add(bleedGuide);

    const safeGuide = new Rect({
      left: (initPrintArea.x + initPrintArea.w / 2) * PIXELS_PER_MM,
      top: (initPrintArea.y + initPrintArea.h / 2) * PIXELS_PER_MM,
      width: initPrintArea.w * PIXELS_PER_MM,
      height: initPrintArea.h * PIXELS_PER_MM,
      originX: "center",
      originY: "center",
      fill: "transparent",
      stroke: "#326b63",
      strokeWidth: 1.5,
      strokeDashArray: [9, 6],
      selectable: false,
      evented: false,
    });
    canvas.add(safeGuide);

    const resize = () => {
      const availableWidth = stage.clientWidth;
      const zoom = Math.max(0.05, Math.min(1.25, availableWidth / pageWidth));
      canvas.setZoom(zoom);
      canvas.setDimensions({ width: Math.round(pageWidth * zoom), height: Math.round(pageHeight * zoom) });
      canvas.requestRenderAll();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    const enforceBounds = () => {
      const activeObjects = canvas.getActiveObjects().filter((object) => metadata(object));
      let valid = true;
      for (const object of activeObjects) {
        if (!isElementWithinPrintArea(objectGeometry(object), initPrintArea)) {
          valid = false;
          break;
        }
      }
      if (!valid) {
        for (const object of activeObjects) {
          const previous = lastValidRef.current.get(metadata(object)?.designId ?? "");
          if (previous) restore(object, previous);
        }
        setStatus("That change would leave the print area, so it was reverted.");
        canvas.requestRenderAll();
        return false;
      }
      for (const object of activeObjects) {
        const id = metadata(object)?.designId;
        if (id) lastValidRef.current.set(id, snapshot(object));
      }
      return true;
    };

    canvas.on("mouse:down", (event) => {
      const target = (event as { target?: FabricObject }).target;
      if (target) {
        const id = metadata(target)?.designId;
        if (id) lastValidRef.current.set(id, snapshot(target));
      }
    });
    for (const eventName of ["object:moving", "object:scaling", "object:rotating"] as const) {
      canvas.on(eventName, () => enforceBounds());
    }
    canvas.on("object:modified", () => {
      enforceBounds();
      setDirty(true);
    });
    canvas.on("object:added", () => setDirty(true));
    canvas.on("object:removed", () => setDirty(true));
    canvas.on("selection:created", (event) => {
      if (((event as { selected?: FabricObject[] }).selected?.length ?? 0) > 1) {
        canvas.discardActiveObject();
        setStatus("Move and edit one element at a time.");
      }
      syncSelection();
    });
    canvas.on("selection:updated", syncSelection);
    canvas.on("selection:cleared", () => {
      setSelection(null);
      setHasSelection(false);
    });

    const addLoadedObject = async (saved: DesignElement) => {
      if (cancelled) return;
      let object: FabricObject;
      if (saved.kind === "image") {
        let source = makePlaceholderDataUrl(saved.label ?? "ARTWORK PLACEHOLDER");
        if (saved.renderable) {
          const preview = await getArtworkPreviewUrl(saved.imagePath);
          if (!preview.url) throw new Error(preview.error ?? "Artwork could not be loaded.");
          source = await sourceAsDataUrl(preview.url);
        }
        const image = await FabricImage.fromURL(source, { crossOrigin: "anonymous" });
        const naturalWidth = Math.max(1, image.width || 1);
        const naturalHeight = Math.max(1, image.height || 1);
        image.set({
          left: saved.xMm * PIXELS_PER_MM,
          top: saved.yMm * PIXELS_PER_MM,
          scaleX: (saved.widthMm * PIXELS_PER_MM) / naturalWidth,
          scaleY: (saved.heightMm * PIXELS_PER_MM) / naturalHeight,
          angle: saved.rotation,
          opacity: saved.opacity,
          originX: "center",
          originY: "center",
        });
        image.setCoords();
        Object.assign(image, {
          dh: {
            designId: saved.id,
            kind: "image",
            imagePath: saved.imagePath,
            mimeType: saved.mimeType,
            renderable: saved.renderable,
            label: saved.label,
          } satisfies ObjectMetadata,
        });
        object = image;
      } else {
        const text = new Textbox(saved.text, {
          left: saved.xMm * PIXELS_PER_MM,
          top: saved.yMm * PIXELS_PER_MM,
          width: (saved.widthMm / saved.scaleX) * PIXELS_PER_MM,
          height: (saved.heightMm / saved.scaleY) * PIXELS_PER_MM,
          fontSize: saved.fontSizeMm * PIXELS_PER_MM,
          fontFamily: saved.fontFamily,
          fontWeight: saved.fontWeight,
          fill: saved.fill,
          textAlign: saved.textAlign ?? "left",
          charSpacing: saved.trackingMm * PIXELS_PER_MM,
          scaleX: saved.scaleX,
          scaleY: saved.scaleY,
          angle: saved.rotation,
          opacity: saved.opacity,
          originX: "center",
          originY: "center",
          splitByGrapheme: false,
        });
        Object.assign(text, {
          dh: {
            designId: saved.id,
            kind: saved.kind,
            placeholderId: saved.placeholderId,
            minFontMm: saved.minFontMm,
            maxFontMm: saved.maxFontMm,
            fitWidthMm: saved.fitWidthMm,
            fitHeightMm: saved.fitHeightMm,
          } satisfies ObjectMetadata,
        });
        object = text;
      }
      canvas.add(object);
      const id = metadata(object)?.designId;
      if (id) lastValidRef.current.set(id, snapshot(object));
    };

    const initialise = async () => {
      try {
        if (initDesign) {
          for (const saved of initDesign.elements) {
            await addLoadedObject(saved);
          }
        } else {
          const placeholders = initProduct.template?.placeholders ?? [];
          placeholders.forEach((placeholder, index) => {
            const object = createPlaceholder(placeholder, index, placeholders.length, initPrintArea);
            canvas.add(object);
            const id = metadata(object)?.designId;
            if (id) lastValidRef.current.set(id, snapshot(object));
          });
        }
        if (!cancelled) {
          canvas.requestRenderAll();
          setDirty(false);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setStatus("The design loaded, but some artwork could not be previewed. Re-upload it before saving.");
          setReady(true);
        }
      }
    };
    void initialise();

    return () => {
      cancelled = true;
      observer.disconnect();
      canvas.dispose();
      if (canvasRef.current === canvas) canvasRef.current = null;
    };
  }, [
    configuration.heightMm,
    configuration.widthMm,
    initialDesignId,
    product.id,
    product.template?.id,
    syncSelection,
  ]);

  const addText = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const widthMm = printArea.w * 0.7;
    const heightMm = Math.min(printArea.h * 0.2, 12);
    const object = new Textbox("YOUR TEXT", {
      left: (printArea.x + printArea.w / 2) * PIXELS_PER_MM,
      top: (printArea.y + printArea.h / 2) * PIXELS_PER_MM,
      width: widthMm * PIXELS_PER_MM,
      fontSize: 8 * PIXELS_PER_MM,
      fontFamily: "Arial",
      fill: "#111111",
      textAlign: "center",
      originX: "center",
      originY: "center",
      splitByGrapheme: false,
    });
    Object.assign(object, {
      dh: {
        designId: crypto.randomUUID(),
        kind: "text",
        fitWidthMm: widthMm,
        fitHeightMm: heightMm,
        minFontMm: 2,
        maxFontMm: 20,
      } satisfies ObjectMetadata,
    });
    canvas.add(object);
    canvas.setActiveObject(object);
    lastValidRef.current.set(metadata(object)!.designId, snapshot(object));
    setDirty(true);
    setStatus("");
    syncSelection();
  };

  const updateSelectedText = (
    patch: { text?: string; fontFamily?: string; fontSizeMm?: number; fill?: string; textAlign?: TextAlign },
    refit = false,
  ) => {
    const canvas = canvasRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !(object instanceof Textbox)) return;
    const previous = snapshot(object);
    const previousMeta = metadata(object);
    object.set({
      ...(patch.text !== undefined ? { text: patch.text } : {}),
      ...(patch.fontFamily !== undefined ? { fontFamily: patch.fontFamily } : {}),
      ...(patch.fontSizeMm !== undefined ? { fontSize: patch.fontSizeMm * PIXELS_PER_MM } : {}),
      ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
      ...(patch.textAlign !== undefined ? { textAlign: patch.textAlign } : {}),
    });
    if (refit) fitTextObject(object);
    object.setCoords();
    if (!isElementWithinPrintArea(objectGeometry(object), printArea)) {
      restore(object, previous);
      setStatus("That text change would leave the print area, so it was reverted.");
    } else {
      setStatus("");
    }
    const id = previousMeta?.designId;
    if (id) lastValidRef.current.set(id, snapshot(object));
    canvas.requestRenderAll();
    setDirty(true);
    syncSelection();
  };

  const updatePlaceholder = (placeholderId: string, value: string) => {
    setPlaceholderValues((current) => ({ ...current, [placeholderId]: value }));
    const canvas = canvasRef.current;
    const object = canvas?.getObjects().find((item) => metadata(item)?.placeholderId === placeholderId);
    if (!canvas || !(object instanceof Textbox)) return;
    const previous = snapshot(object);
    object.set({ text: value });
    fitTextObject(object);
    object.setCoords();
    if (!isElementWithinPrintArea(objectGeometry(object), printArea)) {
      restore(object, previous);
      setStatus("That text would leave the print area, so it was reverted.");
    } else {
      setStatus("");
    }
    const id = metadata(object)?.designId;
    if (id) lastValidRef.current.set(id, snapshot(object));
    canvas.requestRenderAll();
    setDirty(true);
    if (canvas.getActiveObject() === object) syncSelection();
  };

  const deleteSelected = () => {
    const canvas = canvasRef.current;
    const objects = canvas?.getActiveObjects() ?? [];
    for (const object of objects) {
      const id = metadata(object)?.designId;
      if (id) lastValidRef.current.delete(id);
      canvas?.remove(object);
    }
    canvas?.discardActiveObject();
    canvas?.requestRenderAll();
    setSelection(null);
    setHasSelection(false);
    setDirty(true);
  };

  const bringForward = () => {
    const canvas = canvasRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    canvas.bringObjectForward(object);
    canvas.requestRenderAll();
    setDirty(true);
  };

  const handleUpload = async (file: File) => {
    if (!canPersist) {
      setStatus("Sign in and configure Supabase before uploading artwork.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setStatus("Artwork must be 4 MB or smaller.");
      return;
    }
    setUploading(true);
    setStatus("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const result = await response.json() as UploadResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Artwork upload failed.");

      const canvas = canvasRef.current;
      if (!canvas) return;
      const source = result.renderable && result.previewUrl
        ? await sourceAsDataUrl(result.previewUrl)
        : makePlaceholderDataUrl(result.label ?? "ARTWORK PLACEHOLDER");
      const image = await FabricImage.fromURL(source, { crossOrigin: "anonymous" });
      const naturalWidth = Math.max(1, image.width || 1);
      const naturalHeight = Math.max(1, image.height || 1);
      const ratio = naturalWidth / naturalHeight;
      const widthMm = Math.min(printArea.w * 0.7, printArea.h * 0.6 * ratio);
      const heightMm = widthMm / ratio;
      image.set({
        left: (printArea.x + printArea.w / 2) * PIXELS_PER_MM,
        top: (printArea.y + printArea.h / 2) * PIXELS_PER_MM,
        scaleX: (widthMm * PIXELS_PER_MM) / naturalWidth,
        scaleY: (heightMm * PIXELS_PER_MM) / naturalHeight,
        originX: "center",
        originY: "center",
      });
      image.setCoords();
      Object.assign(image, {
        dh: {
          designId: crypto.randomUUID(),
          kind: "image",
          imagePath: result.path,
          mimeType: result.mimeType,
          renderable: result.renderable,
          label: result.label,
        } satisfies ObjectMetadata,
      });
      canvas.add(image);
      canvas.setActiveObject(image);
      lastValidRef.current.set(metadata(image)!.designId, snapshot(image));
      canvas.requestRenderAll();
      setDirty(true);
      setStatus(result.renderable ? "Artwork added. Drag and resize it inside the green print area." : "File saved. Production will render this format before proofing.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Artwork upload failed.");
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !product.template) return;
    const elements = canvas.getObjects().map(serializeObject).filter((element): element is DesignElement => Boolean(element));
    const document: DesignDocument = {
      version: 1,
      productId: product.id,
      templateId: product.template.id,
      widthMm: configuration.widthMm,
      heightMm: configuration.heightMm,
      printArea,
      elements,
    };
    const parsed = parseDesignDocument(document);
    if (!parsed.success) {
      setSaveMessage(parsed.error.issues[0]?.message ?? "The design could not be validated.");
      return;
    }
    const formData = new FormData();
    formData.set("productId", product.id);
    formData.set("designId", savedDesignId ?? "");
    formData.set("name", name);
    formData.set("widthMm", String(configuration.widthMm));
    formData.set("heightMm", String(configuration.heightMm));
    formData.set("materialId", configuration.materialId);
    formData.set("orientation", configuration.orientation);
    formData.set("quantity", String(configuration.quantity));
    formData.set("designJson", JSON.stringify(parsed.data));
    setSaveMessage("");
    startSaving(async () => {
      const result = await saveDesign(formData);
      if (result.error) {
        setSaveMessage(result.error);
        return;
      }
      setSavedDesignId(result.designId);
      setDirty(false);
      setSaveMessage(returnHref ? "Design saved. Now submit the revision on your proof page." : "Design saved to your account.");
      if (result.designId) {
        const query = new URLSearchParams({
          design: result.designId,
          ...(returnHref ? { returnTo: returnHref } : {}),
        });
        window.history.replaceState(null, "", `/design/${product.slug}?${query}`);
      }
    });
  };

  const checkoutQuery = new URLSearchParams({
    product: product.slug,
    w: String(configuration.widthMm),
    h: String(configuration.heightMm),
    material: configuration.materialId,
    orientation: configuration.orientation,
    qty: String(configuration.quantity),
    ...(savedDesignId ? { design: savedDesignId } : {}),
  });
  const canCheckout = Boolean(savedDesignId && !dirty && canPersist);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Template fields</h2>
            <span className="text-xs text-[var(--muted)]">{product.template?.dpi ?? 300} DPI</span>
          </div>
          <div className="mt-5 space-y-4">
            {(product.template?.placeholders ?? []).map((placeholder) => (
              <label key={placeholder.id} className="block text-sm">
                <span className="mb-2 block font-medium">{placeholder.label}</span>
                <input
                  value={placeholderValues[placeholder.id] ?? ""}
                  onChange={(event) => updatePlaceholder(placeholder.id, event.target.value)}
                  maxLength={placeholder.id === "number" ? 12 : 80}
                  className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                />
                <span className="mt-1 block text-xs text-[var(--muted)]">Shrinks to fit automatically</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <h2 className="font-semibold">Selected text</h2>
          {selection ? (
            <div className="mt-5 space-y-4">
              <label className="block text-sm">
                <span className="mb-2 block text-[var(--muted)]">Content</span>
                <textarea
                  value={selection.text}
                  onChange={(event) => updateSelectedText({ text: event.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block text-[var(--muted)]">Font</span>
                <select
                  value={selection.fontFamily}
                  onChange={(event) => updateSelectedText({ fontFamily: event.target.value })}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                >
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="mb-2 block text-[var(--muted)]">Size (mm)</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={0.5}
                    value={Math.round(selection.fontSizeMm * 10) / 10}
                    onChange={(event) => updateSelectedText({ fontSizeMm: Number(event.target.value) })}
                    className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-2 block text-[var(--muted)]">Colour</span>
                  <input
                    type="color"
                    value={selection.fill}
                    onChange={(event) => updateSelectedText({ fill: event.target.value })}
                    className="mt-1 h-11 w-full cursor-pointer rounded-xl border border-[var(--line)] bg-white p-1"
                  />
                </label>
              </div>
              <div className="text-sm">
                <span className="mb-2 block text-[var(--muted)]">Alignment</span>
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Text alignment">
                  {(["left", "center", "right"] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => updateSelectedText({ textAlign: align })}
                      aria-pressed={selection.textAlign === align}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition ${
                        selection.textAlign === align
                          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                          : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--ink)]"
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Select text on the canvas to change its content, font, size and colour.</p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <h2 className="font-semibold">Private artwork</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">PNG and SVG preview in the designer. PDF and AI are stored and rendered by production.</p>
          <input
            ref={uploadRef}
            type="file"
            accept=".png,.svg,.pdf,.ai,image/png,image/svg+xml,application/pdf,application/postscript"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <button
            type="button"
            disabled={!canPersist || uploading || !ready}
            onClick={() => uploadRef.current?.click()}
            className="mt-4 w-full rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload logo or artwork"}
          </button>
          {!canPersist && <Link href={loginHref} className="mt-3 block text-center text-sm font-semibold text-[var(--accent)]">Sign in to save and upload</Link>}
        </section>
      </aside>

      <section className="min-w-0 rounded-2xl border border-[var(--line)] bg-[#e9e5dc] p-3 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addText} disabled={!ready} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">+ Text</button>
            <button type="button" onClick={bringForward} disabled={!hasSelection} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Bring forward</button>
            <button type="button" onClick={deleteSelected} disabled={!hasSelection} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-40">Delete</button>
          </div>
          <p className="text-xs text-[var(--muted)]">{configuration.widthMm} × {configuration.heightMm} mm · bleed {product.template?.bleedMm ?? 0} mm</p>
        </div>

        <div ref={stageRef} className="designer-stage flex min-h-80 items-center justify-center overflow-hidden rounded-xl bg-[#ded9cf] p-3">
          <canvas ref={canvasElementRef} aria-label="Print design canvas. Move, resize and rotate elements inside the green print area." />
        </div>
        <p className="mt-3 text-center text-xs text-[var(--muted)]">Green dashed line: print area · Red dashed line: bleed guide</p>
        {status && <p role="status" className="mt-4 rounded-xl bg-white/80 p-3 text-sm">{status}</p>}

        <div className="mt-6 grid gap-4 border-t border-black/10 pt-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block text-sm">
            <span className="mb-2 block text-[var(--muted)]">Design name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--accent)]"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canPersist || !ready || saving || !name.trim()}
              className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
            >
              {saving ? "Saving…" : "Save design"}
            </button>
          </div>
        </div>
        {saveMessage && (
          <p role="status" className="mt-3 flex flex-wrap items-center gap-3 text-sm font-medium">
            <span>{saveMessage}</span>
            {savedDesignId && returnHref && !dirty ? (
              <Link
                href={returnHref}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-dark)]"
              >
                Back to proof → Submit revision
              </Link>
            ) : savedDesignId && (
              <Link href="/account#designs-heading" className="text-[var(--accent)] underline underline-offset-4">
                View saved designs in Account →
              </Link>
            )}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/70 p-4">
          {returnHref ? (
            <>
              <p className="text-sm text-[var(--muted)]">
                {dirty
                  ? "Save your updated design before returning to your proof."
                  : "Design saved — return to your proof to generate the revised version."}
              </p>
              {!dirty && savedDesignId ? (
                <Link
                  href={returnHref}
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)]"
                >
                  Back to proof → Submit revision
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white opacity-40"
                >
                  Back to proof → Submit revision
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">
                {dirty
                  ? "Save your latest changes before checkout."
                  : canCheckout
                    ? "Your saved design is ready for checkout."
                    : "Save the design to attach it to your order."}
              </p>
              {canCheckout ? (
                <Link
                  href={`/checkout?${checkoutQuery}`}
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)]"
                >
                  Continue to checkout
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white opacity-40"
                >
                  Continue to checkout
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
