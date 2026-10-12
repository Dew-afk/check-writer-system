import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import {
  deleteChequeImage,
  getChequeImage,
  getChequeImageUrl,
  hasUploadedImage,
  isFlatScanAspect,
  setChequeImage,
} from "./chequeImages";

async function blobText(blob: Blob): Promise<string> {
  return blob.text();
}

describe("chequeImages", () => {
  describe("isFlatScanAspect", () => {
    const chequeAspect = 203.2 / 76.2; // ≈ 2.67

    it("accepts scan-like aspect ratios", () => {
      expect(isFlatScanAspect(2540 / 952, chequeAspect)).toBe(true);
      expect(isFlatScanAspect(chequeAspect, chequeAspect)).toBe(true);
      expect(isFlatScanAspect(2.55, chequeAspect)).toBe(true);
    });

    it("rejects promo-graphic aspect ratios", () => {
      expect(isFlatScanAspect(244 / 188, chequeAspect)).toBe(false); // bundled Metrobank
      expect(isFlatScanAspect(1, chequeAspect)).toBe(false);
      expect(isFlatScanAspect(4, chequeAspect)).toBe(false);
    });

    it("rejects garbage input", () => {
      expect(isFlatScanAspect(NaN, chequeAspect)).toBe(false);
      expect(isFlatScanAspect(Infinity, chequeAspect)).toBe(false);
      expect(isFlatScanAspect(0, chequeAspect)).toBe(false);
      expect(isFlatScanAspect(-2, chequeAspect)).toBe(false);
    });
  });

  it("returns null when no image is stored", async () => {
    expect(await getChequeImage("aub")).toBeNull();
    expect(await hasUploadedImage("aub")).toBe(false);
  });

  it("stores and retrieves an image blob", async () => {
    await setChequeImage("bdo", new Blob(["fake-image"], { type: "image/png" }));
    const stored = await getChequeImage("bdo");
    expect(stored).not.toBeNull();
    expect(await blobText(stored as Blob)).toBe("fake-image");
    expect(await hasUploadedImage("bdo")).toBe(true);
    await deleteChequeImage("bdo"); // leave no trace for other tests
  });

  it("overwrites an existing image", async () => {
    await setChequeImage("pnb", new Blob(["v1"], { type: "image/png" }));
    await setChequeImage("pnb", new Blob(["v2"], { type: "image/png" }));
    expect(await blobText((await getChequeImage("pnb")) as Blob)).toBe("v2");
  });

  it("deletes an image", async () => {
    await setChequeImage("landbank", new Blob(["x"], { type: "image/png" }));
    await deleteChequeImage("landbank");
    expect(await getChequeImage("landbank")).toBeNull();
    expect(await hasUploadedImage("landbank")).toBe(false);
  });

  it("falls back to the bundled Metrobank image", async () => {
    expect(await getChequeImageUrl("metrobank")).toBe("/cheques/metrobank-clean.webp");
  });

  it("falls back to the bundled Security Bank image", async () => {
    expect(await getChequeImageUrl("securitybank")).toBe("/cheques/securitybank.webp");
  });

  it("returns null for banks with no bundled or uploaded image", async () => {
    expect(await getChequeImageUrl("bdo")).toBeNull();
  });

  it("serves an uploaded image as a cached object URL", async () => {
    await setChequeImage(
      "aub",
      new Blob(["img"], { type: "image/webp" }),
    );
    const url = await getChequeImageUrl("aub");
    expect(url).toMatch(/^blob:/);
    // Cached: the same URL comes back without creating a new one.
    expect(await getChequeImageUrl("aub")).toBe(url);
  });

  it("falls back to the bundled image after the upload is removed", async () => {
    await setChequeImage(
      "metrobank",
      new Blob(["mine"], { type: "image/webp" }),
    );
    expect(await getChequeImageUrl("metrobank")).toMatch(/^blob:/);
    await deleteChequeImage("metrobank");
    expect(await getChequeImageUrl("metrobank")).toBe("/cheques/metrobank-clean.webp");
  });
});
