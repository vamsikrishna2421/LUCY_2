/**
 * LUCY 2.0 — billing public surface.
 *
 * Import from `billing` (this barrel), not individual files, so the internal layout can change freely.
 * The provider/paywall live here; capability checks and `<Gate>` live in `gating`.
 */
export { EntitlementProvider, useEntitlement, EntitlementContext } from './EntitlementProvider';
export type { EntitlementContextValue } from './EntitlementProvider';
export { Paywall } from './Paywall';
export type { PaywallProps } from './Paywall';

// Low-level façade (rarely needed directly — provider wraps it).
export * as purchases from './purchases';

export {
  PRO_ENTITLEMENT_ID,
  PLAN_PERIOD,
} from './types';
export type {
  Tier,
  PlanId,
  BillingPeriod,
  BillingPackage,
  BillingOffering,
  BillingCustomerInfo,
  PurchaseResult,
  BillingMode,
} from './types';
