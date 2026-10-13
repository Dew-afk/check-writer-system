/**
 * Converts a peso amount into the wording printed on a Philippine cheque.
 *
 * English only for v1. The word tables live at the top of this file so a
 * Filipino wording variant can be added later without touching the logic.
 *
 * Examples:
 *   1234.5   → "One Thousand Two Hundred Thirty-Four Pesos and 50/100 Only"
 *   1        → "One Peso and 00/100 Only"
 *   0.05     → "Zero Pesos and 05/100 Only"
 *   1000000  → "One Million Pesos and 00/100 Only"
 */

export const MAX_AMOUNT = 999_999_999.99;

/** Integer centavos corresponding to MAX_AMOUNT (exact in a double). */
const MAX_CENTAVOS = 99_999_999_999;

export type Capitalization = 'title' | 'upper' | 'lower';

export type AmountToWordsOptions = {
  /** Capitalization style of the wording. Defaults to 'title' ("One Thousand ..."). */
  capitalization?: Capitalization;
  /** Whether to append the word "Only". Defaults to true. */
  suffixOnly?: boolean;
  /**
   * Omits "and 00/100" for whole-peso amounts ("One Hundred Pesos Only").
   * The fraction still appears whenever there are centavos. Defaults to
   * false — "and 00/100" is the standard Philippine cheque format.
   */
  omitZeroCentavos?: boolean;
};

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
] as const;

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
] as const;

/** Thousand-group scales; index 0 = ones, 1 = thousand, 2 = million, 3 = billion. */
const SCALES = ['', 'Thousand', 'Million', 'Billion'] as const;

/** Words for a 0–999 group, e.g. 305 → "Three Hundred Five". */
function groupToWords(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;

  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} Hundred`);
  }
  if (rest >= 20) {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    parts.push(ones === 0 ? TENS[tens] : `${TENS[tens]}-${ONES[ones]}`);
  } else if (rest > 0) {
    parts.push(ONES[rest]);
  }
  return parts.join(' ');
}

/**
 * Converts a peso amount (e.g. 1234.5) into Philippine cheque wording.
 *
 * Throws if the amount is not a finite number, is negative, or exceeds
 * MAX_AMOUNT after rounding to the nearest centavo.
 */
export function amountToWords(
  amount: number,
  options: AmountToWordsOptions = {},
): string {
  if (!Number.isFinite(amount)) {
    throw new TypeError(`amount must be a finite number, got ${amount}`);
  }
  if (amount < 0) {
    throw new RangeError(`amount must not be negative, got ${amount}`);
  }

  // Work in integer centavos so rounding is exact and free of float drift.
  // Number.EPSILON nudges values like 1.005 over the half-centavo boundary.
  const totalCentavos = Math.round((amount + Number.EPSILON) * 100);
  if (totalCentavos > MAX_CENTAVOS) {
    throw new RangeError(`amount must not exceed ${MAX_AMOUNT}, got ${amount}`);
  }

  const pesos = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  // Split the peso part into thousand groups (millions → thousands → ones).
  const groups: string[] = [];
  let remaining = pesos;
  let scale = 0;
  while (remaining > 0) {
    const group = remaining % 1000;
    if (group > 0) {
      const words = groupToWords(group);
      groups.unshift(SCALES[scale] ? `${words} ${SCALES[scale]}` : words);
    }
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }

  const pesosWords = groups.length > 0 ? groups.join(' ') : 'Zero';
  const pesosLabel = pesos === 1 ? 'Peso' : 'Pesos';

  let wording: string;
  if (options.omitZeroCentavos && centavos === 0) {
    wording = `${pesosWords} ${pesosLabel}`;
  } else {
    const centavosWords = `${String(centavos).padStart(2, '0')}/100`;
    wording = `${pesosWords} ${pesosLabel} and ${centavosWords}`;
  }
  if (options.suffixOnly !== false) {
    wording += ' Only';
  }

  switch (options.capitalization) {
    case 'upper':
      return wording.toUpperCase();
    case 'lower':
      return wording.toLowerCase();
    case 'title':
    default:
      return wording;
  }
}

/**
 * UI-safe wrapper: returns null instead of throwing when the amount is out
 * of range, so dialogs and previews can show a friendly message instead of
 * crashing the render.
 */
export function safeAmountToWords(
  amount: number,
  options: AmountToWordsOptions = {},
): string | null {
  try {
    return amountToWords(amount, options);
  } catch {
    return null;
  }
}
