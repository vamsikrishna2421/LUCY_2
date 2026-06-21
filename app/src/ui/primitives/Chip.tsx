/**
 * Chip — a compact, tappable token for filters, tags, and quick selections. Selected state fills
 * with the soft accent + accent text; unselected is a bordered neutral. Optional leading icon and a
 * trailing remove affordance (for input-style chips). Press uses PressableScale. Tokens only.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { PressableScale } from '../motion/PressableScale';
import { useTheme } from '../theme/ThemeProvider';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Show a trailing "×" and call onRemove when tapped. */
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Chip({
  label, selected = false, onPress, disabled = false, icon, onRemove, style, testID,
}: ChipProps): React.ReactElement {
  const { colors, radius, spacing, layout } = useTheme();
  const fg = selected ? 'accent' : 'textSecondary';

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      testID={testID}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.pill,
            backgroundColor: selected ? colors.accentSoft : colors.surface,
            borderWidth: layout.hairline,
            borderColor: selected ? colors.accentLine : colors.border,
            ...(disabled ? { opacity: 0.45 } : null),
          },
          style,
        ]}
      >
        {icon ? <Ionicons name={icon} size={14} color={colors[fg]} /> : null}
        <Text variant="footnote" color={fg} weight="600">{label}</Text>
        {onRemove ? (
          <Ionicons
            name="close"
            size={14}
            color={colors.textMuted}
            onPress={onRemove}
            suppressHighlighting
          />
        ) : null}
      </View>
    </PressableScale>
  );
}

export default Chip;
