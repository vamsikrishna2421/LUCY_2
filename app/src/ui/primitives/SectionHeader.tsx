/**
 * SectionHeader — a labelled section title with an optional trailing action (e.g. "See all").
 * Standardises the spacing + type used above every grouped list/section so screens stay calm and
 * consistent. Title uses the h3 scale; an optional caption sits beneath.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { Row } from '../layout/Row';
import { PressableScale } from '../motion/PressableScale';
import { useTheme } from '../theme/ThemeProvider';

export interface SectionHeaderProps {
  title: string;
  /** Small secondary line under the title. */
  caption?: string;
  /** Trailing action label (renders a tappable accent text). */
  actionLabel?: string;
  onAction?: () => void;
  /** Custom trailing node (overrides actionLabel). */
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title, caption, actionLabel, onAction, trailing, style,
}: SectionHeaderProps): React.ReactElement {
  const { spacing } = useTheme();
  return (
    <Row justify="space-between" align="flex-end" style={[{ marginBottom: spacing.md }, style]}>
      <View style={{ flex: 1 }}>
        <Text variant="h3">{title}</Text>
        {caption ? <Text variant="footnote" color="textMuted" style={{ marginTop: 2 }}>{caption}</Text> : null}
      </View>
      {trailing
        ? trailing
        : actionLabel && onAction
          ? (
            <PressableScale onPress={onAction} hitSlop={8} accessibilityLabel={actionLabel}>
              <Text variant="footnote" color="accent" weight="600">{actionLabel}</Text>
            </PressableScale>
          )
          : null}
    </Row>
  );
}

export default SectionHeader;
