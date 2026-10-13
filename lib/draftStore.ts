import { BANKS, type BankId } from "./banks";
import { sanitizeCustomFields, type CustomTextField } from "./customFields";
import { bankIdSchema, crossingSchema, type Capitalization, type Crossing } from "./chequeSchema";

/**
 * The cheque draft (Fix 3b): survives navigation between /system and
 * /calibrate because it lives in a context provider in the root layout,
 * persisted to localStorage (debounced) under a key that is NOT part of the
 * export/import backup.
 */

export interface ChequeDraft {
  bankId: BankId;
  includeDate: boolean;
  isoDate: string;
  includePayee: boolean;
  payee: string;
  includeAmount: boolean;
  amountText: string;
  crossing: Crossing;
  capitalization: Capitalization;
  suffixOnly: boolean;
  omitZeroCentavos: boolean;
  customFields: CustomTextField[];
}

export const DRAFT_STORAGE_KEY = "ph-cheque-writer:draft";

export const DEFAULT_DRAFT: ChequeDraft = {
  bankId: BANKS[0].id,
  includeDate: false,
  isoDate: "",
  includePayee: false,
  payee: "",
  includeAmount: false,
  amountText: "",
  crossing: "none",
  capitalization: "title",
  suffixOnly: true,
  omitZeroCentavos: false,
  customFields: [],
};

/** Validates a stored draft; bad fields fall back to defaults individually. */
export function sanitizeDraft(raw: unknown): ChequeDraft {
  if (!raw || typeof raw !== "object") return DEFAULT_DRAFT;
  const v = raw as Partial<ChequeDraft>;
  return {
    bankId: bankIdSchema.safeParse(v.bankId).success ? (v.bankId as BankId) : DEFAULT_DRAFT.bankId,
    includeDate: typeof v.includeDate === "boolean" ? v.includeDate : DEFAULT_DRAFT.includeDate,
    isoDate: typeof v.isoDate === "string" ? v.isoDate : DEFAULT_DRAFT.isoDate,
    includePayee: typeof v.includePayee === "boolean" ? v.includePayee : DEFAULT_DRAFT.includePayee,
    payee: typeof v.payee === "string" ? v.payee.slice(0, 200) : DEFAULT_DRAFT.payee,
    includeAmount: typeof v.includeAmount === "boolean" ? v.includeAmount : DEFAULT_DRAFT.includeAmount,
    amountText: typeof v.amountText === "string" ? v.amountText.slice(0, 40) : DEFAULT_DRAFT.amountText,
    crossing: crossingSchema.safeParse(v.crossing).success ? (v.crossing as Crossing) : DEFAULT_DRAFT.crossing,
    capitalization:
      v.capitalization === "upper" || v.capitalization === "lower" || v.capitalization === "title"
        ? v.capitalization
        : DEFAULT_DRAFT.capitalization,
    suffixOnly: typeof v.suffixOnly === "boolean" ? v.suffixOnly : DEFAULT_DRAFT.suffixOnly,
    omitZeroCentavos:
      typeof v.omitZeroCentavos === "boolean" ? v.omitZeroCentavos : DEFAULT_DRAFT.omitZeroCentavos,
    customFields: sanitizeCustomFields(v.customFields),
  };
}
