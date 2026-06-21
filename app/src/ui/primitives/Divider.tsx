/**
 * Divider — a hairline separator. Horizontal by default (list/section separators), vertical with
 * `orientation="vertical"`. Thickness is the token hairline; color + inset come from tokens.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorToken, SpacingToken } from '../theme/tokens';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  color?: ColorToken;
  /** Inset from the leading/trailing edge (horizontal) or top/bottom (vertical). */
  inset?: SpacingToken;
  /** Margin along the cross axis (e.g. vertical space around a horizontal divider). */
  spacing?: SpacingToken;
  style?: StyleProp<ViewStyle>;
}

export function Divider({
  orientation = 'horizontal',
  color = 'divider',
  inset,
  spacing,
  style,
}: DividerProps): React.ReactElement {
  const { colors, spacing: space, layout } = useTheme();
  const insetPx = inset !== undefined ? space[inset] : 0;
  const spacePx = spacing !== undefined ? space[spacing] : 0;

  if (orientation === 'vertical') {
    return (
      <View
        style={[
          {
            width: layout.hairline,
            backgroundColor: colors[color],
            marginVertical: insetPx,
            marginHorizontal: spacePx,
            alignSelf: 'stretch',
          },
          style,
        ]}
      />
    );
  }
  return (
    <View
      style={[
        {
          height: layout.hairline,
          backgroundColor: colors[color],
          marginHorizontal: insetPx,
          marginVertical: spacePx,
        },
        style,
      ]}
    />
  );
}

export default Divider;
