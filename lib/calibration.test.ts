import { describe, expect, it } from "vitest";

import {
  MAX_OFFSET_MM,
  approxWrapText,
  clampFieldPos,
  clampOffset,
  anchorFieldPos,
  cleanFieldOverrides,
  dropPointToMm,
  exceedsDragThreshold,
  fieldPositionPct,
  mmPerPx,
  pxDeltaToMm,
  resolveFieldPos,
  roundOffset,
  sanitizeOffset,
  snapToGrid,
} from "./calibration";

describe("roundOffset", () => {
  it.each([
    [0, 0],
    [1.23, 1.2],
    [1.25, 1.3],
    [-0.07, -0.1],
    [9.999, 10],
  ])("rounds %s to %s", (value, expected) => {
    expect(roundOffset(value)).toBe(expected);
  });
});

describe("clampOffset", () => {
  it.each([
    [0, 0],
    [5.5, 5.5],
    [10, 10],
    [10.1, MAX_OFFSET_MM],
    [15, MAX_OFFSET_MM],
    [-10, -MAX_OFFSET_MM],
    [-12.7, -MAX_OFFSET_MM],
    [Infinity, MAX_OFFSET_MM],
    [-Infinity, -MAX_OFFSET_MM],
    [NaN, NaN],
  ])("clamps %s to %s", (value, expected) => {
    expect(clampOffset(value)).toBe(expected);
  });
});

describe("sanitizeOffset", () => {
  it("clamps and rounds both axes", () => {
    expect(sanitizeOffset({ x: 12.345, y: -8.125 })).toEqual({ x: 10, y: -8.1 });
  });
});

describe("fieldPositionPct", () => {
  it("converts mm positions to percentages of the cheque", () => {
    expect(fieldPositionPct(145, 14, { x: 0, y: 0 }, 203.2, 76.2)).toEqual({
      left: (145 / 203.2) * 100,
      top: (14 / 76.2) * 100,
    });
  });

  it("applies the calibration offset", () => {
    const base = fieldPositionPct(20, 32, { x: 0, y: 0 }, 203.2, 76.2);
    const shifted = fieldPositionPct(20, 32, { x: 2, y: -1 }, 203.2, 76.2);
    expect(shifted.left).toBeCloseTo(base.left + (2 / 203.2) * 100);
    expect(shifted.top).toBeCloseTo(base.top + (-1 / 76.2) * 100);
  });
});

describe("resolveFieldPos", () => {
  it("uses the template position when no override exists", () => {
    expect(resolveFieldPos({ x: 121, y: 20 }, undefined)).toEqual({
      x: 121,
      y: 20,
    });
  });

  it("prefers the override and rounds it", () => {
    expect(resolveFieldPos({ x: 121, y: 20 }, { x: 130.04, y: 15.15 })).toEqual({
      x: 130,
      y: 15.2,
    });
  });
});

describe("approxWrapText", () => {
  it("keeps short text on one line", () => {
    expect(approxWrapText("One Thousand Pesos", 72, 17, 2)).toEqual([
      "One Thousand Pesos",
    ]);
  });

  it("wraps long text and truncates with an ellipsis", () => {
    const text =
      "Nine Hundred Ninety-Nine Million Nine Hundred Ninety-Nine Thousand Nine Hundred Ninety-Nine Pesos and 99/100 Only";
    const lines = approxWrapText(text, 72, 17, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("respects maxLines", () => {
    const lines = approxWrapText(
      "One Two Three Four Five Six Seven Eight Nine Ten",
      20,
      17,
      3,
    );
    expect(lines.length).toBeLessThanOrEqual(3);
  });
});

describe('clampFieldPos', () => {
  it('keeps positions inside the cheque bounds', () => {
    expect(clampFieldPos({ x: 100, y: 40 })).toEqual({ x: 100, y: 40 });
    expect(clampFieldPos({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('clamps out-of-bounds positions and rounds', () => {
    expect(clampFieldPos({ x: -5, y: 999 })).toEqual({ x: 0, y: 76.2 });
    expect(clampFieldPos({ x: 203.25, y: 12.345 })).toEqual({ x: 203.2, y: 12.3 });
  });
});

describe('snapToGrid', () => {
  it('snaps to a 0.5 mm grid', () => {
    expect(snapToGrid({ x: 33.26, y: 21.74 }, 0.5)).toEqual({ x: 33.5, y: 21.5 });
    expect(snapToGrid({ x: 33.0, y: 21.0 }, 0.5)).toEqual({ x: 33, y: 21 });
  });

  it('is a no-op for a non-positive grid', () => {
    expect(snapToGrid({ x: 33.26, y: 21.74 }, 0)).toEqual({ x: 33.26, y: 21.74 });
  });
});

describe('mmPerPx / pxDeltaToMm at different zoom levels', () => {
  it.each([
    [500, 0.4064], // half-size canvas
    [1000, 0.2032], // reference width
    [2000, 0.1016], // 200% zoom
  ])('rect %dpx → %s mm/px', (rectPx, expected) => {
    expect(mmPerPx(rectPx, 203.2)).toBeCloseTo(expected, 4);
  });

  it('converts drag deltas at any canvas size', () => {
    // 10px at half-size = 4.064mm; at double-size = 1.016mm
    expect(pxDeltaToMm(10, 500, 203.2)).toBeCloseTo(4.064, 3);
    expect(pxDeltaToMm(10, 2000, 203.2)).toBeCloseTo(1.016, 3);
  });

  it('guards against zero-size rects', () => {
    expect(mmPerPx(0, 203.2)).toBe(0);
  });
});

describe('cleanFieldOverrides', () => {
  it('keeps valid in-bounds entries', () => {
    expect(
      cleanFieldOverrides({ payee: { x: 33.5, y: 21 }, amountNum: { x: 140, y: 35 } }),
    ).toEqual({ payee: { x: 33.5, y: 21 }, amountNum: { x: 140, y: 35 } });
  });

  it('drops unknown fields, non-finite values, and out-of-bounds positions', () => {
    expect(
      cleanFieldOverrides({
        payee: { x: -3, y: 21 }, // out of bounds
        amountNum: { x: NaN, y: 35 }, // non-finite
        crossing: { x: 500, y: 40 }, // out of bounds
        extraField: { x: 10, y: 10 }, // unknown
      }),
    ).toEqual({});
  });

  it('handles garbage input', () => {
    expect(cleanFieldOverrides(null)).toEqual({});
    expect(cleanFieldOverrides('nope')).toEqual({});
    expect(cleanFieldOverrides({ payee: 'x' })).toEqual({});
  });
});

describe('exceedsDragThreshold (click vs drag)', () => {
  it('is false under the 4px threshold', () => {
    expect(exceedsDragThreshold({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
    expect(exceedsDragThreshold({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
  });

  it('is true past the threshold', () => {
    expect(exceedsDragThreshold({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(true);
    expect(exceedsDragThreshold({ x: 0, y: 0 }, { x: 2, y: 4 })).toBe(true);
  });

  it('honours a custom threshold', () => {
    expect(exceedsDragThreshold({ x: 0, y: 0 }, { x: 7, y: 0 }, 10)).toBe(false);
    expect(exceedsDragThreshold({ x: 0, y: 0 }, { x: 11, y: 0 }, 10)).toBe(true);
  });
});

describe('dropPointToMm at different zoom levels', () => {
  const rect = { left: 0, top: 0, width: 1000, height: 375 };
  const rectZoomed = { left: 0, top: 0, width: 2000, height: 750 };

  it('converts a screen point to cheque mm', () => {
    expect(dropPointToMm(500, 187.5, rect)).toEqual({ x: 101.6, y: 38.1 });
  });

  it('accounts for the canvas offset on screen', () => {
    const offsetRect = { left: 120, top: 80, width: 1000, height: 375 };
    const pos = dropPointToMm(620, 267.5, offsetRect);
    expect(pos.x).toBeCloseTo(101.6, 6);
    expect(pos.y).toBeCloseTo(38.1, 6);
  });

  it('gives the same mm at 2x zoom (independent of rendered size)', () => {
    const a = dropPointToMm(500, 187.5, rect);
    const b = dropPointToMm(1000, 375, rectZoomed);
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });
});

describe('anchorFieldPos', () => {
  it('centers boxed fields on the drop point', () => {
    // date: 10 chars at 8pt ≈ 14.1mm wide, 3.4mm tall → halves subtracted.
    const pos = anchorFieldPos('date', { x: 100, y: 30 }, 10, 8);
    expect(pos.x).toBeCloseTo(100 - 14.11 / 2, 1);
    expect(pos.y).toBeCloseTo(30 - 3.39 / 2, 1);
  });

  it('keeps text fields at baseline-left (x unchanged, y lifted)', () => {
    const pos = anchorFieldPos('payee', { x: 40, y: 25 }, 12, 12);
    expect(pos.x).toBe(40);
    expect(pos.y).toBeCloseTo(25 - 12 * 0.3528 * 0.75, 3);
  });

  it('centers the crossing block', () => {
    const pos = anchorFieldPos('crossing', { x: 100, y: 40 }, 8, 7);
    expect(pos.x).toBeCloseTo(100 - 15, 3);
    expect(pos.y).toBeCloseTo(40 - 5, 3);
  });
});
