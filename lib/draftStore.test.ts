import { describe, expect, it } from "vitest";

import {
  DEFAULT_DRAFT,
  sanitizeDraft,
  type ChequeDraft,
} from "./draftStore";

const validDraft: ChequeDraft = {
  bankId: "aub",
  includeDate: true,
  isoDate: "2026-03-08",
  includePayee: true,
  payee: "Juan Dela Cruz",
  includeAmount: true,
  amountText: "1,234.56",
  crossing: "account-payee-only",
  capitalization: "upper",
  suffixOnly: false,
  omitZeroCentavos: true,
  customFields: [
    { id: "a", text: "VOID", x: 50, y: 30, fontSize: 12, bold: true, uppercase: true, align: "center" },
  ],
};

describe("sanitizeDraft", () => {
  it("round-trips a valid draft", () => {
    expect(sanitizeDraft(validDraft)).toEqual(validDraft);
  });

  it("falls back to defaults for garbage input", () => {
    expect(sanitizeDraft(null)).toEqual(DEFAULT_DRAFT);
    expect(sanitizeDraft("nope")).toEqual(DEFAULT_DRAFT);
  });

  it("drops invalid fields individually", () => {
    const draft = sanitizeDraft({
      ...validDraft,
      bankId: "chase",
      crossing: "sideways",
      capitalization: "scream",
      payee: 42,
      customFields: [{ id: "bad", text: "", x: 0, y: 0, fontSize: 1, bold: false, uppercase: false, align: "left" }],
    });
    expect(draft.bankId).toBe(DEFAULT_DRAFT.bankId);
    expect(draft.crossing).toBe(DEFAULT_DRAFT.crossing);
    expect(draft.capitalization).toBe(DEFAULT_DRAFT.capitalization);
    expect(draft.payee).toBe(DEFAULT_DRAFT.payee);
    expect(draft.customFields).toEqual([]);
    expect(draft.includeDate).toBe(true); // valid field kept
  });

  it("caps free-text lengths", () => {
    const draft = sanitizeDraft({
      ...validDraft,
      payee: "x".repeat(500),
      amountText: "9".repeat(100),
    });
    expect(draft.payee.length).toBeLessThanOrEqual(200);
    expect(draft.amountText.length).toBeLessThanOrEqual(40);
  });
});
