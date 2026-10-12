# Calibration Guide

The app prints text at millimeter coordinates on a cheque-sized PDF page.
Two things determine whether the print lands in the right place:

1. **The field coordinates in `lib/banks.ts`** — currently **placeholders**.
   They must be measured from your real cheque stock (step 5 of PLAN.md).
2. **The per-bank X/Y offset** you tune on the Calibrate page — every printer
   feeds paper slightly differently, so even perfect coordinates need a small
   per-printer shift.

## 0. Add your cheque's image (recommended)

On the system page or the Calibrate page, use **Upload image** next to the
bank selector to add a **flat scan** of your cheque. The scan becomes the
editing canvas for that bank and makes field placement visually accurate —
overlays on a flat scan correspond 1:1 to printed millimeters. The app ships
with a decorative Metrobank image; promo-style images are visual only, not
calibration-accurate. Uploads stay on this device (they are not part of the
JSON export) and can be removed anytime.

## 1. Print the ruler grid

1. Open the app → **Tools → Calibrate**.
2. Pick your bank and click **Print test on plain paper**. This prints a
   millimeter ruler grid at the exact cheque size (203.2 × 76.2 mm).
3. In the print dialog: **100% / Actual Size**, margins **None**.
   Any scaling will make every measurement wrong.

## 2. Measure your real cheque

1. Lay your cheque **on top of the grid**, aligned with the top-left corner.
   (Trace the cheque outline onto the paper first if the stock is thick.)
2. Read the (x, y) of each field's **top-left corner**, in millimeters:

   | Field | What to measure |
   |---|---|
   | Date | Top-left of where the date should sit |
   | Payee | Start of the payee line |
   | Amount (number) | Top-left of the number box |
   | Amount (words) | Start of the words line (and its max width in mm) |
   | Crossing | Center of the crossing area, plus line length and angle |

3. Note the usable **max width** for payee and amount-words lines, and the
   number of lines the words area allows (usually 2).

## 3. Update the template

Edit `lib/banks.ts`: replace the `PLACEHOLDER_FIELDS` values (or give a bank
its own `fields` object) with your measurements. `x`/`y` are millimeters from
the cheque's top-left corner; `fontSize` is in points; `crossing.rotate` is
degrees clockwise.

Then test-print **Print Preview** on plain paper, hold it against a real
cheque, and iterate.

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

## 5. A4 carrier-sheet mode

If your printer can't feed cheque-size paper, use **Print on A4 at offset**:
the cheque is drawn 12 mm from the A4 page's top-left corner (plus your X/Y
offset), outlined in gray. Print on plain A4, align the cheque to the outline,
and run it through once more.
