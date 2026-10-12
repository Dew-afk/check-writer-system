import Link from "next/link";
import type { ReactNode } from "react";

type SystemShellProps = {
  /** Header strip contents (File/Tools dropdowns, Help, About). */
  menu: ReactNode;
  /** Footer contents (country label + Print dropdown). */
  footer: ReactNode;
  children: ReactNode;
};

/**
 * The desktop-style window chrome (docs/design.md): header strip on top,
 * body in the middle, footer strip with the primary action.
 */
export default function SystemShell({ menu, footer, children }: SystemShellProps) {
  return (
    <div className="animate-fade-up w-full max-w-4xl overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-1 border-b border-line bg-paper/60 px-2 py-1.5">
        {menu}
        <Link
          href="/"
          className="ml-auto pr-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted hover:text-ink"
        >
          ← Home
        </Link>
      </div>

      <div className="p-6">{children}</div>

      <div className="flex items-center justify-between border-t border-line bg-paper/60 px-4 py-2.5">
        {footer}
      </div>
    </div>
  );
}
