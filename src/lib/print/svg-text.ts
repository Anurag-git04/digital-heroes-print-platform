import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit, { type Font } from "@pdf-lib/fontkit";

type LoadedFontkitFonts = {
  regular: Font;
  bold: Font;
};

let cached: LoadedFontkitFonts | null = null;

function getFontkitFonts(): LoadedFontkitFonts {
  if (!cached) {
    const fontsDir = path.join(process.cwd(), "assets", "fonts");
    const regularBytes = readFileSync(path.join(fontsDir, "Inter-Regular.ttf"));
    const boldBytes = readFileSync(path.join(fontsDir, "Inter-Bold.ttf"));
    cached = {
      regular: fontkit.create(regularBytes),
      bold: fontkit.create(boldBytes),
    };
  }
  return cached;
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

export type SvgTextBlockParams = {
  text: string;
  cx: number;
  cy: number;
  boxWidthPx?: number;
  textAlign?: "left" | "center" | "right";
  fontSizePx: number;
  fontWeight: "400" | "700";
  fill: string;
  fillOpacity?: number;
  opacity?: number;
  rotation?: number;
  trackingPx?: number;
  lineHeightFactor?: number;
};

/**
 * Renders multi-line text directly as vector SVG `<path>` glyph outlines
 * using our bundled Inter TTF fonts via fontkit, honoring left/center/right alignment
 * inside `boxWidthPx` so proofs and 300 DPI PNGs match the Fabric.js canvas 1:1.
 *
 * This eliminates all reliance on OS/Linux system fonts (`librsvg` / `fontconfig`),
 * preventing missing-glyph "tofu" boxes (`□□□`) on Vercel serverless Linux containers.
 */
export function renderTextAsSvgPaths(params: SvgTextBlockParams): string {
  const fonts = getFontkitFonts();
  const font = params.fontWeight === "700" ? fonts.bold : fonts.regular;
  const scale = params.fontSizePx / font.unitsPerEm;
  const lineHeightFactor = params.lineHeightFactor ?? 1.2;
  const lineHeight = params.fontSizePx * lineHeightFactor;
  const trackingPx = params.trackingPx ?? 0;
  const align = params.textAlign ?? "center";
  const lines = (params.text || " ").split(/\r?\n/);
  const top = params.cy - (lines.length * lineHeight) / 2;

  const paths: string[] = [];

  lines.forEach((line, lineIndex) => {
    if (!line) return;
    const run = font.layout(line);
    const glyphs = run.glyphs;
    const positions = run.positions;

    let totalWidth = 0;
    for (let i = 0; i < glyphs.length; i++) {
      totalWidth += (positions[i]?.xAdvance ?? glyphs[i].advanceWidth) * scale;
      if (i < glyphs.length - 1) totalWidth += trackingPx;
    }

    const boxWidth = params.boxWidthPx ?? totalWidth;
    let cursorX: number;
    if (align === "left") {
      cursorX = params.cx - boxWidth / 2;
    } else if (align === "right") {
      cursorX = params.cx + boxWidth / 2 - totalWidth;
    } else {
      cursorX = params.cx - totalWidth / 2;
    }
    const baselineY = top + lineIndex * lineHeight + params.fontSizePx * 0.86;

    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      const pos = positions[i];
      const xOffset = (pos?.xOffset ?? 0) * scale;
      const yOffset = (pos?.yOffset ?? 0) * scale;
      const d = glyph.path.toSVG();

      if (d) {
        const gx = round(cursorX + xOffset);
        const gy = round(baselineY - yOffset);
        const s = round(scale);
        paths.push(`<path d="${d}" transform="translate(${gx} ${gy}) scale(${s} ${-s})"/>`);
      }

      cursorX += (pos?.xAdvance ?? glyph.advanceWidth) * scale + trackingPx;
    }
  });

  const rotation = params.rotation ?? 0;
  const transformAttr =
    Math.abs(rotation) > 0.001
      ? ` transform="rotate(${round(rotation)} ${round(params.cx)} ${round(params.cy)})"`
      : "";
  const opacityAttr =
    params.opacity !== undefined && params.opacity < 1 ? ` opacity="${params.opacity}"` : "";
  const fillOpacityAttr =
    params.fillOpacity !== undefined && params.fillOpacity < 1
      ? ` fill-opacity="${params.fillOpacity}"`
      : "";

  return (
    `<g data-text="${escapeXml(params.text)}" fill="${escapeXml(params.fill)}"${fillOpacityAttr}${opacityAttr}${transformAttr}>` +
    paths.join("") +
    `</g>`
  );
}
