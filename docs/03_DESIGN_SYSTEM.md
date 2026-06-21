# LUCY 2.0 — Design System (contract)

> Token source of truth in code: `app/src/ui/theme/tokens.ts`. Components: `app/src/ui/`.
> Every component encodes its states and uses only these tokens — no ad-hoc values, no drift.

## The five constraints (testable, in precedence order)
1. **Self-evidence** — every screen readable with zero onboarding; one obvious next move.
2. **Calm** — one primary action per surface; low visual noise; progressive disclosure.
3. **Legible interaction** — affordances look tappable; no hidden-gesture-only paths.
4. **Premium motion** — spatial continuity; shared easing/duration tokens; nothing pops/teleports.
5. **Instant render** — skeletons + cached state always; never a white screen or layout shift.

## Foundations (tokens)
- **Color** — extend 1.0's premium dark + warm amber intelligence. Semantic tokens: `bg`, `surface`,
  `surfaceAlt`, `border`, `textPrimary`, `textSecondary`, `textMuted`, `accent`, `accentMuted`,
  `success`, `warning`, `danger`, `info`, `overlay`. Accent themes (1.0) preserved as accent swaps.
  Dark is primary; a light theme is a stretch goal (tokens structured to allow it).
- **Spacing** — 4pt base scale: `0,2,4,8,12,16,20,24,32,40,48,64`.
- **Radius** — `sm 8 · md 12 · lg 16 · xl 24 · pill 999`.
- **Typography** — system font stack; scale: `display 34/40 · h1 28/34 · h2 22/28 · h3 18/24 ·
  body 16/22 · callout 15/20 · footnote 13/18 · caption 11/14`; weights `regular/medium/semibold/bold`.
- **Elevation** — 4 levels mapped to 1.0 shadows; cards use `e1`, sheets `e3`, modals `e4`.
- **Motion** — durations `fast 120 · base 200 · slow 320 · deliberate 480` ms;
  easings `standard, decelerate, accelerate, spring(soft/snappy)`. Page transitions share an element where possible.
- **Density** — comfortable default; list-row min height 56; touch target ≥ 44.

## Core components (each with default/press/disabled/loading/error + skeleton)
`Button` (primary/secondary/ghost/danger) · `IconButton` · `Card` · `Sheet`/`ActionSheet` · `Toast` ·
`TextField`/`SearchField` · `ListItem` · `SegmentedControl` (sliding) · `Badge` · `Avatar`/`LucyOrb` ·
`Chip` · `Skeleton`/`SkeletonText` · `EmptyState` · `ProgressRing` · `Banner` · `Divider` ·
`SectionHeader` · `Gate`/`PaywallCard` (monetization) · `MetricStat` (reused by dashboard styling language).

## Instant-render rules
- Every data surface renders a **Skeleton** synchronously, then hydrates.
- Lists show cached page-1 before fresh fetch resolves; no blocking spinners on the critical path.

## Motion rules
- Entrance: `FadeInUp` (base + decelerate), staggered for lists.
- Press: `PressableScale` (0.97, spring snappy).
- Navigation: shared-element / cross-fade with `slow` + standard easing.
- Sheets: slide from edge with `spring soft`; backdrop fades `base`.

## Forgiveness (operational "comforting")
Undo over confirm-dialogs; reversible destructive actions via Toast-with-Undo; no destructive surprises.

## Migration plan
1. Implement `tokens.ts` + primitives in `app/src/ui/`.
2. Rebuild core-loop screens first (Capture/Home, Recall/Ask), then Brain, Health, Settings.
3. Replace `Alert.alert` with `ActionSheet`/`Toast`; replace raw colors with semantic tokens.
4. QA each surface against the five constraints.
