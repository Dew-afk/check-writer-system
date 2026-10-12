"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "cn";

const NAV_LINKS = [
  { href: "/system", label: "System" },
  { href: "/calibrate", label: "Calibrate" },
];

/**
 * The one shared shell for every page (docs/design.md): 80px top nav with
 * the logo on the left, centered mono uppercase links, and the theme toggle
 * on the right.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        <div className="relative mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6 md:px-10">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-ink"
          >
            PH Cheque Writer
          </Link>
          <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-8 font-mono text-[11px] uppercase tracking-[0.18em]">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-2 transition-colors hover:text-ink",
                    active
                      ? "border-b-2 border-red text-ink"
                      : "text-ink-muted",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 md:px-10">
        {children}
      </main>
      <footer className="border-t border-line bg-paper/60">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted md:px-10">
          <span>Country: Philippines (PHP)</span>
          <span>Use only on your own genuine cheque stock.</span>
        </div>
      </footer>
    </div>
  );
}
