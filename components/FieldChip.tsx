"use client";

import { useRef } from "react";

import { cn } from "cn";

const DRAG_THRESHOLD_PX = 4;

type FieldChipProps = {
  label: string;
  /** Toggle chips show an on/off state; spawner chips never do. */
  mode?: "toggle" | "spawner";
  checked?: boolean;
  /** True while this field is being placed (mouse or keyboard). */
  placing?: boolean;
  /** Pointer moved past the threshold (or Enter pressed) — placement starts
   *  at the pointer's coordinates so the ghost never pins to a stale spot. */
  onActivate: (clientX?: number, clientY?: number) => void;
  /** Pointer moved while placing — report cursor for the ghost/drop point. */
  onPlacementMove: (clientX: number, clientY: number) => void;
  /** Pointer released while placing — drop at the cursor. */
  onPlacementDrop: (clientX?: number, clientY?: number) => void;
  /** Arrow keys while placing — move the ghost 1mm (Shift = 5mm). */
  onPlacementStep: (dxMm: number, dyMm: number) => void;
  /** Escape while placing — cancel. */
  onPlacementCancel: () => void;
  /** Plain click (under the threshold) — toggle the field on/off. */
  onToggle: () => void;
};

/**
 * Draggable field chip (docs/design.md): pointer-based drag source with a
 * click-vs-drag threshold, and keyboard placement (Enter picks up, arrows
 * move, Enter drops, Escape cancels).
 */
export default function FieldChip({
  label,
  mode = "toggle",
  checked = false,
  placing = false,
  onActivate,
  onPlacementMove,
  onPlacementDrop,
  onPlacementStep,
  onPlacementCancel,
  onToggle,
}: FieldChipProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    startRef.current = { x: e.clientX, y: e.clientY };
    draggingRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const start = startRef.current;
    if (!start) return;
    if (!draggingRef.current) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX) return;
      draggingRef.current = true;
      onActivate(e.clientX, e.clientY);
    }
    onPlacementMove(e.clientX, e.clientY);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const wasDragging = draggingRef.current;
    startRef.current = null;
    draggingRef.current = false;
    if (wasDragging) {
      onPlacementDrop(e.clientX, e.clientY);
    } else {
      onToggle();
    }
  }

  function handlePointerCancel() {
    startRef.current = null;
    draggingRef.current = false;
    onPlacementCancel();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (placing) {
      const step = e.shiftKey ? 5 : 1;
      if (e.key === "ArrowLeft") { e.preventDefault(); onPlacementStep(-step, 0); }
      else if (e.key === "ArrowRight") { e.preventDefault(); onPlacementStep(step, 0); }
      else if (e.key === "ArrowUp") { e.preventDefault(); onPlacementStep(0, -step); }
      else if (e.key === "ArrowDown") { e.preventDefault(); onPlacementStep(0, step); }
      else if (e.key === "Enter") { e.preventDefault(); onPlacementDrop(); }
      else if (e.key === "Escape") { e.preventDefault(); onPlacementCancel(); }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  }

  return (
    <button
      type="button"
      aria-pressed={mode === "toggle" ? checked : undefined}
      onClick={undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      className={cn(
        "min-h-11 touch-none select-none rounded-xl border px-5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all",
        placing
          ? "border-red bg-red/15 text-ink outline-2 outline-dashed outline-red/60"
          : mode === "toggle" && checked
            ? "border-red bg-red text-cream shadow-sm shadow-red/30"
            : mode === "spawner"
              ? "border-dashed border-teal bg-surface text-ink-muted hover:border-teal hover:text-ink"
              : "border-line bg-surface text-ink-muted hover:border-red/60 hover:text-ink",
        "cursor-grab active:cursor-grabbing",
      )}
    >
      {label}
    </button>
  );
}
