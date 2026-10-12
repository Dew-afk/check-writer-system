# PH Cheque Writer

A browser-based Philippine cheque writer. Fill in the date, payee, amount,
and crossing — or place your own labels — directly on a scan of your cheque,
then print at exactly the right spots on your own pre-printed bank stock.

**Banks:** AUB · PNB · Landbank · Metrobank · BDO · Security Bank

## Features

- **Cheque Studio** — the cheque scan is the editing surface: click a field
  to edit it in place, or drag chips (Date / Payee / Amount / Crossing) onto
  the cheque to place them
- **Custom "Name" labels** — place any number of text labels (e.g. "For
  Deposit Only", "VOID"), each with its own text, size, bold/uppercase,
  alignment, and position
- **Date digit spacing** — cheques have printed date cells (MM–DD–YYYY);
  tune `digitSpacing` and `groupGap` per bank so each digit lands inside its
  cell. Digits print without separators, in the bank's order
- **Amount in words** — standard Philippine wording with capitalization,
  "Only" suffix, and optional omission of "and 00/100"
- **Printer calibration** — per-bank X/Y offsets, a mm ruler grid, and an
  A4 carrier-sheet mode for printers that can't feed cheque-size paper
- **Per-bank layouts** — every position is stored in **millimetres** and
  survives reloads; export/import a JSON backup
- **Light/dark theme**, keyboard placement (Enter/arrows), and
  `prefers-reduced-motion` support

## Safety

- Print at **100% / Actual Size**, margins **None**. Test on plain paper first.
- Use only on **your own genuine cheque stock**. The app never prints or
  stores account numbers or MICR data.
- All data (payees, layouts, cheque images) stays in **your browser**.
  Clearing site data erases it — use **File → Export data** for backups.
- Not affiliated with any bank.

> Bank template coordinates ship as placeholders tuned from sample scans —
> verify against your own cheque and drag fields to fine-tune.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Unit tests (Vitest, 249 tests) |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` | ESLint |

## Deploying to Vercel

1. Push this repository to GitHub (done).
2. On [vercel.com](https://vercel.com), **Add New → Project** and import the
   repository.
3. Keep all defaults — framework preset **Next.js**, build command
   `npm run build`, output directory `.next`.
4. **No environment variables are needed.** Everything runs in the browser
   (pdf-lib generates the PDFs client-side).

## Architecture

```
app/                   Next.js App Router pages (/, /system, /calibrate)
components/            ChequeCanvas, chips, dialogs, AppShell, shadcn ui
hooks/                 useChequeImage (IndexedDB per-bank cheque images)
lib/
  amountToWords.ts     peso wording engine (unit-tested)
  banks.ts             bank list + per-bank print templates (mm)
  calibration.ts       mm↔px conversion, clamping, snapping, field overrides
  chequeSchema.ts      Zod validation, crossing/wording enums, date warnings
  customFields.ts      multi-instance "Name" label model
  dateSpacing.ts       date digit-cell spacing math
  generatePdf.ts       pdf-lib print pipeline (cheque page + A4 mode)
  storage.ts           localStorage state, versioned export/import backup
docs/
  design.md            design language (palette, typography, motion)
  calibration.md       how to measure your cheque and tune the printer
```

Key idea: every position is **millimetres from the cheque's top-left**, used
identically by the on-screen overlay, the preview, and the printed PDF — so
what you see is exactly what prints, at any zoom level or printer scale.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui ·
pdf-lib · Zod · Vitest · IndexedDB/localStorage (no backend)
