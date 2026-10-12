import type { ReactNode } from "react";

import { cn } from "cn";

type FeatureCardProps = {
  accent: "red" | "teal" | "navy";
  title: string;
  children: ReactNode;
  className?: string;
};

const ACCENT_CLASSES = {
  red: "bg-red",
  teal: "bg-teal",
  navy: "bg-navy",
} as const;

/** Large cream geometric composition unique to each accent (docs/design.md). */
function ArtBlock({ accent }: { accent: FeatureCardProps["accent"] }) {
  if (accent === "red") {
    return (
      <>
        <span className="absolute -bottom-6 -right-4 size-28 rounded-full border-2 border-cream/40" />
        <span className="absolute -right-8 top-4 size-10 rotate-45 border-2 border-cream/30" />
        <span className="absolute left-6 top-6 size-4 border-2 border-cream/50" />
      </>
    );
  }
  if (accent === "teal") {
    return (
      <>
        <span className="absolute -bottom-8 -right-8 size-28 rotate-45 border-2 border-cream/40" />
        <span className="absolute -left-5 top-5 size-14 rounded-full border-2 border-cream/30" />
        <span className="absolute left-8 bottom-4 size-4 border-2 border-cream/50" />
      </>
    );
  }
  return (
    <>
      <span className="absolute -bottom-6 -right-6 size-24 border-2 border-cream/40" />
      <span className="absolute -right-10 top-6 size-12 rounded-full border-2 border-cream/30" />
      <span className="absolute left-6 top-6 size-4 border-2 border-cream/50" />
    </>
  );
}

/**
 * Colored feature card (docs/design.md): a tall accent art block on top,
 * then the mono title strip and body text on the surface below.
 */
export default function FeatureCard({
  accent,
  title,
  children,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-transform hover:-translate-y-1",
        className,
      )}
    >
      <div className={cn("relative h-32 overflow-hidden", ACCENT_CLASSES[accent])}>
        <ArtBlock accent={accent} />
      </div>
      <div className="p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</p>
      </div>
    </div>
  );
}
