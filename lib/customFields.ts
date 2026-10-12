import { clampFieldPos, type FieldPos } from "./calibration";

/**
 * Multi-instance "Name" fields (custom text labels): unlike the built-in
 * FieldId union, any number of these can be placed per bank, each with its
 * own text, position, and style. All positions are mm from the cheque's
 * top-left — the same coordinate space the canvas and the printer share.
 */

export interface CustomTextField {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
  uppercase: boolean;
  align: "left" | "center";
  maxWidthMm?: number;
}

export const MAX_CUSTOM_FIELDS_PER_BANK = 30;
export const MAX_CUSTOM_TEXT_LENGTH = 200;
export const MAX_SAVED_NAMES = 200;
export const CUSTOM_FONT_SIZE_MIN = 6;
export const CUSTOM_FONT_SIZE_MAX = 40;
export const CUSTOM_MAX_WIDTH_MIN = 5;
export const CUSTOM_MAX_WIDTH_MAX = 200;

export function makeCustomFieldId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `name-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Validates one instance; returns null when the shape is unusable. */
export function sanitizeCustomField(raw: unknown): CustomTextField | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Partial<CustomTextField>;
  const fontSize = v.fontSize;
  if (
    typeof v.id !== "string" ||
    v.id.length < 1 ||
    typeof v.text !== "string" ||
    v.text.trim().length < 1 ||
    v.text.length > MAX_CUSTOM_TEXT_LENGTH ||
    !Number.isFinite(v.x) ||
    !Number.isFinite(v.y) ||
    typeof fontSize !== "number" ||
    !Number.isFinite(fontSize) ||
    fontSize < CUSTOM_FONT_SIZE_MIN ||
    fontSize > CUSTOM_FONT_SIZE_MAX ||
    typeof v.bold !== "boolean" ||
    typeof v.uppercase !== "boolean" ||
    (v.align !== "left" && v.align !== "center")
  ) {
    return null;
  }
  const { x, y } = clampFieldPos({ x: v.x as number, y: v.y as number });
  const field: CustomTextField = {
    id: v.id,
    text: v.text,
    x,
    y,
    fontSize: Math.round(fontSize * 10) / 10,
    bold: v.bold,
    uppercase: v.uppercase,
    align: v.align,
  };
  if (v.maxWidthMm !== undefined && v.maxWidthMm !== null) {
    const mw = v.maxWidthMm as number;
    if (
      Number.isFinite(mw) &&
      mw >= CUSTOM_MAX_WIDTH_MIN &&
      mw <= CUSTOM_MAX_WIDTH_MAX
    ) {
      field.maxWidthMm = Math.round(mw * 10) / 10;
    }
  }
  return field;
}

/** Validates a whole collection: bad entries dropped, count capped. */
export function sanitizeCustomFields(raw: unknown): CustomTextField[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomTextField[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_CUSTOM_FIELDS_PER_BANK) break;
    const clean = sanitizeCustomField(item);
    if (clean && !seen.has(clean.id)) {
      seen.add(clean.id);
      out.push(clean);
    }
  }
  return out;
}

/**
 * First candidate position that doesn't overlap an existing instance
 * (checked against a small bounding box), so click-spawned names stay
 * visible. Deterministic grid walk, mm units.
 */
export function spawnDefaultPosition(existing: CustomTextField[]): FieldPos {
  const candidates: FieldPos[] = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 10; col++) {
      candidates.push({ x: 25 + col * 17, y: 28 + row * 9 });
    }
  }
  for (const pos of candidates) {
    const overlaps = existing.some((f) => {
      const dx = Math.abs(f.x - pos.x);
      const dy = Math.abs(f.y - pos.y);
      return dx < 16 && dy < 7;
    });
    if (!overlaps) return pos;
  }
  return candidates[candidates.length - 1];
}

/** Duplicate offset: +5mm on both axes so the copy is clearly visible. */
export function offsetForDuplicate(pos: FieldPos): FieldPos {
  return clampFieldPos({ x: pos.x + 5, y: pos.y + 5 });
}

/** Validates the "Saved names" list: trimmed, deduped, capped. */
export function sanitizeSavedNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_SAVED_NAMES) break;
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (name.length < 1 || name.length > MAX_CUSTOM_TEXT_LENGTH) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
