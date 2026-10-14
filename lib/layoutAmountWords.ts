import type { PDFFont } from "pdf-lib";

/**
 * SINGLE SOURCE OF TRUTH for the amount-in-words layout (Fix 1). The canvas
 * overlay, the preview, and the printed PDF all call this with the same
 * pdf-lib font metrics — never character counts or CSS wrapping.
 *
 * Algorithm:
 *   1. Measure at the base font size. If it fits maxWidth → one line.
 *   2. Otherwise shrink in 0.25pt steps down to minFontSize (default 85% of
 *      the base, never below 8pt) and re-measure.
 *   3. Only then wrap at word boundaries into at most 2 lines, keeping the
 *      trailing "and NN/100 Only" as one unbreakable unit and preferring a
 *      balanced break. If it still doesn't fit → overflow: true.
 *
 * Line placement: lines stack UPWARD from the pre-printed line, so the
 * first rendered line is the topmost one and the last line sits on the
 * pre-printed line itself. `lineOffsetsMm[i]` is the Y offset (mm, positive
 * = down) of line i relative to the field's anchor position — renderers add
 * it to the field's Y instead of computing their own line positions.
 */

const MIN_FONT_PT = 8;
export const WORDS_MIN_FONT_RATIO = 0.85;

const PT_PER_MM = 72 / 25.4;
const MM_PER_PT = 25.4 / 72;

export interface AmountWordsLayoutInput {
  text: string;
  font: PDFFont;
  /** Base font size in points. */
  baseFontSize: number;
  /** Line width in mm. */
  maxWidthMm: number;
  /** Optional narrower width for the second line (default = maxWidthMm). */
  line2MaxWidthMm?: number;
}

export interface AmountWordsLayoutResult {
  lines: string[];
  /** The font size actually used (after shrinking), in points. */
  fontSize: number;
  /** True when the text cannot fit on 2 lines at the minimum size. */
  overflow: boolean;
  /** True when the text wrapped to a second line. */
  wrapped: boolean;
  /**
   * Y offset of each line in mm, relative to the field's anchor (positive =
   * down). One line → [0]. Two lines → [-spacing, 0]: the first line goes
   * ABOVE the pre-printed line, the last line sits ON it.
   */
  lineOffsetsMm: number[];
}

/** Distance between stacked lines (mm) for the given font size. */
export function wordsLineSpacingMm(fontSizePt: number): number {
  return Math.round(fontSizePt * 1.2 * MM_PER_PT * 100) / 100;
}

/** The trailing fraction ("and 50/100 Only") as one unbreakable unit. */
const UNIT_RE = /^(.*?)( and \d{2}\/100(?: Only)?)$/;

function widthMm(text: string, font: PDFFont, fontSize: number): number {
  return (font.widthOfTextAtSize(text, fontSize) / PT_PER_MM);
}

function minFontSize(base: number): number {
  return Math.max(MIN_FONT_PT, base * WORDS_MIN_FONT_RATIO);
}

export function layoutAmountWords(
  input: AmountWordsLayoutInput,
): AmountWordsLayoutResult {
  const { text, font, baseFontSize, maxWidthMm, line2MaxWidthMm } = input;
  const maxWidth2 = line2MaxWidthMm ?? maxWidthMm;

  // 1 + 2: try one line, shrinking in 0.25pt steps.
  let fontSize = baseFontSize;
  const minPt = minFontSize(baseFontSize);
  while (
    fontSize - 0.25 >= minPt - 0.001 &&
    widthMm(text, font, fontSize) > maxWidthMm
  ) {
    fontSize -= 0.25;
  }
  fontSize = Math.round(fontSize * 100) / 100;
  if (widthMm(text, font, fontSize) <= maxWidthMm) {
    return {
      lines: [text],
      fontSize,
      overflow: false,
      wrapped: false,
      lineOffsetsMm: [0],
    };
  }

  // 3: wrap into at most 2 lines. Keep "and NN/100 Only" unbreakable.
  const unit = UNIT_RE.exec(text);
  const bodyWords = (unit ? unit[1] : text).trim().split(/\s+/).filter(Boolean);
  const tail = unit ? unit[2].trim() : "";

  const fit = (words: string[]): boolean =>
    widthMm(words.join(" "), font, fontSize) <= maxWidthMm;

  // Greedy split, then balance by moving words to the shorter side.
  const line1: string[] = [];
  const rest = [...bodyWords];
  while (rest.length > 0 && fit([...line1, rest[0]])) {
    line1.push(rest.shift() as string);
  }
  let line2 = [...rest];
  if (tail) line2.push(tail);
  // Balance: move words from the longer line to the shorter when possible.
  for (let i = 0; i < bodyWords.length; i++) {
    if (line2.length === 0 || line1.length === 0) break;
    const w1 = widthMm(line1.join(" "), font, fontSize);
    const w2 = widthMm(line2.join(" "), font, fontSize);
    if (w1 <= w2) break;
    // Moving a word from line1 to line2 must keep line1 non-empty and
    // line2 within its width.
    const word = line1[line1.length - 1];
    const candidate = [word, ...line2];
    if (widthMm(candidate.join(" "), font, fontSize) <= maxWidth2) {
      line1.pop();
      line2 = candidate;
    } else {
      break;
    }
  }

  const lines = [line1.join(" "), line2.join(" ")].filter((l) => l.length > 0);
  const overflow =
    lines.length > 2 ||
    widthMm(lines[0] ?? "", font, fontSize) > maxWidthMm ||
    (lines.length > 1 &&
      widthMm(lines[1], font, fontSize) > maxWidth2);
  const wrapped = lines.length > 1;
  const spacing = wordsLineSpacingMm(fontSize);
  // Stack upward from the pre-printed line: the first (topmost) line is
  // offset upward, the last line sits exactly on the anchor.
  const lineOffsetsMm =
    lines.length <= 1 ? [0] : [-spacing, 0];
  return {
    lines: lines.slice(0, 2),
    fontSize,
    overflow,
    wrapped,
    lineOffsetsMm,
  };
}

/**
 * True when a rectangle (mm, top-left origin) intersects any keep-out
 * rectangle of pre-printed text/logos.
 */
export function intersectsKeepOut(
  rect: { x: number; y: number; w: number; h: number },
  keepOut: { x: number; y: number; w: number; h: number }[],
): boolean {
  return keepOut.some(
    (k) =>
      rect.x < k.x + k.w &&
      rect.x + rect.w > k.x &&
      rect.y < k.y + k.h &&
      rect.y + rect.h > k.y,
  );
}
