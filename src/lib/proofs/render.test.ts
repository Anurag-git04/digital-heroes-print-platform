import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { DesignDocument } from "@/lib/designer/model";
import { buildProofSvg, renderProofPng } from "./render";

const design: DesignDocument = {
  version: 1,
  productId: "prod-1",
  templateId: "tpl-1",
  widthMm: 100,
  heightMm: 50,
  printArea: { x: 3, y: 3, w: 94, h: 44 },
  elements: [
    {
      id: "headline",
      kind: "placeholder",
      placeholderId: "headline",
      xMm: 50,
      yMm: 25,
      widthMm: 60,
      heightMm: 12,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      text: 'Fish & <Chips> "Ltd"',
      fontFamily: "Inter",
      fontSizeMm: 8,
      fontWeight: "700",
      fill: "#111111",
      trackingMm: 0,
    },
    {
      id: "logo",
      kind: "image",
      xMm: 20,
      yMm: 25,
      widthMm: 10,
      heightMm: 10,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      imagePath: "user-1/logo.png",
      mimeType: "application/postscript",
      renderable: false,
      label: "AI artwork - production render required",
    },
  ],
};

describe("proof rendering", () => {
  it("escapes text, draws the print area guide, version watermark and non-renderable placeholder", () => {
    const svg = buildProofSvg(design, { version: 2, images: new Map() });

    expect(svg).toContain("Fish &amp; &lt;Chips&gt; &quot;Ltd&quot;");
    expect(svg).not.toContain("<Chips>");
    expect(svg).toContain("PROOF v2");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("AI artwork - production render required");
  });

  it("renders a PNG sized from the millimetre dimensions", async () => {
    const png = await renderProofPng(design, { version: 1, images: new Map() });
    const meta = await sharp(png).metadata();

    expect(meta.format).toBe("png");
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(400);
    // First SVG render can be slow while the system font cache warms up.
  }, 60_000);
});
