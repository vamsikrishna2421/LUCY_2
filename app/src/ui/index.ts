/**
 * LUCY 2.0 design system — public barrel. Import primitives, layout, motion, and theme from here:
 *
 *   import { Button, Card, Text, useTheme, FadeInUp } from '@/ui'; // (or a relative path)
 *
 * Token source of truth: ./theme/tokens. Components read tokens via `useTheme()`.
 * See ./README.md for the full component catalog + usage snippets, and ./Gallery.tsx for a live
 * visual reference of every primitive in all states.
 */

// ── Theme + tokens ──────────────────────────────────────────────────────────
export { ThemeProvider, useTheme, darkTheme } from './theme/ThemeProvider';
export type { Theme, ThemeProviderProps } from './theme/ThemeProvider';
export {
  default as tokens,
  colors, spacing, radius, typography, fontWeight, elevation, duration, easing, spring, layout,
} from './theme/tokens';
export type { Tokens, ColorToken, SpacingToken } from './theme/tokens';

// ── Motion ──────────────────────────────────────────────────────────────────
export { PressableScale } from './motion/PressableScale';
export type { PressableScaleProps } from './motion/PressableScale';
export { FadeInUp } from './motion/FadeInUp';
export type { FadeInUpProps } from './motion/FadeInUp';
export { Stagger } from './motion/Stagger';
export type { StaggerProps } from './motion/Stagger';
export { useReduceMotion } from './motion/useReduceMotion';

// ── Layout ──────────────────────────────────────────────────────────────────
export { Stack } from './layout/Stack';
export type { StackProps } from './layout/Stack';
export { Row } from './layout/Row';
export type { RowProps } from './layout/Row';
export { Spacer } from './layout/Spacer';
export type { SpacerProps } from './layout/Spacer';

// ── Primitives: typography + structure ──────────────────────────────────────
export { Text } from './primitives/Text';
export type { TextProps, TextVariant } from './primitives/Text';
export { Surface } from './primitives/Surface';
export type { SurfaceProps, SurfaceLevel, ElevationToken, RadiusToken } from './primitives/Surface';
export { Card } from './primitives/Card';
export type { CardProps } from './primitives/Card';
export { Divider } from './primitives/Divider';
export type { DividerProps } from './primitives/Divider';
export { SectionHeader } from './primitives/SectionHeader';
export type { SectionHeaderProps } from './primitives/SectionHeader';

// ── Primitives: actions ─────────────────────────────────────────────────────
export { Button } from './primitives/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './primitives/Button';
export { IconButton } from './primitives/IconButton';
export type { IconButtonProps, IconButtonVariant, IconButtonSize } from './primitives/IconButton';

// ── Primitives: inputs ──────────────────────────────────────────────────────
export { TextField } from './primitives/TextField';
export type { TextFieldProps } from './primitives/TextField';
export { SearchField } from './primitives/SearchField';
export type { SearchFieldProps } from './primitives/SearchField';
export { SegmentedControl } from './primitives/SegmentedControl';
export type { SegmentedControlProps, SegmentOption } from './primitives/SegmentedControl';

// ── Primitives: data display ────────────────────────────────────────────────
export { ListItem } from './primitives/ListItem';
export type { ListItemProps } from './primitives/ListItem';
export { Badge } from './primitives/Badge';
export type { BadgeProps, BadgeTone } from './primitives/Badge';
export { Chip } from './primitives/Chip';
export type { ChipProps } from './primitives/Chip';
export { Avatar } from './primitives/Avatar';
export type { AvatarProps, AvatarSize, AvatarStatus } from './primitives/Avatar';
export { LucyOrb } from './primitives/LucyOrb';
export type { LucyOrbProps } from './primitives/LucyOrb';
export { ProgressRing } from './primitives/ProgressRing';
export type { ProgressRingProps } from './primitives/ProgressRing';

// ── Primitives: feedback / overlays ─────────────────────────────────────────
export { BottomSheet } from './primitives/BottomSheet';
export type { BottomSheetProps } from './primitives/BottomSheet';
export { ActionSheet } from './primitives/ActionSheet';
export type { ActionSheetProps, ActionSheetAction } from './primitives/ActionSheet';
export { ToastProvider, useToast } from './primitives/Toast';
export type { ToastOptions, ToastTone } from './primitives/Toast';
export { Banner } from './primitives/Banner';
export type { BannerProps, BannerTone } from './primitives/Banner';
export { EmptyState } from './primitives/EmptyState';
export type { EmptyStateProps } from './primitives/EmptyState';

// ── Skeletons (instant render) ──────────────────────────────────────────────
export { Skeleton } from './primitives/Skeleton';
export type { SkeletonProps } from './primitives/Skeleton';
export { SkeletonText } from './primitives/SkeletonText';
export type { SkeletonTextProps } from './primitives/SkeletonText';
