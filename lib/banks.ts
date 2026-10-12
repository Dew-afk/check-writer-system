/**
 * Supported banks and their cheque print templates.
 *
 * TODO(calibration): ALL coordinates below are PLACEHOLDERS. They are NOT
 * measured from real cheque stock and will not line up. Measure each bank's
 * actual cheque with a ruler (docs/calibration.md, step 5) and replace them.
 * Sizes: standard Philippine cheque ≈ 203.2mm × 76.2mm (8" × 3").
 * Coordinates: x/y in mm from the TOP-LEFT corner; fontSize in points.
 */

import type { DateSpacing } from './dateSpacing';

export const BANK_IDS = [
  'aub',
  'pnb',
  'landbank',
  'metrobank',
  'bdo',
  'securitybank',
] as const;

export type BankId = (typeof BANK_IDS)[number];

/** Standard Philippine cheque size — field positions are clamped to this. */
export const CHEQUE_WIDTH_MM = 203.2;
export const CHEQUE_HEIGHT_MM = 76.2;

export interface Bank {
  id: BankId;
  name: string;
}

export const BANKS: Bank[] = [
  { id: 'aub', name: 'AUB' },
  { id: 'pnb', name: 'PNB' },
  { id: 'landbank', name: 'Landbank' },
  { id: 'metrobank', name: 'Metrobank' },
  { id: 'bdo', name: 'BDO' },
  { id: 'securitybank', name: 'Security Bank' },
];

export interface BankFieldDate {
  x: number;
  y: number;
  fontSize: number;
  format: string; // 'MM/DD/YYYY' for v1
}

export interface BankFieldPayee {
  x: number;
  y: number;
  fontSize: number;
  maxWidth: number;
}

export interface BankFieldAmountNum {
  x: number;
  y: number;
  fontSize: number;
}

export interface BankFieldAmountWords {
  x: number;
  y: number;
  fontSize: number;
  maxWidth: number;
  lines: number;
  lineHeight: number; // mm between lines
}

export interface BankFieldCrossing {
  x: number; // center of the two diagonal lines
  y: number;
  width: number; // line length in mm
  rotate: number; // degrees, positive = clockwise
  fontSize: number;
}

export interface BankTemplate {
  id: BankId;
  name: string;
  widthMm: number;
  heightMm: number;
  /** Factory date digit spacing for this bank (defaults in lib/dateSpacing.ts). */
  dateSpacing?: DateSpacing;
  fields: {
    date: BankFieldDate;
    payee: BankFieldPayee;
    amountNum: BankFieldAmountNum;
    amountWords: BankFieldAmountWords;
    crossing: BankFieldCrossing;
  };
}

/** Shared placeholder layout; each bank re-uses it until real measurements exist. */
const PLACEHOLDER_FIELDS: BankTemplate['fields'] = {
  date: { x: 145, y: 14, fontSize: 10, format: 'MM/DD/YYYY' },
  payee: { x: 20, y: 32, fontSize: 11, maxWidth: 118 },
  amountNum: { x: 158, y: 30, fontSize: 11 },
  amountWords: {
    x: 20,
    y: 44,
    fontSize: 9.5,
    maxWidth: 170,
    lines: 2,
    lineHeight: 4,
  },
  crossing: { x: 120, y: 38, width: 62, rotate: 20, fontSize: 7 },
};

export const BANK_TEMPLATES: Record<BankId, BankTemplate> = {
  aub: {
    id: 'aub',
    name: 'AUB',
    widthMm: CHEQUE_WIDTH_MM,
    heightMm: CHEQUE_HEIGHT_MM,
    // Tuned to the AUB scan's printed date cells (MM-DD-YYYY).
    dateSpacing: { digitSpacing: 4.4, groupGap: 2.0, order: 'mmddyyyy' },
    // Measured from the user's blank AUB scan (1834×704) — verify/drag.
    fields: {
      date: { x: 125, y: 4.5, fontSize: 9, format: 'MM/DD/YYYY' },
      payee: { x: 5, y: 21, fontSize: 12, maxWidth: 160 },
      amountNum: { x: 138, y: 35.5, fontSize: 11 },
      amountWords: {
        x: 38,
        y: 32.5,
        fontSize: 12,
        maxWidth: 95,
        lines: 2,
        lineHeight: 8,
      },
      crossing: { x: 102, y: 32.5, width: 55, rotate: 15, fontSize: 7 },
    },
  },
  pnb: {
    id: 'pnb',
    name: 'PNB',
    widthMm: CHEQUE_WIDTH_MM,
    heightMm: CHEQUE_HEIGHT_MM,
    // Measured from the user's blank PNB scan (1520×574) — verify/drag.
    fields: {
      date: { x: 167, y: 4, fontSize: 8, format: 'MM/DD/YYYY' },
      payee: { x: 5, y: 21, fontSize: 12, maxWidth: 150 },
      amountNum: { x: 174, y: 36, fontSize: 11 },
      amountWords: {
        x: 8,
        y: 35.5,
        fontSize: 12,
        maxWidth: 130,
        lines: 2,
        lineHeight: 8,
      },
      crossing: { x: 100, y: 40, width: 55, rotate: 15, fontSize: 7 },
    },
  },
  landbank: {
    id: 'landbank',
    name: 'Landbank',
    widthMm: CHEQUE_WIDTH_MM,
    heightMm: CHEQUE_HEIGHT_MM,
    // Tuned to the Landbank scan's printed date cells (MM-DD-YYYY).
    dateSpacing: { digitSpacing: 4.2, groupGap: 2.0, order: 'mmddyyyy' },
    // Measured from the user's blank Landbank scan (1952×718) — verify/drag.
    fields: {
      date: { x: 125, y: 3.5, fontSize: 8, format: 'MM/DD/YYYY' },
      payee: { x: 4, y: 24.5, fontSize: 12, maxWidth: 160 },
      amountNum: { x: 140, y: 35, fontSize: 11 },
      amountWords: {
        x: 12.5,
        y: 35,
        fontSize: 12,
        maxWidth: 120,
        lines: 2,
        lineHeight: 8,
      },
      crossing: { x: 99, y: 37, width: 55, rotate: 15, fontSize: 7 },
    },
  },
  metrobank: {
    id: 'metrobank',
    name: 'Metrobank',
    widthMm: CHEQUE_WIDTH_MM,
    heightMm: CHEQUE_HEIGHT_MM,
    // Measured from the user's Metrobank scan (1720×648, 16px left edge
    // cropped). The scan may be slightly skewed — drag fields to fine-tune.
    fields: {
      date: { x: 145, y: 2, fontSize: 8, format: 'MM/DD/YYYY' },
      payee: { x: 5, y: 24, fontSize: 12, maxWidth: 160 },
      amountNum: { x: 177, y: 24, fontSize: 11 },
      amountWords: {
        x: 38.5,
        y: 35,
        fontSize: 12,
        maxWidth: 95,
        lines: 2,
        lineHeight: 8,
      },
      crossing: { x: 99, y: 35, width: 55, rotate: 15, fontSize: 7 },
    },
  },
  bdo: { id: 'bdo', name: 'BDO', widthMm: CHEQUE_WIDTH_MM, heightMm: CHEQUE_HEIGHT_MM, fields: PLACEHOLDER_FIELDS },
  securitybank: {
    id: 'securitybank',
    name: 'Security Bank',
    widthMm: CHEQUE_WIDTH_MM,
    heightMm: CHEQUE_HEIGHT_MM,
    // Measured from the user's Security Bank image used AS-IS (640×263 with
    // its frame; displayed object-contain in the cheque canvas). Field
    // positions account for the frame and letterboxing. Verify against real
    // stock in step 5 — or just drag the fields into place.
    fields: {
      date: { x: 137, y: 8, fontSize: 8, format: 'MM/DD/YYYY' },
      payee: { x: 33, y: 25.8, fontSize: 12.5, maxWidth: 102 },
      amountNum: { x: 136.8, y: 33.9, fontSize: 12 },
      amountWords: {
        x: 18,
        y: 38.7,
        fontSize: 15,
        maxWidth: 76,
        lines: 2,
        lineHeight: 11,
      },
      crossing: { x: 115, y: 28, width: 55, rotate: 15, fontSize: 7 },
    },
  },
};

/**
 * Builds a TypeScript snippet for the current bank's layout (factory fields
 * merged with the given overrides) that can be pasted into BANK_TEMPLATES
 * to make these positions the permanent codebase default.
 */
export function copyLayoutAsCode(
  bankId: BankId,
  overrides: Partial<Record<string, { x: number; y: number }>>,
): string {
  const template = BANK_TEMPLATES[bankId];
  const moved = <T extends { x: number; y: number }>(key: string, base: T): T => {
    const override = overrides[key];
    return override
      ? { ...base, x: round1(override.x), y: round1(override.y) }
      : base;
  };
  const d = moved('date', template.fields.date);
  const p = moved('payee', template.fields.payee);
  const n = moved('amountNum', template.fields.amountNum);
  const w = moved('amountWords', template.fields.amountWords);
  const c = moved('crossing', template.fields.crossing);
  const one = (num: number) => `${Math.round(num * 10) / 10}`;
  return `    ${bankId}: {
    id: '${bankId}',
    name: '${template.name}',
    widthMm: CHEQUE_WIDTH_MM,
    heightMm: CHEQUE_HEIGHT_MM,
    // Pasted from PH Cheque Writer "Copy as code".
    fields: {
      date: { x: ${one(d.x)}, y: ${one(d.y)}, fontSize: ${one(d.fontSize)}, format: 'MM/DD/YYYY' },
      payee: { x: ${one(p.x)}, y: ${one(p.y)}, fontSize: ${one(p.fontSize)}, maxWidth: ${one(p.maxWidth)} },
      amountNum: { x: ${one(n.x)}, y: ${one(n.y)}, fontSize: ${one(n.fontSize)} },
      amountWords: {
        x: ${one(w.x)},
        y: ${one(w.y)},
        fontSize: ${one(w.fontSize)},
        maxWidth: ${one(w.maxWidth)},
        lines: ${w.lines},
        lineHeight: ${one(w.lineHeight)},
      },
      crossing: { x: ${one(c.x)}, y: ${one(c.y)}, width: ${one(c.width)}, rotate: ${one(c.rotate)}, fontSize: ${one(c.fontSize)} },
    },
  },`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
