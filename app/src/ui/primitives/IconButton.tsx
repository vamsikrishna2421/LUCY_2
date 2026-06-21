/**
 * IconButton — a square, icon-only tap target. Variants mirror Button (primary/secondary/ghost/
 * danger) plus a `plain` for bare toolbar glyphs. Always ≥ the token touch target. States:
 * default/press (scale) / disabled (dim). Tokens only.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../motion/PressableScale';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorToken } from '../theme/tokens';

export type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'plain';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  /** Override the icon color token (defaults per-variant). */
  color?: ColorToken;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIZES: Record<IconButtonSize, { box: number; icon: number }> = {
  sm: { box: 36, icon: 18 },
  md: { box: 44, icon: 22 },
  lg: { box: 52, icon: 26 },
};

export function IconButton({
  icon,
  onPress,
  variant = 'plain',
  size = 'md',
  disabled = false,
  color,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: IconButtonProps): React.ReactElement {
  const { colors, radius, layout } = useTheme();

  const variants: Record<IconButtonVariant, { bg: ColorToken | 'transparent'; fg: ColorToken; border?: ColorToken }> = {
    primary: { bg: 'accent', fg: 'textOnAccent' },
    secondary: { bg: 'surfaceAlt', fg: 'textPrimary', border: 'border' },
    ghost: { bg: 'accentSoft', fg: 'accent' },
    danger: { bg: 'surfaceAlt', fg: 'danger', border: 'border' },
    plain: { bg: 'transparent', fg: 'textSecondary' },
  };
  const v = variants[variant];
  const dims = SIZES[size];
  const box = Math.max(dims.box, layout.touchTarget);

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={6}
      testID={testID}
    >
      <View
        style={[
          {
            width: box,
            height: box,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: v.bg === 'transparent' ? 'transparent' : colors[v.bg],
            ...(v.border ? { borderWidth: layout.hairline, borderColor: colors[v.border] } : null),
            ...(disabled ? { opacity: 0.4 } : null),
          },
          style,
        ]}
      >
        <Ionicons name={icon} size={dims.icon} color={colors[color ?? v.fg]} />
      </View>
    </PressableScale>
  );
}

export default IconButton;
