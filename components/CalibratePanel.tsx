"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { BANKS, type BankId } from "@/lib/banks";
import { sanitizeOffset, type FieldOverrides } from "@/lib/calibration";
import {
  getFieldOverrides,
  getLastBank,
  getOffset as loadOffset,
  setOffset as saveOffset,
  type Offset,
} from "@/lib/storage";
import ChequeCanvas from "@/components/ChequeCanvas";
import SystemShell from "@/components/SystemShell";
import { useChequeImage } from "@/hooks/useChequeImage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ImageIcon, ImageOffIcon } from "lucide-react";

function formatMm(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(1)} mm`;
}

export default function CalibratePanel() {
  const [bankId, setBankId] = useState<BankId>(BANKS[0].id);
  const [offset, setOffsetState] = useState<Offset>({ x: 0, y: 0 });
  const [fieldOverrides, setFieldOverrides] = useState<FieldOverrides>({});
  const [printing, setPrinting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    url: imageUrl,
    hasUpload: imageHasUpload,
    loading: imageLoading,
    isFlatScan: imageIsFlatScan,
    upload: uploadImage,
    remove: removeImage,
  } = useChequeImage(bankId);

  // Load after mount (localStorage is unavailable during SSR).
  useEffect(() => {
    const initialBank = getLastBank() ?? BANKS[0].id;
    setBankId(initialBank);
    setOffsetState(loadOffset(initialBank));
    setFieldOverrides(getFieldOverrides(initialBank));
  }, []);

  function handleBankChange(next: BankId) {
    setBankId(next);
    setOffsetState(loadOffset(next));
    setFieldOverrides(getFieldOverrides(next));
  }

  function handleOffsetChange(axis: keyof Offset, value: number) {
    const next = sanitizeOffset({ ...offset, [axis]: value });
    setOffsetState(next);
    saveOffset(bankId, next);
  }

  function handleReset() {
    setOffsetState({ x: 0, y: 0 });
    saveOffset(bankId, { x: 0, y: 0 });
  }

  async function handlePrintTestGrid() {
    setPrinting(true);
    setStatus(null);
    try {
      // Dynamic import keeps pdf-lib out of the initial page bundle.
      const { generateTestGridPdf } = await import("@/lib/generatePdf");
      const bytes = await generateTestGridPdf(bankId);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setStatus("Could not generate the test grid.");
    } finally {
      setPrinting(false);
    }
  }

  async function handleImageFile(file: File) {
    try {
      await uploadImage(file);
      setStatus(null);
    } catch {
      setStatus("Could not save the cheque image.");
    }
  }

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImageFile(file);
          e.target.value = "";
        }}
      />

      <SystemShell
        menu={
          <>
            <span className="px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink">
              Calibrate
            </span>
            <Link
              href="/system"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted hover:text-ink"
            >
              ← Back to system
            </Link>
          </>
        }
        footer={
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              Offsets save per bank, on this device
            </p>
            <Button
              type="button"
              disabled={printing}
              className="h-12 rounded-xl bg-red px-8 text-base font-semibold text-cream hover:bg-red/90"
              onClick={() => void handlePrintTestGrid()}
            >
              {printing ? "Preparing…" : "Print test on plain paper"}
            </Button>
          </>
        }
      >
        <h1 className="text-lg font-semibold text-ink">
          Printer Calibration
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every printer feeds paper slightly differently. Shift all printed
          fields by the same X/Y amount until the test print lines up with your
          cheque. See docs/calibration.md for the full measuring workflow.
        </p>

        {status && <p className="mt-2 text-sm text-destructive">{status}</p>}

        <div className="animate-fade-up mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-56 flex-1 items-center gap-3">
            <Label className="label-micro w-14 shrink-0 text-ink-muted">
              Bank
            </Label>
            <Select
              value={bankId}
              onValueChange={(value) => handleBankChange(value as BankId)}
            >
              <SelectTrigger className="h-11 w-full rounded-xl px-5 data-[size=default]:h-11" aria-label="Bank">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-5"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="size-4" />
            {imageHasUpload ? "Change image" : "Upload image"}
          </Button>
          {imageHasUpload && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-xl px-5 text-destructive"
              onClick={() => void removeImage()}
            >
              <ImageOffIcon className="size-4" />
              Remove
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-5"
            onClick={handleReset}
            disabled={offset.x === 0 && offset.y === 0}
          >
            Reset offset
          </Button>
        </div>

        <div
          className="animate-fade-up mt-5 space-y-4"
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex items-center gap-4">
            <Label className="w-6 shrink-0 text-ink">X</Label>
            <Slider
              value={offset.x}
              onValueChange={(value) =>
                handleOffsetChange("x", Array.isArray(value) ? value[0] : value)
              }
              min={-10}
              max={10}
              step={0.1}
              aria-label="Horizontal offset in millimeters"
              className="flex-1"
            />
            <span className="w-16 shrink-0 text-right font-mono text-sm text-ink">
              {formatMm(offset.x)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-6 shrink-0 text-ink">Y</Label>
            <Slider
              value={offset.y}
              onValueChange={(value) =>
                handleOffsetChange("y", Array.isArray(value) ? value[0] : value)
              }
              min={-10}
              max={10}
              step={0.1}
              aria-label="Vertical offset in millimeters"
              className="flex-1"
            />
            <span className="w-16 shrink-0 text-right font-mono text-sm text-ink">
              {formatMm(offset.y)}
            </span>
          </div>
        </div>

        <div className="animate-fade-up mt-6" style={{ animationDelay: "160ms" }}>
          <p className="label-micro mb-2 text-ink-muted">
            Live preview — {BANKS.find((b) => b.id === bankId)?.name} (203.2 ×
            76.2 mm)
          </p>
          <ChequeCanvas
            bankId={bankId}
            mode="calibrate"
            offset={offset}
            imageUrl={imageUrl}
            imageLoading={imageLoading}
            imageIsFlatScan={imageIsFlatScan}
            fieldOverrides={fieldOverrides}
          />
          <p className="mt-2 text-xs text-ink-muted">
            Upload a flat scan of your cheque to calibrate against the real
            thing; otherwise the sample fields show on the outline.
          </p>
        </div>
      </SystemShell>
    </>
  );
}
