# PH Cheque Writer

A browser-based Philippine cheque writer: fill in and place your cheque
details on a scan of your own cheque, then print them exactly where your
pre-printed bank stock expects them.

**Banks:** AUB · PNB · Landbank · Metrobank · BDO · Security Bank

## Features

- **Cheque Studio** — the cheque scan is the editing surface: click a field
  to edit it in place, or drag chips (Date / Payee / Amount / Crossing) onto
  the cheque to place them
- **Custom "Name" labels** — any number of text labels (e.g. "For Deposit
  Only", "VOID"), each with its own text, size, style, and position
- **Amount in words** — fits the real pre-printed line: shrinks, then wraps
  (max 2 lines) with an overflow warning that blocks printing
- **Date digit spacing** — per-bank digit/group spacing so each digit lands
  inside the printed date cells, no separators
- **Print setup** — paper presets (A4, Letter, Legal, Folio, A5, cheque
  size, custom), portrait/landscape, content rotation for how your printer
  feeds, and a 3×3 anchor grid with fine offsets — saved per bank
- **Printer calibration** — X/Y offsets and a mm ruler grid that uses the
  same print layout as real prints
- **Per-bank layouts** in millimetres that survive reloads, plus a JSON
  backup

## Safety

- Print at **100% / Actual Size**, margins **None**. Test on plain paper first.
- Use only on **your own genuine cheque stock**. The app never prints or
  stores account numbers or MICR data.
- Everything runs in the browser — there is no backend and your data
  (payees, layouts, cheque images) never leaves this device. Clearing site
  data erases it, so use **File → Export data** for backups.
- Not affiliated with any bank.

> Bank template coordinates are starting values tuned from sample scans —
> verify them against your own cheque and drag fields to fine-tune.

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
| `npm test` | Unit tests (Vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` | ESLint |

## Deploying to Vercel

1. Push this repository to GitHub.
2. On [vercel.com](https://vercel.com), **Add New → Project** and import the
   repository — Vercel auto-detects Next.js; no env vars are needed.

## Architecture

```
app/                   Next.js App Router pages (/, /system, /calibrate)
components/            ChequeCanvas, chips, dialogs, AppShell, PdfDialog
hooks/                 useChequeImage (IndexedDB per-bank cheque images)
lib/
  amountToWords.ts     peso wording engine
  banks.ts             bank list + per-bank print templates
  calibration.ts       mm↔px conversion, clamping, snapping, field overrides
  chequeSchema.ts      Zod validation, crossing/wording enums, date warnings
  customFields.ts      multi-instance "Name" label model
  dateSpacing.ts       date digit-cell spacing math
  draftStore.ts        persisted form draft (survives navigation)
  layoutAmountWords.ts single-source amount-words layout (screen = print)
  printLayout.ts       paper presets, orientation, rotation, anchors
  generatePdf.ts       unified pdf-lib print pipeline
  storage.ts           localStorage state, versioned export/import backup
docs/
  design.md            design language (palette, typography, motion)
  calibration.md       measuring your cheque and tuning the printer
```

One model governs everything: **positions are millimetres from the cheque's
top-left**, used identically by the on-screen overlay, the preview, and the
printed PDF — what you see is what prints, at any zoom level or printer
scale. The print pipeline draws the cheque once in that mm space and places
it on the paper (preset/orientation/rotation/anchor), so screen and print
can never diverge.

**Tech stack:** Next.js 14 · TypeScript · Tailwind CSS v4 · shadcn/ui ·
pdf-lib · Zod · Vitest · localStorage/IndexedDB.
