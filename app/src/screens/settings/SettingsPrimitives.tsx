/**
 * Settings primitives — the calm accordion + row, rebuilt on the design system (app/src/ui).
 *
 * `SettingsGroup` is a collapsible card (icon + title + one-line summary + status pill + rotating
 * chevron) — collapsed by default so the screen presents one focal area at a time, exactly as
 * Settings 1.0. `SettingsRow` is a tappable detail row with an optional status pill and an optional
 * trailing action button. Pure presentation — no logic, tokens only.
 */
import React, { useRef, useState, type ReactNode } from 'react';
import { Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Surface, Text, Row, Badge, Button, Divider, PressableScale, useTheme,
} from '../../ui';

export function SettingsGroup({
  icon,
  title,
  summary,
  pill,
  defaultExpanded = false,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  summary: string;
  pill?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}): React.ReactElement {
  const { colors, spacing, radius, duration } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const chevron = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(chevron, { toValue: next ? 1 : 0, duration: duration.fast, useNativeDriver: true }).start();
  };
  const rotate = chevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <Surface level="surface" radius="lg" border="border" padding="none" style={{ marginBottom: spacing.md, overflow: 'hidden' }}>
      <PressableScale
        onPress={toggle}
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${summary}`}
      >
        <Row gap="md" align="center" paddingX="base" paddingY="md">
          <View
            style={{
              width: 40, height: 40, borderRadius: radius.md,
              backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name={icon} size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMed">{title}</Text>
            <Text variant="footnote" color="textMuted" numberOfLines={1}>{summary}</Text>
          </View>
          {pill ? <Badge label={pill} tone="accent" /> : null}
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="chevron-down" size={18} color={colors.textFaint} />
          </Animated.View>
        </Row>
      </PressableScale>
      {expanded ? (
        <View>
          <Divider />
          <View style={{ paddingVertical: spacing.xs }}>{children}</View>
        </View>
      ) : null}
    </Surface>
  );
}

export function SettingsRow({
  title,
  value,
  badge,
  active = false,
  actionLabel,
  actionDisabled,
  actionDestructive,
  onAction,
  onInfo,
}: {
  title: string;
  value: string;
  badge?: string;
  active?: boolean;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionDestructive?: boolean;
  onAction?: () => void;
  onInfo?: () => void;
}): React.ReactElement {
  const { colors, spacing } = useTheme();
  return (
    <Row gap="sm" align="center" paddingX="base" paddingY="sm">
      <PressableScale
        onPress={onInfo}
        scaleTo={0.99}
        accessibilityLabel={`Open ${title}`}
        style={{ flex: 1 }}
      >
        <Row gap="sm" align="center">
          <View style={{ flex: 1 }}>
            <Text variant="body">{title}</Text>
            <Text variant="footnote" color="textMuted" style={{ marginTop: 1 }}>{value}</Text>
          </View>
          {badge ? <StatusPill label={badge} active={active} /> : null}
          {onInfo ? (
            <View
              style={{
                width: 22, height: 22, borderRadius: 11,
                borderWidth: 1, borderColor: colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text variant="caption" color="textMuted" weight="700">i</Text>
            </View>
          ) : null}
        </Row>
      </PressableScale>
      {actionLabel ? (
        <Button
          label={actionLabel}
          size="sm"
          variant={actionDestructive ? 'danger' : 'secondary'}
          disabled={actionDisabled}
          onPress={onAction}
          style={{ marginLeft: spacing.xs }}
        />
      ) : null}
    </Row>
  );
}

/** A small status pill: soft accent when active, muted neutral otherwise. */
export function StatusPill({ active, label }: { active: boolean; label: string }): React.ReactElement {
  return <Badge label={label} tone={active ? 'accent' : 'neutral'} />;
}
