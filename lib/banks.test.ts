import { describe, expect, it } from "vitest";

import { BANK_TEMPLATES, CHEQUE_WIDTH_MM, copyLayoutAsCode } from "./banks";

describe("copyLayoutAsCode", () => {
  it("emits a pasteable template entry with factory positions", () => {
    const snippet = copyLayoutAsCode("bdo", {});
    expect(snippet).toContain("id: 'bdo'");
    expect(snippet).toContain("name: 'BDO'");
    expect(snippet).toContain("widthMm: CHEQUE_WIDTH_MM");
    expect(snippet).toContain("date: { x:");
    expect(snippet).toContain("crossing: {");
    // Factory payee x must appear (e.g. bdo placeholder x=20).
    expect(snippet).toContain(
      `payee: { x: ${BANK_TEMPLATES.bdo.fields.payee.x}`,
    );
  });

  it("merges dragged positions over the factory values", () => {
    const snippet = copyLayoutAsCode("metrobank", {
      payee: { x: 33.3, y: 21.7 },
    });
    expect(snippet).toContain("payee: { x: 33.3, y: 21.7");
    // Untouched fields keep factory positions.
    expect(snippet).toContain(
      `amountNum: { x: ${BANK_TEMPLATES.metrobank.fields.amountNum.x}`,
    );
  });

  it("rounds positions to one decimal", () => {
    const snippet = copyLayoutAsCode("aub", {
      date: { x: 125.05, y: 4.56 },
    });
    expect(snippet).toContain("date: { x: 125.1, y: 4.6");
  });

  it("keeps cheque dimensions constant", () => {
    expect(CHEQUE_WIDTH_MM).toBe(203.2);
    const snippet = copyLayoutAsCode("securitybank", {});
    expect(snippet).toContain("heightMm: CHEQUE_HEIGHT_MM");
  });
});
