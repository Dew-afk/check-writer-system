"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { safeAmountToWords } from "@/lib/amountToWords";
import { BANKS, BANK_TEMPLATES, copyLayoutAsCode, type BankId } from "@/lib/banks";
import { DEFAULT_DATE_SPACING, type DateSpacing } from "@/lib/dateSpacing";
import type { AmountWordsLayoutResult } from "@/lib/layoutAmountWords";
import { intersectsKeepOut } from "@/lib/layoutAmountWords";
import {
  makeCustomFieldId,
  offsetForDuplicate,
  spawnDefaultPosition,
  type CustomTextField,
} from "@/lib/customFields";
import {
  anchorFieldPos,
  clampFieldPos,
  dropPointToMm,
  resolveFieldPos,
  snapToGrid,
} from "@/lib/calibration";
import {
  CROSSINGS,
  amountSchema,
  getDateWarnings,
  isoDateSchema,
  parseAmountText,
  payeeSchema,
  todayIso,
  type Capitalization,
  type Crossing,
} from "@/lib/chequeSchema";
import {
  buildBackupJson,
  clearAllFieldOverrides,
  clearCustomFields,
  clearFieldOverrideSingle,
  clearFieldOverrides,
  getDateSpacing,
  getCustomFields,
  getFieldOverrides,
  getLastBank,
  getOffset,
  getPayees,
  getPrintLayout,
  getWordsMaxWidth,
  importBackup,
  saveCustomFields,
  saveDateSpacing,
  saveFieldOverrides,
  savePayees,
  savePrintLayout,
  saveWordsMaxWidth,
  getSavedNames,
  saveSavedNames,
  setLastBank,
  type Payee,
} from "@/lib/storage";
import type { FieldOverrides, FieldPos, FieldId } from "@/lib/calibration";
import type { ChequePrintPayload } from "@/lib/generatePdf";
import ChequeCanvas from "@/components/ChequeCanvas";
import DateSpacingDialog from "@/components/DateSpacingDialog";
import FieldChip from "@/components/FieldChip";
import NoticeBanner from "@/components/NoticeBanner";
import PayeeManager from "@/components/PayeeManager";
import SystemShell from "@/components/SystemShell";
import WordingDialog from "@/components/WordingDialog";
import { useChequeImage } from "@/hooks/useChequeImage";
import { useDraft } from "@/components/DraftProvider";
import PdfDialog from "@/components/PdfDialog";
import PrintLayoutDialog from "@/components/PrintLayoutDialog";
import { DEFAULT_PRINT_LAYOUT, type PrintLayout } from "@/lib/printLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageIcon, ImageOffIcon } from "lucide-react";
import { cn } from "cn";

/** Confirmation dialog for destructive layout resets. */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-5"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl bg-red px-5 font-semibold text-cream hover:bg-red/90"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small pill toggle for the include-flags (Date / Payee / Amount). */
function ToggleChip({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "min-h-11 rounded-xl border px-5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all",
        checked
          ? "border-red bg-red text-cream shadow-sm shadow-red/30"
          : "border-line bg-surface text-ink-muted hover:border-red/60 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

const MENU_BUTTON =
  "font-mono text-[11px] uppercase tracking-[0.14em]";

export default function ChequeForm() {
  const { draft, setDraft, clearDraft } = useDraft();
  const bankId = draft.bankId;
  const includeDate = draft.includeDate;
  const isoDate = draft.isoDate;
  const includePayee = draft.includePayee;
  const payee = draft.payee;
  const includeAmount = draft.includeAmount;
  const amountText = draft.amountText;
  const crossing = draft.crossing;
  const capitalization = draft.capitalization;
  const suffixOnly = draft.suffixOnly;
  const omitZeroCentavos = draft.omitZeroCentavos;
  const customFields = draft.customFields;
  // Fields start OFF — the cheque is blank until a chip is dragged onto it.
  const [payees, setPayees] = useState<Payee[]>([]);

  const [payeeManagerOpen, setPayeeManagerOpen] = useState(false);
  const [wordingOpen, setWordingOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [fieldOverrides, setFieldOverrides] = useState<FieldOverrides>({});
  const [selectedField, setSelectedField] = useState<FieldId | null>(null);
  const [snapOn, setSnapOn] = useState(false);
  const [dateSpacing, setDateSpacing] = useState<DateSpacing>(DEFAULT_DATE_SPACING);
  const [dateSpacingOpen, setDateSpacingOpen] = useState(false);
  const [printLayout, setPrintLayout] = useState<PrintLayout>(DEFAULT_PRINT_LAYOUT);
  const [printSetupOpen, setPrintSetupOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [placingName, setPlacingName] = useState(false);
  const [placingNamePos, setPlacingNamePos] = useState<FieldPos | null>(null);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [clearNamesConfirm, setClearNamesConfirm] = useState(false);
  const [wordsMaxWidth, setWordsMaxWidth] = useState<number | undefined>(undefined);
  const [wordsLayout, setWordsLayout] = useState<AmountWordsLayoutResult | null>(null);
  const [placingField, setPlacingField] = useState<FieldId | null>(null);
  const [placingPos, setPlacingPos] = useState<FieldPos | null>(null);
  const placingFieldRef = useRef<FieldId | null>(null);
  const placingNamePosRef = useRef<FieldPos | null>(null);
  const customFieldsRef = useRef<CustomTextField[]>([]);
  const placingPosRef = useRef<FieldPos | null>(null);
  const canvasElRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [storageError, setStorageError] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"bank" | "all" | null>(null);
  const [importStatus, setImportStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | null>(null);
  const savedFlashTimer = useRef<number | null>(null);
  const overridesRef = useRef<FieldOverrides>({});
  const bankRef = useRef<BankId>(BANKS[0].id);
  bankRef.current = bankId;
  overridesRef.current = fieldOverrides;
  customFieldsRef.current = customFields;

  const {
    url: imageUrl,
    hasUpload: imageHasUpload,
    loading: imageLoading,
    isFlatScan: imageIsFlatScan,
    upload: uploadImage,
    remove: removeImage,
  } = useChequeImage(bankId);

  // Load local data after mount (localStorage is unavailable during SSR).
  useEffect(() => {
    setPayees(getPayees());
    const last = getLastBank();
    const activeBank = draft.bankId !== BANKS[0].id ? draft.bankId : (last ?? BANKS[0].id);
    if (activeBank !== draft.bankId) {
      setDraft({ bankId: activeBank, customFields: getCustomFields(activeBank) });
    }
    if (!draft.isoDate) setDraft({ isoDate: todayIso() });
    setFieldOverrides(getFieldOverrides(activeBank));
    setDateSpacing(getDateSpacing(activeBank));
    setWordsMaxWidth(getWordsMaxWidth(activeBank));
    setPrintLayout(getPrintLayout(activeBank));
    setSavedNames(getSavedNames());
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived validity.
  const amount = parseAmountText(amountText);
  const amountIsValid = amount !== null && amountSchema.safeParse(amount).success;
  const payeeIsValid = payeeSchema.safeParse(payee).success;
  const dateIsValid = isoDateSchema.safeParse(isoDate).success;
  const anyFieldIncluded =
    includeDate || includePayee || includeAmount || crossing !== "none";

  const warnings =
    includeDate && dateIsValid ? getDateWarnings(isoDate) : [];
  const selectedCustom =
    customFields.find((f) => f.id === selectedCustomId) ?? null;
  const selectedResolved = selectedField
    ? resolveFieldPos(
        {
          x: BANK_TEMPLATES[bankId].fields[selectedField].x,
          y: BANK_TEMPLATES[bankId].fields[selectedField].y,
        },
        fieldOverrides[selectedField],
      )
    : null;
  const wordingPreview =
    amountIsValid && amount !== null
      ? (safeAmountToWords(amount, {
          capitalization,
          suffixOnly,
          omitZeroCentavos,
        }) ?? "Invalid amount — must be at most 999,999,999.99.")
      : "Enter a valid amount to preview the wording.";

  // Single source of truth: the SAME layout module the canvas and PDF use.
  useEffect(() => {
    let cancelled = false;
    if (!(amountIsValid && amount !== null)) {
      setWordsLayout(null);
      return;
    }
    void (async () => {
      const { getHelveticaFont } = await import("@/lib/fontMetrics");
      const { layoutAmountWords } = await import("@/lib/layoutAmountWords");
      const font = await getHelveticaFont();
      if (cancelled) return;
      const template = BANK_TEMPLATES[bankRef.current];
      const width =
        wordsMaxWidth ?? template.fields.amountWords.maxWidth;
      setWordsLayout(
        layoutAmountWords({
          text: wordingPreview,
          font,
          baseFontSize: template.fields.amountWords.fontSize,
          maxWidthMm: width,
          line2MaxWidthMm: width,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordingPreview, wordsMaxWidth, bankId]);

  const wordsOverflow = wordsLayout?.overflow ?? false;
  const wordsLine2Overlaps =
    !!wordsLayout?.wrapped &&
    intersectsKeepOut(
      {
        x: BANK_TEMPLATES[bankId].fields.amountWords.line2?.x ??
          BANK_TEMPLATES[bankId].fields.amountWords.x,
        y: BANK_TEMPLATES[bankId].fields.amountWords.line2?.y ??
          BANK_TEMPLATES[bankId].fields.amountWords.y +
            BANK_TEMPLATES[bankId].fields.amountWords.lineHeight,
        w: wordsMaxWidth ?? BANK_TEMPLATES[bankId].fields.amountWords.maxWidth,
        h: BANK_TEMPLATES[bankId].fields.amountWords.fontSize * 0.45,
      },
      BANK_TEMPLATES[bankId].fields.amountWords.keepOut ?? [],
    );

  const canPrint =
    !wordsOverflow &&
    anyFieldIncluded &&
    (!includeDate || dateIsValid) &&
    (!includePayee || payeeIsValid) &&
    (!includeAmount || amountIsValid);

  function handleWordsWidthChange(mm: number) {
    setWordsMaxWidth(mm);
    if (saveWordsMaxWidth(bankId, mm)) {
      setSaveState("saved");
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSaveState("idle"), 1600);
    } else {
      setStorageError(true);
    }
  }

  function handleSnapWordsToLineEnd() {
    const width = BANK_TEMPLATES[bankId].fields.amountWords.maxWidth;
    handleWordsWidthChange(width);
  }

  function handleBankChange(next: BankId) {
    saveCustomFields(bankId, customFields);
    setLastBank(next);
    setDraft({ bankId: next, customFields: getCustomFields(next) });
    setFieldOverrides(getFieldOverrides(next));
    setDateSpacing(getDateSpacing(next));
    setWordsMaxWidth(getWordsMaxWidth(next));
    setDraft({ customFields: getCustomFields(next) });
    setSelectedCustomId(null);
    setEditingCustomId(null);
    setSelectedField(null);
  }

  /** Debounced persist of the current bank's layout; shows "Saved". */
  function persistFieldOverrides(snapshot: { bankId: BankId; overrides: FieldOverrides }) {
        const ok = saveFieldOverrides(snapshot.bankId, snapshot.overrides);
    if (!ok) {
      setStorageError(true);
    } else {
      setSaveState("saved");
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSaveState("idle"), 1600);
    }
  }

  function handleFieldMoved(fieldId: FieldId, pos: FieldPos) {
    // Single source of truth: clamp to cheque bounds, then snap to grid.
    const clamped = clampFieldPos(pos);
    const final = snapOn ? snapToGrid(clamped, 0.5) : clamped;
        setFieldOverrides((prev) => ({ ...prev, [fieldId]: final }));
    const snapshot = { bankId: bankRef.current, overrides: { ...overridesRef.current, [fieldId]: final } };
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      persistFieldOverrides(snapshot);
    }, 300);
  }

  /** Arrow-key nudging for the selected field (1 mm, Shift = 5 mm). */
  useEffect(() => {
    if (!moveMode || placingField || placingName || !selectedField) return;
    const field: FieldId = selectedField; // narrowed + stable for the closure
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("input, textarea, select, [contenteditable]")) return;
      const step = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;
      e.preventDefault();
      const template = BANK_TEMPLATES[bankRef.current];
      const base = template.fields[field];
      const current = resolveFieldPos(
        { x: base.x, y: base.y },
        overridesRef.current[field],
      );
      handleFieldMoved(field, { x: current.x + dx, y: current.y + dy });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveMode, selectedField, snapOn, placingField]);

  // Custom-instance keys: arrows nudge, Delete removes, Ctrl+D duplicates.
  useEffect(() => {
    if (!moveMode || !selectedCustomId || placingName || editingCustomId) return;
    const id = selectedCustomId; // stable for the closure
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("input, textarea, select, [contenteditable]")) return;
      const step = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "Delete") {
        e.preventDefault();
        removeCustom(id);
        return;
      } else if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        duplicateCustom(id);
        return;
      } else return;
      e.preventDefault();
      const field = customFieldsRef.current.find((f) => f.id === id);
      if (!field) return;
      updateCustom(id, {
        x: clampFieldPos({ x: field.x + dx, y: field.y + dy }).x,
        y: clampFieldPos({ x: field.x + dx, y: field.y + dy }).y,
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveMode, selectedCustomId, placingName, editingCustomId, snapOn]);

  function handleSaveAsDefault() {
    const snapshot = { bankId, overrides: fieldOverrides };
    const ok = saveFieldOverrides(snapshot.bankId, snapshot.overrides);
    if (!ok) {
      setStorageError(true);
      setImportStatus({ ok: false, message: "Could not save — storage may be blocked." });
      return;
    }
    setImportStatus({
      ok: true,
      message: `Saved layout as the default for ${BANKS.find((b) => b.id === bankId)?.name}.`,
    });
  }

  function handleCopyAsCode() {
    const snippet = copyLayoutAsCode(bankId, fieldOverrides);
    const full = `export const BANK_TEMPLATES: Record<BankId, BankTemplate> = {\n${snippet}\n};`;
    void navigator.clipboard
      ?.writeText(full)
      .then(() => {
        setImportStatus({ ok: true, message: "Copied — paste into lib/banks.ts." });
      })
      .catch(() => {
        setImportStatus({ ok: false, message: "Clipboard unavailable." });
      });
  }

  function handleDateSpacingChange(next: DateSpacing) {
    setDateSpacing(next);
    if (saveDateSpacing(bankId, next)) {
      setSaveState('saved');
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSaveState('idle'), 1600);
    } else {
      setStorageError(true);
    }
  }

  function handleDateSpacingReset() {
    const factory = BANK_TEMPLATES[bankId].dateSpacing ?? DEFAULT_DATE_SPACING;
    handleDateSpacingChange(factory);
  }

  // ---- Multi-instance Name fields ----

  function persistCustomFields(next: CustomTextField[]) {
    customFieldsRef.current = next;
    const ok = saveCustomFields(bankId, next);
    if (!ok) {
      setStorageError(true);
    } else {
      setSaveState('saved');
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSaveState('idle'), 1600);
    }
  }

  function updateCustom(id: string, patch: Partial<CustomTextField>) {
    setDraft((prev) => {
      const next = prev.customFields.map((f) => (f.id === id ? { ...f, ...patch } : f));
      persistCustomFields(next);
      return { customFields: next };
    });
  }

  function spawnNameAt(pos: FieldPos) {
    const clamped = clampFieldPos(snapOn ? snapToGrid(pos, 0.5) : pos);
    const instance: CustomTextField = {
      id: makeCustomFieldId(),
      text: 'Name',
      x: clamped.x,
      y: clamped.y,
      fontSize: 12,
      bold: false,
      uppercase: false,
      align: 'left',
    };
    setDraft((prev) => {
      const next = [...prev.customFields, instance];
      persistCustomFields(next);
      return { customFields: next };
    });
    setSelectedCustomId(instance.id);
    setEditingCustomId(instance.id);
  }

  /** Plain click on the Name chip: spawn at a visible, non-overlapping spot. */
  function spawnNameDefault() {
    spawnNameAt(spawnDefaultPosition(customFieldsRef.current));
  }

  // Name chip placement (pointer), same rect math as built-in chips.
  function nameActivate(clientX?: number, clientY?: number) {
    setPlacingName(true);
    if (clientX !== undefined && clientY !== undefined) {
      namePlacementMove(clientX, clientY);
    } else {
      const pos = spawnDefaultPosition(customFieldsRef.current);
      placingNamePosRef.current = pos;
      setPlacingNamePos(pos);
    }
  }

  function namePlacementMove(clientX: number, clientY: number) {
    const rect = canvasElRef.current?.getBoundingClientRect();
    if (!rect) return;
    const raw = dropPointToMm(clientX, clientY, rect, 203.2, 76.2);
    const pos = clampFieldPos(snapOn ? snapToGrid(raw, 0.5) : raw);
    placingNamePosRef.current = pos;
    setPlacingNamePos(pos);
  }

  function namePlacementStep(dxMm: number, dyMm: number) {
    const current = placingNamePosRef.current;
    if (!current) return;
    const pos = clampFieldPos(
      snapOn
        ? snapToGrid({ x: current.x + dxMm, y: current.y + dyMm }, 0.5)
        : { x: current.x + dxMm, y: current.y + dyMm },
    );
    placingNamePosRef.current = pos;
    setPlacingNamePos(pos);
  }

  function namePlacementCancel() {
    setPlacingName(false);
    placingNamePosRef.current = null;
    setPlacingNamePos(null);
  }

  function namePlacementDrop(clientX?: number, clientY?: number) {
    if (clientX !== undefined && clientY !== undefined) {
      const rect = canvasElRef.current?.getBoundingClientRect();
      if (
        !rect ||
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        namePlacementCancel();
        return;
      }
      namePlacementMove(clientX, clientY);
    }
    const pos = placingNamePosRef.current;
    if (!pos) {
      namePlacementCancel();
      return;
    }
    spawnNameAt(pos);
    namePlacementCancel();
  }

  function removeCustom(id: string) {
    setDraft((prev) => {
      const next = prev.customFields.filter((f) => f.id !== id);
      persistCustomFields(next);
      return { customFields: next };
    });
    if (selectedCustomId === id) setSelectedCustomId(null);
    if (editingCustomId === id) setEditingCustomId(null);
  }

  function duplicateCustom(id: string) {
    const source = customFieldsRef.current.find((f) => f.id === id);
    if (!source) return;
    const copy: CustomTextField = {
      ...source,
      id: makeCustomFieldId(),
      ...offsetForDuplicate({ x: source.x, y: source.y }),
    };
    setDraft((prev) => {
      const next = [...prev.customFields, copy];
      persistCustomFields(next);
      return { customFields: next };
    });
    setSelectedCustomId(copy.id);
  }

  function commitCustomEditing(id: string, text: string) {
    updateCustom(id, { text });
    setEditingCustomId(null);
    // Remember the text for reuse (deduped, capped in storage).
    const names = [text.trim(), ...savedNames.filter((n) => n.toLowerCase() !== text.trim().toLowerCase())].slice(0, 200);
    setSavedNames(names);
    saveSavedNames(names);
  }

  function cancelCustomEditing(id: string) {
    setEditingCustomId(null);
    // Escape on a placeholder instance removes it.
    const field = customFieldsRef.current.find((f) => f.id === id);
    if (field && field.text === 'Name') removeCustom(id);
  }

  function clearAllNames() {
    setDraft({ customFields: [] });
    customFieldsRef.current = [];
    setSelectedCustomId(null);
    setEditingCustomId(null);
    if (!clearCustomFields(bankId)) setStorageError(true);
  }

  function handleResetPositions() {
    setFieldOverrides({});
    setSelectedField(null);
    if (!clearFieldOverrides(bankId)) {
      setStorageError(true);
    }
  }

  /** Approximate character count used for drop anchoring. */
  function charsFor(fieldId: FieldId): number {
    if (fieldId === "date") return 10; // MM/DD/YYYY
    if (fieldId === "payee") return Math.max(payee.length, 8);
    if (fieldId === "amountNum") return Math.max(amountText.length, 8);
    if (fieldId === "amountWords") return 40;
    return 8;
  }

  /** Chip placement: Enter pressed or drag threshold exceeded. The ghost is
   *  seeded at the POINTER (converted to mm), never at a stale saved spot. */
  function activatePlacement(
    fieldId: FieldId,
    clientX?: number,
    clientY?: number,
  ) {
    placingFieldRef.current = fieldId;
    setPlacingField(fieldId);
    if (clientX !== undefined && clientY !== undefined) {
      placementMove(clientX, clientY);
      return;
    }
    // Keyboard pickup: start from the field's current/factory position.
    const template = BANK_TEMPLATES[bankId];
    const base = template.fields[fieldId];
    const current = resolveFieldPos(
      { x: base.x, y: base.y },
      fieldOverrides[fieldId],
    );
    placingPosRef.current = current;
    setPlacingPos(current);
  }

  /** Chip placement: pointer moved — convert to mm and anchor. */
  function placementMove(clientX: number, clientY: number) {
    const field = placingFieldRef.current;
    if (!field) return;
    const rect = canvasElRef.current?.getBoundingClientRect();
    if (!rect) return;
    const template = BANK_TEMPLATES[bankId];
    const raw = dropPointToMm(
      clientX,
      clientY,
      rect,
      template.widthMm,
      template.heightMm,
    );
    const anchored = anchorFieldPos(
      field,
      raw,
      charsFor(field),
      template.fields[field].fontSize,
    );
    const pos = clampFieldPos(snapOn ? snapToGrid(anchored, 0.5) : anchored);
    placingPosRef.current = pos;
    setPlacingPos(pos);
      }

  /** Chip placement: drop (pointer) or keyboard step. */
  function placementStep(dxMm: number, dyMm: number) {
    const current = placingPosRef.current;
    if (!current || !placingFieldRef.current) return;
    const moved = { x: current.x + dxMm, y: current.y + dyMm };
    const pos = clampFieldPos(snapOn ? snapToGrid(moved, 0.5) : moved);
    placingPosRef.current = pos;
    setPlacingPos(pos);
  }

  function placementCancel() {
    placingFieldRef.current = null;
    placingPosRef.current = null;
    setPlacingPos(null);
    setPlacingField(null);
  }

  function placementDrop(clientX?: number, clientY?: number) {
    const field = placingFieldRef.current;
    if (!field) return;
    if (clientX !== undefined && clientY !== undefined) {
      // Pointer drops outside the canvas are cancelled, not clamped in.
      const rect = canvasElRef.current?.getBoundingClientRect();
      if (
        !rect ||
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        placementCancel();
        return;
      }
      placementMove(clientX, clientY);
    }
    const pos = placingPosRef.current;
    if (!pos) {
      // The pointer never tracked a valid position — never commit a seed.
      placementCancel();
      return;
    }
    handleFieldMoved(field, pos);
    if (field === "date") setDraft({ includeDate: true });
    else if (field === "payee") setDraft({ includePayee: true });
    else if (field === "amountNum") setDraft({ includeAmount: true });
    else if (field === "crossing" && crossing === "none")
      setDraft({ crossing: "account-payee-only" });
    setSelectedField(field);
    placementCancel();
  }

  /** Remove a field from the cheque (✕ or right-click in Move mode). */
  function handleRemoveField(fieldId: FieldId) {
    setFieldOverrides((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
    if (!clearFieldOverrideSingle(bankId, fieldId)) {
      setStorageError(true);
    }
    if (fieldId === "date") setDraft({ includeDate: false });
    else if (fieldId === "payee") setDraft({ includePayee: false });
    else if (fieldId === "amountNum") setDraft({ includeAmount: false });
    else if (fieldId === "crossing") setDraft({ crossing: "none" });
    if (selectedField === fieldId) setSelectedField(null);
  }

  function handleResetAllBanks() {
    setFieldOverrides({});
    setSelectedField(null);
    if (!clearAllFieldOverrides()) {
      setStorageError(true);
    }
  }

  function handlePayeesChange(next: Payee[]) {
    setPayees(next);
    savePayees(next);
  }

  function handleExport() {
    const json = buildBackupJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ph-cheque-writer-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    setImportStatus({ ok: true, message: "Data exported." });
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const result = importBackup(text);
    if (result.ok) {
      setPayees(getPayees());
      const last = getLastBank();
      if (last) setDraft({ bankId: last, customFields: getCustomFields(last) });
      const noun = result.payeeCount === 1 ? "payee" : "payees";
      setImportStatus({
        ok: true,
        message: `Imported ${result.payeeCount} ${noun} (backup replaces current data).`,
      });
    } else {
      setImportStatus({ ok: false, message: result.error });
    }
  }

  async function handleImageFile(file: File) {
    try {
      await uploadImage(file);
      setImportStatus({
        ok: true,
        message: "Cheque image saved for this bank (this device only).",
      });
    } catch {
      setImportStatus({ ok: false, message: "Could not save the cheque image." });
    }
  }

  function buildPayload(): ChequePrintPayload {
    return {
      bankId,
      date: includeDate && dateIsValid ? isoDate : undefined,
      payee: includePayee && payeeIsValid ? payee.trim() : undefined,
      amount:
        includeAmount && amountIsValid && amount !== null ? amount : undefined,
      crossing: crossing === "none" ? undefined : crossing,
      capitalization,
      suffixOnly,
      omitZeroCentavos,
      dateSpacing,
      customFields,
      wordsMaxWidthMm: wordsMaxWidth,
      offset: getOffset(bankId),
      fieldOverrides,
    };
  }

  type PrintMode = "dialog" | "download";

  async function handlePrint(mode: PrintMode) {
    setGenerating(true);
    try {
      // Dynamic import keeps pdf-lib out of the initial page bundle.
      const { generatePdf } = await import("@/lib/generatePdf");
      const bytes = await generatePdf(buildPayload(), printLayout);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (mode === "download") {
        const link = document.createElement("a");
        link.href = url;
        link.download = "cheque.pdf";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(url);
        setPdfOpen(true);
      }
    } catch {
      setImportStatus({ ok: false, message: "PDF generation failed." });
    } finally {
      setGenerating(false);
    }
  }

  function handlePrintLayoutChange(next: PrintLayout) {
    setPrintLayout(next);
    savePrintLayout(bankId, next);
  }

  function handlePrintLayoutReset() {
    handlePrintLayoutChange(DEFAULT_PRINT_LAYOUT);
  }

  const menuBar = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className={MENU_BUTTON} />}
        >
          File
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={handleExport}>Export data…</DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            Import data…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className={MENU_BUTTON} />}
        >
          Tools
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            disabled={Object.keys(fieldOverrides).length === 0}
            onClick={handleSaveAsDefault}
          >
            Save as default…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={Object.keys(fieldOverrides).length === 0}
            onClick={() => void handleCopyAsCode()}
          >
            Copy as code…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={customFields.length === 0}
            onClick={() => setClearNamesConfirm(true)}
          >
            Clear all names on this bank…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={Object.keys(fieldOverrides).length === 0}
            onClick={() => setConfirmAction("bank")}
          >
            Reset field positions…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirmAction("all")}>
            Reset all banks…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPrintSetupOpen(true)}>
            Print setup…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDateSpacingOpen(true)}>
            Date spacing…
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/calibrate" />}>
            Calibrate…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        className={MENU_BUTTON}
        onClick={() => setHelpOpen(true)}
      >
        Help
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={MENU_BUTTON}
        onClick={() => setAboutOpen(true)}
      >
        About
      </Button>
    </>
  );

  const footerBar = (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
        Country: Philippines (PHP)
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!canPrint || generating}
          render={
            <Button
              className={cn(
                "h-12 rounded-xl px-8 text-base font-semibold text-cream",
                "bg-red hover:bg-red/90",
                canPrint && !generating && "print-ready",
              )}
            />
          }
        >
          {generating ? "Generating…" : "Print ▾"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!canPrint || generating}
            onClick={() => void handlePrint("dialog")}
          >
            Print…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canPrint || generating}
            onClick={() => void handlePrint("dialog")}
          >
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canPrint || generating}
            onClick={() => void handlePrint("download")}
          >
            Download PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = "";
        }}
      />
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

      <SystemShell menu={menuBar} footer={footerBar}>
        {storageError && (
          <p className="animate-in fade-in duration-300 mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not save to this browser&apos;s storage — it may be blocked
            (private mode) or full. Your changes apply for this session only.
          </p>
        )}
        {importStatus && (
          <p
            className={cn(
              "animate-in fade-in duration-300 mb-4 text-sm",
              importStatus.ok ? "text-ink-muted" : "text-destructive",
            )}
          >
            {importStatus.message}
          </p>
        )}

        {/* Toolbar */}
        <div className="animate-fade-up space-y-3 rounded-xl border border-line bg-paper/60 p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
            <div className="flex items-center gap-1.5">
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
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FieldChip
              label="Date"
              checked={includeDate}
              placing={placingField === "date"}
              onActivate={() => activatePlacement("date")}
              onPlacementMove={placementMove}
              onPlacementDrop={placementDrop}
              onPlacementStep={placementStep}
              onPlacementCancel={placementCancel}
              onToggle={() => setDraft({ includeDate: !includeDate })}
            />
            <FieldChip
              label="Payee"
              checked={includePayee}
              placing={placingField === "payee"}
              onActivate={() => activatePlacement("payee")}
              onPlacementMove={placementMove}
              onPlacementDrop={placementDrop}
              onPlacementStep={placementStep}
              onPlacementCancel={placementCancel}
              onToggle={() => setDraft({ includePayee: !includePayee })}
            />
            <FieldChip
              label="Amount"
              checked={includeAmount}
              placing={placingField === "amountNum"}
              onActivate={() => activatePlacement("amountNum")}
              onPlacementMove={placementMove}
              onPlacementDrop={placementDrop}
              onPlacementStep={placementStep}
              onPlacementCancel={placementCancel}
              onToggle={() => setDraft({ includeAmount: !includeAmount })}
            />
            <FieldChip
              label="Crossing"
              checked={crossing !== "none"}
              placing={placingField === "crossing"}
              onActivate={() => activatePlacement("crossing")}
              onPlacementMove={placementMove}
              onPlacementDrop={placementDrop}
              onPlacementStep={placementStep}
              onPlacementCancel={placementCancel}
              onToggle={() =>
                setDraft({ crossing: crossing === "none" ? "account-payee-only" : "none" })
              }
            />
            <FieldChip
              label="Name"
              mode="spawner"
              placing={placingName}
              onActivate={nameActivate}
              onPlacementMove={namePlacementMove}
              onPlacementDrop={namePlacementDrop}
              onPlacementStep={namePlacementStep}
              onPlacementCancel={namePlacementCancel}
              onToggle={spawnNameDefault}
            />
            <div className="mx-1 h-5 w-px bg-line" />
            <ToggleChip
              checked={moveMode}
              onChange={(next) => {
                setMoveMode(next);
                if (!next) setSelectedField(null);
              }}
            >
              Move fields
            </ToggleChip>
            {moveMode && (
              <ToggleChip checked={snapOn} onChange={setSnapOn}>
                Snap 0.5 mm
              </ToggleChip>
            )}
            {moveMode && Object.keys(fieldOverrides).length > 0 && (
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-xl px-5 font-mono text-[11px] uppercase tracking-[0.12em] text-destructive"
                onClick={() => setConfirmAction("bank")}
              >
                Reset positions
              </Button>
            )}
            {saveState === "saved" && (
              <span className="animate-in fade-in duration-300 font-mono text-[11px] uppercase tracking-[0.12em] text-teal">
                Saved
              </span>
            )}
            <div className="mx-1 h-5 w-px bg-line" />
            <Label className="label-micro text-ink-muted">Crossing</Label>
            <Select
              value={crossing}
              onValueChange={(value) => setDraft({ crossing: value as Crossing })}
            >
              <SelectTrigger className="h-11 w-56 rounded-xl px-5 data-[size=default]:h-11" aria-label="Crossing">
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
            <div className="mx-1 h-5 w-px bg-line" />
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl px-5"
              onClick={() => setWordingOpen(true)}
            >
              Wording…
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl px-5"
              onClick={() => setPayeeManagerOpen(true)}
            >
              Payees…
            </Button>
          </div>

          {/* Selected-field fine controls */}
          {moveMode && selectedField && selectedResolved && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
              <Label className="label-micro text-ink-muted">
                {selectedField} · mm
              </Label>
              <div className="flex items-center gap-2">
                <Label className="label-micro text-ink-muted">X</Label>
                <Input
                  type="number"
                  min={0}
                  max={203.2}
                  step={0.1}
                  value={selectedResolved.x}
                  onChange={(e) =>
                    handleFieldMoved(selectedField, {
                      x: Number(e.target.value),
                      y: selectedResolved.y,
                    })
                  }
                  className="h-11 w-24 rounded-xl"
                  aria-label={`${selectedField} X position in mm`}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="label-micro text-ink-muted">Y</Label>
                <Input
                  type="number"
                  min={0}
                  max={76.2}
                  step={0.1}
                  value={selectedResolved.y}
                  onChange={(e) =>
                    handleFieldMoved(selectedField, {
                      x: selectedResolved.x,
                      y: Number(e.target.value),
                    })
                  }
                  className="h-11 w-24 rounded-xl"
                  aria-label={`${selectedField} Y position in mm`}
                />
              </div>
              {selectedField === "amountWords" && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl px-5"
                  onClick={handleSnapWordsToLineEnd}
                >
                  Snap to line end
                </Button>
              )}
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                Arrow keys 1 mm · Shift 5 mm
              </span>
            </div>
          )}

          {/* Selected Name instance properties */}
          {selectedCustomId && selectedCustom && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
              <Label className="label-micro text-ink-muted">Name · text</Label>
              <Input
                value={selectedCustom.text}
                onChange={(e) => updateCustom(selectedCustom.id, { text: e.target.value })}
                className="h-11 w-56 rounded-xl"
                aria-label="Name label text (properties)"
              />
              {savedNames.length > 0 && (
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value) {
                      updateCustom(selectedCustom.id, { text: value });
                      commitCustomEditing(selectedCustom.id, value);
                    }
                  }}
                >
                  <SelectTrigger
                    className="h-11 w-48 rounded-xl px-5 data-[size=default]:h-11"
                    aria-label="Saved names"
                  >
                    <SelectValue placeholder="Saved names…" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2">
                <Label className="label-micro text-ink-muted">Size</Label>
                <Input
                  type="number"
                  min={6}
                  max={40}
                  step={0.5}
                  value={selectedCustom.fontSize}
                  onChange={(e) =>
                    updateCustom(selectedCustom.id, { fontSize: Number(e.target.value) })
                  }
                  className="h-11 w-20 rounded-xl"
                  aria-label="Custom label font size"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="label-micro text-ink-muted">X</Label>
                <Input
                  type="number"
                  min={0}
                  max={203.2}
                  step={0.1}
                  value={selectedCustom.x}
                  onChange={(e) =>
                    updateCustom(selectedCustom.id, { x: Number(e.target.value) })
                  }
                  className="h-11 w-24 rounded-xl"
                  aria-label="Custom label X mm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="label-micro text-ink-muted">Y</Label>
                <Input
                  type="number"
                  min={0}
                  max={76.2}
                  step={0.1}
                  value={selectedCustom.y}
                  onChange={(e) =>
                    updateCustom(selectedCustom.id, { y: Number(e.target.value) })
                  }
                  className="h-11 w-24 rounded-xl"
                  aria-label="Custom label Y mm"
                />
              </div>
              <ToggleChip
                checked={selectedCustom.bold}
                onChange={(v) => updateCustom(selectedCustom.id, { bold: v })}
              >
                Bold
              </ToggleChip>
              <ToggleChip
                checked={selectedCustom.uppercase}
                onChange={(v) => updateCustom(selectedCustom.id, { uppercase: v })}
              >
                Uppercase
              </ToggleChip>
              <Select
                value={selectedCustom.align}
                onValueChange={(value) =>
                  updateCustom(selectedCustom.id, {
                    align: value as CustomTextField["align"],
                  })
                }
              >
                <SelectTrigger
                  className="h-11 w-36 rounded-xl px-5 data-[size=default]:h-11"
                  aria-label="Custom label alignment"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Cheque canvas */}
        <div className="animate-fade-up mt-5" style={{ animationDelay: "80ms" }}>
          <ChequeCanvas
            bankId={bankId}
            mode="edit"
            offset={getOffset(bankId)}
            imageUrl={imageUrl}
            imageLoading={imageLoading}
            imageIsFlatScan={imageIsFlatScan}
            fieldOverrides={fieldOverrides}
            dateSpacing={dateSpacing}
            moveMode={moveMode}
            onFieldMoved={handleFieldMoved}
            selectedField={selectedField}
            onSelectField={setSelectedField}
            canvasRef={canvasElRef}
            placing={placingField !== null || placingName}
            ghostNamePos={placingName ? placingNamePos : null}
            ghostField={placingField}
            ghostPos={placingPos}
            onRemoveField={handleRemoveField}
            customFields={customFields}
            selectedCustomId={selectedCustomId}
            editingCustomId={editingCustomId}
            onSelectCustom={(id) => {
              setSelectedCustomId(id);
              if (id) setSelectedField(null);
            }}
            onCustomChange={updateCustom}
            onRemoveCustom={removeCustom}
            onDuplicateCustom={duplicateCustom}
            onEditingCommit={commitCustomEditing}
            onEditingCancel={cancelCustomEditing}
            wordsMaxWidthMm={wordsMaxWidth}
            onWordsMaxWidthChange={handleWordsWidthChange}
            dateIso={isoDate}
            payee={payee}
            amountText={amountText}
            crossing={crossing}
            includeDate={includeDate}
            includePayee={includePayee}
            includeAmount={includeAmount}
            onDateChange={(v) => setDraft({ isoDate: v })}
            onPayeeChange={(v) => setDraft({ payee: v })}
            onAmountChange={(v) => setDraft({ amountText: v })}
            onCrossingChange={(v) => setDraft({ crossing: v })}
            payees={payees}
            wordsText={amountIsValid && amount !== null ? wordingPreview : undefined}
          />
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
            {moveMode
              ? "Drag each field into place — positions save per bank and apply to the printed PDF."
              : "The cheque starts blank — drag a field chip onto it, or click a chip to place it at its saved spot. Flat scans line up with real print positions."}
          </p>
        </div>

        {/* Amount in words */}
        <div
          className="animate-fade-up mt-5 rounded-xl border border-line bg-paper/60 p-4"
          style={{ animationDelay: "140ms" }}
        >
          <p className="label-micro text-ink-muted">Amount in words</p>
          <p
            key={wordingPreview}
            className="animate-in fade-in duration-300 mt-1 text-sm leading-relaxed text-ink"
          >
            {wordsLayout?.lines.join(" ") ?? wordingPreview}
          </p>
          {wordsLayout?.wrapped && (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
              Two lines — drag the line-end handle on the cheque to widen it,
              or snap to the pre-printed line.
            </p>
          )}
          {wordsLine2Overlaps && (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-amber-700">
              Line 2 overlaps pre-printed text or the bank logo.
            </p>
          )}
          {wordsOverflow && (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-destructive">
              Amount words don&apos;t fit the line — shorten the amount or
              widen the line before printing.
            </p>
          )}
          {amountText !== "" && amount === null && (
            <p className="mt-1 text-xs text-destructive">
              Enter a valid amount — up to 999,999,999.99, at most 2 decimals.
            </p>
          )}
        </div>

        {warnings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {warnings.includes("postdated") && (
              <Badge className="animate-in zoom-in-95 duration-300 border-red/40 bg-red/10 text-red">
                Date is post-dated
              </Badge>
            )}
            {warnings.includes("stale") && (
              <Badge className="animate-in zoom-in-95 duration-300 border-red/40 bg-red/10 text-red">
                Date is more than 6 months old
              </Badge>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <NoticeBanner>
            Print at 100% / Actual Size, margins None. Test on plain paper
            first. Use only on your own genuine cheque stock.
          </NoticeBanner>
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-xl px-5 font-mono text-[11px] uppercase tracking-[0.12em] text-destructive"
            onClick={clearDraft}
          >
            Clear form
          </Button>
        </div>
      </SystemShell>

      <PayeeManager
        open={payeeManagerOpen}
        onOpenChange={setPayeeManagerOpen}
        payees={payees}
        onPayeesChange={handlePayeesChange}
      />

      <DateSpacingDialog
        open={dateSpacingOpen}
        onOpenChange={setDateSpacingOpen}
        spacing={dateSpacing}
        onChange={handleDateSpacingChange}
        onReset={handleDateSpacingReset}
      />

      <WordingDialog
        open={wordingOpen}
        onOpenChange={setWordingOpen}
        amountText={amountText}
        capitalization={capitalization}
        onCapitalizationChange={(v) => setDraft({ capitalization: v as Capitalization })}
        suffixOnly={suffixOnly}
        onSuffixOnlyChange={(v) => setDraft({ suffixOnly: v })}
        omitZeroCentavos={omitZeroCentavos}
        onOmitZeroCentavosChange={(v) => setDraft({ omitZeroCentavos: v })}
      />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How to print safely</DialogTitle>
            <DialogDescription>
              Follow these steps every time you print a cheque.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>Print at 100% / Actual Size, with margins set to None.</li>
            <li>
              Test on plain paper first and hold it against the cheque before
              printing on stock.
            </li>
            <li>Use only on your own genuine cheque stock.</li>
            <li>Check the printed date, payee, and amount before signing.</li>
            <li>
              For accurate field placement, upload a flat scan of your cheque
              (Upload image) — promo images are decorative only.
            </li>
            <li>
              If fields land in the wrong place, adjust the per-bank offsets on
              the Calibrate page (Tools → Calibrate).
            </li>
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>About PH Cheque Writer</DialogTitle>
            <DialogDescription>Version 0.1.0</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Fills in and prints the date, payee, amount, and crossing on your
              own pre-printed Philippine bank cheques.
            </p>
            <p>
              Not affiliated with any bank. All data stays in your browser —
              back it up with File → Export data. Cheque images are not part of
              the backup.
            </p>
            <p>Use only on your own genuine cheque stock.</p>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={clearNamesConfirm}
        onOpenChange={setClearNamesConfirm}
        title="Clear all names?"
        message={`Delete every custom name label on ${
          BANKS.find((b) => b.id === bankId)?.name
        }? This cannot be undone.`}
        onConfirm={clearAllNames}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={
          confirmAction === "bank"
            ? "Reset field positions?"
            : "Reset all banks?"
        }
        message={
          confirmAction === "bank"
            ? `Restore ${
                BANKS.find((b) => b.id === bankId)?.name
              }'s field positions to the factory defaults?`
            : "Restore every bank's field positions to the factory defaults? Your saved layouts will be lost. Custom name labels are NOT affected."
        }
        onConfirm={() => {
          if (confirmAction === "bank") handleResetPositions();
          else handleResetAllBanks();
        }}
      />

      <PdfDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        url={pdfUrl}
        title="Print Preview"
        description="Print at 100% / Actual Size, margins None. Test on plain paper first."
        onDownload={() => {
          if (!pdfUrl) return;
          const link = document.createElement("a");
          link.href = pdfUrl;
          link.download = "cheque.pdf";
          link.click();
        }}
      />

      <PrintLayoutDialog
        open={printSetupOpen}
        onOpenChange={setPrintSetupOpen}
        layout={printLayout}
        onChange={handlePrintLayoutChange}
        onReset={handlePrintLayoutReset}
      />
    </>
  );
}
