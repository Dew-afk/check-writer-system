# Plan: Philippine Cheque Writer

## 1. Objective

A web app that lets a user pick a bank, enter date, payee, and amount, then print the values at the correct positions on a pre-printed physical cheque. It replicates the workflow of a desktop cheque-writing tool: bank dropdown, date with checkbox, payee combo box with a "..." list manager, amount with a crossing dropdown, wording language, and a Print button.

**Supported banks:** AUB, PNB, Landbank, Metrobank, BDO, Security Bank.

## 2. Tech stack (Vercel-friendly, no backend needed)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14+ (App Router), TypeScript | Zero-config Vercel deploy |
| UI | Tailwind + shadcn/ui | Easy to mimic the compact desktop-style form |
| PDF generation | pdf-lib (client-side) | Exact millimeter placement, no server cost |
| Storage | localStorage or IndexedDB (via idb) | Payee list and calibration stay on the user's device |
| Amount to words | Custom TS module with unit tests (Vitest) | Must be correct to the centavo |
| Validation | Zod | Prevents bad amounts and dates |
| Hosting | Vercel | Everything runs in the browser, so no serverless limits apply |

## 3. Architecture

```
/app
  page.tsx                  → main form (desktop-style window)
  calibrate/page.tsx        → per-bank offset tuning + test print
/components
  ChequeForm.tsx
  PayeeManager.tsx          → "..." dialog (add/edit/delete payees)
  PrintPreview.tsx          → overlay of text on cheque outline
/lib
  banks.ts                  → template config per bank
  amountToWords.ts          → PHP wording (Pesos and 50/100 Only)
  generatePdf.ts            → pdf-lib: page = cheque size, text at mm coords
  storage.ts                → payees, last bank, calibration offsets
```

Template config (data-driven, so adding a bank means adding JSON):

```ts
type BankTemplate = {
  id: 'aub'|'pnb'|'landbank'|'metrobank'|'bdo'|'securitybank';
  name: string;
  widthMm: number; heightMm: number;
  fields: {
    date:        { x: number; y: number; fontSize: number; format: string };
    payee:       { x: number; y: number; maxWidth: number };
    amountNum:   { x: number; y: number };
    amountWords: { x: number; y: number; maxWidth: number; lines: number };
    crossing:    { x: number; y: number; rotate?: number };
  };
};
```

**Data flow:** Form → Zod validation → amountToWords → generatePdf(template + user offsets) → open the PDF in a new tab → user prints at 100% / Actual Size.

## 4. Limitations (be upfront about these)

- **Cheque coordinates are not guaranteed.** The exact field positions and dimensions of each bank's current cheque stock cannot be verified, and banks change designs. All six templates ship as placeholders and must be measured against a real cheque with a ruler, then tuned in the Calibrate page.
- **Printer variance.** Every printer feeds paper slightly differently. Hence the per-bank X/Y offset calibration and test-print-on-plain-paper workflow.
- **Browser print scaling.** The user must print at 100% / Actual Size with no margins or "fit to page". The app can't force this, so show a warning.
- **Feed mechanics.** Many printers can't take small cheque-size paper. Options are a carrier sheet or a full A4 page with the cheque position offset (add a "print on A4 at position" mode).
- **No MICR / account-number printing.** These are pre-printed on genuine cheque stock, and MICR needs special magnetic ink. The app never prints them.
- **Local-only data.** Payees are tied to one browser and device. Clearing site data erases them, so add Export/Import JSON.
- **No audit trail or cheque numbering in v1** (keep it out of scope, or add an optional local log).
- **Wording limits.** English only in v1. Filipino wording is optional and needs careful review.
- **Misuse and legal.** The tool is for printing on your own genuine cheque stock only. Don't add features that imitate bank security features, and add a disclaimer that users are responsible for verifying printed cheques. The app is not affiliated with any bank, and existing product names and branding must not be copied.
- **Cheque rules vary.** The six-month staleness, post-dating, and bank-specific acceptance of crossings aren't enforced by the app, so only show gentle warnings.

## 5. Build prompt

Build a Next.js 14 (App Router, TypeScript, Tailwind, shadcn/ui) web app called
"PH Cheque Writer", deployable to Vercel with zero backend. It replicates the
workflow of a desktop cheque-writing tool.

BANKS (only these six): AUB, PNB, Landbank, Metrobank, BDO, Security Bank.

UI (single compact "window" card, desktop-app look, light blue-gray background):
- Top menu bar: File (Export/Import data), Tools (Calibrate), Help, About.
- Row 1: Bank dropdown (the six banks) | checkbox + date picker (default today,
  format MM/DD/YYYY, checkbox toggles whether date is printed).
- Row 2: checkbox + Payee combo box (autocomplete from saved payees) + "..."
  button opening a Payee Manager dialog (add/edit/delete, saved locally).
- Row 3: checkbox + Amount numeric input (2 decimals, max 999,999,999.99) +
  Crossing dropdown: "None", "Account Payee Only", "Cross A/C Payee + Or Bearer",
  "Not Negotiable". (Each checkbox toggles whether that field is printed.)
- Row 4: "Wording" button (opens options: capitalization style, suffix "Only")
  + read-only language field "English".
- Footer: "Country: Philippines (PHP)", and a Print button with a dropdown:
  "Print Cheque (PDF)", "Print Preview", "Print on A4 at offset".

CORE LOGIC:
- lib/amountToWords.ts: converts to Philippine style, e.g.
  "One Thousand Two Hundred Thirty-Four Pesos and 50/100 Only". Handle zero
  centavos ("and 00/100"), singular "One Peso", millions/billions. Include
  Vitest unit tests with edge cases.
- lib/banks.ts: data-driven BankTemplate per bank (widthMm, heightMm, and x/y/
  fontSize/maxWidth in millimeters for date, payee, amountNum, amountWords
  (multi-line wrap), crossing). Use CLEARLY LABELED PLACEHOLDER coordinates with
  a TODO comment; do not claim they match real cheques.
- lib/generatePdf.ts: use pdf-lib client-side. Page size = cheque size in mm
  (converted to points). Draw text at coordinates plus the user's saved X/Y
  offset for that bank. Crossing renders as two parallel diagonal lines with
  text. Open the PDF in a new tab. No server calls.
- Calibrate page: per-bank X/Y offset sliders (±10mm, 0.1mm steps), a live
  preview overlay on an outline of the cheque, and a "Print test on plain
  paper" button that draws a ruler grid. Persist offsets.
- Storage: IndexedDB/localStorage for payees, last-used bank, offsets. Export/
  Import JSON backup.

SAFETY/UX:
- Show a persistent notice: "Print at 100% / Actual Size, margins None. Test on
  plain paper first. Use only on your own genuine cheque stock."
- Never print or store account numbers or MICR data.
- Warn (don't block) if the date is more than 6 months old or post-dated.
- Validate everything with Zod; disable Print until required checked fields
  are valid.
- Do not use the name or branding of any existing product or bank logos.

DELIVERABLES: full source, README with Vercel deploy steps (import repo, no env
vars needed), a docs/calibration.md explaining how to measure a real cheque in
millimeters, and tests for amountToWords.

## 6. Suggested build order

1. `amountToWords` plus tests (the riskiest logic).
2. Form UI and storage.
3. `generatePdf` with one bank and a test grid.
4. Calibrate page.
5. Measure each real cheque, fill the six templates, and test-print.
6. Deploy to Vercel.
