import { CHEQUE_HEIGHT_MM, CHEQUE_WIDTH_MM } from "./banks";

/**
 * Unified print pipeline (Fix 2): one generator driven by a PrintLayout.
 * The cheque content is always drawn in its native mm coordinate space on an
 * embedded cheque-size page; the carrier page places/rotates that page via
 * the preset, orientation, rotation, anchor, and fine offset below.
 */

export type PaperPreset =
  | "a4"
  | "letter"
  | "legal"
  | "folio"
  | "a5"
  | "cheque"
  | "custom";

export type PrintOrientation = "portrait" | "landscape";

/** 0 = none, 90 = clockwise, 270 = counter-clockwise, 180 = upside down. */
export type ContentRotation = 0 | 90 | 180 | 270;

export type AnchorX = "left" | "center" | "right";
export type AnchorY = "top" | "middle" | "bottom";

export interface PrintLayout {
  paperPreset: PaperPreset;
  /** Custom paper width/height in mm (paperPreset = "custom"). */
  customWidthMm?: number;
  customHeightMm?: number;
  orientation: PrintOrientation;
  contentRotation: ContentRotation;
  anchorX: AnchorX;
  anchorY: AnchorY;
  /** Fine offset in mm, applied after the anchor grid. */
  offsetMm: { x: number; y: number };
}

export const DEFAULT_PRINT_LAYOUT: PrintLayout = {
  paperPreset: "a4",
  orientation: "portrait",
  contentRotation: 0,
  anchorX: "center",
  anchorY: "middle",
  offsetMm: { x: 0, y: 0 },
};

export const PAPER_PRESET_LABELS: Record<PaperPreset, string> = {
  a4: "A4 (210 × 297 mm)",
  letter: "Letter / Short (215.9 × 279.4 mm)",
  legal: "Legal (215.9 × 355.6 mm)",
  folio: "Long / Folio 8.5 × 13 (215.9 × 330.2 mm)",
  a5: "A5 (148 × 210 mm)",
  cheque: "Cheque size (custom)",
  custom: "Custom W × H mm",
};

export const PAPER_SIZES_MM: Record<Exclude<PaperPreset, "custom">, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
  legal: { w: 215.9, h: 355.6 },
  folio: { w: 215.9, h: 330.2 },
  a5: { w: 148, h: 210 },
  cheque: { w: CHEQUE_WIDTH_MM, h: CHEQUE_HEIGHT_MM },
};

export function isValidRotation(value: unknown): value is ContentRotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

/** Validates a stored layout; returns null when anything is unusable. */
export function sanitizePrintLayout(value: unknown): PrintLayout | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<PrintLayout>;
  if (
    !v.paperPreset ||
    !(Object.keys(PAPER_PRESET_LABELS) as string[]).includes(v.paperPreset)
  ) {
    return null;
  }
  const orientation: PrintOrientation =
    v.orientation === "landscape" ? "landscape" : "portrait";
  if (!isValidRotation(v.contentRotation)) return null;
  const anchorX: AnchorX =
    v.anchorX === "left" || v.anchorX === "right" ? v.anchorX : "center";
  const anchorY: AnchorY =
    v.anchorY === "top" || v.anchorY === "bottom" ? v.anchorY : "middle";
  const layout: PrintLayout = {
    paperPreset: v.paperPreset as PaperPreset,
    orientation,
    contentRotation: v.contentRotation,
    anchorX,
    anchorY,
    offsetMm: { x: 0, y: 0 },
  };
  if (v.paperPreset === "custom") {
    const w = v.customWidthMm;
    const h = v.customHeightMm;
    if (
      typeof w !== "number" || !Number.isFinite(w) || w < 50 || w > 500 ||
      typeof h !== "number" || !Number.isFinite(h) || h < 50 || h > 500
    ) {
      return null;
    }
    layout.customWidthMm = w;
    layout.customHeightMm = h;
  }
  const ox = v.offsetMm;
  if (ox && typeof ox === "object" && Number.isFinite(ox.x) && Number.isFinite(ox.y)) {
    layout.offsetMm = {
      x: Math.min(200, Math.max(-200, ox.x as number)),
      y: Math.min(200, Math.max(-200, ox.y as number)),
    };
  }
  return layout;
}

export interface PaperPage {
  widthMm: number;
  heightMm: number;
}

/** Page size after orientation, including custom sizes. The cheque preset is
 *  always native size — orientation only matters for carrier papers. */
export function paperPageMm(layout: PrintLayout): PaperPage {
  if (layout.paperPreset === "cheque") {
    return { widthMm: CHEQUE_WIDTH_MM, heightMm: CHEQUE_HEIGHT_MM };
  }
  if (layout.paperPreset === "custom") {
    const w = layout.customWidthMm ?? 210;
    const h = layout.customHeightMm ?? 297;
    return layout.orientation === "landscape" ? { widthMm: h, heightMm: w } : { widthMm: w, heightMm: h };
  }
  const size = PAPER_SIZES_MM[layout.paperPreset];
  return layout.orientation === "landscape"
    ? { widthMm: size.h, heightMm: size.w }
    : { widthMm: size.w, heightMm: size.h };
}

/** The cheque's on-page footprint after content rotation. */
export function rotatedChequeSize(
  rotation: ContentRotation,
): { widthMm: number; heightMm: number } {
  return rotation === 90 || rotation === 270
    ? { widthMm: CHEQUE_HEIGHT_MM, heightMm: CHEQUE_WIDTH_MM }
    : { widthMm: CHEQUE_WIDTH_MM, heightMm: CHEQUE_HEIGHT_MM };
}

export interface PlacedCheque {
  /** Top-left of the cheque's bounding box on the page, mm. */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fits: boolean;
}

/** Anchor grid + fine offset; returns the placement and a fit check. */
export function placeChequeOnPage(
  layout: PrintLayout,
  page: PaperPage,
): PlacedCheque {
  const rotated = rotatedChequeSize(layout.contentRotation);
  const margin = 2; // mm breathing room
  const x = (() => {
    switch (layout.anchorX) {
      case "left":
        return margin;
      case "right":
        return page.widthMm - rotated.widthMm - margin;
      case "center":
      default:
        return (page.widthMm - rotated.widthMm) / 2;
    }
  })();
  const y = (() => {
    switch (layout.anchorY) {
      case "top":
        return margin;
      case "bottom":
        return page.heightMm - rotated.heightMm - margin;
      case "middle":
      default:
        return (page.heightMm - rotated.heightMm) / 2;
    }
  })();
  const xMm = x + layout.offsetMm.x;
  const yMm = y + layout.offsetMm.y;
  const fits =
    xMm >= 0 &&
    yMm >= 0 &&
    xMm + rotated.widthMm <= page.widthMm &&
    yMm + rotated.heightMm <= page.heightMm;
  return {
    xMm,
    yMm,
    widthMm: rotated.widthMm,
    heightMm: rotated.heightMm,
    fits,
  };
}
