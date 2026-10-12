# Design Language — PH Cheque Writer

Single source of truth for the UI. All pages (landing, system, calibrate),
dialogs, and overlays follow these recipes. Inspired by the Laws of UX
homepage reference: warm grays, cream surfaces, three accents, IBM Plex.
Tokens live in `app/globals.css` (`@theme` + `:root`/`.dark`).

## Palette

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | `#bfbfb6` | `#191a19` | Page background, header/footer washes |
| `surface` | `#d6d6d0` | `#242524` | Cards, toolbar panels |
| `cream` | `#ddd7b7` | `#cfc9b4` | Text on accents, FeatureCard text |
| `ink` | `#0f1e24` | `#e8e6df` | Headings, body text |
| `ink-muted` | `#55656b` | `#a3a199` | Secondary text, hints |
| `line` | `#a7a79e` | `#3d3e3a` | Borders, dividers, inputs |
| `red` (accent 1) | `#be4339` | `#e05946` | Primary buttons, toggles, focus rings, warnings |
| `teal` (accent 2) | `#206483` | `#3a86a8` | Secondary accents, feature cards |
| `navy` (accent 3) | `#415069` | `#6a7fae` | Tertiary accents, feature cards |

Semantic shadcn vars map onto these (see `:root` / `.dark` in globals.css):
`--primary: clay`, `--background: paper`, `--card: surface`, `--ring: clay`.

## Typography

- **Fonts**: IBM Plex Sans (body/headings, `--font-plex-sans`) + IBM Plex
  Mono (nav links, micro-labels, notices, chips, numeric readouts,
  `--font-plex-mono`).
- Headings: `font-semibold tracking-tight text-ink` (text-lg in windows,
  text-4xl/5xl on the hero).
- Micro-labels: `.label-micro` class (mono 11px, uppercase, `tracking 0.12em`)
  with `text-ink-muted` (labels) or `text-ink` (emphasis).
- Body hints: `text-sm text-ink-muted`; notices: `NoticeBanner` (mono 11px,
  uppercase, 0.14em tracking).

## Surfaces & layout

- **AppShell** (every page): sticky top nav, **80px tall** — logo left ("PH
  Cheque Writer"), centered mono uppercase links (System / Calibrate) with
  `gap-8`, `px-3 py-2` hit areas, and a red underline on the active page;
  theme toggle right. Container: `max-w-6xl px-6 md:px-10`.
- **SurfaceCard**: `rounded-xl border border-line bg-surface shadow-sm`.
- **Window chrome** (`SystemShell`): surface card with header strip
  (`bg-paper/60 border-b border-line`, mono menu buttons) and footer strip
  (country label left, primary action right).
- **Toolbar panel**: `rounded-xl border border-line bg-paper/60 p-4`.
- The cheque canvas sits in a padded surface card (`p-4`) with a rounded
  white frame; the cheque itself always stays **white with black text** —
  print truth.

## Controls

- **Sizing**: all controls are at least 44px tall (`min-h-11` / `h-11`),
  `px-5`, `rounded-xl`. Primary buttons are `h-12 px-8` (Print, Get
  Started, Print test grid).
- **Primary button**: `bg-red text-cream font-semibold hover:bg-red/90`;
  ready-to-print glow: `.print-ready`.
- **Pill toggle** — active: `border-red bg-red text-cream shadow-sm shadow-red/30`;
  inactive: `border-line bg-surface text-ink-muted hover:border-red/60 hover:text-ink`;
  mono 11px uppercase text.
- **Bank chip** (non-toggle): `rounded-full border border-line bg-surface
  px-4 py-1.5 font-mono text-xs text-ink-muted`, laid out with `gap-2`.
- **FeatureCard**: rounded-xl surface card with hover lift
  (`hover:-translate-y-1`); top = `h-32` accent art block (`red`/`teal`/`navy`)
  with large cream geometric marks (circle, rotated square, or square
  outline), bottom = mono uppercase title strip + body text.
- Canvas field hover rings: `hover:ring-2 hover:ring-red/40`; drag mode
  `cursor-move` + `ring-red/50`.

## Background

`GeometricBackground`: five faint accent-tinted shapes (circles, squares, a
rotated square — borders and 8–12% opacity fills) fixed behind content,
drifting on 28s/34s ease-in-out loops. Static under
`prefers-reduced-motion`.

## Motion

- Entrance: `.animate-fade-up` — 0.55s `cubic-bezier(0.22,1,0.36,1)`, `both`
  fill; stagger cards/rows ~60ms apart (e.g. 40/100/160/220ms).
- Feedback: pop-ins `animate-in fade-in/zoom-in-95 duration-300`.
- All motion off under `@media (prefers-reduced-motion: reduce)`.

## Theme

Light/dark via the `.dark` class on `<html>`; `ThemeToggle` persists the
choice in localStorage (`phcw-theme`); a tiny inline script in
`app/layout.tsx` applies it before first paint.

## Content notes

- Safety notice (persistent, `NoticeBanner`): "Print at 100% / Actual Size,
  margins None. Test on plain paper first. Use only on your own genuine
  cheque stock."
- Country label: "Country: Philippines (PHP)".
