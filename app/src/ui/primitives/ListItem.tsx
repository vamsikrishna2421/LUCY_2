/**
 * ListItem — the standard tappable row (spec density: list-row min height 56). Composes an optional
 * leading node (icon/avatar), a title + optional subtitle, and a trailing node (chevron by default
 * when tappable, or a custom control). Press uses PressableScale. Tokens only — every row across the
 * app shares this rhythm.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { PressableScale } from '../motion/PressableScale';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorToken } from '../theme/tokens';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Leading Ionicons name (rendered in a tinted disc). Use `leading` for anything custom. */
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: ColorToken;
  /** Custom leading node (overrides `icon`). */
  leading?: React.ReactNode;
  /** Custom trailing node (overrides the default chevron). */
  trailing?: React.ReactNode;
  /** Show a chevron when tappable. Default true if onPress is set. */
  showChevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ListItem({
  title,
  subtitle,
  icon,
  iconColor = 'accent',
  leading,
  trailing,
  showChevron,
  onPress,
  onLongPress,
  disabled = false,
  destructive = false,
  accessibilityLabel,
  style,
  testID,
}: ListItemProps): React.ReactElement {
  const { colors, spacing, radius, layout } = useTheme();
  const titleColor: ColorToken = destructive ? 'danger' : 'textPrimary';
  const chevron = (showChevron ?? !!onPress) && !trailing;

  const leadingNode = leading ?? (icon ? (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.sm,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={18} color={colors[iconColor]} />
    </View>
  ) : null);

  const body = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: layout.listRowMin,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.base,
          ...(disabled ? { opacity: 0.45 } : null),
        },
        style,
      ]}
    >
      {leadingNode}
      <View style={{ flex: 1 }}>
        <Text variant="body" color={titleColor} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text variant="footnote" color="textMuted" numberOfLines={2} style={{ marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
    </View>
  );

  if (!onPress && !onLongPress) return body;

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      scaleTo={0.985}
      accessibilityLabel={accessibilityLabel ?? title}
      testID={testID}
    >
      {body}
    </PressableScale>
  );
}

export default ListItem;
