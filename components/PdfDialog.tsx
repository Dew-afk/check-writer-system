"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PdfDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title: string;
  description?: string;
  /** "What will actually print" indicator (print-layer note). */
  note?: string;
  /** Downloads the PDF instead of opening a tab (optional). */
  onDownload?: () => void;
};

/**
 * In-page PDF dialog (Fix 3a): shows the generated PDF in an <iframe> with
 * Print and Download buttons — no window.open after async work, so popup
 * blockers can't eat the result. Blob URLs are revoked only on close.
 */
export default function PdfDialog({
  open,
  onOpenChange,
  url,
  title,
  description,
  note,
  onDownload,
}: PdfDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Revoke the blob URL when the dialog closes for good.
  useEffect(() => {
    if (!open && url) {
      URL.revokeObjectURL(url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handlePrint() {
    try {
      iframeRef.current?.contentWindow?.print();
    } catch {
      // Some browsers block cross-frame print — fall back to opening the PDF.
      if (url) window.open(url, "_blank");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-3xl flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>
              {description} Print at 100% / Actual Size, margins None.
            </DialogDescription>
          )}
          {note && (
            <p className="rounded-lg border border-teal/40 bg-teal/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-teal">
              {note}
            </p>
          )}
        </DialogHeader>
        {url ? (
          <iframe
            ref={iframeRef}
            src={url}
            title={title}
            className="min-h-0 flex-1 rounded-md border border-border bg-white"
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Generating PDF…
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-5"
            onClick={handlePrint}
          >
            Print
          </Button>
          {onDownload && (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl px-5"
              onClick={onDownload}
            >
              Download
            </Button>
          )}
          <Button
            type="button"
            className="h-11 rounded-xl bg-red px-5 font-semibold text-cream hover:bg-red/90"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
