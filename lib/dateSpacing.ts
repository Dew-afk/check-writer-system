/**
 * Date digit-spacing system (Task B): cheques have printed date boxes
 * (MM cells, a printed dash, DD cells, a printed dash, YYYY cells), so the
 * date prints as zero-padded DIGITS ONLY, each digit centered in its own
 * cell. Two per-bank spacings (mm):
 *   digitSpacing — center-to-center distance between digits in a group
 *   groupGap     — extra distance between groups, to jump the printed dash
 * Everything is mm-based, so screen, preview, and print are identical at
 * any zoom or printer scale.
 */

export type DateOrder = 'mmddyyyy' | 'ddmmyyyy' | 'yyyymmdd';

export interface DateSpacing {
  digitSpacing: number;
  groupGap: number;
  order: DateOrder;
}

export const DATE_ORDERS: DateOrder[] = ['mmddyyyy', 'ddmmyyyy', 'yyyymmdd'];

export const DATE_ORDER_LABELS: Record<DateOrder, string> = {
  mmddyyyy: 'MMDDYYYY',
  ddmmyyyy: 'DDMMYYYY',
  yyyymmdd: 'YYYYMMDD',
};

export const DEFAULT_DATE_SPACING: DateSpacing = {
  digitSpacing: 4.2,
  groupGap: 2.0,
  order: 'mmddyyyy',
};

export const MAX_DATE_SPACING_MM = 10;

export function isValidDateOrder(value: unknown): value is DateOrder {
  return (
    typeof value === 'string' &&
    (DATE_ORDERS as string[]).includes(value)
  );
}

/** Validates spacing values; returns null when anything is unusable. */
export function sanitizeDateSpacing(value: unknown): DateSpacing | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<DateSpacing>;
  if (
    !Number.isFinite(v.digitSpacing) ||
    !Number.isFinite(v.groupGap) ||
    !isValidDateOrder(v.order)
  ) {
    return null;
  }
  const digitSpacing = v.digitSpacing as number;
  const groupGap = v.groupGap as number;
  if (
    digitSpacing < 0 ||
    digitSpacing > MAX_DATE_SPACING_MM ||
    groupGap < 0 ||
    groupGap > MAX_DATE_SPACING_MM
  ) {
    return null;
  }
  return { digitSpacing, groupGap, order: v.order as DateOrder };
}

/** ISO date → digits only, zero-padded, in the bank's order. */
export function dateToDigits(iso: string, order: DateOrder): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '00000000';
  const [, yyyy, mm, dd] = match;
  switch (order) {
    case 'ddmmyyyy':
      return `${dd}${mm}${yyyy}`;
    case 'yyyymmdd':
      return `${yyyy}${mm}${dd}`;
    case 'mmddyyyy':
    default:
      return `${mm}${dd}${yyyy}`;
  }
}

/** Group sizes in DISPLAY order (e.g. mmddyyyy → [2, 2, 4]). */
export function dateGroupSizes(order: DateOrder): [number, number, number] {
  switch (order) {
    case 'ddmmyyyy':
      return [2, 2, 4];
    case 'yyyymmdd':
      return [4, 2, 2];
    case 'mmddyyyy':
    default:
      return [2, 2, 4];
  }
}

/** Monospace digit advance (≈0.6em) in mm for a given font size (pt). */
export function digitAdvanceMm(fontSizePt: number): number {
  return fontSizePt * 0.6 * 0.3528;
}

/**
 * Center offsets (mm, relative to the field's left edge) for the eight
 * digits. Inside a group, centers step by digitSpacing; across a group
 * boundary they step by digitSpacing + groupGap (jumping the printed dash).
 */
export function digitCenterOffsetsMm(
  spacing: DateSpacing,
  fontSizePt: number,
): number[] {
  const sizes = dateGroupSizes(spacing.order);
  const offsets: number[] = [];
  let cursor = digitAdvanceMm(fontSizePt) / 2;
  let digitIndex = 0;
  for (let g = 0; g < sizes.length; g++) {
    for (let i = 0; i < sizes[g]; i++) {
      if (digitIndex > 0) {
        cursor += spacing.digitSpacing + (i === 0 ? spacing.groupGap : 0);
      }
      offsets.push(cursor);
      digitIndex++;
    }
  }
  return offsets;
}

/** Total rendered width of the eight digits in mm. */
export function digitTotalWidthMm(
  spacing: DateSpacing,
  fontSizePt: number,
): number {
  const advance = digitAdvanceMm(fontSizePt);
  const centers = digitCenterOffsetsMm(spacing, fontSizePt);
  const last = centers[centers.length - 1] ?? 0;
  return last + advance / 2;
}
