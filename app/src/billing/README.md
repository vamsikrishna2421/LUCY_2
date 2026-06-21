# billing/ — Monetization (RevenueCat)

LUCY 2.0's paywall + entitlement layer. Freemium via **RevenueCat**, entitlement id **`pro`**, three
plans + a 7-day trial. Designed to run **with zero credentials** (mock mode), so the whole upgrade/gating
UX is testable on day one.

## Layers

```
purchases.ts          # the ONLY file that touches react-native-purchases (lazy-required)
  └─ EntitlementProvider.tsx   # React context: tier/isPro/offerings/loading + purchase/restore/refresh/setDevPro
       └─ Paywall.tsx          # the upgrade screen (3 plan cards, trial CTA, restore, legal)

../gating/            # capability checks (useEntitlement), <Gate>, usePaywall() — see ../gating
```

## Plans & entitlement

| Plan id | Price | Period | Trial |
|---|---|---|---|
| `lucy_pro_annual` | $79.99 | annual (anchor, "best value") | 7 days |
| `lucy_pro_monthly` | $9.99 | monthly | 7 days |
| `lucy_lifetime` | $199 | one-time | — |

Entitlement granting Pro: **`pro`** (`PRO_ENTITLEMENT_ID`). Configure offerings + entitlement in the
RevenueCat dashboard; product ids must match the table above.

## Mock mode (no setup required)

Mock mode activates when **either** RevenueCat key is missing
(`EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`) **or** the native module isn't present
(Expo Go, web, a dev build without the pod). In mock mode:

- `getOfferings()` returns the three real plans (real prices).
- `purchase()` flips a persisted dev "isPro" flag (via `expo-secure-store`) — no native sheet.
- `restore()` reflects that stored flag.
- `setDevPro(true|false)` toggles Pro for testing gates. (No-op against the live SDK.)

Check the active backend with `purchases.getMode()` / `purchases.isMock()`, or `useEntitlement().mode`.

## Going live

1. `npm install react-native-purchases` (see INTEGRATION.md) and make a dev/EAS build (native module
   required — not available in Expo Go).
2. Set `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY` in `.env`.
3. Create the `pro` entitlement, the three products, and an offering in RevenueCat.

No code changes needed — `purchases.ts` auto-detects keys + native module and switches to live.

## API (`purchases.ts`)

| Fn | Purpose |
|---|---|
| `configure()` | Idempotent init; decides live vs mock. Never throws. |
| `isConfigured()` / `getMode()` / `isMock()` | Status. |
| `getOfferings()` | Current offering (plans for the paywall). |
| `purchase(planId)` | Buy a plan → `PurchaseResult`. |
| `restore()` | Restore purchases → `PurchaseResult`. |
| `getCustomerInfo()` | Entitlement snapshot. |
| `setDevPro(bool)` | DEV/mock-only: force Pro on/off. |

App code normally uses the **provider hook** (`useEntitlement` from `billing`) or the **gating hook**
(`useEntitlement` from `gating`), not `purchases.ts` directly.

## Hooks — which `useEntitlement`?

- `billing` → `useEntitlement()` — raw state + actions: `{ tier, isPro, isTrial, offerings, loading, mode,
  purchase, restore, refresh, setDevPro }`.
- `gating` → `useEntitlement()` — capability view: `{ isPro, can(feature), limit(key),
  remaining(key, used), ... }`. **Prefer this in feature code.**

See **INTEGRATION.md** for the exact App.tsx wiring + presenting the paywall.
