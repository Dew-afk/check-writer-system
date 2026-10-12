import type { CSSProperties } from "react";

/**
 * Faint geometric background: accent-tinted shapes drifting very slowly
 * behind the content (docs/design.md). Static under prefers-reduced-motion.
 */
const SHAPES: { style: CSSProperties; reverse?: boolean }[] = [
  { style: { top: "12%", left: "6%", width: "18vmin", height: "18vmin", borderRadius: "50%", border: "2px solid var(--color-red)", animationDelay: "-6s" } },
  { style: { top: "18%", right: "10%", width: "10vmin", height: "10vmin", background: "var(--color-teal)", opacity: 0.12, animationDelay: "-14s" }, reverse: true },
  { style: { bottom: "14%", left: "12%", width: "12vmin", height: "12vmin", background: "var(--color-navy)", opacity: 0.1, animationDelay: "-9s" } },
  { style: { bottom: "22%", right: "16%", width: "16vmin", height: "16vmin", border: "2px solid var(--color-teal)", transform: "rotate(45deg)", animationDelay: "-20s" }, reverse: true },
  { style: { top: "55%", left: "3%", width: "7vmin", height: "7vmin", background: "var(--color-red)", opacity: 0.1, animationDelay: "-3s" } },
];

export default function GeometricBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {SHAPES.map((shape, i) => (
        <span
          key={i}
          className={shape.reverse ? "geo-shape--reverse" : "geo-shape"}
          style={{ position: "absolute", opacity: shape.style.opacity ?? 0.08, ...shape.style }}
        />
      ))}
    </div>
  );
}
