import { describe, expect, it } from "vitest";

import {
  makeCustomFieldId,
  offsetForDuplicate,
  sanitizeCustomField,
  sanitizeCustomFields,
  sanitizeSavedNames,
  spawnDefaultPosition,
  MAX_CUSTOM_FIELDS_PER_BANK,
  MAX_CUSTOM_TEXT_LENGTH,
} from "./customFields";

const valid = {
  id: "a1",
  text: "For Deposit Only",
  x: 50,
  y: 30,
  fontSize: 12,
  bold: false,
  uppercase: false,
  align: "left" as const,
};

describe("sanitizeCustomField", () => {
  it("accepts a valid instance", () => {
    expect(sanitizeCustomField(valid)).toEqual(valid);
  });

  it("accepts optional maxWidthMm only when in range", () => {
    expect(sanitizeCustomField({ ...valid, maxWidthMm: 60 })).toMatchObject({
      maxWidthMm: 60,
    });
    expect(sanitizeCustomField({ ...valid, maxWidthMm: 1 })).not.toHaveProperty(
      "maxWidthMm",
    );
  });

  it("clamps out-of-bounds positions", () => {
    const field = sanitizeCustomField({ ...valid, x: -10, y: 999 });
    expect(field).toMatchObject({ x: 0, y: 76.2 });
  });

  it.each([
    { ...valid, id: "" },
    { ...valid, text: "" },
    { ...valid, text: "x".repeat(MAX_CUSTOM_TEXT_LENGTH + 1) },
    { ...valid, x: NaN },
    { ...valid, fontSize: 4 },
    { ...valid, fontSize: 60 },
    { ...valid, fontSize: "12" },
    { ...valid, bold: "yes" },
    { ...valid, align: "right" },
    null,
    "nope",
  ])("rejects %j", (raw) => {
    expect(sanitizeCustomField(raw)).toBeNull();
  });
});

describe("sanitizeCustomFields (collection)", () => {
  it("drops bad entries and duplicate ids, keeps the rest in order", () => {
    const out = sanitizeCustomFields([
      valid,
      { ...valid, id: "a1", x: 10 }, // duplicate id — dropped
      { ...valid, id: "", x: 10 }, // bad — dropped
      { ...valid, id: "a2", x: 70 },
    ]);
    expect(out.map((f) => f.id)).toEqual(["a1", "a2"]);
  });

  it("caps the count per bank", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...valid, id: `id-${i}` }));
    expect(sanitizeCustomFields(many)).toHaveLength(MAX_CUSTOM_FIELDS_PER_BANK);
  });
});

describe("spawnDefaultPosition", () => {
  it("avoids existing instances", () => {
    const pos = spawnDefaultPosition([{ ...valid, x: 25, y: 28 }]);
    expect(Math.abs(pos.x - 25) >= 16 || Math.abs(pos.y - 28) >= 7).toBe(true);
  });

  it("always returns a position inside the cheque", () => {
    const crowded = Array.from({ length: 30 }, (_, i) => ({
      ...valid,
      id: `c${i}`,
      x: 25 + i,
      y: 28,
    }));
    const pos = spawnDefaultPosition(crowded);
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.x).toBeLessThanOrEqual(203.2);
    expect(pos.y).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeLessThanOrEqual(76.2);
  });
});

describe("offsetForDuplicate", () => {
  it("offsets by 5mm and clamps", () => {
    expect(offsetForDuplicate({ x: 50, y: 30 })).toEqual({ x: 55, y: 35 });
    const clamped = offsetForDuplicate({ x: 201, y: 74 });
    expect(clamped.x).toBeLessThanOrEqual(203.2);
    expect(clamped.y).toBeLessThanOrEqual(76.2);
  });
});

describe("makeCustomFieldId", () => {
  it("generates unique ids", () => {
    const ids = Array.from({ length: 50 }, () => makeCustomFieldId());
    expect(new Set(ids).size).toBe(50);
    for (const id of ids) expect(id.length).toBeGreaterThan(5);
  });
});

describe("sanitizeSavedNames", () => {
  it("trims, dedupes case-insensitively, and caps", () => {
    expect(sanitizeSavedNames([" Juan ", "juan", "", "Maria", "Maria"])).toEqual([
      "Juan",
      "Maria",
    ]);
    const many = Array.from({ length: 250 }, (_, i) => `Name ${i}`);
    expect(sanitizeSavedNames(many)).toHaveLength(200);
  });

  it("rejects non-strings and overlong entries", () => {
    expect(sanitizeSavedNames([42, "x".repeat(MAX_CUSTOM_TEXT_LENGTH + 1)])).toEqual([]);
  });
});
