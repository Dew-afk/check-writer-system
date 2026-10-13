"use client";

import {
  PAPER_PRESET_LABELS,
  paperPageMm,
  placeChequeOnPage,
  type AnchorX,
  type AnchorY,
  type ContentRotation,
  type PaperPreset,
  type PrintLayout,
  type PrintOrientation,
} from "@/lib/printLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";

const PRESETS = Object.keys(PAPER_PRESET_LABELS) as PaperPreset[];
const ROTATIONS: { value: ContentRotation; label: string }[] = [
  { value: 0, label: "None" },
  { value: 90, label: "90° CW" },
  { value: 270, label: "90° CCW" },
  { value: 180, label: "180°" },
];

type PrintLayoutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: PrintLayout;
  onChange: (next: PrintLayout) => void;
  onReset: () => void;
};

/**
 * Print setup per bank (Fix 2): paper preset, orientation, content rotation
 * (how the cheque is fed), 3×3 anchor grid + fine offsets, and a live page
 * preview with a fit warning.
 */
export default function PrintLayoutDialog({
  open,
  onOpenChange,
  layout,
  onChange,
  onReset,
}: PrintLayoutDialogProps) {
  const paper = paperPageMm(layout);
  const placed = placeChequeOnPage(layout, paper);
  const isCheque = layout.paperPreset === "cheque";

  // Page preview geometry (fit the paper into a 260×360 box).
  const previewScale = Math.min(260 / paper.widthMm, 360 / paper.heightMm);
  const pw = paper.widthMm * previewScale;
  const ph = paper.heightMm * previewScale;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Print Setup</DialogTitle>
          <DialogDescription>
            Saved per bank. The cheque is drawn in its native millimetres and
            placed on the paper below — test prints from Calibrate use these
            same settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Controls */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Label className="label-micro w-24 shrink-0 text-ink-muted">
                Paper
              </Label>
              <Select
                value={layout.paperPreset}
                onValueChange={(value) =>
                  onChange({ ...layout, paperPreset: value as PaperPreset })
                }
              >
                <SelectTrigger
                  className="h-11 w-full rounded-xl px-5 data-[size=default]:h-11"
                  aria-label="Paper preset"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {PAPER_PRESET_LABELS[preset]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {layout.paperPreset === "custom" && (
              <div className="flex items-center gap-3">
                <Label className="label-micro w-24 shrink-0 text-ink-muted">
                  W × H mm
                </Label>
                <Input
                  type="number"
                  min={50}
                  max={500}
                  value={layout.customWidthMm ?? 210}
                  onChange={(e) =>
                    onChange({ ...layout, customWidthMm: Number(e.target.value) })
                  }
                  className="h-11 w-24 rounded-xl"
                  aria-label="Custom paper width mm"
                />
                <Input
                  type="number"
                  min={50}
                  max={500}
                  value={layout.customHeightMm ?? 297}
                  onChange={(e) =>
                    onChange({ ...layout, customHeightMm: Number(e.target.value) })
                  }
                  className="h-11 w-24 rounded-xl"
                  aria-label="Custom paper height mm"
                />
              </div>
            )}

            {!isCheque && (
              <div className="flex items-center gap-2">
                <Label className="label-micro w-24 shrink-0 text-ink-muted">
                  Page
                </Label>
                {(["portrait", "landscape"] as PrintOrientation[]).map((o) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={layout.orientation === o}
                    onClick={() => onChange({ ...layout, orientation: o })}
                    className={cn(
                      "min-h-11 rounded-xl border px-4 font-mono text-[11px] uppercase tracking-[0.12em]",
                      layout.orientation === o
                        ? "border-red bg-red text-cream"
                        : "border-line bg-surface text-ink-muted hover:border-red/60",
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Label
                className="label-micro w-24 shrink-0 text-ink-muted"
                title="How the cheque is fed into the printer — short edge vs long edge first. Rotate the content if the cheque doesn't fit unrotated."
              >
                Rotate
              </Label>
              <Select
                value={String(layout.contentRotation)}
                onValueChange={(value) =>
                  onChange({
                    ...layout,
                    contentRotation: Number(value) as ContentRotation,
                  })
                }
              >
                <SelectTrigger
                  className="h-11 w-full rounded-xl px-5 data-[size=default]:h-11"
                  aria-label="Content rotation"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROTATIONS.map((r) => (
                    <SelectItem key={r.value} value={String(r.value)}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Label className="label-micro w-24 shrink-0 text-ink-muted">
                Anchor
              </Label>
              <div className="grid grid-cols-3 gap-1">
                {(["top", "middle", "bottom"] as AnchorY[]).map((y) =>
                  (["left", "center", "right"] as AnchorX[]).map((x) => (
                    <button
                      key={`${x}-${y}`}
                      type="button"
                      aria-label={`Anchor ${y} ${x}`}
                      aria-pressed={layout.anchorX === x && layout.anchorY === y}
                      onClick={() => onChange({ ...layout, anchorX: x, anchorY: y })}
                      className={cn(
                        "size-9 rounded-md border",
                        layout.anchorX === x && layout.anchorY === y
                          ? "border-red bg-red text-cream"
                          : "border-line bg-surface hover:border-red/60",
                      )}
                    />
                  )),
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label className="label-micro w-24 shrink-0 text-ink-muted">
                Offset mm
              </Label>
              <Input
                type="number"
                step={0.5}
                value={layout.offsetMm.x}
                onChange={(e) =>
                  onChange({
                    ...layout,
                    offsetMm: { ...layout.offsetMm, x: Number(e.target.value) },
                  })
                }
                className="h-11 w-20 rounded-xl"
                aria-label="Anchor X offset mm"
              />
              <Input
                type="number"
                step={0.5}
                value={layout.offsetMm.y}
                onChange={(e) =>
                  onChange({
                    ...layout,
                    offsetMm: { ...layout.offsetMm, y: Number(e.target.value) },
                  })
                }
                className="h-11 w-20 rounded-xl"
                aria-label="Anchor Y offset mm"
              />
            </div>
          </div>

          {/* Live page preview */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="relative rounded-lg border-2 border-line bg-white shadow-inner"
              style={{ width: pw, height: ph }}
            >
              <div
                className={cn(
                  "absolute border",
                  placed.fits
                    ? "border-teal bg-teal/10"
                    : "border-red bg-red/10",
                )}
                style={{
                  left: placed.xMm * previewScale,
                  top: placed.yMm * previewScale,
                  width: placed.widthMm * previewScale,
                  height: placed.heightMm * previewScale,
                }}
              >
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-widest text-ink/50">
                  cheque
                </span>
              </div>
              {/* Feed direction arrow */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-ink/40">
                <span className="block text-center text-[10px] font-mono uppercase">
                  feed
                </span>
                <span className="mx-auto block h-6 w-0 border-l-2 border-dashed border-ink/40" />
                <span className="mx-auto block h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-ink/40" />
              </div>
            </div>
            <p
              className={cn(
                "font-mono text-[11px] uppercase tracking-[0.12em]",
                placed.fits ? "text-teal" : "text-destructive",
              )}
            >
              {placed.fits
                ? `Fits — ${paper.widthMm.toFixed(0)} × ${paper.heightMm.toFixed(0)} mm`
                : "Doesn't fit — change paper, orientation, or rotation"}
            </p>
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-5"
            onClick={onReset}
          >
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
