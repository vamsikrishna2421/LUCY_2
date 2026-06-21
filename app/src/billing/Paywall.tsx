/**
 * LUCY 2.0 — Paywall.
 *
 * The Pro upgrade surface: three plan cards (annual highlighted as "best value"), a trial CTA, the
 * feature list, restore, and terms/privacy links. Built directly on design tokens + RN primitives via
 * `useTheme()` (the ui/ primitive library has no shared components yet — only theme + motion).
 *
 * Fully functional in MOCK MODE: `purchase()` flips the dev pro flag, so the whole flow is testable with
 * zero credentials. Presented as a modal by `PaywallController` (`usePaywall()`), but also usable as a
 * standalone screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme, type Theme } from '../ui/theme/ThemeProvider';
import { useEntitlement } from './EntitlementProvider';
import type { BillingPackage, PlanId } from './types';

/** Marketing links — replace with the real URLs before launch (parked in NEEDS_FROM_YOU). */
const TERMS_URL = 'https://lucy.app/terms';
const PRIVACY_URL = 'https://lucy.app/privacy';

/** The Pro value props, in display order. */
const FEATURES: readonly string[] = [
  'Unlimited captures',
  'Premium cloud models (Claude & GPT)',
  'All proactive autopilots',
  'Advanced Health & Money',
  'LAN companion (desktop pairing)',
  'Meeting mode (live capture + summary)',
  'Priority processing',
];

export interface PaywallProps {
  /** Called when the user dismisses the paywall (close button / after a successful purchase). */
  onClose?: () => void;
  /** Called once a purchase or restore makes the user Pro. */
  onPurchased?: () => void;
  /** Optional context line under the title (e.g. "Unlock Meeting mode"). */
  headline?: string;
  /** Layout style override for the outer container. */
  style?: StyleProp<ViewStyle>;
}

export function Paywall({ onClose, onPurchased, headline, style }: PaywallProps): React.ReactElement {
  const theme = useTheme();
  const s = styles(theme);
  const { offerings, loading, isPro, mode, purchase, restore } = useEntitlement();

  const packages = offerings?.packages ?? [];
  // Default the selection to the annual plan (the anchor / best value) when available.
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && packages.length > 0) {
      const annual = packages.find((p) => p.period === 'annual');
      setSelected((annual ?? packages[0]).planId);
    }
  }, [packages, selected]);

  // If the user becomes Pro (purchase/restore/dev toggle), notify + close.
  useEffect(() => {
    if (isPro) {
      onPurchased?.();
    }
  }, [isPro, onPurchased]);

  const selectedPkg = packages.find((p) => p.planId === selected) ?? null;
  const ctaTrial = selectedPkg?.hasTrial ?? false;

  const handlePurchase = useCallback(async () => {
    if (!selected || busy) return;
    setError(null);
    setBusy('purchase');
    try {
      const result = await purchase(selected);
      if (result.success) {
        onPurchased?.();
        onClose?.();
      } else if (!result.cancelled && result.error) {
        setError(result.error);
      }
    } finally {
      setBusy(null);
    }
  }, [selected, busy, purchase, onPurchased, onClose]);

  const handleRestore = useCallback(async () => {
    if (busy) return;
    setError(null);
    setBusy('restore');
    try {
      const result = await restore();
      if (result.success) {
        onPurchased?.();
        onClose?.();
      } else if (!result.cancelled) {
        setError(result.error ?? 'No previous purchases found.');
      }
    } finally {
      setBusy(null);
    }
  }, [busy, restore, onPurchased, onClose]);

  const openLink = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {});
  }, []);

  const ctaLabel = ctaTrial ? 'Start 7-day free trial' : 'Continue';

  return (
    <View style={[s.container, style]}>
      {/* Header */}
      <View style={s.header}>
        {onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={12}
            style={s.closeBtn}
          >
            <Text style={s.closeIcon}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* Title block */}
        <Text style={s.kicker}>LUCY PRO</Text>
        <Text style={s.title}>Your second brain, unlimited.</Text>
        <Text style={s.subtitle}>
          {headline ?? 'Unlock unlimited captures, premium cloud models, and every autopilot.'}
        </Text>

        {/* Feature list */}
        <View style={s.featureList}>
          {FEATURES.map((f) => (
            <View key={f} style={s.featureRow}>
              <View style={s.checkDot}>
                <Text style={s.checkMark}>✓</Text>
              </View>
              <Text style={s.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Plans */}
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : (
          <View style={s.plans}>
            {packages.map((pkg) => (
              <PlanCard
                key={pkg.planId}
                theme={theme}
                pkg={pkg}
                selected={pkg.planId === selected}
                onSelect={() => setSelected(pkg.planId)}
              />
            ))}
          </View>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Primary CTA */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          onPress={handlePurchase}
          disabled={busy !== null || loading || !selected}
          style={({ pressed }) => [
            s.cta,
            (busy !== null || loading || !selected) && s.ctaDisabled,
            pressed && s.ctaPressed,
          ]}
        >
          {busy === 'purchase' ? (
            <ActivityIndicator color={theme.colors.textOnAccent} />
          ) : (
            <Text style={s.ctaText}>{ctaLabel}</Text>
          )}
        </Pressable>

        {ctaTrial ? (
          <Text style={s.trialNote}>7 days free, then {selectedPkg?.priceString}. Cancel anytime.</Text>
        ) : (
          <Text style={s.trialNote}>One-time payment. Yours forever.</Text>
        )}

        {/* Restore + legal */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          onPress={handleRestore}
          disabled={busy !== null}
          hitSlop={8}
          style={s.restoreBtn}
        >
          {busy === 'restore' ? (
            <ActivityIndicator color={theme.colors.textSecondary} size="small" />
          ) : (
            <Text style={s.restoreText}>Restore purchases</Text>
          )}
        </Pressable>

        <View style={s.legalRow}>
          <Pressable onPress={() => openLink(TERMS_URL)} hitSlop={8}>
            <Text style={s.legalLink}>Terms</Text>
          </Pressable>
          <Text style={s.legalDot}>·</Text>
          <Pressable onPress={() => openLink(PRIVACY_URL)} hitSlop={8}>
            <Text style={s.legalLink}>Privacy</Text>
          </Pressable>
        </View>

        {mode === 'mock' ? (
          <Text style={s.mockNote}>
            Dev mock mode — purchases are simulated locally (no RevenueCat keys configured).
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Plan card ────────────────────────────────────────────────────────────────

interface PlanCardProps {
  theme: Theme;
  pkg: BillingPackage;
  selected: boolean;
  onSelect: () => void;
}

/** Per-plan display copy derived from the package. */
function planCopy(pkg: BillingPackage): { name: string; cadence: string; badge?: string; sub?: string } {
  switch (pkg.period) {
    case 'annual': {
      // Per-month equivalent for the "best value" framing.
      const perMonth = pkg.price > 0 ? `$${(pkg.price / 12).toFixed(2)}/mo` : '';
      return {
        name: 'Annual',
        cadence: '/yr',
        badge: 'BEST VALUE',
        sub: perMonth ? `${perMonth} · billed yearly` : 'Billed yearly',
      };
    }
    case 'monthly':
      return { name: 'Monthly', cadence: '/mo', sub: 'Billed monthly' };
    case 'lifetime':
    default:
      return { name: 'Lifetime', cadence: '', sub: 'One-time payment' };
  }
}

function PlanCard({ theme, pkg, selected, onSelect }: PlanCardProps): React.ReactElement {
  const s = styles(theme);
  const copy = planCopy(pkg);
  const featured = Boolean(copy.badge);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${copy.name} plan, ${pkg.priceString}${copy.cadence}`}
      onPress={onSelect}
      style={({ pressed }) => [
        s.planCard,
        featured && s.planCardFeatured,
        selected && s.planCardSelected,
        pressed && s.planCardPressed,
      ]}
    >
      {copy.badge ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{copy.badge}</Text>
        </View>
      ) : null}

      <View style={s.planRow}>
        {/* Radio */}
        <View style={[s.radio, selected && s.radioOn]}>
          {selected ? <View style={s.radioDot} /> : null}
        </View>

        <View style={s.planTextCol}>
          <Text style={s.planName}>{copy.name}</Text>
          {copy.sub ? <Text style={s.planSub}>{copy.sub}</Text> : null}
        </View>

        <View style={s.planPriceCol}>
          <Text style={s.planPrice}>{pkg.priceString}</Text>
          {copy.cadence ? <Text style={s.planCadence}>{copy.cadence}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

// ── Styles (token-driven) ──────────────────────────────────────────────────────

const styles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.bg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: t.spacing.base,
      paddingTop: t.spacing.sm,
      height: 44,
      alignItems: 'center',
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surfaceAlt,
    },
    closeIcon: {
      color: t.colors.textSecondary,
      fontSize: 22,
      lineHeight: 24,
      marginTop: -2,
    },
    scrollContent: {
      paddingHorizontal: t.spacing.xl,
      paddingBottom: t.spacing.xxl,
      maxWidth: t.layout.maxContentWidth,
      width: '100%',
      alignSelf: 'center',
    },
    kicker: {
      ...t.typography.caption,
      color: t.colors.accent,
      letterSpacing: 1.5,
      marginBottom: t.spacing.sm,
    },
    title: {
      ...t.typography.h1,
      color: t.colors.textPrimary,
      marginBottom: t.spacing.sm,
    },
    subtitle: {
      ...t.typography.body,
      color: t.colors.textSecondary,
      marginBottom: t.spacing.xl,
    },
    featureList: {
      marginBottom: t.spacing.xl,
      gap: t.spacing.md,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
    },
    checkDot: {
      width: 22,
      height: 22,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkMark: {
      color: t.colors.accent,
      fontSize: 13,
      fontWeight: t.fontWeight.bold,
    },
    featureText: {
      ...t.typography.bodyMed,
      color: t.colors.textPrimary,
      flex: 1,
    },
    loadingBox: {
      paddingVertical: t.spacing.xxl,
      alignItems: 'center',
    },
    plans: {
      gap: t.spacing.md,
      marginBottom: t.spacing.lg,
    },
    planCard: {
      borderRadius: t.radius.lg,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      paddingVertical: t.spacing.base,
      paddingHorizontal: t.spacing.base,
    },
    planCardFeatured: {
      borderColor: t.colors.accentLine,
    },
    planCardSelected: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.surfaceAlt,
      ...t.elevation.glow,
    },
    planCardPressed: {
      opacity: 0.9,
    },
    badge: {
      position: 'absolute',
      top: -10,
      right: t.spacing.base,
      backgroundColor: t.colors.accent,
      borderRadius: t.radius.sm,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 2,
    },
    badgeText: {
      ...t.typography.caption,
      color: t.colors.textOnAccent,
      letterSpacing: 0.5,
      fontWeight: t.fontWeight.bold,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: t.radius.pill,
      borderWidth: 2,
      borderColor: t.colors.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: {
      borderColor: t.colors.accent,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.accent,
    },
    planTextCol: {
      flex: 1,
    },
    planName: {
      ...t.typography.h3,
      color: t.colors.textPrimary,
    },
    planSub: {
      ...t.typography.footnote,
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    planPriceCol: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    planPrice: {
      ...t.typography.h3,
      color: t.colors.textPrimary,
    },
    planCadence: {
      ...t.typography.footnote,
      color: t.colors.textSecondary,
      marginLeft: 2,
    },
    error: {
      ...t.typography.footnote,
      color: t.colors.danger,
      marginBottom: t.spacing.md,
      textAlign: 'center',
    },
    cta: {
      backgroundColor: t.colors.accent,
      borderRadius: t.radius.pill,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: t.spacing.sm,
      ...t.elevation.glow,
    },
    ctaDisabled: {
      opacity: 0.55,
    },
    ctaPressed: {
      opacity: 0.9,
    },
    ctaText: {
      ...t.typography.h3,
      color: t.colors.textOnAccent,
      fontWeight: t.fontWeight.bold,
    },
    trialNote: {
      ...t.typography.footnote,
      color: t.colors.textMuted,
      textAlign: 'center',
      marginTop: t.spacing.md,
    },
    restoreBtn: {
      alignSelf: 'center',
      paddingVertical: t.spacing.md,
      marginTop: t.spacing.sm,
    },
    restoreText: {
      ...t.typography.callout,
      color: t.colors.textSecondary,
      textDecorationLine: 'underline',
    },
    legalRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    },
    legalLink: {
      ...t.typography.footnote,
      color: t.colors.textMuted,
    },
    legalDot: {
      color: t.colors.textFaint,
    },
    mockNote: {
      ...t.typography.caption,
      color: t.colors.textFaint,
      textAlign: 'center',
      marginTop: t.spacing.lg,
    },
  });

export default Paywall;
