/**
 * LUCY 2.0 — gating/useEntitlement.
 *
 * The capability layer on top of billing state. Feature code asks questions in product terms — "can I use
 * cloud models?", "how many captures are left?" — without knowing about RevenueCat or tiers. It reads the
 * raw entitlement from `billing/EntitlementProvider` and resolves answers against `limits.ts`.
 *
 * This is the hook screens should reach for (and what `<Gate>` uses internally).
 */
import { useMemo } from 'react';

import { useEntitlement as useBillingEntitlement } from '../billing/EntitlementProvider';
import {
  isUnlimited,
  limitsForPro,
  remainingForLimit,
  UNLIMITED,
  type Feature,
  type LimitKey,
  type TierLimits,
} from './limits';

/** What `useEntitlement()` (gating) returns. */
export interface GatingEntitlement {
  /** True when the user has Pro. */
  isPro: boolean;
  /** True while a free trial is active. */
  isTrial: boolean;
  /** True during the initial billing hydrate. */
  loading: boolean;
  /** The resolved limit set for the current tier. */
  limits: TierLimits;
  /** Capability check: is this premium feature available on the current tier? */
  can: (feature: Feature) => boolean;
  /** Quota lookup: the numeric cap for a key (`UNLIMITED` for no cap). */
  limit: (key: LimitKey) => number;
  /** Remaining allowance for a quota given how many are already used. */
  remaining: (key: LimitKey, usedCount: number) => number;
  /** True when a quota key is uncapped on the current tier. */
  isUnlimited: (key: LimitKey) => boolean;
}

/**
 * Capability/limits view of the user's entitlement. Recomputes only when pro/trial/loading change.
 */
export function useEntitlement(): GatingEntitlement {
  const { isPro, isTrial, loading } = useBillingEntitlement();

  return useMemo<GatingEntitlement>(() => {
    const limits = limitsForPro(isPro);
    return {
      isPro,
      isTrial,
      loading,
      limits,
      can: (feature: Feature) => limits[feature],
      limit: (key: LimitKey) => limits[key],
      remaining: (key: LimitKey, usedCount: number) => remainingForLimit(limits[key], usedCount),
      isUnlimited: (key: LimitKey) => isUnlimited(limits[key]),
    };
  }, [isPro, isTrial, loading]);
}

export { UNLIMITED };
export type { Feature, LimitKey, TierLimits };
