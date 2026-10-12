"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import type { Payee } from "@/lib/storage";

type PayeeManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payees: Payee[];
  onPayeesChange: (payees: Payee[]) => void;
};

function newPayeeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `payee-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** "…" dialog: add, edit-in-place, and delete payees (persisted by the parent). */
export default function PayeeManager({
  open,
  onOpenChange,
  payees,
  onPayeesChange,
}: PayeeManagerProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function nameTaken(name: string, exceptId?: string): boolean {
    const needle = name.trim().toLowerCase();
    return payees.some(
      (p) => p.id !== exceptId && p.name.toLowerCase() === needle,
    );
  }

  function addPayee() {
    const name = newName.trim();
    if (!name) return;
    if (nameTaken(name)) {
      setError(`"${name}" is already in the list.`);
      return;
    }
    onPayeesChange([...payees, { id: newPayeeId(), name }]);
    setNewName("");
    setError("");
  }

  function startEdit(payee: Payee) {
    setEditingId(payee.id);
    setEditName(payee.name);
    setDeletingId(null);
    setError("");
  }

  function saveEdit() {
    if (editingId === null) return;
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    if (nameTaken(name, editingId)) {
      setError(`"${name}" is already in the list.`);
      return;
    }
    onPayeesChange(
      payees.map((p) => (p.id === editingId ? { ...p, name } : p)),
    );
    setEditingId(null);
    setError("");
  }

  function confirmDelete() {
    if (deletingId === null) return;
    onPayeesChange(payees.filter((p) => p.id !== deletingId));
    setDeletingId(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payee Manager</DialogTitle>
          <DialogDescription>
            Saved payees appear as suggestions while typing. They stay on this
            device only — use File → Export data for a backup.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addPayee();
            }}
            placeholder="Add a payee…"
            aria-label="New payee name"
          />
          <Button type="button" size="icon-sm" onClick={addPayee} aria-label="Add payee">
            <PlusIcon />
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {payees.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No saved payees yet.
            </p>
          ) : (
            payees.map((payee) => (
              <div
                key={payee.id}
                className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/60"
              >
                {editingId === payee.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-7 flex-1"
                      aria-label="Edit payee name"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={saveEdit}
                      aria-label="Save"
                    >
                      <CheckIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel edit"
                    >
                      <XIcon />
                    </Button>
                  </>
                ) : deletingId === payee.id ? (
                  <>
                    <span className="flex-1 text-sm text-destructive">
                      Delete “{payee.name}”?
                    </span>
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      onClick={confirmDelete}
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => setDeletingId(null)}
                    >
                      No
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{payee.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEdit(payee)}
                      aria-label={`Edit ${payee.name}`}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      onClick={() => {
                        setDeletingId(payee.id);
                        setEditingId(null);
                      }}
                      aria-label={`Delete ${payee.name}`}
                    >
                      <Trash2Icon />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
