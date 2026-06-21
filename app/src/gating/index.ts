/**
 * LUCY 2.0 — gating public surface.
 *
 * Feature gating for screens/components: the capability hook, the `<Gate>` wrapper, the paywall trigger,
 * and the limit constants. Import from `gating` (this barrel).
 */
export { useEntitlement } from './useEntitlement';
export type { GatingEntitlement } from './useEntitlement';

export { Gate, PaywallCard } from './Gate';
export type { GateProps, PaywallCardProps } from './Gate';

export { PaywallController, usePaywall, PaywallControllerContext } from './PaywallController';
export type { PaywallControllerValue, OpenPaywallOptions, PaywallControllerProps } from './PaywallController';

export {
  FREE_LIMITS,
  PRO_LIMITS,
  FEATURE_LABELS,
  UNLIMITED,
  limitsForPro,
  isUnlimited,
  remainingForLimit,
} from './limits';
export type { Feature, LimitKey, QuotaLimits, FeatureFlags, TierLimits } from './limits';
