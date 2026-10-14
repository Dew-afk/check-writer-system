import { describe, expect, it } from "vitest";

import { amountToWords } from "./amountToWords";
import { BANK_TEMPLATES, type BankId } from "./banks";
import { getHelveticaFont } from "./fontMetrics";
import {
  intersectsKeepOut,
  layoutAmountWords,
  wordsLineSpacingMm,
} from "./layoutAmountWords";

const AUB_SAMPLE =
  "Twelve Thousand Two Hundred Twenty-Two Pesos and 00/100 Only";
const BIG_SAMPLE = "One Hundred Twenty Million Pesos and 50/100 Only";
const LONGEST = "Nine Hundred Ninety-Nine Million Nine Hundred Ninety-Nine Thousand Nine Hundred Ninety-Nine Pesos and 99/100 Only";

async function layoutFor(bankId: BankId, text: string) {
  const font = await getHelveticaFont();
  const words = BANK_TEMPLATES[bankId].fields.amountWords;
  return layoutAmountWords({
    text,
    font,
    baseFontSize: words.fontSize,
    maxWidthMm: words.maxWidth,
  });
}

describe("layoutAmountWords — one line whenever the real line allows", () => {
  it("fits both samples on one line on all six banks", async () => {
    for (const bankId of Object.keys(BANK_TEMPLATES) as BankId[]) {
      for (const text of [AUB_SAMPLE, BIG_SAMPLE]) {
        const layout = await layoutFor(bankId, text);
        expect(
          layout.lines.length,
          `${bankId}: ${text.slice(0, 30)}…`,
        ).toBe(1);
        expect(layout.overflow).toBe(false);
      }
    }
  });

  it("never produces more than 2 lines; overflow flags the rest", async () => {
    for (const bankId of Object.keys(BANK_TEMPLATES) as BankId[]) {
      const layout = await layoutFor(bankId, LONGEST);
      expect(layout.lines.length).toBeLessThanOrEqual(2);
      if (layout.lines.length > 2) expect(layout.overflow).toBe(true);
    }
  });

  it("keeps 'and NN/100 Only' as an unbreakable unit", async () => {
    const font = await getHelveticaFont();
    const narrow = { baseFontSize: 12, maxWidthMm: 50, line2MaxWidthMm: 50 };
    const layout = layoutAmountWords({ text: AUB_SAMPLE, font, ...narrow });
    expect(layout.wrapped).toBe(true);
    const joined = layout.lines.join(" ");
    expect(joined).toContain("and 00/100 Only");
    // The unit is never split across the two lines.
    for (const line of layout.lines) {
      expect(
        line.endsWith("and 00/100 Only") || !line.includes(" and "),
      ).toBe(true);
    }
  });

  it("shrinks the font before wrapping", async () => {
    const font = await getHelveticaFont();
    // Text that nearly fits: at 12pt it needs ~127mm; at 11.75 it fits 120.
    const base = layoutAmountWords({
      text: AUB_SAMPLE,
      font,
      baseFontSize: 12,
      maxWidthMm: 120,
    });
    expect(base.lines).toHaveLength(1);
    expect(base.fontSize).toBeLessThan(12);
    expect(base.fontSize).toBeGreaterThanOrEqual(12 * 0.85);
  });

  it("never shrinks below 8pt or 85% of the base", async () => {
    const font = await getHelveticaFont();
    const layout = layoutAmountWords({
      text: LONGEST,
      font,
      baseFontSize: 9,
      maxWidthMm: 40,
      line2MaxWidthMm: 40,
    });
    expect(layout.fontSize).toBeGreaterThanOrEqual(8);
  });

  it("flags overflow when 2 lines at minimum size still don't fit", async () => {
    const font = await getHelveticaFont();
    const layout = layoutAmountWords({
      text: LONGEST,
      font,
      baseFontSize: 9.5,
      maxWidthMm: 30,
      line2MaxWidthMm: 30,
    });
    expect(layout.overflow).toBe(true);
    expect(layout.lines.length).toBeLessThanOrEqual(2);
  });

  it("fits 123,123,121.00 on AUB on one line", async () => {
    const text = amountToWords(123123121, {
      capitalization: "title",
      suffixOnly: true,
    });
    const layout = await layoutFor("aub", text);
    expect(layout.lines, JSON.stringify(layout)).toHaveLength(1);
    expect(layout.overflow).toBe(false);
    // The shrink cap still applies — never more than 15% off the base.
    const base = BANK_TEMPLATES.aub.fields.amountWords.fontSize;
    expect(layout.fontSize).toBeGreaterThanOrEqual(base * 0.85 - 0.01);
  });

  it("a forced wrap gives 2 lines at different Y positions", async () => {
    const font = await getHelveticaFont();
    const layout = layoutAmountWords({
      text: LONGEST,
      font,
      baseFontSize: 12,
      maxWidthMm: 100,
    });
    expect(layout.wrapped).toBe(true);
    expect(layout.lines).toHaveLength(2);
    expect(layout.lineOffsetsMm).toHaveLength(2);
    expect(layout.lineOffsetsMm[0]).not.toBe(layout.lineOffsetsMm[1]);
    // The last line sits exactly on the pre-printed line; the first line
    // stacks upward from it.
    expect(layout.lineOffsetsMm[1]).toBe(0);
    expect(layout.lineOffsetsMm[0]).toBeLessThan(0);
    expect(layout.lineOffsetsMm[0]).toBeCloseTo(
      -wordsLineSpacingMm(layout.fontSize),
      5,
    );
  });

  it("a one-line layout anchors the line at offset 0", async () => {
    const font = await getHelveticaFont();
    const layout = layoutAmountWords({
      text: AUB_SAMPLE,
      font,
      baseFontSize: 12,
      maxWidthMm: 200,
    });
    expect(layout.lines).toHaveLength(1);
    expect(layout.lineOffsetsMm).toEqual([0]);
  });

  it("parity: the same input yields identical lines at any call", async () => {
    const font = await getHelveticaFont();
    const words = BANK_TEMPLATES.aub.fields.amountWords;
    const a = layoutAmountWords({
      text: AUB_SAMPLE,
      font,
      baseFontSize: words.fontSize,
      maxWidthMm: words.maxWidth,
    });
    const b = layoutAmountWords({
      text: AUB_SAMPLE,
      font,
      baseFontSize: words.fontSize,
      maxWidthMm: words.maxWidth,
    });
    expect(a.lines).toEqual(b.lines);
    expect(a.fontSize).toBe(b.fontSize);
    expect(a.lineOffsetsMm).toEqual(b.lineOffsetsMm);
  });
});

describe("intersectsKeepOut", () => {
  const rect = { x: 10, y: 10, w: 20, h: 5 };

  it("detects intersections", () => {
    expect(intersectsKeepOut(rect, [{ x: 25, y: 12, w: 10, h: 3 }])).toBe(true);
    expect(intersectsKeepOut(rect, [{ x: 0, y: 0, w: 12, h: 12 }])).toBe(true);
  });

  it("ignores non-overlapping rectangles", () => {
    expect(intersectsKeepOut(rect, [{ x: 40, y: 10, w: 5, h: 5 }])).toBe(false);
    expect(intersectsKeepOut(rect, [])).toBe(false);
  });
});
