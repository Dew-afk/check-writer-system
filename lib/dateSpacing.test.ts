import { describe, expect, it } from "vitest";

import {
  dateGroupSizes,
  dateToDigits,
  digitAdvanceMm,
  digitCenterOffsetsMm,
  digitTotalWidthMm,
  sanitizeDateSpacing,
  DEFAULT_DATE_SPACING,
} from "./dateSpacing";

describe("dateToDigits (zero-padding + order)", () => {
  it("pads zeroes and emits digits only (mmddyyyy default)", () => {
    expect(dateToDigits("2026-03-08", "mmddyyyy")).toBe("03082026");
    expect(dateToDigits("2026-11-05", "mmddyyyy")).toBe("11052026");
  });

  it("supports every order option", () => {
    expect(dateToDigits("2026-03-08", "ddmmyyyy")).toBe("08032026");
    expect(dateToDigits("2026-03-08", "yyyymmdd")).toBe("20260308");
  });

  it("handles leap day", () => {
    expect(dateToDigits("2024-02-29", "mmddyyyy")).toBe("02292024");
    expect(dateToDigits("2024-02-29", "ddmmyyyy")).toBe("29022024");
    expect(dateToDigits("2024-02-29", "yyyymmdd")).toBe("20240229");
  });

  it("never emits separators", () => {
    for (const order of ["mmddyyyy", "ddmmyyyy", "yyyymmdd"] as const) {
      const digits = dateToDigits("2026-03-08", order);
      expect(digits).toMatch(/^\d{8}$/);
    }
  });
});

describe("digitCenterOffsetsMm (group gap math)", () => {
  it("steps by digitSpacing inside a group", () => {
    const centers = digitCenterOffsetsMm({ digitSpacing: 4, groupGap: 2, order: "mmddyyyy" }, 8);
    // digits 0 and 1 are in the MM group.
    expect(centers[1] - centers[0]).toBeCloseTo(4, 6);
  });

  it("steps by digitSpacing + groupGap across a group boundary", () => {
    const centers = digitCenterOffsetsMm({ digitSpacing: 4, groupGap: 2, order: "mmddyyyy" }, 8);
    // boundaries after digit 1 (MM→DD) and 3 (DD→YYYY).
    expect(centers[2] - centers[1]).toBeCloseTo(6, 6);
    expect(centers[4] - centers[3]).toBeCloseTo(6, 6);
  });

  it("is zoom/scale independent (mm only, invariant across font sizes)", () => {
    const s = { digitSpacing: 4.2, groupGap: 2.0, order: "mmddyyyy" as const };
    const a = digitCenterOffsetsMm(s, 8);
    const b = digitCenterOffsetsMm(s, 16);
    // The pattern doubles only the first half-advance; gaps are identical.
    expect(a[3] - a[0]).toBeCloseTo(b[3] - b[0], 6);
    expect(a[2] - a[1]).toBeCloseTo(s.digitSpacing + s.groupGap, 6);
  });

  it("places eight digits with correct group sizes per order", () => {
    expect(dateGroupSizes("mmddyyyy")).toEqual([2, 2, 4]);
    expect(dateGroupSizes("ddmmyyyy")).toEqual([2, 2, 4]);
    expect(dateGroupSizes("yyyymmdd")).toEqual([4, 2, 2]);
    for (const order of ["mmddyyyy", "ddmmyyyy", "yyyymmdd"] as const) {
      const centers = digitCenterOffsetsMm({ digitSpacing: 3, groupGap: 1, order }, 10);
      expect(centers).toHaveLength(8);
    }
  });
});

describe("digitAdvanceMm / digitTotalWidthMm", () => {
  it("advance is monospace (0.6em)", () => {
    expect(digitAdvanceMm(10)).toBeCloseTo(10 * 0.6 * 0.3528, 6);
  });

  it("total width = last center + half advance", () => {
    const s = { digitSpacing: 4.2, groupGap: 2, order: "mmddyyyy" as const };
    const centers = digitCenterOffsetsMm(s, 8);
    const total = digitTotalWidthMm(s, 8);
    expect(total).toBeCloseTo(centers[7] + digitAdvanceMm(8) / 2, 6);
  });

  it("groupGap widens the total width", () => {
    const a = digitTotalWidthMm({ digitSpacing: 4, groupGap: 0, order: "mmddyyyy" }, 8);
    const b = digitTotalWidthMm({ digitSpacing: 4, groupGap: 2, order: "mmddyyyy" }, 8);
    expect(b - a).toBeCloseTo(4, 6); // two boundaries × 2mm
  });
});

describe("sanitizeDateSpacing", () => {
  it("accepts valid spacing", () => {
    expect(sanitizeDateSpacing(DEFAULT_DATE_SPACING)).toEqual(DEFAULT_DATE_SPACING);
    expect(sanitizeDateSpacing({ digitSpacing: 0, groupGap: 0, order: "yyyymmdd" })).toEqual({
      digitSpacing: 0,
      groupGap: 0,
      order: "yyyymmdd",
    });
  });

  it.each([
    null,
    "nope",
    {},
    { digitSpacing: NaN, groupGap: 1, order: "mmddyyyy" },
    { digitSpacing: 1, groupGap: Infinity, order: "mmddyyyy" },
    { digitSpacing: -1, groupGap: 1, order: "mmddyyyy" },
    { digitSpacing: 11, groupGap: 1, order: "mmddyyyy" },
    { digitSpacing: 1, groupGap: 20, order: "mmddyyyy" },
    { digitSpacing: 1, groupGap: 1, order: "MMDDYYYY" },
    { digitSpacing: 1, groupGap: 1, order: "mdy" },
  ])("rejects %j", (value) => {
    expect(sanitizeDateSpacing(value)).toBeNull();
  });
});
