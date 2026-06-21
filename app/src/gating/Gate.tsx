/**
 * LUCY 2.0 — Gate.
 *
 * Wraps premium UI: when the feature is unlocked it renders children unchanged; when locked it shows a
 * tasteful lock state with an "Unlock with Pro" CTA that opens the paywall (via `usePaywall()`).
 *
 *   <Gate feature="meetingMode">      → hard lock: children replaced by a PaywallCard
 *   <Gate feature="cloudModels" soft> → soft lock: children shown dimmed under a tap-to-unlock scrim
 *
 * Built on tokens + RN primitives via `useTheme()`. Use the `soft` variant when a preview of the locked
 * UI is motivating (e.g. an autopilot list); use the default hard lock for entire premium screens.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '../ui/theme/ThemeProvider';
import { FEATURE_LABELS, type Feature } from './limits';
import { usePaywall } from './PaywallController';
import { useEntitlement } from './useEntitlement';

export interface GateProps {
  /** The premium capability required to see the children. */
  feature: Feature;
  /** Children to gate. */
  children: React.ReactNode;
  /**
   * Soft lock: render the children dimmed beneath a scrim with an unlock CTA (a teaser), instead of
   * fully replacing them with a {@link PaywallCard}. Defaults to false (hard lock).
   */
  soft?: boolean;
  /** Optional title for the lock card (defaults to the feature's label). */
  title?: string;
  /** Optional description for the lock card. */
  description?: string;
  /** Style override for the wrapper. */
  style?: StyleProp<ViewStyle>;
  /**
   * Render this instead of the default lock UI when locked. Receives an `unlock` callback. Lets a screen
   * provide a bespoke locked state while still routing to the shared paywall.
   */
  renderLocked?: (unlock: () => void) => React.ReactNode;
}

export function Gate({
  feature,
  children,
  soft = false,
  title,
  description,
  style,
  renderLocked,
}: GateProps): React.ReactElement {
  const { can, loading } = useEntitlement();
  const { open } = usePaywall();
  const theme = useTheme();
  const s = styles(theme);

  const label = title ?? FEATURE_LABELS[feature];
  const unlock = useCallback(
    () => open({ headline: `Unlock ${label}`, source: `gate:${feature}` }),
    [open, label, feature],
  );

  // While billing hydrates, render children to avoid a flash of the locked state for Pro users.
  if (loading || can(feature)) {
    return <View style={style}>{children}</View>;
  }

  if (renderLocked) {
    return <View style={style}>{renderLocked(unlock)}</View>;
  }

  // Soft lock — show a dimmed teaser of the real UI under a tappable scrim.
  if (soft) {
    return (
      <View style={[s.softWrap, style]}>
        <View style={s.softContent} pointerEvents="none">
          {children}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Unlock ${label} with Pro`}
          onPress={unlock}
          style={s.softScrim}
        >
          <LockBadge theme={theme} />
          <Text style={s.softTitle}>{label}</Text>
          <View style={s.softCta}>
            <Text style={s.softCtaText}>Unlock with Pro</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  // Hard lock — replace children with a PaywallCard.
  return (
    <View style={style}>
      <PaywallCard feature={feature} title={label} description={description} onUnlock={unlock} />
    </View>
  );
}

// ── PaywallCard (the default hard-lock surface, also exported for standalone use) ──

export interface PaywallCardProps {
  /** Feature being gated (used for default copy + telemetry source). */
  feature?: Feature;
  /** Card title. */
  title: string;
  /** Optional supporting copy. */
  description?: string;
  /** Called when the user taps the unlock CTA. If omitted, opens the shared paywall. */
  onUnlock?: () => void;
  /** Style override. */
  style?: StyleProp<ViewStyle>;
}

export function PaywallCard({
  feature,
  title,
  description,
  onUnlock,
  style,
}: PaywallCardProps): React.ReactElement {
  const theme = useTheme();
  const s = styles(theme);
  const { open } = usePaywall();

  const handlePress = useCallback(() => {
    if (onUnlock) onUnlock();
    else open({ headline: `Unlock ${title}`, source: feature ? `gate:${feature}` : 'paywallCard' });
  }, [onUnlock, open, title, feature]);

  return (
    <View style={[s.card, style]}>
      <LockBadge theme={theme} />
      <Text style={s.cardTitle}>{title}</Text>
      <Text style={s.cardDesc}>
        {description ?? 'This is a Pro feature. Upgrade to unlock it and everything else in LUCY Pro.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Unlock ${title} with Pro`}
        onPress={handlePress}
        style={({ pressed }) => [s.cardCta, pressed && s.cardCtaPressed]}
      >
        <Text style={s.cardCtaText}>Unlock with Pro</Text>
      </Pressable>
    </View>
  );
}

// ── Lock badge ─────────────────────────────────────────────────────────────────

function LockBadge({ theme }: { theme: Theme }): React.ReactElement {
  const s = styles(theme);
  return (
    <View style={s.lockBadge}>
      <Text style={s.lockGlyph}>🔒</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = (t: Theme) =>
  StyleSheet.create({
    // Hard-lock card
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.spacing.xl,
      alignItems: 'center',
      ...t.elevation.e1,
    },
    cardTitle: {
      ...t.typography.h3,
      color: t.colors.textPrimary,
      marginTop: t.spacing.md,
      textAlign: 'center',
    },
    cardDesc: {
      ...t.typography.callout,
      color: t.colors.textSecondary,
      textAlign: 'center',
      marginTop: t.spacing.sm,
      marginBottom: t.spacing.lg,
    },
    cardCta: {
      backgroundColor: t.colors.accent,
      borderRadius: t.radius.pill,
      paddingHorizontal: t.spacing.xl,
      paddingVertical: t.spacing.md,
      ...t.elevation.glow,
    },
    cardCtaPressed: {
      opacity: 0.9,
    },
    cardCtaText: {
      ...t.typography.bodyMed,
      color: t.colors.textOnAccent,
      fontWeight: t.fontWeight.bold,
    },

    // Soft lock
    softWrap: {
      position: 'relative',
      borderRadius: t.radius.lg,
      overflow: 'hidden',
    },
    softContent: {
      opacity: 0.35,
    },
    softScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.colors.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      padding: t.spacing.base,
    },
    softTitle: {
      ...t.typography.bodyMed,
      color: t.colors.textPrimary,
      marginTop: t.spacing.sm,
      marginBottom: t.spacing.md,
      textAlign: 'center',
    },
    softCta: {
      backgroundColor: t.colors.accent,
      borderRadius: t.radius.pill,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
    },
    softCtaText: {
      ...t.typography.callout,
      color: t.colors.textOnAccent,
      fontWeight: t.fontWeight.semibold,
    },

    // Lock badge
    lockBadge: {
      width: 44,
      height: 44,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockGlyph: {
      fontSize: 20,
    },
  });

export default Gate;
