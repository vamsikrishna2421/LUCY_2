/**
 * Badge — a small status pill or count indicator. Tones map to semantic colors (neutral/accent/
 * success/warning/danger/info); `dot` renders a tiny dot, `count` clamps to "9+". Used for unread
 * counts, statuses, and inline labels. Tokens only.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorToken } from '../theme/tokens';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  /** Text label. Ignored when `count` or `dot` is set. */
  label?: string;
  /** Numeric count — clamps to "9+". */
  count?: number;
  /** Render a bare dot (no text). */
  dot?: boolean;
  tone?: BadgeTone;
  /** Solid fill vs. soft tinted background. Default soft. */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TONES: Record<BadgeTone, { fg: ColorToken; soft: ColorToken; solidFg: ColorToken }> = {
  neutral: { fg: 'textSecondary', soft: 'surfaceAlt', solidFg: 'textPrimary' },
  accent: { fg: 'accent', soft: 'accentSoft', solidFg: 'textOnAccent' },
  success: { fg: 'success', soft: 'surfaceAlt', solidFg: 'bg' },
  warning: { fg: 'warning', soft: 'surfaceAlt', solidFg: 'bg' },
  danger: { fg: 'danger', soft: 'surfaceAlt', solidFg: 'bg' },
  info: { fg: 'info', soft: 'surfaceAlt', solidFg: 'bg' },
};

export function Badge({
  label, count, dot, tone = 'neutral', solid = false, style,
}: BadgeProps): React.ReactElement {
  const { colors, radius } = useTheme();
  const t = TONES[tone];

  if (dot) {
    return (
      <View
        style={[
          { width: 8, height: 8, borderRadius: 4, backgroundColor: colors[t.fg] },
          style,
        ]}
      />
    );
  }

  const text = count !== undefined ? (count > 9 ? '9+' : String(count)) : label ?? '';
  const bg = solid ? colors[t.fg] : colors[t.soft];
  const fg: ColorToken = solid ? t.solidFg : t.fg;

  return (
    <View
      style={[
        {
          minWidth: 18,
          height: 18,
          paddingHorizontal: 6,
          borderRadius: radius.pill,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text variant="caption" color={fg} weight="700">{text}</Text>
    </View>
  );
}

export default Badge;
