import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { BANK_TEMPLATES } from "./banks";
import {
  formatAmountNum,
  generateChequePdf,
  generateChequePdfA4,
  generateTestGridPdf,
  wrapText,
} from "./generatePdf";

const MM_TO_PT = 72 / 25.4;

async function makeFont() {
  const doc = await PDFDocument.create();
  return doc.embedFont(StandardFonts.Helvetica);
}

const fullPayload = {
  bankId: "bdo" as const,
  date: "2026-10-07",
  payee: "Juan Dela Cruz",
  amount: 1234.5,
  crossing: "account-payee-only" as const,
  capitalization: "title" as const,
  suffixOnly: true,
};

describe("formatAmountNum", () => {
  it.each([
    [0, "0.00"],
    [0.05, "0.05"],
    [1, "1.00"],
    [1234.5, "1,234.50"],
    [1000000, "1,000,000.00"],
    [999999999.99, "999,999,999.99"],
  ])("formats %s", (amount, expected) => {
    expect(formatAmountNum(amount)).toBe(expected);
  });
});

describe("wrapText", () => {
  it("keeps short text on one line", async () => {
    const font = await makeFont();
    expect(wrapText("One Thousand Pesos", font, 9.5, 170, 2)).toEqual([
      "One Thousand Pesos",
    ]);
  });

  it("wraps long text within maxWidth", async () => {
    const font = await makeFont();
    const text =
      "Nine Hundred Ninety-Nine Million Nine Hundred Ninety-Nine Thousand Nine Hundred Ninety-Nine Pesos and 99/100 Only";
    const lines = wrapText(text, font, 9.5, 100, 3);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 9.5)).toBeLessThanOrEqual(
        100 * MM_TO_PT,
      );
    }
  });

  it("truncates overflow with an ellipsis at maxLines", async () => {
    const font = await makeFont();
    const text =
      "Nine Hundred Ninety-Nine Million Nine Hundred Ninety-Nine Thousand Nine Hundred Ninety-Nine Pesos and 99/100 Only";
    const lines = wrapText(text, font, 9.5, 60, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 9.5)).toBeLessThanOrEqual(
        60 * MM_TO_PT,
      );
    }
  });
});

describe("generateChequePdf", () => {
  it("produces a cheque-size page (203.2 × 76.2 mm)", async () => {
    const bytes = await generateChequePdf(fullPayload);
    const doc = await PDFDocument.load(bytes);
    const [page] = doc.getPages();
    expect(page.getWidth()).toBeCloseTo(203.2 * MM_TO_PT);
    expect(page.getHeight()).toBeCloseTo(76.2 * MM_TO_PT);
  });

  it("handles every optional field omitted", async () => {
    const bytes = await generateChequePdf({
      bankId: "aub",
      capitalization: "lower",
      suffixOnly: false,
      offset: { x: 1.5, y: -2 },
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("renders with a calibration offset without error", async () => {
    const bytes = await generateChequePdf({ ...fullPayload, offset: { x: 3, y: 1.2 } });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("skips crossing when set to none", async () => {
    const bytes = await generateChequePdf({ ...fullPayload, crossing: "none" });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("renders with per-field position overrides", async () => {
    const bytes = await generateChequePdf({
      ...fullPayload,
      fieldOverrides: {
        date: { x: 140.5, y: 18.2 },
        payee: { x: 25, y: 30 },
        amountNum: { x: 160, y: 30 },
        amountWords: { x: 10, y: 42 },
        crossing: { x: 90, y: 40 },
      },
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("generateChequePdfA4", () => {
  it("produces an A4 page", async () => {
    const bytes = await generateChequePdfA4(fullPayload);
    const doc = await PDFDocument.load(bytes);
    const [page] = doc.getPages();
    expect(page.getWidth()).toBeCloseTo(210 * MM_TO_PT);
    expect(page.getHeight()).toBeCloseTo(297 * MM_TO_PT);
  });
});

describe("generateTestGridPdf", () => {
  it("produces a cheque-size ruler grid for every bank", async () => {
    for (const template of Object.values(BANK_TEMPLATES)) {
      const bytes = await generateTestGridPdf(template.id);
      const doc = await PDFDocument.load(bytes);
      const [page] = doc.getPages();
      expect(page.getWidth()).toBeCloseTo(template.widthMm * MM_TO_PT);
      expect(page.getHeight()).toBeCloseTo(template.heightMm * MM_TO_PT);
    }
  });
});

describe("customFields printing", () => {
  it("renders custom name labels without error", async () => {
    const bytes = await generateChequePdf({
      ...fullPayload,
      customFields: [
        { id: "a", text: "For Deposit Only", x: 30, y: 20, fontSize: 12, bold: false, uppercase: true, align: "left" },
        { id: "b", text: "VOID", x: 100, y: 35, fontSize: 20, bold: true, uppercase: true, align: "center", maxWidthMm: 60 },
      ],
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
