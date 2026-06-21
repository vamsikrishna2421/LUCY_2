/**
 * LUCY 2.0 — RevenueCat wrapper (with built-in MOCK MODE).
 *
 * The ONLY module that touches `react-native-purchases`. Everything else (provider, paywall, gating)
 * goes through this façade and the local types in `./types`. Two hard requirements drive the design:
 *
 *  1. LAZY-REQUIRE the SDK. We `require()` it inside `configure()` — never at import time — so the app
 *     boots even when the package isn't installed or the native module isn't linked (Expo Go / web / a
 *     dev build without the pod). Any failure → we fall back to mock mode rather than throw.
 *
 *  2. MOCK MODE with zero credentials. When the RevenueCat API keys are absent (no
 *     `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`) OR the native module isn't present, we
 *     serve a realistic offering (the three real plans) and persist a dev "isPro" toggle in
 *     `expo-secure-store`. This makes the entire gating/paywall UX testable end-to-end with no setup.
 *
 * See docs/02_ARCHITECTURE.md §3 and §6.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import {
  PRO_ENTITLEMENT_ID,
  PLAN_PERIOD,
  type BillingCustomerInfo,
  type BillingMode,
  type BillingOffering,
  type BillingPackage,
  type PlanId,
  type PurchaseResult,
} from './types';

// ── Env keys ───────────────────────────────────────────────────────────────────
// EXPO_PUBLIC_* are inlined at build time; reading process.env is safe on device.
const IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';

/** SecureStore key for the dev pro toggle used in mock mode. */
const DEV_PRO_STORE_KEY = 'lucy.billing.devPro';
/** Stable anonymous app-user id for mock customer info. */
const MOCK_APP_USER_ID = 'mock-user';

// ── Module state ─────────────────────────────────────────────────────────────
/** The lazily-required `react-native-purchases` default export, or null in mock mode. */
let Purchases: any = null;
/** Whether `configure()` has completed (in either mode). */
let configured = false;
/** Which backend is live. Resolved during `configure()`; defaults to mock. */
let mode: BillingMode = 'mock';

// ── Mock offering ────────────────────────────────────────────────────────────
// The three real plans from docs/01_PRODUCT_DIRECTION.md §4. Prices match the proposed launch pricing.
const MOCK_OFFERING: BillingOffering = {
  identifier: 'default',
  packages: [
    {
      planId: 'lucy_pro_annual',
      packageIdentifier: '$rc_annual',
      priceString: '$79.99',
      price: 79.99,
      currencyCode: 'USD',
      period: 'annual',
      hasTrial: true,
      trialDays: 7,
    },
    {
      planId: 'lucy_pro_monthly',
      packageIdentifier: '$rc_monthly',
      priceString: '$9.99',
      price: 9.99,
      currencyCode: 'USD',
      period: 'monthly',
      hasTrial: true,
      trialDays: 7,
    },
    {
      planId: 'lucy_lifetime',
      packageIdentifier: '$rc_lifetime',
      priceString: '$199',
      price: 199,
      currencyCode: 'USD',
      period: 'lifetime',
      hasTrial: false,
      trialDays: 0,
    },
  ],
};

// ── Mock persistence ─────────────────────────────────────────────────────────
async function readDevPro(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(DEV_PRO_STORE_KEY)) === 'true';
  } catch {
    return false;
  }
}

async function writeDevPro(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(DEV_PRO_STORE_KEY, value ? 'true' : 'false');
  } catch {
    // Non-fatal: dev toggle simply won't persist across reloads.
  }
}

function mockCustomerInfo(isPro: boolean): BillingCustomerInfo {
  return {
    isPro,
    activeEntitlements: isPro ? [PRO_ENTITLEMENT_ID] : [],
    appUserId: MOCK_APP_USER_ID,
    proExpiresAt: null,
    isTrial: false,
  };
}

// ── SDK mapping helpers ──────────────────────────────────────────────────────
/** Infer our billing period from a RevenueCat package identifier / product. */
function periodFromPackage(pkg: any): BillingPackage['period'] {
  const id: string = (pkg?.identifier ?? '').toLowerCase();
  if (id.includes('annual') || id.includes('year')) return 'annual';
  if (id.includes('month')) return 'monthly';
  if (id.includes('lifetime')) return 'lifetime';
  // Fall back to the store product's subscription period when the identifier is custom.
  const subPeriod: string = (pkg?.product?.subscriptionPeriod ?? '').toUpperCase();
  if (subPeriod === 'P1Y') return 'annual';
  if (subPeriod === 'P1M') return 'monthly';
  return 'lifetime';
}

/** Best-effort map from a store product id to our PlanId. */
function planIdFromProduct(productId: string, period: BillingPackage['period']): PlanId {
  if (productId === 'lucy_pro_annual' || productId === 'lucy_pro_monthly' || productId === 'lucy_lifetime') {
    return productId;
  }
  if (period === 'annual') return 'lucy_pro_annual';
  if (period === 'lifetime') return 'lucy_lifetime';
  return 'lucy_pro_monthly';
}

function mapPackage(pkg: any): BillingPackage {
  const product = pkg?.product ?? {};
  const period = periodFromPackage(pkg);
  const planId = planIdFromProduct(product.identifier ?? '', period);
  const intro = product.introPrice ?? null;
  const trialDays = intro && intro.price === 0 ? introPeriodToDays(intro) : 0;
  return {
    planId,
    packageIdentifier: pkg?.identifier ?? planId,
    priceString: product.priceString ?? '',
    price: typeof product.price === 'number' ? product.price : 0,
    currencyCode: product.currencyCode ?? 'USD',
    period: PLAN_PERIOD[planId] ?? period,
    hasTrial: trialDays > 0,
    trialDays,
  };
}

/** Convert a RevenueCat introductory-period descriptor to a day count. */
function introPeriodToDays(intro: any): number {
  const unit: string = (intro?.periodUnit ?? '').toUpperCase();
  const count: number = typeof intro?.periodNumberOfUnits === 'number' ? intro.periodNumberOfUnits : 0;
  if (!count) return 0;
  switch (unit) {
    case 'DAY':
      return count;
    case 'WEEK':
      return count * 7;
    case 'MONTH':
      return count * 30;
    case 'YEAR':
      return count * 365;
    default:
      return count;
  }
}

function mapCustomerInfo(info: any): BillingCustomerInfo {
  const active = info?.entitlements?.active ?? {};
  const pro = active?.[PRO_ENTITLEMENT_ID];
  const activeIds = Object.keys(active);
  return {
    isPro: Boolean(pro),
    activeEntitlements: activeIds,
    appUserId: info?.originalAppUserId ?? 'unknown',
    proExpiresAt: pro?.expirationDate ?? null,
    isTrial: pro?.periodType === 'trial' || pro?.periodType === 'TRIAL',
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize the billing layer. Safe to call repeatedly (idempotent). Never throws — on any problem it
 * silently degrades to mock mode. Resolves once the mode is decided.
 */
export async function configure(): Promise<void> {
  if (configured) return;

  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;

  // No key for this platform → mock mode, no SDK touched.
  if (!apiKey) {
    mode = 'mock';
    configured = true;
    return;
  }

  // Try to lazy-require + configure the native SDK. Any failure falls back to mock.
  try {
    const mod = require('react-native-purchases');
    Purchases = mod?.default ?? mod;
    if (!Purchases || typeof Purchases.configure !== 'function') {
      throw new Error('react-native-purchases native module unavailable');
    }
    if (typeof Purchases.setLogLevel === 'function' && mod?.LOG_LEVEL) {
      Purchases.setLogLevel(__DEV__ ? mod.LOG_LEVEL.DEBUG : mod.LOG_LEVEL.ERROR);
    }
    await Purchases.configure({ apiKey });
    mode = 'live';
    configured = true;
  } catch {
    // SDK missing / native module not linked / configure failed → graceful mock.
    Purchases = null;
    mode = 'mock';
    configured = true;
  }
}

/** True once {@link configure} has run. */
export function isConfigured(): boolean {
  return configured;
}

/** Whether we're backed by the live SDK or the in-app mock. */
export function getMode(): BillingMode {
  return mode;
}

/** Convenience: true when running against the mock backend. */
export function isMock(): boolean {
  return mode === 'mock';
}

/**
 * Fetch the current offering (the set of plans to show on the paywall). In mock mode returns the three
 * real plans. In live mode maps RevenueCat's `current` offering; falls back to the mock if RC has no
 * current offering configured yet (so the paywall is never empty during setup).
 */
export async function getOfferings(): Promise<BillingOffering> {
  if (!configured) await configure();
  if (mode === 'mock' || !Purchases) return MOCK_OFFERING;

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current;
    const pkgs: any[] = current?.availablePackages ?? [];
    if (!current || pkgs.length === 0) return MOCK_OFFERING;
    return {
      identifier: current.identifier ?? 'default',
      packages: sortPackages(pkgs.map(mapPackage)),
    };
  } catch {
    return MOCK_OFFERING;
  }
}

/** Order packages annual → monthly → lifetime (paywall display order). */
function sortPackages(pkgs: BillingPackage[]): BillingPackage[] {
  const rank: Record<string, number> = { annual: 0, monthly: 1, lifetime: 2 };
  return [...pkgs].sort((a, b) => (rank[a.period] ?? 9) - (rank[b.period] ?? 9));
}

/**
 * Purchase a plan by its {@link PlanId}. In mock mode this flips the persisted dev pro flag on (no native
 * sheet). In live mode it finds the matching package in the current offering and runs the RC purchase.
 */
export async function purchase(planId: PlanId): Promise<PurchaseResult> {
  if (!configured) await configure();

  if (mode === 'mock' || !Purchases) {
    await writeDevPro(true);
    return { success: true, cancelled: false, customerInfo: mockCustomerInfo(true) };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const pkgs: any[] = offerings?.current?.availablePackages ?? [];
    const target = pkgs.find((p) => mapPackage(p).planId === planId);
    if (!target) {
      return { success: false, cancelled: false, error: `Plan ${planId} not available` };
    }
    const { customerInfo } = await Purchases.purchasePackage(target);
    const mapped = mapCustomerInfo(customerInfo);
    return { success: mapped.isPro, cancelled: false, customerInfo: mapped };
  } catch (e: any) {
    // RevenueCat sets userCancelled on the error object when the user dismisses the sheet.
    if (e?.userCancelled) return { success: false, cancelled: true };
    return { success: false, cancelled: false, error: e?.message ?? 'Purchase failed' };
  }
}

/**
 * Restore previous purchases. In mock mode this re-reads the persisted dev pro flag (so a "restore"
 * after toggling dev pro reflects the stored value). In live mode it runs RC's restore.
 */
export async function restore(): Promise<PurchaseResult> {
  if (!configured) await configure();

  if (mode === 'mock' || !Purchases) {
    const isPro = await readDevPro();
    return { success: isPro, cancelled: false, customerInfo: mockCustomerInfo(isPro) };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const mapped = mapCustomerInfo(customerInfo);
    return { success: mapped.isPro, cancelled: false, customerInfo: mapped };
  } catch (e: any) {
    return { success: false, cancelled: false, error: e?.message ?? 'Restore failed' };
  }
}

/**
 * Current entitlement snapshot. In mock mode this reflects the persisted dev pro toggle; in live mode it
 * maps RC's `getCustomerInfo()`. Never throws — returns a free snapshot on error.
 */
export async function getCustomerInfo(): Promise<BillingCustomerInfo> {
  if (!configured) await configure();

  if (mode === 'mock' || !Purchases) {
    return mockCustomerInfo(await readDevPro());
  }

  try {
    const info = await Purchases.getCustomerInfo();
    return mapCustomerInfo(info);
  } catch {
    return mockCustomerInfo(false);
  }
}

/**
 * DEV-ONLY: force the pro entitlement on/off (mock mode only). No-op in live mode — real entitlements
 * come from the store. Returns the resulting customer info so callers can update state immediately.
 */
export async function setDevPro(value: boolean): Promise<BillingCustomerInfo> {
  if (mode === 'live' && Purchases) {
    // Refuse to fake entitlements against the live SDK; return the real snapshot instead.
    return getCustomerInfo();
  }
  await writeDevPro(value);
  return mockCustomerInfo(value);
}
