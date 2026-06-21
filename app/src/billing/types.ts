/**
 * LUCY 2.0 — Billing types.
 *
 * Local, dependency-free shapes for the monetization layer. They intentionally mirror the relevant
 * subset of `react-native-purchases` (RevenueCat) so `purchases.ts` can map the SDK's objects onto these
 * — and so the rest of the app (provider, paywall, gating) never imports the SDK directly. This keeps the
 * native module fully optional (lazy-required) and makes MOCK MODE a drop-in.
 *
 * See docs/02_ARCHITECTURE.md §3.
 */

/** The two tiers in the product. `pro` is granted by the `pro` RevenueCat entitlement. */
export type Tier = 'free' | 'pro';

/** The RevenueCat entitlement identifier that grants Pro. Configured in the RC dashboard. */
export const PRO_ENTITLEMENT_ID = 'pro';

/** Product / store identifiers for the three plans. Must match App Store Connect / Play / RevenueCat. */
export type PlanId = 'lucy_pro_monthly' | 'lucy_pro_annual' | 'lucy_lifetime';

/** Billing cadence for a plan — drives copy ("/mo", "/yr", "once") and the "best value" math. */
export type BillingPeriod = 'monthly' | 'annual' | 'lifetime';

/**
 * A purchasable package within an offering. A flattened, display-ready view over RevenueCat's
 * `PurchasesPackage` + `StoreProduct` (only the fields the paywall needs).
 */
export interface BillingPackage {
  /** Our stable plan id (also the store product id). */
  planId: PlanId;
  /** RevenueCat package identifier (e.g. `$rc_monthly`); kept so we can purchase the exact package. */
  packageIdentifier: string;
  /** Localized, currency-formatted price string from the store, e.g. "$9.99". */
  priceString: string;
  /** Raw numeric price in the local currency (for "best value" / per-month math). */
  price: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currencyCode: string;
  /** Billing cadence. */
  period: BillingPeriod;
  /** Whether this package offers an introductory free trial. */
  hasTrial: boolean;
  /** Trial length in days when {@link hasTrial} is true (0 otherwise). */
  trialDays: number;
}

/** A RevenueCat offering — the named set of packages presented on the paywall. */
export interface BillingOffering {
  /** Offering identifier (RevenueCat `current` offering id, e.g. "default"). */
  identifier: string;
  /** Packages in display order. */
  packages: BillingPackage[];
}

/**
 * The subset of RevenueCat `CustomerInfo` the app consumes. `purchases.ts` derives {@link isPro} from
 * the presence of the active `pro` entitlement.
 */
export interface BillingCustomerInfo {
  /** True when the `pro` entitlement is active (subscription, trial, or lifetime). */
  isPro: boolean;
  /** Active entitlement identifiers (typically `['pro']` or `[]`). */
  activeEntitlements: string[];
  /** RevenueCat app user id (anonymous id in mock mode). */
  appUserId: string;
  /** Expiry of the pro entitlement (ISO string) — null for lifetime or when not subscribed. */
  proExpiresAt: string | null;
  /** True while a free trial is active. */
  isTrial: boolean;
}

/** Result of a purchase / restore attempt. `cancelled` distinguishes a user back-out from a failure. */
export interface PurchaseResult {
  /** True when the pro entitlement is active after the operation. */
  success: boolean;
  /** True when the user dismissed the native purchase sheet (not an error). */
  cancelled: boolean;
  /** Updated customer info when available. */
  customerInfo?: BillingCustomerInfo;
  /** Human-readable error message when {@link success} is false and not {@link cancelled}. */
  error?: string;
}

/** Whether the live SDK or the in-app mock is backing the billing layer (surfaced for dev UIs). */
export type BillingMode = 'live' | 'mock';

/** Map a plan id to its billing period (single source for the relationship). */
export const PLAN_PERIOD: Record<PlanId, BillingPeriod> = {
  lucy_pro_monthly: 'monthly',
  lucy_pro_annual: 'annual',
  lucy_lifetime: 'lifetime',
};
