# Monetization — Integration Guide

How the orchestrator wires billing + gating into the app. **Nothing here edits frozen logic.** Two
provider wraps in `App.tsx` and you're done; everything works in mock mode immediately.

---

## 1. Wrap the app (App.tsx)

Add two providers near the root, **inside** `SafeAreaProvider` (the paywall uses theme + safe-area) and
**inside** `ThemeProvider` if/when the UI layer adds one. Order: `EntitlementProvider` (state) →
`PaywallController` (the shared paywall modal) → your existing tree.

### Imports (top of App.tsx)

```tsx
import { EntitlementProvider } from './src/billing';
import { PaywallController } from './src/gating';
```

### Wrap (in the returned tree)

Current root is:

```tsx
<ErrorBoundary>
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        {/* …app… */}
```

Insert the two providers just inside `SafeAreaProvider`:

```tsx
<ErrorBoundary>
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <EntitlementProvider>
        <PaywallController>
          <SafeAreaView style={styles.safe}>
            {/* …app (unchanged)… */}
          </SafeAreaView>
        </PaywallController>
      </EntitlementProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
</ErrorBoundary>
```

That's the entire required change. The paywall is now reachable from anywhere via `usePaywall()`, and
`useEntitlement()` works app-wide.

> Note: there is no `ThemeProvider` in `App.tsx` yet — the paywall/gate call `useTheme()`, which safely
> falls back to the dark theme outside a provider. When the UI layer adds `ThemeProvider` at the root,
> keep `EntitlementProvider`/`PaywallController` inside it.

---

## 2. Present the paywall

Anywhere under `PaywallController`:

```tsx
import { usePaywall } from '../gating';

function UpgradeButton() {
  const { open } = usePaywall();
  return <Button title="Go Pro" onPress={() => open({ source: 'settings' })} />;
}
```

Or render the screen directly (e.g. a dedicated route) — it's a normal component:

```tsx
import { Paywall } from '../billing';
<Paywall onClose={goBack} onPurchased={goBack} />
```

---

## 3. Gate a premium feature

```tsx
import { Gate, useEntitlement } from '../gating';

// Declarative wrap (hard lock → PaywallCard when free):
<Gate feature="meetingMode">
  <MeetingMode … />
</Gate>

// Soft lock (dim the real UI under a tap-to-unlock scrim):
<Gate feature="cloudModels" soft>
  <CloudModelPicker />
</Gate>

// Imperative checks (quotas + capabilities):
const { isPro, can, remaining } = useEntitlement();
if (!can('lanCompanion')) { /* hide the entry point */ }
const left = remaining('capturesPerDay', todaysCaptureCount); // Infinity when Pro
if (left <= 0) usePaywall().open({ headline: 'Daily capture limit reached' });
```

Features: `unlimitedCaptures`, `multipleAutopilots`, `cloudModels`, `lanCompanion`, `meetingMode`,
`advancedHealth`, `advancedMoney`, `priorityProcessing`. Quotas: `capturesPerDay`, `activeAutopilots`.
(All defined in `gating/limits.ts`.)

### Suggested wiring points (existing surfaces → gate)
- **Meeting mode** (`components/MeetingMode`, header "Meeting" pill in App.tsx) → `feature="meetingMode"`.
- **LAN companion / dashboard server** (Settings → server toggle) → `feature="lanCompanion"`.
- **Cloud model selection** (Settings → Remote intelligence) → `feature="cloudModels"`.
- **Capture submit** (`screens/Capture`) → check `remaining('capturesPerDay', usedToday)` before enqueue.
- **Autopilots** list → `feature="multipleAutopilots"` beyond the first active one.
- **Advanced Health / Money** panels → `feature="advancedHealth"` / `feature="advancedMoney"`.

(The orchestrator owns screens/; these are recommendations, not changes made here.)

---

## 4. Dev testing without credentials (mock mode)

No keys needed. To flip Pro on/off while testing gates, call `setDevPro` from the billing hook (persists
via `expo-secure-store`):

```tsx
import { useEntitlement } from '../billing'; // the billing hook (not the gating one)
const { mode, isPro, setDevPro } = useEntitlement();
// e.g. a hidden Settings dev row:
<Switch value={isPro} onValueChange={setDevPro} />        // mock mode only
{mode === 'mock' && <Text>Billing: mock</Text>}
```

A real purchase on the mock paywall also flips this flag, so the end-to-end flow (paywall → "purchase" →
gates unlock) is fully exercisable in Expo Go / web / a dev build without the pod.

---

## 5. Native dependency (for live billing)

```bash
npm install react-native-purchases
```

- The SDK is **lazy-required** in `billing/purchases.ts` — the app runs without it (mock mode). Install
  it only when you're ready to test live purchases.
- Requires a **dev build / EAS build** (native module; not available in Expo Go).
- Set keys in `.env` (and document in `.env.example`):

  ```
  EXPO_PUBLIC_RC_IOS_KEY=appl_xxx
  EXPO_PUBLIC_RC_ANDROID_KEY=goog_xxx
  ```

- In RevenueCat: create entitlement `pro`, products `lucy_pro_monthly` / `lucy_pro_annual` /
  `lucy_lifetime`, and a current offering. No code change needed — `purchases.ts` auto-switches to live
  once a platform key + the native module are present.

---

## 6. Telemetry hook (optional, when telemetry/ lands)

`open()` accepts a `source`, and `purchase()`/`restore()` return a `PurchaseResult`. When
`telemetry/events.ts` exists, fire `paywall_viewed` (on open), `purchase_started`, `purchase_completed`,
`restore_completed` from the call sites. No coupling is added here so the billing layer stays standalone.
