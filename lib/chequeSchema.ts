import { z } from 'zod';

import { MAX_AMOUNT } from './amountToWords';
import { BANK_IDS } from './banks';

/** Bank identifiers; the selected bank picks which print template to use. */
export const bankIdSchema = z.enum(BANK_IDS);

/** Crossing options, shown in the order of the dropdown. */
export const CROSSINGS = {
  none: 'None',
  'account-payee-only': 'Account Payee Only',
  'cross-ac-payee-or-bearer': 'Cross A/C Payee + Or Bearer',
  'not-negotiable': 'Not Negotiable',
} as const;

export const crossingSchema = z.enum([
  'none',
  'account-payee-only',
  'cross-ac-payee-or-bearer',
  'not-negotiable',
]);

export type Crossing = z.infer<typeof crossingSchema>;

/** Printed text inside the crossing lines (kept out of generatePdf so the UI
 *  can show it without pulling pdf-lib into the page bundle). */
export const CROSSING_PRINT_TEXT: Record<Exclude<Crossing, 'none'>, string> = {
  'account-payee-only': 'ACCOUNT PAYEE ONLY',
  'cross-ac-payee-or-bearer': 'CROSS A/C PAYEE + OR BEARER',
  'not-negotiable': 'NOT NEGOTIABLE',
};

/** Wording capitalization styles (matches amountToWords options). */
export const CAPITALIZATIONS = {
  title: 'Title Case',
  upper: 'UPPERCASE',
  lower: 'lowercase',
} as const;

export const capitalizationSchema = z.enum(['title', 'upper', 'lower']);

export type Capitalization = z.infer<typeof capitalizationSchema>;

/** Payee names as printed on the cheque. */
export const payeeSchema = z.string().trim().min(1).max(120);

/** Peso amounts as printed on the cheque. */
export const amountSchema = z
  .number()
  .finite()
  .min(0)
  .max(MAX_AMOUNT)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    'at most 2 decimal places',
  );

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Strict ISO date check (rejects rollovers like 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_RE, 'must be YYYY-MM-DD')
  .refine(isValidIsoDate, 'not a valid calendar date');

/**
 * Parses free-typed amount text into a number, or null when invalid.
 * Accepts "1234.56", "1,234.56", ".50"; commas are only accepted as
 * thousand separators, and at most 2 decimals are allowed.
 */
const AMOUNT_TEXT_RE = /^(\d{1,3}(,\d{3})*|\d*)(\.\d{0,2})?$/;

export function parseAmountText(text: string): number | null {
  const cleaned = text.trim();
  if (!/\d/.test(cleaned) || !AMOUNT_TEXT_RE.test(cleaned)) return null;
  const value = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

export type DateWarning = 'postdated' | 'stale';

/**
 * Gentle warnings (never blocks printing): post-dated, or more than
 * 6 months old. Dates are compared at local midnight.
 */
export function getDateWarnings(
  isoDate: string,
  today: Date = new Date(),
): DateWarning[] {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const cutoff = new Date(
    startOfToday.getFullYear(),
    startOfToday.getMonth() - 6,
    startOfToday.getDate(),
  );

  const warnings: DateWarning[] = [];
  if (date > startOfToday) warnings.push('postdated');
  if (date < cutoff) warnings.push('stale');
  return warnings;
}

/** Date → "YYYY-MM-DD" in local time. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" → "MM/DD/YYYY" for display. */
export function formatIsoDateUs(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}
