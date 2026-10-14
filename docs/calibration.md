# Calibration Guide

The app prints text at millimeter coordinates, drawn once in the cheque's
native mm space and placed on the paper by your Print Setup (paper preset,
orientation, rotation, anchor). Two things determine whether the print lands
in the right place:

1. **The field coordinates in `lib/banks.ts`** — starting values tuned from
   sample scans; verify them against your real cheque and drag fields to
   fine-tune (they persist per bank).
2. **The per-bank X/Y offset** you tune on the Calibrate page — every printer
   feeds paper slightly differently.

## 0. Add your cheque's image (recommended)

On the system page or the Calibrate page, use **Upload image** next to the
bank selector to add a **flat scan** of your cheque. The scan becomes the
editing canvas for that bank and makes field placement visually accurate —
overlays on a flat scan correspond 1:1 to printed millimeters. Uploads stay
on this device (they are not part of the JSON export) and can be removed
anytime.

## 1. Print the ruler grid

1. Open the app → **Tools → Calibrate**.
2. Pick your bank and click **Print test on plain paper**. The grid prints
   through the **same Print Setup layout as real prints**, so what you
   measure is what you get.
3. In the print dialog: **100% / Actual Size**, margins **None**. Any
   scaling will make every measurement wrong.

## 2. Measure your real cheque — including the amount-words line

1. Lay your cheque **on top of the grid**, aligned with the top-left corner.
   (Trace the cheque outline onto the paper first if the stock is thick.)
2. Read the (x, y) of each field's **top-left corner**, in millimeters:

   | Field | What to measure |
   |---|---|
   | Date | Top-left of where the date should sit |
   | Payee | Start of the payee line |
   | Amount (number) | Top-left of the number box |
   | Amount (words) | Start of the words line |
   | Crossing | Center of the crossing area, plus line length and angle |

3. **Amount-words line width**: measure the FULL pre-printed line — from the
   left edge of the words area to the line's right end (often just before
   the amount box) — not just the width of any sample text printed on it.
   That full width is the template's `amountWords.maxWidth`; wrapped text
   stacks a second line ABOVE the pre-printed line (spacing and shrink are
   computed in `lib/layoutAmountWords.ts`, the single source for screen,
   preview, and PDF). Also note the rectangles of any pre-printed
   text/logos the words must avoid (`keepOut`). On the cheque you can also
   drag the line-end handle of the amount-words box or use **Snap to line
   end** — the width persists per bank.

## 3. Update the template

Edit `lib/banks.ts`: replace the placeholder values (or give a bank its own
`fields` object) with your measurements. `x`/`y` are millimeters from the
cheque's top-left corner; `fontSize` is in points; `crossing.rotate` is
degrees clockwise.

Then test-print **Print…** on plain paper, hold it against a real cheque,
and iterate.

## 4. Tune the printer offset

Even with perfect coordinates, your printer may shift everything by a fixed
amount (e.g. +0.8 mm right, -0.4 mm up).

1. Open **Tools → Calibrate** and pick the bank.
2. Adjust the **X** and **Y** sliders (±10 mm, 0.1 mm steps) while watching
   the live preview shift.
3. Print a real cheque payload on **plain paper**, overlay it on your cheque,
   and correct the sliders until it lines up.
4. The offset is saved per bank, on this device, and is included in
   **File → Export data** backups.

## 5. Print Setup: paper, orientation, rotation, anchor

Tools → **Print setup…** (saved per bank):

- **Paper preset** — A4, Letter/Short, Legal, Long/Folio, A5, cheque size,
  or custom W×H mm. Most home/office printers only have A4 or Letter, so
  pick the paper you actually load.
- **Orientation** — portrait is the default; landscape swaps the paper's
  width/height. The cheque preset ignores orientation (the page IS the
  cheque).
- **Content rotation** — how the cheque is fed into the printer (short edge
  vs long edge first) varies per printer. If the cheque doesn't fit
  unrotated (the preview warns), try 90° CW/CCW so its long edge runs along
  the paper's long edge.
- **Anchor** — a 3×3 grid (top/middle/bottom × left/center/right) plus fine
  X/Y offsets in mm, so the cheque lands where it is physically inserted or
  taped on the carrier sheet.
- The **live page preview** shows the cheque rectangle, a feed-direction
  arrow, and a fit warning. Calibrate's test grid uses these same settings.

## 6. Test-print-on-plain-paper workflow

1. Print the ruler grid (plain paper) → hold your cheque over it → measure.
2. Print a cheque payload (plain paper) → overlay it on the cheque.
3. Correct offsets/setup until both line up.
4. Only then print on real cheque stock.

If your printer can't feed cheque-size paper, use any carrier preset (A4 is
the default): the cheque is drawn at your anchor with a light gray outline —
print on plain paper, align the cheque to the outline, and run it through
once more.
