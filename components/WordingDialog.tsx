"use client";

import { safeAmountToWords } from "@/lib/amountToWords";
import {
  CAPITALIZATIONS,
  parseAmountText,
  type Capitalization,
} from "@/lib/chequeSchema";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WordingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountText: string;
  capitalization: Capitalization;
  onCapitalizationChange: (value: Capitalization) => void;
  suffixOnly: boolean;
  onSuffixOnlyChange: (value: boolean) => void;
  omitZeroCentavos: boolean;
  onOmitZeroCentavosChange: (value: boolean) => void;
};

/** Wording options dialog: capitalization style + "Only" suffix, with live preview. */
export default function WordingDialog({
  open,
  onOpenChange,
  amountText,
  capitalization,
  onCapitalizationChange,
  suffixOnly,
  onSuffixOnlyChange,
  omitZeroCentavos,
  onOmitZeroCentavosChange,
}: WordingDialogProps) {
  const amount = parseAmountText(amountText);
  const preview =
    amount === null
      ? "Enter a valid amount to preview the wording."
      : (safeAmountToWords(amount, { capitalization, suffixOnly, omitZeroCentavos }) ??
        "Invalid amount — must be at most 999,999,999.99 with 2 decimals.");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wording Options</DialogTitle>
          <DialogDescription>
            How the amount-in-words line is written on the cheque.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Label className="w-24 shrink-0">Capitalization</Label>
          <Select
            value={capitalization}
            onValueChange={(value) =>
              onCapitalizationChange(value as Capitalization)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CAPITALIZATIONS) as Capitalization[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {CAPITALIZATIONS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={suffixOnly}
            onCheckedChange={(checked) => onSuffixOnlyChange(Boolean(checked))}
          />
          <Label>Append the word &ldquo;Only&rdquo;</Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={omitZeroCentavos}
            onCheckedChange={(checked) =>
              onOmitZeroCentavosChange(Boolean(checked))
            }
          />
          <Label>
            Omit &ldquo;and 00/100&rdquo; on whole-peso amounts
          </Label>
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <p className="mt-1 text-sm leading-relaxed">{preview}</p>
        </div>

        <DialogFooter showCloseButton>Done</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
