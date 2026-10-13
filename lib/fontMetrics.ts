import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";

/**
 * Shared Helvetica metrics for browser-side layout (Fix 1): the canvas
 * overlay measures text with the SAME pdf-lib font metrics the printer
 * uses, so screen, preview, and PDF layout are identical.
 */

let helveticaPromise: Promise<PDFFont> | null = null;

export function getHelveticaFont(): Promise<PDFFont> {
  if (!helveticaPromise) {
    helveticaPromise = PDFDocument.create().then((doc) =>
      doc.embedFont(StandardFonts.Helvetica),
    );
  }
  return helveticaPromise;
}
