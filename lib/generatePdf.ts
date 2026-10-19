import { PDFDocument, PDFFont, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";

import { amountToWords } from "./amountToWords";
import { BANK_TEMPLATES } from "./banks";
import type { BankId, BankTemplate } from "./banks";
import {
  resolveFieldPos,
  type FieldOverrides,
} from "./calibration";
import {
  CROSSING_PRINT_TEXT,
  type Capitalization,
  type Crossing,
} from "./chequeSchema";
import {
  dateToDigits,
  digitCenterOffsetsMm,
  DEFAULT_DATE_SPACING,
  type DateSpacing,
} from "./dateSpacing";
import type { CustomTextField } from "./customFields";
import { layoutAmountWords } from "./layoutAmountWords";
import {
  DEFAULT_PRINT_LAYOUT,
  paperPageMm,
  placeChequeOnPage,
  type PrintLayout,
} from "./printLayout";
import type { Offset } from "./storage";

/**
 * Client-side cheque PDF generation (no server calls). Page size matches the
 * bank template's cheque size in millimeters; all field coordinates are in
 * millimeters from the TOP-LEFT of the cheque, plus the user's saved
 * calibration offset. Template coordinates are placeholders until step 5.
 */

const MM_TO_PT = 72 / 25.4;
export interface ChequePrintPayload {
  bankId: BankId;
  date?: string; // ISO "YYYY-MM-DD"
  payee?: string;
  amount?: number;
  crossing?: Crossing; // undefined or 'none' = not printed
  capitalization: Capitalization;
  suffixOnly: boolean;
  /** Omits "and 00/100" for whole-peso amounts. */
  omitZeroCentavos?: boolean;
  /** Per-bank date digit spacing (Task B). */
  dateSpacing?: DateSpacing;
  /** Multi-instance custom text labels, drawn on top of the built-ins. */
  customFields?: CustomTextField[];
  /** Per-bank override of the amount-words line width (mm). */
  wordsMaxWidthMm?: number;
  /** User calibration offset in mm (per bank). */
  offset?: Offset;
  /** Per-field position overrides set by dragging on the canvas (mm). */
  fieldOverrides?: FieldOverrides;
}

/** Printed text inside the crossing lines — see chequeSchema. */
export { CROSSING_PRINT_TEXT };

/** "1234.5" → "1,234.50" */
export function formatAmountNum(amount: number): string {
  const [pesos, cents = "00"] = amount.toFixed(2).split(".");
  return `${pesos.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}

/**
 * Wraps text into at most maxLines lines that each fit maxWidthMm, measuring
 * with the given font. Overflow on the last line is trimmed with an ellipsis.
 */
export function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidthMm: number,
  maxLines: number,
): string[] {
  const maxWidthPt = maxWidthMm * MM_TO_PT;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidthPt) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = `${lines[maxLines - 1]}…`;
    while (
      last.length > 1 &&
      font.widthOfTextAtSize(last, fontSize) > maxWidthPt
    ) {
      last = `${last.slice(0, -2)}…`;
    }
    lines[maxLines - 1] = last;
  }
  return lines;
}

interface DrawTextOpts {
  page: PDFPage;
  font: PDFFont;
  text: string;
  xMm: number;
  yMm: number; // top of the text
  fontSize: number;
  /** Top-left of the cheque area on this page, in mm. */
  originMm: Offset;
  pageHeightPt: number;
  rotateDeg?: number;
}

function drawText({
  page,
  font,
  text,
  xMm,
  yMm,
  fontSize,
  originMm,
  pageHeightPt,
  rotateDeg,
}: DrawTextOpts): void {
  page.drawText(text, {
    x: (originMm.x + xMm) * MM_TO_PT,
    // Baseline ≈ one font-size below the top; close enough for Helvetica
    // (any residual error is absorbed by the calibration offsets).
    y: pageHeightPt - (originMm.y + yMm) * MM_TO_PT - fontSize,
    size: fontSize,
    font,
    rotate: rotateDeg === undefined ? undefined : degrees(rotateDeg),
    color: rgb(0, 0, 0),
  });
}

function drawCrossing(
  page: PDFPage,
  font: PDFFont,
  field: BankTemplate["fields"]["crossing"],
  label: string,
  originMm: Offset,
  pageHeightPt: number,
): void {
  const cx = (originMm.x + field.x) * MM_TO_PT;
  const cy = pageHeightPt - (originMm.y + field.y) * MM_TO_PT;
  const rad = (field.rotate * Math.PI) / 180;
  const half = (field.width * MM_TO_PT) / 2;
  const dir = { x: Math.cos(rad) * half, y: Math.sin(rad) * half };
  const perp = { x: -Math.sin(rad), y: Math.cos(rad) };
  const gap = 3.5; // points between the two lines

  for (const offset of [-gap, gap]) {
    page.drawLine({
      start: { x: cx - dir.x + perp.x * offset, y: cy - dir.y + perp.y * offset },
      end: { x: cx + dir.x + perp.x * offset, y: cy + dir.y + perp.y * offset },
      thickness: 0.8,
      color: rgb(0, 0, 0),
    });
  }

  const textWidth = font.widthOfTextAtSize(label, field.fontSize);
  page.drawText(label, {
    x: cx - textWidth / 2,
    y: cy - field.fontSize * 0.35,
    size: field.fontSize,
    font,
    rotate: degrees(field.rotate),
    color: rgb(0, 0, 0),
  });
}

/** Draws every included field of the payload onto the given page.
 *  THE PRINT LAYER: only typed fields (date, payee, amount, amount in
 *  words, crossing, custom labels) are drawn here. Guide-layer content —
 *  cheque border, background scan, ruler grid, placeholder boxes — is
 *  never drawn in this document. */
function drawCheque(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  courier: PDFFont,
  payload: ChequePrintPayload,
  originMm: Offset,
): void {
  const template = BANK_TEMPLATES[payload.bankId];
  const { fields } = template;
  const pageHeightPt = page.getHeight();

  // Per-field overrides win over the template's default position.
  const datePos = resolveFieldPos(
    { x: fields.date.x, y: fields.date.y },
    payload.fieldOverrides?.date,
  );
  const payeePos = resolveFieldPos(
    { x: fields.payee.x, y: fields.payee.y },
    payload.fieldOverrides?.payee,
  );
  const amountNumPos = resolveFieldPos(
    { x: fields.amountNum.x, y: fields.amountNum.y },
    payload.fieldOverrides?.amountNum,
  );
  const wordsPos = resolveFieldPos(
    { x: fields.amountWords.x, y: fields.amountWords.y },
    payload.fieldOverrides?.amountWords,
  );
  const crossPos = resolveFieldPos(
    { x: fields.crossing.x, y: fields.crossing.y },
    payload.fieldOverrides?.crossing,
  );

  if (payload.date) {
    // Digits only, zero-padded, each centered in its cell (Task B). Courier
    // is monospace, so every digit has the same advance — identical on
    // screen, in preview, and in print.
    const spacing = payload.dateSpacing ?? DEFAULT_DATE_SPACING;
    const digits = dateToDigits(payload.date, spacing.order);
    const centers = digitCenterOffsetsMm(spacing, fields.date.fontSize);
    const digitFont = courier;
    digits.split("").forEach((digit, i) => {
      const cx = datePos.x + centers[i];
      const w = digitFont.widthOfTextAtSize(digit, fields.date.fontSize);
      page.drawText(digit, {
        x: (originMm.x + cx) * MM_TO_PT - w / 2,
        y:
          pageHeightPt -
          (originMm.y + datePos.y) * MM_TO_PT -
          fields.date.fontSize,
        size: fields.date.fontSize,
        font: digitFont,
        color: rgb(0, 0, 0),
      });
    });
  }

  if (payload.payee) {
    drawText({
      page,
      font,
      text: payload.payee,
      xMm: payeePos.x,
      yMm: payeePos.y,
      fontSize: fields.payee.fontSize,
      originMm,
      pageHeightPt,
    });
  }

  if (payload.amount !== undefined) {
    drawText({
      page,
      font: bold,
      text: formatAmountNum(payload.amount),
      xMm: amountNumPos.x,
      yMm: amountNumPos.y,
      fontSize: fields.amountNum.fontSize,
      originMm,
      pageHeightPt,
    });

    const words = amountToWords(payload.amount, {
      capitalization: payload.capitalization,
      suffixOnly: payload.suffixOnly,
      omitZeroCentavos: payload.omitZeroCentavos,
    });
    // Single source of truth: same layout module as the canvas overlay.
    const layout = layoutAmountWords({
      text: words,
      font,
      baseFontSize: fields.amountWords.fontSize,
      maxWidthMm:
        payload.wordsMaxWidthMm ?? fields.amountWords.maxWidth,
    });
    layout.lines.forEach((line, i) => {
      // Lines stack upward from the pre-printed line (lineOffsetsMm).
      drawText({
        page,
        font,
        text: line,
        xMm: wordsPos.x,
        yMm: wordsPos.y + layout.lineOffsetsMm[i],
        fontSize: layout.fontSize,
        originMm,
        pageHeightPt,
      });
    });
  }

  if (payload.crossing && payload.crossing !== "none") {
    drawCrossing(
      page,
      font,
      { ...fields.crossing, x: crossPos.x, y: crossPos.y },
      CROSSING_PRINT_TEXT[payload.crossing],
      originMm,
      pageHeightPt,
    );
  }

  // Custom text labels (Name fields): same mm coordinates as the canvas, so
  // print matches screen. Drawn last (on top).
  for (const field of payload.customFields ?? []) {
    const text = field.uppercase ? field.text.toUpperCase() : field.text;
    const fieldFont = field.bold ? bold : font;
    const lines = field.maxWidthMm
      ? wrapText(text, fieldFont, field.fontSize, field.maxWidthMm, 4)
      : [text];
    lines.forEach((line, i) => {
      const width = fieldFont.widthOfTextAtSize(line, field.fontSize);
      const xMm =
        field.align === "center" ? field.x - width / MM_TO_PT / 2 : field.x;
      page.drawText(line, {
        x: (originMm.x + xMm) * MM_TO_PT,
        y:
          pageHeightPt -
          (originMm.y + field.y) * MM_TO_PT -
          field.fontSize * (1 + i * 1.2),
        size: field.fontSize,
        font: fieldFont,
        color: rgb(0, 0, 0),
      });
    });
  }
}

/**
 * Builds the cheque content on a native cheque-size page (mm coordinates,
 * untouched by paper settings) and returns that document.
 */
async function buildChequeDocument(
  payload: ChequePrintPayload,
): Promise<PDFDocument> {
  const template = BANK_TEMPLATES[payload.bankId];
  const doc = await PDFDocument.create();
  const page = doc.addPage([
    template.widthMm * MM_TO_PT,
    template.heightMm * MM_TO_PT,
  ]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const courier = await doc.embedFont(StandardFonts.Courier);
  drawCheque(page, font, bold, courier, payload, payload.offset ?? { x: 0, y: 0 });
  return doc;
}

/**
 * Places an embedded cheque document on a carrier page per the layout.
 *
 * Print-layer rule: the cheque document contains ONLY the typed fields
 * (date, payee, amount, amount in words, crossing, custom labels) — no
 * border, scan, or guides. The optional `border` is a guide drawn on the
 * CARRIER page (never on the cheque itself) and only when the user turns
 * on "Print cheque border" in Print Setup (default OFF).
 */
async function placeOnCarrier(
  chequeDoc: PDFDocument,
  layout: PrintLayout,
  options: { border?: boolean } = {},
): Promise<Uint8Array> {
  const paper = paperPageMm(layout);
  const placed = placeChequeOnPage(layout, paper);
  const doc = await PDFDocument.create();
  const page = doc.addPage([
    paper.widthMm * MM_TO_PT,
    paper.heightMm * MM_TO_PT,
  ]);
  const [embedded] = await doc.embedPdf(chequeDoc);
  page.drawPage(embedded, {
    x: placed.xMm * MM_TO_PT,
    y: paper.heightMm * MM_TO_PT - (placed.yMm + placed.heightMm) * MM_TO_PT,
    width: embedded.width,
    height: embedded.height,
    rotate: degrees(layout.contentRotation),
  });
  const drawBorder =
    options.border === true && layout.paperPreset !== "cheque";
  if (drawBorder) {
    // Light gray outline of the cheque area to help alignment on carrier
    // sheets — a screen-style guide the user opted into printing.
    page.drawRectangle({
      x: placed.xMm * MM_TO_PT,
      y: paper.heightMm * MM_TO_PT - (placed.yMm + placed.heightMm) * MM_TO_PT,
      width: placed.widthMm * MM_TO_PT,
      height: placed.heightMm * MM_TO_PT,
      borderColor: rgb(0.55, 0.6, 0.65),
      borderWidth: 0.5,
    });
  }
  return doc.save();
}

/**
 * THE unified generator (Fix 2): the cheque is always drawn in its native mm
 * space, then placed on the chosen paper with the preset/orientation/
 * rotation/anchor settings. Default layout is A4 portrait, cheque centered.
 */
export async function generatePdf(
  payload: ChequePrintPayload,
  layout: PrintLayout = DEFAULT_PRINT_LAYOUT,
): Promise<Uint8Array> {
  const chequeDoc = await buildChequeDocument(payload);
  if (layout.paperPreset === "cheque") return chequeDoc.save();
  return placeOnCarrier(chequeDoc, layout, {
    border: layout.printChequeBorder === true,
  });
}

/**
 * Cheque-size PDF (the page is exactly the cheque dimensions) — kept as a
 * convenience wrapper for the "cheque" preset.
 */
export async function generateChequePdf(
  payload: ChequePrintPayload,
): Promise<Uint8Array> {
  return generatePdf(payload, {
    ...DEFAULT_PRINT_LAYOUT,
    paperPreset: "cheque",
  });
}

/**
 * A4 carrier sheet at the legacy 12,12mm origin — kept as a wrapper.
 */
export async function generateChequePdfA4(
  payload: ChequePrintPayload,
): Promise<Uint8Array> {
  return generatePdf(payload, {
    ...DEFAULT_PRINT_LAYOUT,
    paperPreset: "a4",
    anchorX: "left",
    anchorY: "top",
    offsetMm: { x: 12, y: 12 },
  });
}

/**
 * A ruler grid at the cheque's size — print on plain paper and hold a real
 * cheque against it to measure where the fields actually sit (Calibrate).
 * Uses the same PrintLayout pipeline so test prints match real prints.
 */
export async function generateTestGridPdf(
  bankId: BankId,
  layout: PrintLayout = DEFAULT_PRINT_LAYOUT,
): Promise<Uint8Array> {
  const template = BANK_TEMPLATES[bankId];
  const doc = await PDFDocument.create();
  const page = doc.addPage([
    template.widthMm * MM_TO_PT,
    template.heightMm * MM_TO_PT,
  ]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.55, 0.6, 0.65);

  for (let x = 0; x <= template.widthMm; x += 5) {
    const px = x * MM_TO_PT;
    page.drawLine({
      start: { x: px, y: 0 },
      end: { x: px, y: template.heightMm * MM_TO_PT },
      thickness: x % 25 === 0 ? 0.7 : 0.3,
      color: ink,
    });
    if (x % 25 === 0) {
      page.drawText(String(x), { x: px + 1, y: 2, size: 5, font, color: ink });
    }
  }
  for (let y = 0; y <= template.heightMm; y += 5) {
    const py = page.getHeight() - y * MM_TO_PT;
    page.drawLine({
      start: { x: 0, y: py },
      end: { x: template.widthMm * MM_TO_PT, y: py },
      thickness: y % 25 === 0 ? 0.7 : 0.3,
      color: ink,
    });
    if (y % 25 === 0) {
      page.drawText(String(y), { x: 1, y: py - 6, size: 5, font, color: ink });
    }
  }
  if (layout.paperPreset === "cheque") return doc.save();
  // No guide border on the calibration sheet — the ruler grid IS the guide,
  // and this function is only reachable from Calibrate's "Print test".
  return placeOnCarrier(doc, layout);
}
