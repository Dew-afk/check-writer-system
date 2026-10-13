import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { BANK_TEMPLATES } from "./banks";
import {
  DEFAULT_PRINT_LAYOUT,
  paperPageMm,
  placeChequeOnPage,
  rotatedChequeSize,
  sanitizePrintLayout,
  type PrintLayout,
} from "./printLayout";
import {
  formatAmountNum,
  generateChequePdf,
  generateChequePdfA4,
  generatePdf,
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
      const bytes = await generateTestGridPdf(template.id, { ...DEFAULT_PRINT_LAYOUT, paperPreset: "cheque" });
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

describe("unified PrintLayout pipeline (Fix 2)", () => {
  const presets = ["a4", "letter", "legal", "folio", "a5", "cheque"] as const;
  const orientations = ["portrait", "landscape"] as const;
  const rotations = [0, 90, 180, 270] as const;

  it("produces a valid PDF for every paper x orientation x rotation", async () => {
    // Page geometry is bank-independent — the cheque content is native-size.
    for (const paperPreset of presets) {
        for (const orientation of orientations) {
          for (const contentRotation of rotations) {
            const layout: PrintLayout = {
              ...DEFAULT_PRINT_LAYOUT,
              paperPreset,
              orientation,
              contentRotation,
            };
            const bytes = await generatePdf(fullPayload, layout);
            const head = new TextDecoder().decode(bytes.slice(0, 5));
            expect(head).toBe("%PDF-");
            const doc = await PDFDocument.load(bytes);
            const [page] = doc.getPages();
            const paper = paperPageMm(layout);
            expect(page.getWidth()).toBeCloseTo(paper.widthMm * MM_TO_PT, 1);
            expect(page.getHeight()).toBeCloseTo(paper.heightMm * MM_TO_PT, 1);
          }
        }
      }
  });

  it("places the cheque inside the page when the fit check passes", async () => {
    for (const paperPreset of presets) {
      for (const contentRotation of rotations) {
        const layout: PrintLayout = {
          ...DEFAULT_PRINT_LAYOUT,
          paperPreset,
          contentRotation,
        };
        const paper = paperPageMm(layout);
        const placed = placeChequeOnPage(layout, paper);
        if (placed.fits) {
          expect(placed.xMm).toBeGreaterThanOrEqual(0);
          expect(placed.yMm).toBeGreaterThanOrEqual(0);
          expect(placed.xMm + placed.widthMm).toBeLessThanOrEqual(paper.widthMm + 0.01);
          expect(placed.yMm + placed.heightMm).toBeLessThanOrEqual(paper.heightMm + 0.01);
        }
      }
    }
  });

  it("rotates the cheque footprint for 90/270 content rotations", () => {
    expect(rotatedChequeSize(0)).toEqual({ widthMm: 203.2, heightMm: 76.2 });
    expect(rotatedChequeSize(90)).toEqual({ widthMm: 76.2, heightMm: 203.2 });
    expect(rotatedChequeSize(270).widthMm).toBe(76.2);
    expect(rotatedChequeSize(180).widthMm).toBe(203.2);
  });

  it("sanitizes stored layouts and rejects bad ones", () => {
    expect(sanitizePrintLayout(DEFAULT_PRINT_LAYOUT)).toEqual(DEFAULT_PRINT_LAYOUT);
    expect(sanitizePrintLayout({ ...DEFAULT_PRINT_LAYOUT, orientation: "sideways" })).toEqual(
      { ...DEFAULT_PRINT_LAYOUT, orientation: "portrait" },
    );
    expect(sanitizePrintLayout({ ...DEFAULT_PRINT_LAYOUT, paperPreset: "nope" })).toBeNull();
    expect(sanitizePrintLayout({ ...DEFAULT_PRINT_LAYOUT, contentRotation: 45 })).toBeNull();
    expect(
      sanitizePrintLayout({
        ...DEFAULT_PRINT_LAYOUT,
        paperPreset: "custom",
        customWidthMm: 300,
        customHeightMm: 120,
      }),
    ).toMatchObject({ paperPreset: "custom", customWidthMm: 300, customHeightMm: 120 });
  });

  it("test grids are valid for every bank/paper/orientation", async () => {
    for (const template of Object.values(BANK_TEMPLATES)) {
      for (const paperPreset of ["a4", "letter", "cheque"] as const) {
        for (const orientation of orientations) {
          const bytes = await generateTestGridPdf(template.id, {
            ...DEFAULT_PRINT_LAYOUT,
            paperPreset,
            orientation,
          });
          expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
        }
      }
    }
  });
});
