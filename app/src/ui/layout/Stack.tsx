/**
 * Stack — vertical flex layout with token-based gap + padding. Removes the endless ad-hoc
 * `style={{ gap, padding }}` views across screens; everything routes through the spacing scale.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { SpacingToken } from '../theme/tokens';

export interface StackProps {
  children?: React.ReactNode;
  /** Gap between children, from the spacing scale. */
  gap?: SpacingToken;
  /** Uniform padding, from the spacing scale. */
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  flex?: number;
  style?: StyleProp<ViewStyle>;
}

export function Stack({
  children, gap, padding, paddingX, paddingY, align, justify, flex, style,
}: StackProps): React.ReactElement {
  const { spacing } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'column',
          ...(gap !== undefined ? { gap: spacing[gap] } : null),
          ...(padding !== undefined ? { padding: spacing[padding] } : null),
          ...(paddingX !== undefined ? { paddingHorizontal: spacing[paddingX] } : null),
          ...(paddingY !== undefined ? { paddingVertical: spacing[paddingY] } : null),
          ...(align ? { alignItems: align } : null),
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

export default Stack;
