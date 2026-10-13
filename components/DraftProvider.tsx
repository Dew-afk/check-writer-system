"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DRAFT_STORAGE_KEY,
  DEFAULT_DRAFT,
  sanitizeDraft,
  type ChequeDraft,
} from "@/lib/draftStore";

interface DraftContextValue {
  draft: ChequeDraft;
  setDraft: (
    patch: Partial<ChequeDraft> | ((prev: ChequeDraft) => Partial<ChequeDraft>),
  ) => void;
  clearDraft: () => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

/** Persists the draft (debounced) so navigation never loses the form. */
export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<ChequeDraft>(DEFAULT_DRAFT);
  const timer = useRef<number | null>(null);
  const draftRef = useRef<ChequeDraft>(DEFAULT_DRAFT);
  draftRef.current = draft;

  // Restore after mount to avoid hydration mismatches.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        setDraftState(sanitizeDraft(JSON.parse(raw)));
      }
    } catch {
      // Corrupted draft — start fresh.
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const persist = useCallback((next: ChequeDraft) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private mode / quota — the draft still works for this session.
      }
    }, 300);
  }, []);

  const setDraft = useCallback(
    (patch: Partial<ChequeDraft> | ((prev: ChequeDraft) => Partial<ChequeDraft>)) => {
      setDraftState((prev) => {
        const applied = typeof patch === "function" ? patch(prev) : patch;
        const next = { ...prev, ...applied };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearDraft = useCallback(() => {
    setDraftState(DEFAULT_DRAFT);
    persist(DEFAULT_DRAFT);
  }, [persist]);

  return (
    <DraftContext.Provider value={{ draft, setDraft, clearDraft }}>
      {children}
    </DraftContext.Provider>
  );
}

export function useDraft(): DraftContextValue {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useDraft must be used inside DraftProvider");
  return value;
}
