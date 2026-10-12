"use client";

import { useCallback, useEffect, useState } from "react";

import { BANK_TEMPLATES, type BankId } from "@/lib/banks";
import {
  deleteChequeImage,
  getChequeImageUrl,
  hasUploadedImage,
  isFlatScanAspect,
  setChequeImage,
} from "@/lib/chequeImages";

/**
 * Loads/upload/removes the per-bank cheque image shown on the canvas, and
 * measures its aspect ratio to decide whether it is a flat scan (can back the
 * canvas 1:1) or a promo graphic (shown as a reference thumbnail instead).
 */
export function useChequeImage(bankId: BankId) {
  const [url, setUrl] = useState<string | null>(null);
  const [hasUpload, setHasUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFlatScan, setIsFlatScan] = useState(false);

  const measureAspect = useCallback(
    (imageUrl: string | null, cancelled: () => boolean) => {
      if (!imageUrl) {
        setIsFlatScan(false);
        return;
      }
      const image = new Image();
      image.onload = () => {
        if (cancelled()) return;
        const template = BANK_TEMPLATES[bankId];
        setIsFlatScan(
          isFlatScanAspect(
            image.naturalWidth / image.naturalHeight,
            template.widthMm / template.heightMm,
          ),
        );
      };
      image.src = imageUrl;
    },
    [bankId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIsFlatScan(false);
    void (async () => {
      const [imageUrl, uploaded] = await Promise.all([
        getChequeImageUrl(bankId),
        hasUploadedImage(bankId),
      ]);
      if (cancelled) return;
      setUrl(imageUrl);
      setHasUpload(uploaded);
      setLoading(false);
      measureAspect(imageUrl, () => cancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, [bankId, measureAspect]);

  const upload = useCallback(
    async (file: File) => {
      await setChequeImage(bankId, file);
      const imageUrl = await getChequeImageUrl(bankId);
      setUrl(imageUrl);
      setHasUpload(true);
      measureAspect(imageUrl, () => false);
    },
    [bankId, measureAspect],
  );

  const remove = useCallback(async () => {
    await deleteChequeImage(bankId);
    const imageUrl = await getChequeImageUrl(bankId);
    setUrl(imageUrl);
    setHasUpload(false);
    measureAspect(imageUrl, () => false);
  }, [bankId, measureAspect]);

  return { url, hasUpload, loading, isFlatScan, upload, remove };
}
