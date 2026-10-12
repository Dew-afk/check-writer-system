"use client";

import {
  DATE_ORDER_LABELS,
  DATE_ORDERS,
  digitAdvanceMm,
  digitCenterOffsetsMm,
  digitTotalWidthMm,
  type DateOrder,
  type DateSpacing,
} from "@/lib/dateSpacing";
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
import { Slider } from "@/components/ui/slider";

const PREVIEW_ISO = "2026-03-08"; // test date: 03/08/2026
const PREVIEW_FONT_PT = 12;
const PREVIEW_SCALE = 4; // px per mm in the preview box

type DateSpacingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spacing: DateSpacing;
  onChange: (next: DateSpacing) => void;
  onReset: () => void;
};

/** Task B: per-bank date digit spacing controls with a live preview. */
export default function DateSpacingDialog({
  open,
  onOpenChange,
  spacing,
  onChange,
  onReset,
}: DateSpacingDialogProps) {
  const centers = digitCenterOffsetsMm(spacing, PREVIEW_FONT_PT);
  const cell = digitAdvanceMm(PREVIEW_FONT_PT);
  const total = digitTotalWidthMm(spacing, PREVIEW_FONT_PT);
  // Preview digits from the test date in the chosen order.
  const previewDigits = PREVIEW_ISO.replace(/-/g, "");
  const ordered =
    spacing.order === "ddmmyyyy"
      ? previewDigits.slice(6, 8) + previewDigits.slice(4, 6) + previewDigits.slice(0, 4)
      : spacing.order === "yyyymmdd"
        ? previewDigits
        : previewDigits.slice(4, 8) + previewDigits.slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Date Spacing</DialogTitle>
          <DialogDescription>
            Your cheque has printed date cells: MM – DD – YYYY. Tune the
            spacing so each digit lands inside its cell. Saved per bank, in
            millimetres — identical on screen and in print.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Label className="label-micro w-24 shrink-0 text-ink-muted">
            Order
          </Label>
          <Select
            value={spacing.order}
            onValueChange={(value) =>
              onChange({ ...spacing, order: value as DateOrder })
            }
          >
            <SelectTrigger
              className="h-11 w-full rounded-xl px-5 data-[size=default]:h-11"
              aria-label="Date digit order"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_ORDERS.map((order) => (
                <SelectItem key={order} value={order}>
                  {DATE_ORDER_LABELS[order]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <Label className="label-micro w-24 shrink-0 text-ink-muted">
            Digit spacing
          </Label>
          <Slider
            value={spacing.digitSpacing}
            onValueChange={(value) =>
              onChange({
                ...spacing,
                digitSpacing: Array.isArray(value) ? value[0] : value,
              })
            }
            min={0}
            max={10}
            step={0.1}
            aria-label="Digit spacing in millimetres"
            className="flex-1"
          />
          <Input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={spacing.digitSpacing}
            onChange={(e) =>
              onChange({ ...spacing, digitSpacing: Number(e.target.value) })
            }
            className="h-11 w-24 rounded-xl"
            aria-label="Digit spacing millimetres"
          />
        </div>

        <div className="flex items-center gap-4">
          <Label className="label-micro w-24 shrink-0 text-ink-muted">
            Group gap
          </Label>
          <Slider
            value={spacing.groupGap}
            onValueChange={(value) =>
              onChange({
                ...spacing,
                groupGap: Array.isArray(value) ? value[0] : value,
              })
            }
            min={0}
            max={10}
            step={0.1}
            aria-label="Group gap in millimetres"
            className="flex-1"
          />
          <Input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={spacing.groupGap}
            onChange={(e) =>
              onChange({ ...spacing, groupGap: Number(e.target.value) })
            }
            className="h-11 w-24 rounded-xl"
            aria-label="Group gap millimetres"
          />
        </div>

        {/* Live preview: digits placed with the exact same mm math. */}
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="label-micro text-ink-muted">Preview — 03/08/2026</p>
          <div
            className="relative mt-2"
            style={{ width: total * PREVIEW_SCALE + cell * PREVIEW_SCALE, height: PREVIEW_FONT_PT * 1.6 }}
          >
            {ordered.split("").map((digit, i) => (
              <span
                key={i}
                className="absolute top-0 text-center font-mono leading-none"
                style={{
                  left: (centers[i] - cell / 2) * PREVIEW_SCALE,
                  width: cell * PREVIEW_SCALE,
                  fontSize: PREVIEW_FONT_PT * 1.15,
                }}
              >
                {digit}
              </span>
            ))}
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-5"
            onClick={onReset}
          >
            Reset to default
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
