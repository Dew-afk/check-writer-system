import { z } from 'zod';

import {
  cleanFieldOverrides,
  sanitizeOffset,
  type FieldId,
  type FieldOverrides,
} from './calibration';
import { bankIdSchema } from './chequeSchema';
import {
  DEFAULT_DATE_SPACING,
  sanitizeDateSpacing,
  type DateSpacing,
} from './dateSpacing';
import {
  BANK_TEMPLATES,
  CHEQUE_HEIGHT_MM,
  CHEQUE_WIDTH_MM,
  type BankId,
} from './banks';
import {
  sanitizeCustomFields,
  sanitizeSavedNames,
  type CustomTextField,
} from './customFields';
import {
  DEFAULT_PRINT_LAYOUT,
  sanitizePrintLayout,
  type PrintLayout,
} from './printLayout';

/**
 * Local-only storage: payees, last-used bank, per-bank printer offsets, and
 * per-bank field layouts live in the user's browser (localStorage). Clearing
 * site data erases them, hence the Export/Import JSON backup in the File
 * menu. All writes report success so the UI can surface storage failures
 * (private mode, quota) instead of failing silently.
 */

export interface Payee {
  id: string;
  name: string;
}

export interface Offset {
  x: number;
  y: number;
}

export interface StoredState {
  payees: Payee[];
  lastBank: BankId | null;
  /** Layer (b): global per-bank printer calibration shift (Calibrate page). */
  offsets: Partial<Record<BankId, Offset>>;
  /** Layer (a): per-bank field layout (dragged positions), mm from top-left. */
  fieldOverrides: Partial<Record<BankId, FieldOverrides>>;
  /** Per-bank date digit spacing (Task B), mm. */
  dateSpacing: Partial<Record<BankId, DateSpacing>>;
  /** Per-bank multi-instance custom text labels (Name fields), mm. */
  customFields: Partial<Record<BankId, CustomTextField[]>>;
  /** Remembered custom-label texts, reusable when editing instances. */
  savedNames: string[];
  /** Per-bank override of the amount-words line width (mm). */
  wordsWidthOverrides: Partial<Record<BankId, number>>;
  /** Per-bank print layout (paper, orientation, rotation, anchor). */
  printLayouts: Partial<Record<BankId, PrintLayout>>;
  /**
   * Per-bank screen guide: show the cheque border/scan on the editing
   * canvas. Default ON; never affects what prints.
   */
  showBorderOnScreen: Partial<Record<BankId, boolean>>;
}

const STORAGE_KEY = 'ph-cheque-writer:v1';
export const BACKUP_VERSION = 2;

const payeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
});

const offsetSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

/**
 * Field layouts: each bank maps field ids to mm positions. Entries are
 * validated individually in the transform (via cleanFieldOverrides), so one
 * bad entry can never wipe a whole layout.
 */
const fieldOverridesSchema = z
  .record(z.string(), z.record(z.string(), z.unknown()))
  .catch({})
  .transform((raw) => {
    const out: Partial<Record<BankId, FieldOverrides>> = {};
    for (const [bankKey, fields] of Object.entries(raw)) {
      if (!bankIdSchema.safeParse(bankKey).success) continue;
      const cleaned = cleanFieldOverrides(fields);
      if (Object.keys(cleaned).length > 0) {
        out[bankKey as BankId] = cleaned;
      }
    }
    return out;
  });

const storedStateSchema = z.object({
  payees: z.array(payeeSchema),
  lastBank: bankIdSchema.nullable(),
  offsets: z
    .record(z.string(), offsetSchema)
    .superRefine((offsets, ctx) => {
      for (const key of Object.keys(offsets)) {
        if (!bankIdSchema.safeParse(key).success) {
          ctx.addIssue({
            code: 'custom',
            message: `unknown bank id: ${key}`,
          });
        }
      }
    })
    .transform((offsets) => {
      // Out-of-range saved offsets (bad layout data) fall back to the
      // clamped ±10mm range instead of shifting fields off the cheque.
      const out: Partial<Record<BankId, Offset>> = {};
      for (const [key, value] of Object.entries(offsets)) {
        if (bankIdSchema.safeParse(key).success) {
          out[key as BankId] = sanitizeOffset(value);
        }
      }
      return out;
    }),
  fieldOverrides: fieldOverridesSchema,
  dateSpacing: z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((raw) => {
      const out: Partial<Record<BankId, DateSpacing>> = {};
      for (const [bankKey, value] of Object.entries(raw)) {
        if (!bankIdSchema.safeParse(bankKey).success) continue;
        const spacing = sanitizeDateSpacing(value);
        if (spacing) out[bankKey as BankId] = spacing;
      }
      return out;
    }),
  customFields: z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((raw) => {
      const out: Partial<Record<BankId, CustomTextField[]>> = {};
      for (const [bankKey, value] of Object.entries(raw)) {
        if (!bankIdSchema.safeParse(bankKey).success) continue;
        const fields = sanitizeCustomFields(value);
        if (fields.length > 0) out[bankKey as BankId] = fields;
      }
      return out;
    }),
  savedNames: z.unknown().catch([]).transform((raw) => sanitizeSavedNames(raw)),
  wordsWidthOverrides: z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((raw) => {
      const out: Partial<Record<BankId, number>> = {};
      for (const [bankKey, value] of Object.entries(raw)) {
        if (!bankIdSchema.safeParse(bankKey).success) continue;
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        // Must leave room on the cheque to the right of the field's x;
        // anything beyond that (or below 20mm) is an invalid saved layout
        // and falls back to the bank's factory line length.
        const bank = BANK_TEMPLATES[bankKey as BankId];
        const max = CHEQUE_WIDTH_MM - bank.fields.amountWords.x;
        if (value < 20 || value > max) continue;
        out[bankKey as BankId] = Math.round(value * 10) / 10;
      }
      return out;
    }),
  printLayouts: z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((raw) => {
      const out: Partial<Record<BankId, PrintLayout>> = {};
      for (const [bankKey, value] of Object.entries(raw)) {
        if (!bankIdSchema.safeParse(bankKey).success) continue;
        const layout = sanitizePrintLayout(value);
        if (layout) out[bankKey as BankId] = layout;
      }
      return out;
    }),
  // Optional field: backups exported before this feature lack the key and
  // fall back to the default (border ON screen, never printed).
  showBorderOnScreen: z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((raw) => {
      const out: Partial<Record<BankId, boolean>> = {};
      for (const [bankKey, value] of Object.entries(raw)) {
        if (!bankIdSchema.safeParse(bankKey).success) continue;
        if (typeof value !== "boolean") continue;
        out[bankKey as BankId] = value;
      }
      return out;
    }),
});

/** Accepts v1 backups (without or with loose layouts) and current v2 files. */
const backupSchema = storedStateSchema.extend({
  app: z.literal('ph-cheque-writer'),
  version: z.union([z.literal(1), z.literal(BACKUP_VERSION)]),
  exportedAt: z.string().min(1),
});

const DEFAULT_STATE: StoredState = {
  payees: [],
  lastBank: null,
  offsets: {},
  fieldOverrides: {},
  dateSpacing: {},
  customFields: {},
  savedNames: [],
  wordsWidthOverrides: {},
  printLayouts: {},
  showBorderOnScreen: {},
};

function getLocalStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  // Test environments (Node) can provide a global localStorage mock.
  if (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { localStorage?: unknown }).localStorage === 'object'
  ) {
    return (globalThis as { localStorage: Storage }).localStorage;
  }
  return null;
}

function readRaw(): string | null {
  try {
    return getLocalStorage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeRaw(value: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return true; // SSR: nothing to persist
  try {
    storage.setItem(STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function loadStoredState(): StoredState {
  const raw = readRaw();
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = storedStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

/** Persists state; returns false when storage is unavailable (quota/private). */
export function saveStoredState(state: StoredState): boolean {
  return writeRaw(JSON.stringify(state));
}

export function getPayees(): Payee[] {
  return loadStoredState().payees;
}

export function savePayees(payees: Payee[]): void {
  const state = loadStoredState();
  saveStoredState({ ...state, payees });
}

export function getLastBank(): BankId | null {
  return loadStoredState().lastBank;
}

export function setLastBank(bankId: BankId): void {
  const state = loadStoredState();
  saveStoredState({ ...state, lastBank: bankId });
}

/** Layer (b): calibration offsets (Calibrate page). */
export function getOffset(bankId: BankId): Offset {
  return loadStoredState().offsets[bankId] ?? { x: 0, y: 0 };
}

/** Date digit spacing: saved value → bank factory → global default. */
export function getDateSpacing(bankId: BankId): DateSpacing {
  const saved = loadStoredState().dateSpacing[bankId];
  if (saved) return saved;
  return BANK_TEMPLATES[bankId].dateSpacing ?? DEFAULT_DATE_SPACING;
}

export function saveDateSpacing(bankId: BankId, spacing: DateSpacing): boolean {
  const state = loadStoredState();
  const clean = sanitizeDateSpacing(spacing);
  if (!clean) return false;
  return saveStoredState({
    ...state,
    dateSpacing: { ...state.dateSpacing, [bankId]: clean },
  });
}

export function setOffset(bankId: BankId, offset: Offset): void {
  const state = loadStoredState();
  saveStoredState({
    ...state,
    offsets: { ...state.offsets, [bankId]: offset },
  });
}

/** Layer (a): the saved field layout for a bank ({} = use factory defaults). */
export function getFieldOverrides(bankId: BankId): FieldOverrides {
  return cleanFieldOverrides(loadStoredState().fieldOverrides[bankId] ?? {});
}

/** Saves one field's position (clamped to cheque bounds). */
export function setFieldOverride(
  bankId: BankId,
  fieldId: FieldId,
  pos: { x: number; y: number },
): boolean {
  const state = loadStoredState();
  const bankOverrides = cleanFieldOverrides(state.fieldOverrides[bankId] ?? {});
  bankOverrides[fieldId] = {
    x: Math.min(CHEQUE_WIDTH_MM, Math.max(0, pos.x)),
    y: Math.min(CHEQUE_HEIGHT_MM, Math.max(0, pos.y)),
  };
  return saveStoredState({
    ...state,
    fieldOverrides: { ...state.fieldOverrides, [bankId]: bankOverrides },
  });
}

/** Saves a bank's whole layout in one write (debounced drag saves). */
export function saveFieldOverrides(
  bankId: BankId,
  overrides: FieldOverrides,
): boolean {
  const state = loadStoredState();
  const cleaned = cleanFieldOverrides(overrides);
  return saveStoredState({
    ...state,
    fieldOverrides: {
      ...state.fieldOverrides,
      [bankId]: cleaned,
    },
  });
}

/** Removes one field from a bank's layout (chip off / ✕ on the canvas). */
export function clearFieldOverrideSingle(
  bankId: BankId,
  fieldId: FieldId,
): boolean {
  const state = loadStoredState();
  const bankOverrides = cleanFieldOverrides(state.fieldOverrides[bankId] ?? {});
  delete bankOverrides[fieldId];
  return saveStoredState({
    ...state,
    fieldOverrides: { ...state.fieldOverrides, [bankId]: bankOverrides },
  });
}

/** Resets one bank's layout back to factory defaults. */
export function clearFieldOverrides(bankId: BankId): boolean {
  const state = loadStoredState();
  const next = { ...state.fieldOverrides };
  delete next[bankId];
  return saveStoredState({ ...state, fieldOverrides: next });
}

/** Resets every bank's layout back to factory defaults. */
export function clearAllFieldOverrides(): boolean {
  const state = loadStoredState();
  return saveStoredState({ ...state, fieldOverrides: {} });
}

/** Per-bank print layout (falls back to the default A4 portrait). */
export function getPrintLayout(bankId: BankId): PrintLayout {
  return loadStoredState().printLayouts[bankId] ?? DEFAULT_PRINT_LAYOUT;
}

export function savePrintLayout(bankId: BankId, layout: PrintLayout): boolean {
  const state = loadStoredState();
  const clean = sanitizePrintLayout(layout);
  if (!clean) return false;
  return saveStoredState({
    ...state,
    printLayouts: { ...state.printLayouts, [bankId]: clean },
  });
}

/** Screen guide: show the cheque border/scan on the canvas (default ON). */
export function getShowBorderOnScreen(bankId: BankId): boolean {
  return loadStoredState().showBorderOnScreen[bankId] ?? true;
}

export function saveShowBorderOnScreen(bankId: BankId, on: boolean): boolean {
  const state = loadStoredState();
  return saveStoredState({
    ...state,
    showBorderOnScreen: { ...state.showBorderOnScreen, [bankId]: on },
  });
}

/** Per-bank amount-words line width override (mm), or undefined. */
export function getWordsMaxWidth(bankId: BankId): number | undefined {
  return loadStoredState().wordsWidthOverrides[bankId];
}

export function saveWordsMaxWidth(bankId: BankId, mm: number): boolean {
  const state = loadStoredState();
  const max = CHEQUE_WIDTH_MM - BANK_TEMPLATES[bankId].fields.amountWords.x;
  const clamped = Math.min(max, Math.max(20, Math.round(mm * 10) / 10));
  return saveStoredState({
    ...state,
    wordsWidthOverrides: { ...state.wordsWidthOverrides, [bankId]: clamped },
  });
}

/** Custom text labels (Name fields) for one bank. */
export function getCustomFields(bankId: BankId): CustomTextField[] {
  return sanitizeCustomFields(loadStoredState().customFields[bankId] ?? []);
}

export function saveCustomFields(bankId: BankId, fields: CustomTextField[]): boolean {
  const state = loadStoredState();
  const clean = sanitizeCustomFields(fields);
  return saveStoredState({ ...state, customFields: { ...state.customFields, [bankId]: clean } });
}

export function clearCustomFields(bankId: BankId): boolean {
  const state = loadStoredState();
  const next = { ...state.customFields };
  delete next[bankId];
  return saveStoredState({ ...state, customFields: next });
}

/** Remembered custom-label texts. */
export function getSavedNames(): string[] {
  return loadStoredState().savedNames;
}

export function saveSavedNames(names: string[]): boolean {
  const state = loadStoredState();
  return saveStoredState({ ...state, savedNames: sanitizeSavedNames(names) });
}

/** Serializes the full stored state for the File → Export data menu item. */
export function buildBackupJson(): string {
  const state = loadStoredState();
  return JSON.stringify(
    {
      app: 'ph-cheque-writer',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      ...state,
    },
    null,
    2,
  );
}

export type BackupParseResult =
  | { ok: true; data: StoredState }
  | { ok: false; error: string };

/** Validates a backup file's contents without touching storage (pure). */
export function parseBackupJson(text: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  const result = backupSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: 'The file is not a valid PH Cheque Writer backup.',
    };
  }
  const { payees, lastBank, offsets, fieldOverrides, dateSpacing, customFields, savedNames, wordsWidthOverrides, printLayouts, showBorderOnScreen } = result.data;
  return { ok: true, data: { payees, lastBank, offsets, fieldOverrides, dateSpacing, customFields, savedNames, wordsWidthOverrides, printLayouts, showBorderOnScreen } };
}

export type ImportResult =
  | { ok: true; payeeCount: number }
  | { ok: false; error: string };

/** Validates and replaces the stored state from a backup file. */
export function importBackup(text: string): ImportResult {
  const parsed = parseBackupJson(text);
  if (!parsed.ok) return parsed;
  const ok = saveStoredState(parsed.data);
  if (!ok) {
    return { ok: false, error: 'Could not save — storage may be blocked.' };
  }
  return { ok: true, payeeCount: parsed.data.payees.length };
}
