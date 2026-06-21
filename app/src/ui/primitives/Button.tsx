/**
 * Button — the primary action primitive. Encodes every variant (primary/secondary/ghost/danger),
 * size (sm/md/lg), and state (default/press/disabled/loading) the design system calls for. Press
 * uses PressableScale; loading swaps the label for a spinner while preserving width; disabled dims
 * and blocks interaction. Tokens only — no raw colors/sizes.
 *
 * Self-evidence + calm: one obvious primary per surface; secondary/ghost recede; danger reads as
 * caution without shouting.
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { PressableScale } from '../motion/PressableScale';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorToken } from '../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Leading icon name (Ionicons). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Place the icon after the label. */
  iconRight?: boolean;
  /** Stretch to fill the parent width. */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface VariantStyle {
  bg: ColorToken | 'transparent';
  fg: ColorToken;
  border?: ColorToken;
}

const SIZES: Record<ButtonSize, { padV: number; padH: number; font: 'callout' | 'bodyMed'; icon: number; minH: number }> = {
  sm: { padV: 8, padH: 14, font: 'callout', icon: 16, minH: 36 },
  md: { padV: 12, padH: 18, font: 'bodyMed', icon: 18, minH: 48 },
  lg: { padV: 15, padH: 22, font: 'bodyMed', icon: 20, minH: 54 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconRight = false,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps): React.ReactElement {
  const { colors, radius, layout } = useTheme();

  const variants: Record<ButtonVariant, VariantStyle> = {
    primary: { bg: 'accent', fg: 'textOnAccent' },
    secondary: { bg: 'surfaceAlt', fg: 'textPrimary', border: 'border' },
    ghost: { bg: 'transparent', fg: 'accent' },
    danger: { bg: 'danger', fg: 'textOnAccent' },
  };
  const v = variants[variant];
  const dims = SIZES[size];
  const isDisabled = disabled || loading;
  const fg = colors[v.fg];

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      style={fullWidth ? { width: '100%' } : undefined}
      testID={testID}
    >
      <View
        style={[
          styles.base,
          {
            backgroundColor: v.bg === 'transparent' ? 'transparent' : colors[v.bg],
            borderRadius: radius.md,
            paddingVertical: dims.padV,
            paddingHorizontal: dims.padH,
            minHeight: Math.max(dims.minH, layout.touchTarget),
            ...(v.border ? { borderWidth: layout.hairline, borderColor: colors[v.border] } : null),
            ...(isDisabled ? { opacity: 0.45 } : null),
            ...(fullWidth ? { alignSelf: 'stretch' } : null),
          },
          style,
        ]}
      >
        {/* Spinner overlays the centered content while loading so width never jumps. */}
        {loading ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.center}>
              <ActivityIndicator size="small" color={fg} />
            </View>
          </View>
        ) : null}
        <View style={[styles.content, { opacity: loading ? 0 : 1 }]}>
          {icon && !iconRight ? <Ionicons name={icon} size={dims.icon} color={fg} /> : null}
          <Text variant={dims.font} color={v.fg} weight="600" numberOfLines={1}>{label}</Text>
          {icon && iconRight ? <Ionicons name={icon} size={dims.icon} color={fg} /> : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default Button;
