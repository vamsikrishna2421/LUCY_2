/**
 * Row — horizontal flex layout with token-based gap + padding. The horizontal sibling of `Stack`.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { SpacingToken } from '../theme/tokens';

export interface RowProps {
  children?: React.ReactNode;
  gap?: SpacingToken;
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  flex?: number;
  style?: StyleProp<ViewStyle>;
}

export function Row({
  children, gap, padding, paddingX, paddingY, align = 'center', justify, wrap, flex, style,
}: RowProps): React.ReactElement {
  const { spacing } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: align,
          ...(wrap ? { flexWrap: 'wrap' } : null),
          ...(gap !== undefined ? { gap: spacing[gap] } : null),
          ...(padding !== undefined ? { padding: spacing[padding] } : null),
          ...(paddingX !== undefined ? { paddingHorizontal: spacing[paddingX] } : null),
          ...(paddingY !== undefined ? { paddingVertical: spacing[paddingY] } : null),
          ...(justify ? { justifyContent: justify } : null),
          ...(flex !== undefined ? { flex } : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default Row;
