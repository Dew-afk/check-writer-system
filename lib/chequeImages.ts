import { openDB, type DBSchema } from "idb";

import type { BankId } from "./banks";

/**
 * Per-bank cheque images (user uploads) stored in IndexedDB — they are NOT
 * part of the JSON export/import backup and stay on this device only.
 * Banks without an upload fall back to a bundled image (Metrobank) or none.
 */

const DB_NAME = "ph-cheque-writer-images";
const STORE = "cheques";

/** Bundled cheque visuals shipped with the app. */
export const BUNDLED_CHEQUE_IMAGES: Partial<Record<BankId, string>> = {
  aub: "/cheques/aub-clean.webp",
  metrobank: "/cheques/metrobank-clean.webp",
  pnb: "/cheques/pnb-clean.webp",
  landbank: "/cheques/landbank-clean.webp",
  securitybank: "/cheques/securitybank.webp",
};

interface ChequeImageDB extends DBSchema {
  cheques: {
    key: BankId;
    value: Blob;
  };
}

function getDb() {
  if (typeof indexedDB === "undefined") return null;
  // idb caches the connection per name/version internally.
  return openDB<ChequeImageDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
}

export async function getChequeImage(bankId: BankId): Promise<Blob | null> {
  const db = await getDb();
  if (!db) return null;
  return (await db.get(STORE, bankId)) ?? null;
}

export async function setChequeImage(bankId: BankId, image: Blob): Promise<void> {
  const db = await getDb();
  if (!db) return;
  revokeCachedUrl(bankId);
  await db.put(STORE, image, bankId);
}

export async function deleteChequeImage(bankId: BankId): Promise<void> {
  const db = await getDb();
  if (!db) return;
  revokeCachedUrl(bankId);
  await db.delete(STORE, bankId);
}

export async function hasUploadedImage(bankId: BankId): Promise<boolean> {
  return (await getChequeImage(bankId)) !== null;
}

/**
 * Decides whether an image's aspect ratio is close enough to the cheque's
 * (2.67:1) to be a flat scan that can back the canvas 1:1. Promo graphics
 * (like the bundled Metrobank image) fail this and are shown as reference
 * thumbnails instead.
 */
export function isFlatScanAspect(
  imageAspect: number,
  chequeAspect: number,
): boolean {
  if (!Number.isFinite(imageAspect) || imageAspect <= 0) return false;
  return Math.abs(imageAspect / chequeAspect - 1) < 0.12;
}

/** Cached object URLs for uploaded images, so they aren't recreated per render. */
const objectUrls = new Map<BankId, string>();

function revokeCachedUrl(bankId: BankId): void {
  const existing = objectUrls.get(bankId);
  if (existing) {
    URL.revokeObjectURL(existing);
    objectUrls.delete(bankId);
  }
}

/**
 * Resolves the image to display for a bank: the uploaded image (as an object
 * URL, cached) if one exists, else the bundled image, else null.
 */
export async function getChequeImageUrl(
  bankId: BankId,
): Promise<string | null> {
  const image = await getChequeImage(bankId);
  if (image) {
    const cached = objectUrls.get(bankId);
    if (cached) return cached;
    const url = URL.createObjectURL(image);
    objectUrls.set(bankId, url);
    return url;
  }
  return BUNDLED_CHEQUE_IMAGES[bankId] ?? null;
}
