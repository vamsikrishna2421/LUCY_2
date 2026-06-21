/**
 * LUCY 2.0 — EntitlementProvider.
 *
 * Owns the app's billing state and exposes it through context. It configures `purchases.ts` on mount,
 * hydrates the entitlement + offerings, and re-syncs when the app returns to the foreground (a purchase
 * or trial expiry may have happened off-app). Consumers use `useEntitlement()` (this file) for raw state,
 * or the richer `gating/useEntitlement` hook for capability checks.
 *
 * Everything works in MOCK MODE with no keys — `setDevPro()` flips the entitlement locally so the whole
 * gating/paywall UX is testable. See docs/02_ARCHITECTURE.md §3.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import * as billing from './purchases';
import type { BillingMode, BillingOffering, PlanId, PurchaseResult, Tier } from './types';

/** The value exposed by {@link EntitlementContext} / {@link useEntitlement}. */
export interface EntitlementContextValue {
  /** Resolved tier — `'pro'` when the `pro` entitlement is active, else `'free'`. */
  tier: Tier;
  /** Convenience boolean mirror of `tier === 'pro'`. */
  isPro: boolean;
  /** Whether a free trial is currently active. */
  isTrial: boolean;
  /** Current offering (plans for the paywall); null until first load completes. */
  offerings: BillingOffering | null;
  /** True during the initial hydrate (before tier/offerings are known). */
  loading: boolean;
  /** Whether billing is backed by the live SDK or the in-app mock. */
  mode: BillingMode;
  /** Purchase a plan; resolves with the outcome and refreshes state on success. */
  purchase: (planId: PlanId) => Promise<PurchaseResult>;
  /** Restore previous purchases; refreshes state on success. */
  restore: () => Promise<PurchaseResult>;
  /** Re-read entitlement + offerings from the billing layer. */
  refresh: () => Promise<void>;
  /** DEV-ONLY (mock mode): force pro on/off so gating is testable without credentials. */
  setDevPro: (value: boolean) => Promise<void>;
}

const defaultValue: EntitlementContextValue = {
  tier: 'free',
  isPro: false,
  isTrial: false,
  offerings: null,
  loading: true,
  mode: 'mock',
  purchase: async () => ({ success: false, cancelled: false, error: 'Provider not mounted' }),
  restore: async () => ({ success: false, cancelled: false, error: 'Provider not mounted' }),
  refresh: async () => {},
  setDevPro: async () => {},
};

const EntitlementContext = createContext<EntitlementContextValue>(defaultValue);

export interface EntitlementProviderProps {
  children: React.ReactNode;
}

export function EntitlementProvider({ children }: EntitlementProviderProps): React.ReactElement {
  const [isPro, setIsPro] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [offerings, setOfferings] = useState<BillingOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<BillingMode>('mock');

  /** Guards against setState after unmount during async hydrate. */
  const mounted = useRef(true);

  const applyCustomerInfo = useCallback((info: { isPro: boolean; isTrial: boolean }) => {
    if (!mounted.current) return;
    setIsPro(info.isPro);
    setIsTrial(info.isTrial);
  }, []);

  const refresh = useCallback(async () => {
    try {
      await billing.configure();
      // Offerings and customer info are independent — fetch in parallel.
      const [offering, customer] = await Promise.all([
        billing.getOfferings(),
        billing.getCustomerInfo(),
      ]);
      if (!mounted.current) return;
      setOfferings(offering);
      setMode(billing.getMode());
      applyCustomerInfo(customer);
    } catch {
      // Billing layer never throws, but guard anyway: default to free, mock.
      if (!mounted.current) return;
      setMode(billing.getMode());
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [applyCustomerInfo]);

  // Initial hydrate.
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  // Re-sync on foreground (entitlement may have changed while backgrounded).
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refresh]);

  const purchase = useCallback(
    async (planId: PlanId): Promise<PurchaseResult> => {
      const result = await billing.purchase(planId);
      if (result.success && result.customerInfo) applyCustomerInfo(result.customerInfo);
      else if (result.success) await refresh();
      return result;
    },
    [applyCustomerInfo, refresh],
  );

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    const result = await billing.restore();
    if (result.customerInfo) applyCustomerInfo(result.customerInfo);
    else if (result.success) await refresh();
    return result;
  }, [applyCustomerInfo, refresh]);

  const setDevPro = useCallback(
    async (value: boolean) => {
      const info = await billing.setDevPro(value);
      applyCustomerInfo(info);
    },
    [applyCustomerInfo],
  );

  const value = useMemo<EntitlementContextValue>(
    () => ({
      tier: isPro ? 'pro' : 'free',
      isPro,
      isTrial,
      offerings,
      loading,
      mode,
      purchase,
      restore,
      refresh,
      setDevPro,
    }),
    [isPro, isTrial, offerings, loading, mode, purchase, restore, refresh, setDevPro],
  );

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

/**
 * Raw entitlement state from the provider. Safe to call outside the provider — returns sensible defaults
 * (free tier, loading=false-ish). Most feature code should prefer `gating/useEntitlement` which layers
 * capability checks on top of this.
 */
export function useEntitlement(): EntitlementContextValue {
  return useContext(EntitlementContext);
}

export { EntitlementContext };
