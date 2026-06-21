/**
 * SkeletonText — N shimmer lines approximating a paragraph. The last line is shortened so the block
 * reads as text rather than bars. Line height + gap come from tokens. Use while body copy loads.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Skeleton } from './Skeleton';
import { useTheme } from '../theme/ThemeProvider';

export interface SkeletonTextProps {
  /** Number of lines. Default 3. */
  lines?: number;
  /** Height of each line (px). Default 12. */
  lineHeight?: number;
  /** Width of the final (short) line, as a 0–1 fraction. Default 0.6. */
  lastLineWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonText({
  lines = 3, lineHeight = 12, lastLineWidth = 0.6, style,
}: SkeletonTextProps): React.ReactElement {
  const { spacing } = useTheme();
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {Array.from({ length: lines }).map((_, i) => {
        const isLast = i === lines - 1;
        return (
          <Skeleton
            key={i}
            height={lineHeight}
            width={isLast && lines > 1 ? `${Math.round(lastLineWidth * 100)}%` : '100%'}
          />
        );
      })}
    </View>
  );
}

export default SkeletonText;
