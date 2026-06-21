/**
 * EmptyState — a warm, character-led empty/zero-data state. Shows the breathing LucyOrb (or a custom
 * icon), a clear title + optional message, and an optional primary CTA. Turns empty lists into a
 * moment of warmth and gives the "one obvious next move" the self-evidence constraint asks for.
 * Tokens only.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Button } from './Button';
import { LucyOrb } from './LucyOrb';
import { useTheme } from '../theme/ThemeProvider';

export interface EmptyStateProps {
  title: string;
  message?: string;
  /** Show the breathing LucyOrb (default) or a static icon. */
  icon?: keyof typeof Ionicons.glyphMap;
  ctaLabel?: string;
  onCta?: () => void;
  /** Tighter vertical rhythm for empty states inside smaller cards. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title, message, icon, ctaLabel, onCta, compact = false, style,
}: EmptyStateProps): React.ReactElement {
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={[
        {
          alignItems: 'center',
          paddingVertical: compact ? spacing.xl : spacing.xxl,
          paddingHorizontal: spacing.xl,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.pill,
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={30} color={colors.accent} />
        </View>
      ) : (
        <LucyOrb size={64} />
      )}
      <Text variant="h3" align="center" style={{ marginTop: spacing.base }}>{title}</Text>
      {message ? (
        <Text variant="footnote" color="textMuted" align="center" style={{ marginTop: spacing.sm, maxWidth: 300 }}>
          {message}
        </Text>
      ) : null}
      {ctaLabel && onCta ? (
        <Button label={ctaLabel} onPress={onCta} variant="secondary" size="sm" style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

export default EmptyState;
