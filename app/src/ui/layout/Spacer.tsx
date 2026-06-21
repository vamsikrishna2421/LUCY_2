/**
 * Spacer — a token-sized gap. Use inside Row/Stack/View where a `gap` is impractical, or pass
 * `grow` to push siblings apart (flex:1). Size is from the spacing scale.
 */
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { SpacingToken } from '../theme/tokens';

export interface SpacerProps {
  /** Size from the spacing scale. Ignored when `grow` is set. Defaults to `base` (16). */
  size?: SpacingToken;
  /** Fill available space (flex:1) to push siblings apart. */
  grow?: boolean;
}

export function Spacer({ size = 'base', grow }: SpacerProps): React.ReactElement {
  const { spacing } = useTheme();
  if (grow) return <View style={{ flex: 1 }} />;
  return <View style={{ width: spacing[size], height: spacing[size] }} />;
}

export default Spacer;
