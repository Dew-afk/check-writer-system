import type { ReactNode } from "react";

import { cn } from "cn";

type NoticeBannerProps = {
  children: ReactNode;
  className?: string;
};

/** Mono small-print notice used for safety/legal lines (docs/design.md). */
export default function NoticeBanner({ children, className }: NoticeBannerProps) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}
