"use client";

import { useEffect, useRef, useState } from "react";

import { BANK_TEMPLATES, type BankId } from "@/lib/banks";
import {
  fieldPositionPct,
  ptToCqw,
  resolveFieldPos,
  roundOffset,
  type FieldId,
  type FieldOverrides,
  type FieldPos,
} from "@/lib/calibration";
import { CROSSINGS, CROSSING_PRINT_TEXT, type Crossing } from "@/lib/chequeSchema";
import type { CustomTextField } from "@/lib/customFields";
import type { AmountWordsLayoutResult } from "@/lib/layoutAmountWords";
import { wordsLineSpacingMm } from "@/lib/layoutAmountWords";
import {
  dateToDigits,
  digitAdvanceMm,
  digitCenterOffsetsMm,
  digitTotalWidthMm,
  DEFAULT_DATE_SPACING,
  type DateSpacing,
} from "@/lib/dateSpacing";
import type { Offset, Payee } from "@/lib/storage";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyIcon, GripVerticalIcon, XIcon } from "lucide-react";
import { cn } from "cn";

/** Ghost label shown while placing a field from a chip. */
const GHOST_LABELS: Record<FieldId, string> = {
  date: "DATE",
  payee: "PAYEE",
  amountNum: "AMOUNT",
  amountWords: "AMOUNT IN WORDS",
  crossing: "CROSSING",
};

/** Inline editor for a fresh/spawned custom label (Enter/blur commit, Escape cancel). */
function CustomTextEditor({
  id,
  initial,
  fontSize,
  onCommit,
  onCancel,
}: {
  id: string;
  initial: string;
  fontSize: number;
  onCommit?: (id: string, text: string) => void;
  onCancel?: (id: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const commit = () => {
    const text = value.trim();
    if (text) onCommit?.(id, text);
    else onCancel?.(id);
  };
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCancel?.(id);
      }}
      onFocus={(e) => e.target.select()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="border-0 border-b-2 border-dashed border-red bg-transparent px-1 py-0.5 text-ink shadow-none outline-none"
      style={{ fontSize, width: Math.max(60, value.length * fontSize * 0.62 + 16) }}
      aria-label="Custom label text"
    />
  );
}

/** Sample data for calibration mode. */
const SAMPLE = {
  dateIso: "2026-10-07",
  payee: "JUAN DELA CRUZ",
  amountNum: "1,234.50",
  wordsLine1: "One Thousand Two Hundred Thirty-Four",
  wordsLine2: "Pesos and 50/100 Only",
};

type ChequeCanvasProps = {
  bankId: BankId;
  mode: "edit" | "calibrate";
  offset: Offset;
  imageUrl: string | null;
  imageLoading: boolean;
  /** True when the image is a flat scan (aspect ≈ cheque) that can back the canvas. */
  imageIsFlatScan?: boolean;
  /** Per-field position overrides (set by dragging in move mode). */
  fieldOverrides?: FieldOverrides;
  /** Per-bank date digit spacing (Task B). */
  dateSpacing?: DateSpacing;
  /** When true, fields are draggable instead of click-to-edit. */
  moveMode?: boolean;
  /** Reports a field's new position (mm) after dragging. */
  onFieldMoved?: (fieldId: FieldId, pos: FieldPos) => void;
  /** The field selected for nudging/X-Y inputs (move mode). */
  selectedField?: FieldId | null;
  onSelectField?: (fieldId: FieldId | null) => void;
  /** Pass-through ref to the cheque element (used for chip-drop conversion). */
  canvasRef?: React.RefObject<HTMLDivElement>;
  /** True while a chip is being dragged/placed — highlights the drop zone. */
  placing?: boolean;
  /** Field being placed from a chip, and its current mm position (ghost). */
  ghostField?: FieldId | null;
  ghostPos?: FieldPos | null;
  /** Ghost position while placing a Name chip (multi-instance spawner). */
  ghostNamePos?: FieldPos | null;
  /** Removes a field from the cheque (right-click or the handle ✕). */
  onRemoveField?: (fieldId: FieldId) => void;
  // Multi-instance custom text labels (Name fields).
  customFields?: CustomTextField[];
  selectedCustomId?: string | null;
  editingCustomId?: string | null;
  onSelectCustom?: (id: string | null) => void;
  onCustomChange?: (id: string, patch: Partial<CustomTextField>) => void;
  onRemoveCustom?: (id: string) => void;
  onDuplicateCustom?: (id: string) => void;
  onEditingCommit?: (id: string, text: string) => void;
  onEditingCancel?: (id: string) => void;
  /** Per-bank override of the amount-words line width (mm). */
  wordsMaxWidthMm?: number;
  onWordsMaxWidthChange?: (mm: number) => void;
  // Edit-mode values and callbacks.
  dateIso?: string;
  payee?: string;
  amountText?: string;
  crossing?: Crossing;
  includeDate?: boolean;
  includePayee?: boolean;
  includeAmount?: boolean;
  onDateChange?: (iso: string) => void;
  onPayeeChange?: (value: string) => void;
  onAmountChange?: (value: string) => void;
  onCrossingChange?: (value: Crossing) => void;
  payees?: Payee[];
  /** Amount-in-words text shown on the canvas (edit mode). */
  wordsText?: string;
};

/**
 * The cheque as an editing surface: the bank's cheque image (or a styled
 * outline) with the print fields overlaid at their resolved positions.
 * In edit mode fields edit in place; in move mode they drag to reposition.
 */
export default function ChequeCanvas({
  bankId,
  mode,
  offset,
  imageUrl,
  imageLoading,
  imageIsFlatScan = false,
  fieldOverrides,
  dateSpacing = DEFAULT_DATE_SPACING,
  moveMode = false,
  onFieldMoved,
  selectedField = null,
  onSelectField,
  canvasRef,
  placing = false,
  ghostField = null,
  ghostPos = null,
  ghostNamePos = null,
  onRemoveField,
  customFields = [],
  selectedCustomId = null,
  editingCustomId = null,
  onSelectCustom,
  onCustomChange,
  onRemoveCustom,
  onDuplicateCustom,
  onEditingCommit,
  onEditingCancel,
  wordsMaxWidthMm,
  onWordsMaxWidthChange,
  dateIso = "",
  payee = "",
  amountText = "",
  crossing = "none",
  includeDate = true,
  includePayee = true,
  includeAmount = true,
  onDateChange,
  onPayeeChange,
  onAmountChange,
  onCrossingChange,
  payees = [],
  wordsText,
}: ChequeCanvasProps) {
  const template = BANK_TEMPLATES[bankId];
  const { fields } = template;
  const isEdit = mode === "edit";
  const interactive = isEdit && !moveMode;

  const [dateOpen, setDateOpen] = useState(false);
  const [payeeEditing, setPayeeEditing] = useState(false);
  const [amountEditing, setAmountEditing] = useState(false);
  const [crossingOpen, setCrossingOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const payeeInputRef = useRef<HTMLInputElement>(null);
  const internalCanvasRef = useRef<HTMLDivElement>(null);
  const measureRef = canvasRef ?? internalCanvasRef;

  useEffect(() => {
    if (payeeEditing) payeeInputRef.current?.focus();
  }, [payeeEditing]);

  // Resolved positions: per-field override wins over the template value.
  const resolved = (fieldId: FieldId): FieldPos =>
    resolveFieldPos(
      { x: fields[fieldId].x, y: fields[fieldId].y },
      fieldOverrides?.[fieldId],
    );

  const datePos = fieldPositionPct(
    resolved("date").x,
    resolved("date").y,
    offset,
    template.widthMm,
    template.heightMm,
  );
  const payeePos = fieldPositionPct(
    resolved("payee").x,
    resolved("payee").y,
    offset,
    template.widthMm,
    template.heightMm,
  );
  const amountNumPos = fieldPositionPct(
    resolved("amountNum").x,
    resolved("amountNum").y,
    offset,
    template.widthMm,
    template.heightMm,
  );
  const wordsPos = fieldPositionPct(
    resolved("amountWords").x,
    resolved("amountWords").y,
    offset,
    template.widthMm,
    template.heightMm,
  );
  const crossPos = fieldPositionPct(
    resolved("crossing").x,
    resolved("crossing").y,
    offset,
    template.widthMm,
    template.heightMm,
  );

  const fieldFont = (pt: number) => ({
    fontSize: ptToCqw(pt, template.widthMm),
  });
  const dateIsoStr = isEdit ? dateIso || "" : SAMPLE.dateIso;
  const dateDigits = dateToDigits(dateIsoStr, dateSpacing.order);
  const digitCenters = digitCenterOffsetsMm(dateSpacing, fields.date.fontSize);
  const digitCell = digitAdvanceMm(fields.date.fontSize);
  const dateBoxStyle = {
    left: `${datePos.left}%`,
    top: `${datePos.top}%`,
    width: `${(digitTotalWidthMm(dateSpacing, fields.date.fontSize) / template.widthMm) * 100}cqw`,
    height: ptToCqw(fields.date.fontSize * 1.2, template.widthMm),
  };
  const dateDigitsRender = (
    <>
      {dateDigits.split("").map((digit, i) => (
        <span
          key={i}
          className="absolute top-0 text-center font-mono leading-none"
          style={{
            left: `${((digitCenters[i] - digitCell / 2) / template.widthMm) * 100}cqw`,
            width: `${(digitCell / template.widthMm) * 100}cqw`,
            ...fieldFont(fields.date.fontSize),
          }}
        >
          {digit}
        </span>
      ))}
    </>
  );
  const payeeText = isEdit ? payee : SAMPLE.payee;
  const amountNum = isEdit ? amountText : SAMPLE.amountNum;
  const dateFaded = isEdit && !includeDate;
  const payeeFaded = isEdit && !includePayee;
  const amountFaded = isEdit && !includeAmount;

  const query = (isEdit ? payee : "").trim().toLowerCase();
  const suggestions =
    query === ""
      ? payees
      : payees.filter((p) => p.name.toLowerCase().includes(query));

  const crossingLabel =
    crossing === "none" || !crossing ? null : CROSSING_PRINT_TEXT[crossing];


  const crossingPicker = (
    <PopoverContent align="center" className="w-64 p-1">
      <Select
        value={crossing}
        onValueChange={(value) => {
          onCrossingChange?.(value as Crossing);
          setCrossingOpen(false);
        }}
      >
        <SelectTrigger className="w-full" aria-label="Crossing">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(CROSSINGS) as Crossing[]).map((key) => (
            <SelectItem key={key} value={key}>
              {CROSSINGS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </PopoverContent>
  );

  const crossingBlock = (
    <div
      className="flex flex-col items-center gap-[0.6cqw]"
      style={{
        transform: `rotate(${fields.crossing.rotate}deg)`,
        width: `${(fields.crossing.width / template.widthMm) * 100}cqw`,
      }}
    >
      <div className="h-px w-full bg-ink" />
      <span
        className="whitespace-nowrap text-center leading-none text-ink"
        style={fieldFont(fields.crossing.fontSize)}
      >
        {crossingLabel}
      </span>
      <div className="h-px w-full bg-ink" />
    </div>
  );

  const payeeMaxWidth = {
    maxWidth: `${(fields.payee.maxWidth / template.widthMm) * 100}cqw`,
  };

  /** Pointer-drag: converts screen px to mm and reports new positions. */
  function startDrag(e: React.PointerEvent, fieldId: FieldId) {
    if (!moveMode || !onFieldMoved) return;
    e.preventDefault();
    const rect = measureRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mmPerPxX = template.widthMm / rect.width;
    const mmPerPxY = template.heightMm / rect.height;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = resolved(fieldId);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      onFieldMoved(fieldId, {
        x: roundOffset(startPos.x + (ev.clientX - startX) * mmPerPxX),
        y: roundOffset(startPos.y + (ev.clientY - startY) * mmPerPxY),
      });
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  const dragClass =
    "cursor-move touch-none select-none rounded-sm outline-2 outline-dashed outline-red/40 outline-offset-2 transition-shadow hover:ring-1 hover:ring-red/50";
  const dragHandlers = (fieldId: FieldId) =>
    moveMode && onFieldMoved
      ? { onPointerDown: (e: React.PointerEvent) => startDrag(e, fieldId) }
      : {};

  /** Right-click removal in move mode. */
  const removeHandlers = (fieldId: FieldId) =>
    moveMode && onRemoveField
      ? {
          onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault();
            onRemoveField(fieldId);
          },
        }
      : {};

  /** Click-to-select in move mode; canvas background click deselects. */
  const selectHandlers = (fieldId: FieldId) =>
    moveMode && onSelectField
      ? {
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelectField(fieldId);
          },
        }
      : {};

  const selectedClass = (fieldId: FieldId) =>
    moveMode && selectedField === fieldId
      ? "rounded-md ring-2 ring-red bg-red/5"
      : "";

  /** 44px drag handle + remove ✕ shown on the selected field (touch-friendly). */
  const dragHandle = (fieldId: FieldId) =>
    moveMode && selectedField === fieldId ? (
      <span
        aria-hidden
        className="absolute -right-2 -top-2 z-20 flex items-center gap-1"
      >
        <button
          type="button"
          aria-label={`Remove ${fieldId}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveField?.(fieldId);
          }}
          className="flex size-6 items-center justify-center rounded-full bg-ink text-cream shadow-md"
        >
          <XIcon className="size-4" />
        </button>
        <span className="flex size-11 cursor-move touch-none items-center justify-center rounded-lg bg-red text-cream shadow-md">
          <GripVerticalIcon className="size-5" />
        </span>
      </span>
    ) : null;

  /** Pointer-drag for a custom instance (same px→mm conversion). */
  function startCustomDrag(e: React.PointerEvent, id: string) {
    if (!moveMode || !onCustomChange) return;
    e.preventDefault();
    const rect = measureRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mmPerPxX = template.widthMm / rect.width;
    const mmPerPxY = template.heightMm / rect.height;
    const field = customFields.find((f) => f.id === id);
    if (!field) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      onCustomChange(id, {
        x: roundOffset(field.x + (ev.clientX - startX) * mmPerPxX),
        y: roundOffset(field.y + (ev.clientY - startY) * mmPerPxY),
      });
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  const dot = (pos: { left: number; top: number }) => (
    <span
      className="absolute size-[1.2%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red/60"
      style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
    />
  );

  const [wordsLayout, setWordsLayout] = useState<AmountWordsLayoutResult | null>(
    null,
  );
  const wordsWidth = wordsMaxWidthMm ?? fields.amountWords.maxWidth;
  useEffect(() => {
    let cancelled = false;
    if (!wordsText) {
      setWordsLayout(null);
      return;
    }
    void (async () => {
      // Dynamic import keeps pdf-lib out of the initial page bundle.
      const { getHelveticaFont } = await import("@/lib/fontMetrics");
      const { layoutAmountWords } = await import("@/lib/layoutAmountWords");
      const font = await getHelveticaFont();
      if (cancelled) return;
      setWordsLayout(
        layoutAmountWords({
          text: wordsText,
          font,
          baseFontSize: fields.amountWords.fontSize,
          maxWidthMm: wordsWidth,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [wordsText, wordsWidth, fields.amountWords.fontSize]);

  /** Right-edge handle drag: edits the per-bank line width in mm. */
  function startWordsWidthDrag(e: React.PointerEvent) {
    if (!moveMode || !onWordsMaxWidthChange) return;
    e.preventDefault();
    const rect = measureRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mmPerPxX = template.widthMm / rect.width;
    const startX = e.clientX;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const next = wordsWidth + (ev.clientX - startX) * mmPerPxX;
      const maxW = template.widthMm - fields.amountWords.x;
      onWordsMaxWidthChange(Math.min(maxW, Math.max(20, roundOffset(next))));
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  const wordsLines = wordsLayout?.lines ?? [];

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="@container">
        <div
          ref={measureRef}
          className={cn(
            "relative overflow-hidden rounded-lg border border-line bg-white shadow-sm",
            placing && "ring-4 ring-red/50",
          )}
          style={{ aspectRatio: `${template.widthMm} / ${template.heightMm}` }}
          onClick={() => {
            if (moveMode && onSelectField) onSelectField(null);
          }}
        >
        {imageUrl && imageIsFlatScan ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`${template.name} cheque`}
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-paper/40">
            <span className="select-none text-2xl font-bold tracking-widest text-ink/10">
              {template.name.toUpperCase()}
            </span>
          </div>
        )}
        {imageUrl && !imageIsFlatScan && (
          <figure className="absolute bottom-[2%] right-[2%] z-10 w-[24%] overflow-hidden rounded-lg border border-line bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`${template.name} reference image`}
              className="h-auto w-full"
              draggable={false}
            />
            <figcaption className="bg-paper/60 px-2 py-1 text-center text-[0.6cqw] font-medium uppercase tracking-wide text-ink-muted">
              Reference image
            </figcaption>
          </figure>
        )}
        {imageLoading && (
          <div className="absolute inset-0 animate-pulse bg-paper/70" />
        )}

        {/* Date */}
        {isEdit && !includeDate ? null : interactive && onDateChange ? (
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger
              disabled={!includeDate}
              render={
                <button
                  type="button"
                  className={cn(
                    "absolute font-medium text-ink transition-shadow hover:ring-2 hover:ring-red/40",
                    dateFaded && "opacity-40",
                  )}
                  style={dateBoxStyle}
                />
              }
            >
              {dateDigitsRender}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateIso ? new Date(`${dateIso}T00:00:00`) : undefined}
                defaultMonth={dateIso ? new Date(`${dateIso}T00:00:00`) : new Date()}
                onSelect={(date) => {
                  if (date) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, "0");
                    const d = String(date.getDate()).padStart(2, "0");
                    onDateChange(`${y}-${m}-${d}`);
                    setDateOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <span
            className={cn(
              "absolute whitespace-nowrap font-medium text-ink",
              mode === "calibrate" || dateFaded ? "opacity-90" : "",
              moveMode && dragClass,
              selectedClass("date"),
            )}
            {...dragHandlers("date")}
            {...selectHandlers("date")}
            {...removeHandlers("date")}
            style={dateBoxStyle}
          >
            {dateDigitsRender}
            {dragHandle("date")}
          </span>
        )}

        {/* Payee */}
        {isEdit && !includePayee ? null : interactive && onPayeeChange ? (
          <span
            className={cn(
              "absolute whitespace-nowrap text-ink",
              payeeFaded && "opacity-40",
            )}
            style={{ left: `${payeePos.left}%`, top: `${payeePos.top}%`, ...fieldFont(fields.payee.fontSize), ...payeeMaxWidth }}
          >
            {payeeEditing ? (
              <span className="relative inline-block">
                <Input
                  ref={payeeInputRef}
                  value={payee}
                  onChange={(e) => {
                    onPayeeChange(e.target.value);
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => setSuggestionsOpen(true)}
                  onBlur={() => {
                    setPayeeEditing(false);
                    setSuggestionsOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setPayeeEditing(false);
                      setSuggestionsOpen(false);
                    }
                  }}
                  className="h-auto border-0 border-b-2 border-dashed border-red bg-transparent px-1.5 py-0.5 shadow-none ring-0 focus-visible:ring-0"
                  aria-label="Payee"
                />
                {suggestionsOpen && (
                  <span
                    className="absolute left-0 top-full z-50 mt-1 block w-72 rounded-lg border border-border bg-popover p-1 shadow-md"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <Command shouldFilter={false}>
                      <CommandList>
                        {suggestions.length === 0 ? (
                          <CommandEmpty>
                            No saved payees match — type to use a new name.
                          </CommandEmpty>
                        ) : (
                          suggestions.map((p) => (
                            <CommandItem
                              key={p.id}
                              onSelect={() => {
                                onPayeeChange(p.name);
                                setPayeeEditing(false);
                                setSuggestionsOpen(false);
                              }}
                            >
                              {p.name}
                            </CommandItem>
                          ))
                        )}
                      </CommandList>
                    </Command>
                  </span>
                )}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPayeeEditing(true);
                  setSuggestionsOpen(true);
                }}
                className="rounded-md px-2 py-0.5 text-left text-ink transition-shadow hover:ring-2 hover:ring-red/40"
              >
                {payee ? payee : <span className="text-ink/30">Payee…</span>}
              </button>
            )}
          </span>
        ) : (
          <span
            className={cn(
              "absolute block truncate whitespace-nowrap text-ink",
              moveMode && dragClass,
              selectedClass("payee"),
            )}
            {...dragHandlers("payee")}
            {...selectHandlers("payee")}
            {...removeHandlers("payee")}
            style={{ left: `${payeePos.left}%`, top: `${payeePos.top}%`, ...fieldFont(fields.payee.fontSize), ...payeeMaxWidth }}
          >
            {payeeText || (!isEdit && SAMPLE.payee) || (
              <span className="text-ink/30">Payee…</span>
            )}
            {dragHandle("payee")}
          </span>
        )}

        {/* Amount (number) */}
        {isEdit && !includeAmount ? null : interactive && onAmountChange ? (
          <span
            className={cn(
              "absolute whitespace-nowrap font-bold text-ink",
              amountFaded && "opacity-40",
            )}
            style={{ left: `${amountNumPos.left}%`, top: `${amountNumPos.top}%`, ...fieldFont(fields.amountNum.fontSize) }}
          >
            {amountEditing ? (
              <Input
                autoFocus
                value={amountText}
                onChange={(e) => onAmountChange(e.target.value)}
                onBlur={() => setAmountEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") setAmountEditing(false);
                }}
                inputMode="decimal"
                className="h-auto w-36 border-0 border-b-2 border-dashed border-red bg-transparent px-1.5 py-0.5 text-right shadow-none ring-0 focus-visible:ring-0"
                aria-label="Amount"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAmountEditing(true)}
                className="rounded-md px-2 py-0.5 transition-shadow hover:ring-2 hover:ring-red/40"
              >
                {amountText ? amountText : <span className="text-ink/30">0.00</span>}
              </button>
            )}
          </span>
        ) : (
          <span
            className={cn(
              "absolute whitespace-nowrap font-bold text-ink",
              moveMode && dragClass,
              selectedClass("amountNum"),
            )}
            {...dragHandlers("amountNum")}
            {...selectHandlers("amountNum")}
            {...removeHandlers("amountNum")}
            style={{ left: `${amountNumPos.left}%`, top: `${amountNumPos.top}%`, ...fieldFont(fields.amountNum.fontSize) }}
          >
            {amountNum || <span className="text-ink/30">0.00</span>}
            {dragHandle("amountNum")}
          </span>
        )}

        {/* Amount words (sample in calibrate mode, live wording in edit mode) */}
        {(mode === "calibrate" || wordsLines.length > 0) && (
          <>
            {(mode === "calibrate"
              ? [SAMPLE.wordsLine1, SAMPLE.wordsLine2]
              : wordsLines
            ).map((line, i) => {
              const size =
                mode === "calibrate"
                  ? fields.amountWords.fontSize
                  : wordsLayout?.fontSize ?? fields.amountWords.fontSize;
              // Each line is positioned in mm relative to the CANVAS (never
              // inside a zero-size wrapper — percentages there collapse to
              // the same point and the lines overlap). The lib's offsets
              // stack the lines upward from the pre-printed line.
              const offsetsMm =
                mode === "calibrate"
                  ? [-wordsLineSpacingMm(size), 0]
                  : wordsLayout?.lineOffsetsMm ?? [];
              const linePos = fieldPositionPct(
                resolved("amountWords").x,
                resolved("amountWords").y + (offsetsMm[i] ?? 0),
                offset,
                template.widthMm,
                template.heightMm,
              );
              return (
                <p
                  key={i}
                  className={cn(
                    "absolute whitespace-nowrap leading-snug text-ink",
                    moveMode && dragClass,
                    selectedClass("amountWords"),
                  )}
                  {...dragHandlers("amountWords")}
                  {...selectHandlers("amountWords")}
                  {...removeHandlers("amountWords")}
                  style={{
                    left: `${linePos.left}%`,
                    top: `${linePos.top}%`,
                    ...fieldFont(size),
                  }}
                >
                  {line}
                  {i === 0 && dragHandle("amountWords")}
                </p>
              );
            })}
            {moveMode && onWordsMaxWidthChange && selectedField === "amountWords" && (
              <span
                aria-label="Amount words line end"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  startWordsWidthDrag(e);
                }}
                className="absolute z-20 flex size-11 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-lg border-2 border-red bg-cream text-red shadow-md"
                style={{
                  left: `${((resolved("amountWords").x + wordsWidth) / template.widthMm) * 100}%`,
                  top: `${wordsPos.top}%`,
                }}
              >
                <GripVerticalIcon className="size-5" />
              </span>
            )}
          </>
        )}

        {/* Crossing */}
        <div
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2",
            moveMode && dragClass,
            selectedClass("crossing"),
          )}
          {...dragHandlers("crossing")}
          {...selectHandlers("crossing")}
          {...removeHandlers("crossing")}
          style={{ left: `${crossPos.left}%`, top: `${crossPos.top}%` }}
        >
          {dragHandle("crossing")}
          {crossingLabel ? (
            interactive && onCrossingChange ? (
              <Popover open={crossingOpen} onOpenChange={setCrossingOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="rounded-sm transition-shadow hover:ring-1 hover:ring-red/40"
                    />
                  }
                >
                  {crossingBlock}
                </PopoverTrigger>
                {crossingPicker}
              </Popover>
            ) : (
              crossingBlock
            )
          ) : isEdit && crossing === 'none' ? null : (
            <Popover open={crossingOpen} onOpenChange={setCrossingOpen}>
              <PopoverTrigger
                disabled={!interactive || !onCrossingChange}
                render={
                  <button
                    type="button"
                    className="rounded-sm px-2 py-1 text-center text-xs text-ink/30 transition-shadow hover:text-red hover:ring-1 hover:ring-red/40"
                  />
                }
              >
                {isEdit ? "+ Crossing" : ""}
              </PopoverTrigger>
              {crossingPicker}
            </Popover>
          )}
        </div>

        {/* Custom text labels (Name fields) — independent multi-instance layer */}
        {customFields.map((field) => {
          const pos = fieldPositionPct(
            field.x,
            field.y,
            offset,
            template.widthMm,
            template.heightMm,
          );
          const selected = field.id === selectedCustomId;
          const editing = field.id === editingCustomId;
          return (
            <div
              key={field.id}
              className={cn(
                "absolute",
                moveMode && dragClass,
                selected && "rounded-md bg-red/5 ring-2 ring-red",
              )}
              {...(moveMode && onCustomChange
                ? { onPointerDown: (e: React.PointerEvent) => startCustomDrag(e, field.id) }
                : {})}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCustom?.(field.id);
              }}
              {...(moveMode && onRemoveCustom
                ? {
                    onContextMenu: (e: React.MouseEvent) => {
                      e.preventDefault();
                      onRemoveCustom(field.id);
                    },
                  }
                : {})}
              style={{
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                ...(field.align === "center" ? { transform: "translateX(-50%)" } : {}),
                ...(field.maxWidthMm
                  ? { maxWidth: `${(field.maxWidthMm / template.widthMm) * 100}cqw` }
                  : {}),
              }}
            >
              {editing ? (
                <CustomTextEditor
                  id={field.id}
                  initial={field.text}
                  fontSize={field.fontSize}
                  onCommit={onEditingCommit}
                  onCancel={onEditingCancel}
                />
              ) : (
                <span
                  className={cn(
                    "whitespace-pre-wrap leading-snug",
                    field.bold && "font-bold",
                  )}
                  style={fieldFont(field.fontSize)}
                >
                  {field.uppercase ? field.text.toUpperCase() : field.text}
                </span>
              )}
              {moveMode && selected && (
                <span
                  aria-hidden
                  className="absolute -right-2 -top-2 z-20 flex items-center gap-1"
                >
                  <button
                    type="button"
                    aria-label={`Remove ${field.text.slice(0, 12)}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveCustom?.(field.id);
                    }}
                    className="flex size-6 items-center justify-center rounded-full bg-ink text-cream shadow-md"
                  >
                    <XIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Duplicate ${field.text.slice(0, 12)}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateCustom?.(field.id);
                    }}
                    className="flex size-6 items-center justify-center rounded-full bg-teal text-cream shadow-md"
                  >
                    <CopyIcon className="size-4" />
                  </button>
                  <span className="flex size-11 cursor-move touch-none items-center justify-center rounded-lg bg-red text-cream shadow-md">
                    <GripVerticalIcon className="size-5" />
                  </span>
                </span>
              )}
            </div>
          );
        })}

        {/* Calibration dots */}
        {mode === "calibrate" && (
          <>
            {dot(datePos)}
            {dot(payeePos)}
            {dot(amountNumPos)}
            {dot(wordsPos)}
            {dot(crossPos)}
          </>
        )}

        {/* Chip-placement ghost preview (built-in fields) */}
        {ghostField && ghostPos && (
          <span
            className="pointer-events-none absolute z-30 rounded-md border-2 border-dashed border-red bg-red/10 px-2 py-1 font-mono text-xs uppercase tracking-wide text-ink"
            style={{
              left: `${fieldPositionPct(ghostPos.x, ghostPos.y, offset, template.widthMm, template.heightMm).left}%`,
              top: `${fieldPositionPct(ghostPos.x, ghostPos.y, offset, template.widthMm, template.heightMm).top}%`,
            }}
          >
            {GHOST_LABELS[ghostField]}
          </span>
        )}
        {placing && !ghostField && ghostNamePos && (
          <span
            className="pointer-events-none absolute z-30 rounded-md border-2 border-dashed border-teal bg-teal/10 px-2 py-1 font-mono text-xs uppercase tracking-wide text-ink"
            style={{
              left: `${fieldPositionPct(ghostNamePos.x, ghostNamePos.y, offset, template.widthMm, template.heightMm).left}%`,
              top: `${fieldPositionPct(ghostNamePos.x, ghostNamePos.y, offset, template.widthMm, template.heightMm).top}%`,
            }}
          >
            NAME
          </span>
        )}
        </div>
      </div>
    </div>
  );
}
