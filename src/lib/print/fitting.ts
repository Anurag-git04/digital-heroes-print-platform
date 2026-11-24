/**
 * Unit conversions and per-placeholder text fitting (shrink-to-fit + horizontal tracking).
 * Pure logic so it can be unit-tested with either a real pdf-lib PDFFont or a mock measurer.
 */

export const PT_PER_INCH = 72;
export const MM_PER_INCH = 25.4;

export function mmToPt(mm: number): number {
  return (mm * PT_PER_INCH) / MM_PER_INCH;
}

export function ptToMm(pt: number): number {
  return (pt * MM_PER_INCH) / PT_PER_INCH;
}

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / MM_PER_INCH);
}

export interface FontMeasurer {
  widthOfTextAtSize(text: string, size: number): number;
}

export type FitTextOptions = {
  requestedSizePt: number;
  minSizePt: number;
  maxSizePt: number;
  maxWidthPt: number;
  maxHeightPt: number;
  baseTrackingPt?: number;
  lineHeightFactor?: number;
};

export type FitTextResult = {
  fontSizePt: number;
  trackingPt: number;
  measuredWidthPt: number;
  measuredHeightPt: number;
  fits: boolean;
};

export function measureLineWidthPt(
  line: string,
  font: FontMeasurer,
  fontSizePt: number,
  trackingPt: number,
): number {
  if (!line) return 0;
  const baseWidth = font.widthOfTextAtSize(line, fontSizePt);
  const gaps = Math.max(0, line.length - 1);
  return baseWidth + gaps * trackingPt;
}

/**
 * Fits text inside (maxWidthPt x maxHeightPt):
 * 1. Starts from requestedSizePt clamped to [minSizePt, maxSizePt].
 * 2. Shrinks font size down to minSizePt until every line fits within maxWidthPt and total height <= maxHeightPt.
 * 3. If still wider than maxWidthPt at minSizePt, tightens horizontal tracking down to a readable floor (-12% of font size).
 */
export function fitTextToBox(
  text: string,
  font: FontMeasurer,
  options: FitTextOptions,
): FitTextResult {
  const lines = (text || " ").split(/\r?\n/);
  const lineHeightFactor = options.lineHeightFactor ?? 1.2;
  const minSizePt = Math.max(1, Math.min(options.minSizePt, options.maxSizePt));
  const maxSizePt = Math.max(minSizePt, options.maxSizePt);
  const startSizePt = Math.min(maxSizePt, Math.max(minSizePt, options.requestedSizePt));
  const baseTrackingPt = options.baseTrackingPt ?? 0;

  let chosenSize = minSizePt;
  let chosenTracking = baseTrackingPt;
  let fittedBySize = false;

  // Step 1: Shrink font size in 0.25pt increments from startSizePt down to minSizePt.
  for (let size = startSizePt; size >= minSizePt - 0.001; size -= 0.25) {
    const candidate = Math.max(minSizePt, Math.round(size * 100) / 100);
    const totalHeight = lines.length * candidate * lineHeightFactor;
    const widest = Math.max(
      ...lines.map((line) => measureLineWidthPt(line, font, candidate, baseTrackingPt)),
    );

    if (widest <= options.maxWidthPt + 0.01 && totalHeight <= options.maxHeightPt + 0.01) {
      chosenSize = candidate;
      chosenTracking = baseTrackingPt;
      fittedBySize = true;
      break;
    }

    if (candidate <= minSizePt) {
      break;
    }
  }

  // Step 2: If still too wide at minSizePt, tighten horizontal tracking.
  if (!fittedBySize) {
    chosenSize = minSizePt;
    const minTrackingPt = -chosenSize * 0.12;
    let requiredTracking = baseTrackingPt;

    for (const line of lines) {
      const gaps = Math.max(0, line.length - 1);
      if (gaps === 0) continue;
      const baseWidth = font.widthOfTextAtSize(line, chosenSize);
      if (baseWidth + gaps * baseTrackingPt > options.maxWidthPt) {
        const needed = (options.maxWidthPt - baseWidth) / gaps;
        requiredTracking = Math.min(requiredTracking, needed);
      }
    }

    chosenTracking = Math.max(minTrackingPt, Math.min(baseTrackingPt, requiredTracking));
  }

  const measuredWidthPt = Math.max(
    ...lines.map((line) => measureLineWidthPt(line, font, chosenSize, chosenTracking)),
  );
  const measuredHeightPt = lines.length * chosenSize * lineHeightFactor;
  const fits =
    measuredWidthPt <= options.maxWidthPt + 0.5 &&
    measuredHeightPt <= options.maxHeightPt + 0.5;

  return {
    fontSizePt: Math.round(chosenSize * 100) / 100,
    trackingPt: Math.round(chosenTracking * 1000) / 1000,
    measuredWidthPt: Math.round(measuredWidthPt * 100) / 100,
    measuredHeightPt: Math.round(measuredHeightPt * 100) / 100,
    fits,
  };
}
