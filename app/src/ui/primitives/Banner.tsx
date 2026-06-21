/**
 * Banner — an inline, non-modal message strip for contextual info/warnings/errors/success. Sits in
 * the content flow (unlike Toast, which floats and auto-dismisses). Tone sets the icon + accent;
 * optional action text and a dismiss (×). Calm by default — soft tinted surface, hairline border.
 * Tokens only.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { PressableScale } from '../motion/PressableScale';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorToken } from '../theme/tokens';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'accent';

export interface BannerProps {
  /** Bold leading line. */
  title?: string;
  message: string;
  tone?: BannerTone;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

const TONE: Record<BannerTone, { accent: ColorToken; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { accent: 'info', icon: 'information-circle' },
  success: { accent: 'success', icon: 'checkmark-circle' },
  warning: { accent: 'warning', icon: 'warning' },
  danger: { accent: 'danger', icon: 'alert-circle' },
  accent: { accent: 'accent', icon: 'sparkles' },
};

export function Banner({
  title, message, tone = 'info', icon, actionLabel, onAction, onDismiss, style,
}: BannerProps): React.ReactElement {
  const { colors, radius, spacing, layout } = useTheme();
  const t = TONE[tone];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: layout.hairline,
          borderColor: colors.border,
          borderLeftWidth: 3,
          borderLeftColor: colors[t.accent],
          padding: spacing.md,
        },
        style,
      ]}
    >
      <Ionicons name={icon ?? t.icon} size={20} color={colors[t.accent]} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text variant="footnote" color="textPrimary" weight="700">{title}</Text> : null}
        <Text variant="footnote" color="textSecondary" style={title ? { marginTop: 2 } : undefined}>{message}</Text>
        {actionLabel && onAction ? (
          <PressableScale onPress={onAction} hitSlop={6} accessibilityLabel={actionLabel} style={{ marginTop: spacing.sm }}>
            <Text variant="footnote" color={t.accent} weight="700">{actionLabel}</Text>
          </PressableScale>
        ) : null}
      </View>
      {onDismiss ? (
        <Ionicons name="close" size={18} color={colors.textMuted} onPress={onDismiss} suppressHighlighting accessibilityLabel="Dismiss" />
      ) : null}
    </View>
  );
}

export default Banner;
