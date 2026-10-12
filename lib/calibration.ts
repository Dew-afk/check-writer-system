import { CHEQUE_HEIGHT_MM, CHEQUE_WIDTH_MM } from "./banks";
import type { Offset } from "./storage";

/**
 * Calibration math shared by the Calibrate page and the canvas: offset
 * clamping/rounding, mm→percentage conversion, and per-field position
 * overrides (drag-to-move on the cheque).
 */

export const MAX_OFFSET_MM = 10;
export const OFFSET_STEP_MM = 0.1;

/** The five movable fields of a cheque template. */
export type FieldId = "date" | "payee" | "amountNum" | "amountWords" | "crossing";

export const FIELD_IDS: FieldId[] = [
  "date",
  "payee",
  "amountNum",
  "amountWords",
  "crossing",
];

/** Per-field position override (mm, top-left origin). */
export type FieldPos = { x: number; y: number };

/** A bank's set of field-position overrides. */
export type FieldOverrides = Partial<Record<FieldId, FieldPos>>;

/** Rounds to the 0.1mm slider step. */
export function roundOffset(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Rounds and clamps a single axis to ±MAX_OFFSET_MM. */
export function clampOffset(value: number): number {
  return Math.min(MAX_OFFSET_MM, Math.max(-MAX_OFFSET_MM, roundOffset(value)));
}

/** Returns a valid offset for storage (both axes clamped and rounded). */
export function sanitizeOffset(offset: Offset): Offset {
  return { x: clampOffset(offset.x), y: clampOffset(offset.y) };
}

/**
 * Converts a field position in mm (top-left origin) plus the calibration
 * offset into percentages of the cheque, for absolutely-positioned preview
 * elements inside a scaled-down cheque outline.
 */
export function fieldPositionPct(
  fieldX: number,
  fieldY: number,
  offset: Offset,
  widthMm: number,
  heightMm: number,
): { left: number; top: number } {
  return {
    left: ((fieldX + offset.x) / widthMm) * 100,
    top: ((fieldY + offset.y) / heightMm) * 100,
  };
}

/** Font size in points → container-query units so text scales with the canvas. */
export function ptToCqw(pt: number, widthMm: number): string {
  return `${((pt * 96) / 72 / 3.779 / widthMm) * 100}cqw`;
}

/**
 * Resolves a field's final position: the per-field override wins, otherwise
 * the template value. Rounded to the 0.1mm step.
 */
export function resolveFieldPos(
  templatePos: FieldPos,
  override: FieldPos | undefined,
): FieldPos {
  if (!override) return templatePos;
  return { x: roundOffset(override.x), y: roundOffset(override.y) };
}

/** Clamps a field position to the cheque bounds (0..203.2 × 0..76.2 mm). */
export function clampFieldPos(
  pos: FieldPos,
  widthMm: number = CHEQUE_WIDTH_MM,
  heightMm: number = CHEQUE_HEIGHT_MM,
): FieldPos {
  return {
    x: Math.min(widthMm, Math.max(0, roundOffset(pos.x))),
    y: Math.min(heightMm, Math.max(0, roundOffset(pos.y))),
  };
}

/** Snaps a position to the given mm grid. */
export function snapToGrid(pos: FieldPos, gridMm: number): FieldPos {
  if (gridMm <= 0) return pos;
  return {
    x: Math.round(pos.x / gridMm) * gridMm,
    y: Math.round(pos.y / gridMm) * gridMm,
  };
}

/** Screen px → mm scale for a canvas rendered at rectPx pixels wide. */
export function mmPerPx(rectPx: number, chequeMm: number): number {
  return rectPx > 0 ? chequeMm / rectPx : 0;
}

/** Converts a pixel drag delta to mm (zoom/window-size independent). */
export function pxDeltaToMm(
  deltaPx: number,
  rectPx: number,
  chequeMm: number,
): number {
  return deltaPx * mmPerPx(rectPx, chequeMm);
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** True once the pointer moved further than the click-vs-drag threshold. */
export function exceedsDragThreshold(
  start: ScreenPoint,
  current: ScreenPoint,
  thresholdPx = 4,
): boolean {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return Math.hypot(dx, dy) > thresholdPx;
}

/** Converts a screen drop point to cheque mm (top-left origin). */
export function dropPointToMm(
  clientX: number,
  clientY: number,
  rect: ScreenRect,
  widthMm: number = CHEQUE_WIDTH_MM,
  heightMm: number = CHEQUE_HEIGHT_MM,
): FieldPos {
  return {
    x: (clientX - rect.left) * mmPerPx(rect.width, widthMm),
    y: (clientY - rect.top) * mmPerPx(rect.height, heightMm),
  };
}

/** Rough rendered size of a field in mm (0.5em/char avg, cap-height tall). */
export function estimateFieldSizeMm(
  fieldId: FieldId,
  textChars: number,
  fontSizePt: number,
): { widthMm: number; heightMm: number } {
  if (fieldId === 'crossing') {
    // Crossing renders as two lines + text; treat as a 30×10mm block.
    return { widthMm: 30, heightMm: 10 };
  }
  if (fieldId === 'amountWords') {
    return {
      widthMm: textChars * fontSizePt * 0.5 * 0.3528,
      heightMm: fontSizePt * 2 * 0.3528 * 1.2,
    };
  }
  return {
    widthMm: textChars * fontSizePt * 0.5 * 0.3528,
    heightMm: fontSizePt * 0.3528 * 1.2,
  };
}

/**
 * Anchors a dropped position: boxed fields (date, amount) center on the
 * drop point; text fields (payee, words) put their baseline-left there.
 */
export function anchorFieldPos(
  fieldId: FieldId,
  dropMm: FieldPos,
  textChars: number,
  fontSizePt: number,
): FieldPos {
  const size = estimateFieldSizeMm(fieldId, textChars, fontSizePt);
  if (fieldId === 'date' || fieldId === 'amountNum') {
    return { x: dropMm.x - size.widthMm / 2, y: dropMm.y - size.heightMm / 2 };
  }
  if (fieldId === 'crossing') {
    return { x: dropMm.x - size.widthMm / 2, y: dropMm.y - size.heightMm / 2 };
  }
  // Text fields: baseline-left → shift the top up by ~3/4 cap height.
  return { x: dropMm.x, y: dropMm.y - fontSizePt * 0.3528 * 0.75 };
}

/**
 * Keeps only valid, in-bounds field overrides — malformed entries are
 * dropped individually so one bad value can't wipe a bank's whole layout.
 */
export function cleanFieldOverrides(raw: unknown): FieldOverrides {
  if (!raw || typeof raw !== 'object') return {};
  const record = raw as Record<string, unknown>;
  const out: FieldOverrides = {};
  for (const fieldId of FIELD_IDS) {
    const value = record[fieldId] as FieldPos | undefined;
    if (
      value &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y) &&
      value.x >= 0 &&
      value.x <= CHEQUE_WIDTH_MM &&
      value.y >= 0 &&
      value.y <= CHEQUE_HEIGHT_MM
    ) {
      out[fieldId] = clampFieldPos(value);
    }
  }
  return out;
}

/**
 * Approximate word wrap for the canvas overlay (visual only — the printed
 * PDF uses real font metrics in generatePdf.ts). Assumes ~0.5em per
 * character and truncates with an ellipsis beyond maxLines.
 */
export function approxWrapText(
  text: string,
  maxWidthMm: number,
  fontSizePt: number,
  maxLines: number,
): string[] {
  const avgCharMm = (fontSizePt * 0.5 * 25.4) / 72;
  const maxChars = Math.max(10, Math.floor(maxWidthMm / avgCharMm));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  while (lines.length > maxLines) {
    lines.splice(maxLines - 1, 2, `${lines[maxLines - 1]}…`);
  }
  return lines.slice(0, maxLines);
}
