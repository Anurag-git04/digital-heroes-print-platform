import { readFile } from "node:fs/promises";
import path from "node:path";

type BundledFonts = {
  regular: Uint8Array;
  bold: Uint8Array;
};

let cachedFonts: Promise<BundledFonts> | null = null;

async function readBundledFonts(): Promise<BundledFonts> {
  const fontsDir = path.join(process.cwd(), "assets", "fonts");
  const [regular, bold] = await Promise.all([
    readFile(path.join(fontsDir, "Inter-Regular.ttf")),
    readFile(path.join(fontsDir, "Inter-Bold.ttf")),
  ]);

  return {
    regular: new Uint8Array(regular),
    bold: new Uint8Array(bold),
  };
}

export function loadBundledFonts(): Promise<BundledFonts> {
  if (!cachedFonts) {
    cachedFonts = readBundledFonts().catch((error) => {
      cachedFonts = null;
      throw error;
    });
  }
  return cachedFonts;
}
