import { z } from 'zod';

import {
  cleanFieldOverrides,
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
  const { payees, lastBank, offsets, fieldOverrides, dateSpacing, customFields, savedNames } = result.data;
  return { ok: true, data: { payees, lastBank, offsets, fieldOverrides, dateSpacing, customFields, savedNames } };
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
