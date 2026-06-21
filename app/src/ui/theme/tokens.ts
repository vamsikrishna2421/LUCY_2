/**
 * LUCY 2.0 — Design tokens (SOURCE OF TRUTH).
 *
 * Every UI primitive/component/screen reads from here — no ad-hoc colors, spacing, or durations.
 * Values are brand-consistent with 1.0 (`src/config/colors.ts`) so the redesign migrates without a
 * visual break. Dark is primary; the structure (semantic names) allows a light theme later.
 *
 * See docs/03_DESIGN_SYSTEM.md.
 */

// ── Palette (raw) — mirrors 1.0 premium dark + amber ───────────────────────────
const palette = {
  amber: '#FF8C42',
  amberGlow: '#FFA05C',
  amberDeep: '#E8722A',
  amberSoft: '#3D1D08',
  amberMist: '#2A1205',
  amberLine: '#6F3515',

  ink0: '#0C0B09', // deepest background
  ink1: '#131108', // sheet
  ink2: '#161310', // surface
  ink3: '#1F1A14', // raised
  ink4: '#2A2219', // elevated

  cream: '#F5EFE6',
  tan: '#C4A882',
  brown: '#8A7560',
  faint: '#5C4A38',

  border: '#2D2218',
  borderSoft: '#221B12',
  divider: '#1E1710',

  success: '#4ADE80',
  warning: '#F59E0B',
  danger: '#FB7185',
  info: '#60A5FA',
  violet: '#A78BFA',
  gold: '#F5C451',
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ── Semantic colors ────────────────────────────────────────────────────────────
export const colors = {
  bg: palette.ink0,
  surface: palette.ink2,
  surfaceAlt: palette.ink3,
  surfaceElevated: palette.ink4,
  sheet: palette.ink1,

  border: palette.border,
  borderSoft: palette.borderSoft,
  divider: palette.divider,

  textPrimary: palette.cream,
  textSecondary: palette.tan,
  textMuted: palette.brown,
  textFaint: palette.faint,
  textOnAccent: '#1A0E03',

  accent: palette.amber,
  accentGlow: palette.amberGlow,
  accentDeep: palette.amberDeep,
  accentSoft: palette.amberSoft,
  accentMist: palette.amberMist,
  accentLine: palette.amberLine,

  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,
  accentSecondary: palette.violet,
  gold: palette.gold,

  overlay: 'rgba(0,0,0,0.6)',
  scrim: 'rgba(12,11,9,0.85)',
  white: palette.white,
  transparent: 'transparent',
} as const;

// ── Spacing (4pt base) ───────────────────────────────────────────────────────
export const spacing = {
  none: 0, xxs: 2, xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24,
  xxl: 32, xxxl: 40, huge: 48, mega: 64,
} as const;

// ── Radius ─────────────────────────────────────────────────────────────────────
export const radius = { none: 0, sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

// ── Typography ───────────────────────────────────────────────────────────────
export const fontWeight = {
  regular: '400', medium: '500', semibold: '600', bold: '700',
} as const;

export const typography = {
  display:  { fontSize: 34, lineHeight: 40, fontWeight: fontWeight.bold },
  h1:       { fontSize: 28, lineHeight: 34, fontWeight: fontWeight.bold },
  h2:       { fontSize: 22, lineHeight: 28, fontWeight: fontWeight.semibold },
  h3:       { fontSize: 18, lineHeight: 24, fontWeight: fontWeight.semibold },
  body:     { fontSize: 16, lineHeight: 22, fontWeight: fontWeight.regular },
  bodyMed:  { fontSize: 16, lineHeight: 22, fontWeight: fontWeight.medium },
  callout:  { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.regular },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.regular },
  caption:  { fontSize: 11, lineHeight: 14, fontWeight: fontWeight.medium },
} as const;

// ── Elevation (maps to RN shadow + Android elevation) ──────────────────────────
export const elevation = {
  e0: { shadowColor: palette.black, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  e1: { shadowColor: palette.amber, shadowOpacity: 0.06, shadowRadius: 4,  shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  e2: { shadowColor: palette.amber, shadowOpacity: 0.10, shadowRadius: 8,  shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  e3: { shadowColor: palette.amber, shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  e4: { shadowColor: palette.black, shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 16 },
  glow: { shadowColor: palette.amber, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
} as const;

// ── Motion ─────────────────────────────────────────────────────────────────────
export const duration = { fast: 120, base: 200, slow: 320, deliberate: 480 } as const;

// Bezier control points (use with Easing.bezier in RN).
export const easing = {
  standard:   [0.2, 0.0, 0.0, 1.0],
  decelerate: [0.0, 0.0, 0.0, 1.0],
  accelerate: [0.3, 0.0, 1.0, 1.0],
} as const;

export const spring = {
  soft:   { damping: 18, stiffness: 160, mass: 1 },
  snappy: { damping: 22, stiffness: 260, mass: 1 },
} as const;

// ── Layout ─────────────────────────────────────────────────────────────────────
export const layout = {
  touchTarget: 44,
  listRowMin: 56,
  screenPadding: spacing.base,
  maxContentWidth: 640,
  hairline: 1,
} as const;

export const tokens = {
  colors, spacing, radius, typography, fontWeight, elevation, duration, easing, spring, layout,
} as const;

export type Tokens = typeof tokens;
export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export default tokens;
