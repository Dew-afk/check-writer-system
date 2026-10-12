import type { ReactNode } from "react";

import { cn } from "cn";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
};

/** Rounded surface card recipe from docs/design.md. */
export default function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
