# Telemetry — Integration Guide

Exact snippets to wire `app/src/telemetry/` into LUCY 2.0. Everything is no-op without env keys,
so these are safe to land before credentials exist.

> Ownership note: the telemetry package is self-contained. The two edits below (App.tsx,
> ErrorBoundary) touch files owned by the app/integration owner — they are **described here, not
> applied** by the telemetry workstream.

---

## 1. Initialize on app mount — `App.tsx`

Add the import and a one-time init effect. `installGlobalErrorLogger()` already runs at module
load (unchanged); `initTelemetry()` brings up PostHog + Sentry and replays any buffered events.

```tsx
// near the other src imports at the top of App.tsx
import { initTelemetry, track } from './src/telemetry';

export default function App() {
  // ...existing state...

  // Bring telemetry up once, as early as possible.
  useEffect(() => {
    initTelemetry();
    track('app_open');
  }, []);

  // ...rest of component...
}
```

Optional — emit `app_foreground` from the existing `AppState` listener (App.tsx already imports
`AppState`):

```tsx
useEffect(() => {
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') track('app_foreground');
  });
  return () => sub.remove();
}, []);
```

---

## 2. Forward caught errors to Sentry — `app/src/components/ErrorBoundary.tsx`

**Described, not applied.** ErrorBoundary already persists crashes to `dev_log` via `logCrash`
(keep that). Add a single forwarding call so the same errors also reach Sentry — telemetry is
purely additive and never throws.

Two one-line touch points, both inside the existing `logCrash` helper (so the global handler and
the React boundary are both covered through one place):

```ts
// at the top of ErrorBoundary.tsx, with the other imports:
import { captureError } from '../telemetry';

async function logCrash(message: string, stack: string): Promise<void> {
  captureError(new Error(message), { stack: stack.slice(0, 1500) });   // ← ADD THIS LINE
  try {
    // ...existing dev_log insert, unchanged...
  } catch { /* logging must never throw */ }
}
```

That single added line covers both `componentDidCatch` and the global handler set by
`installGlobalErrorLogger()`, because both funnel through `logCrash`. No other ErrorBoundary
changes are needed.

---

## 3. Screen views

Drive `useScreenTracking` from the active-screen state in `App.tsx` (the app uses manual screen
state, not react-navigation):

```tsx
import { useScreenTracking } from './src/telemetry/useScreenTracking';

// inside App(), reflecting the current top-level surface:
useScreenTracking(screen === 'dashboard' ? dashCurrentView : screen);
```

Or call it inside an individual screen component: `useScreenTracking('Capture')`.

---

## 4. Where to fire the key funnel events

Call `track(...)` from the UI/service seam (screens, providers, hooks) — never from frozen logic
modules. Suggested call sites:

**Activation funnel**
- `components/Onboarding.tsx` — `track('onboarding_started')` on first render;
  `track('onboarding_completed')` inside `onComplete(...)`.
- Capture screen — `track('capture_started', { source })` when a capture begins;
  `track('capture_saved', { source, privacyLevel })` after the save call resolves.
- Extraction service hook — `track('extraction_completed', { source, itemCount })` when a queued
  capture finishes processing.
- Ask/Recall screen — `track('recall_query')` on submit; `track('recall_answered', { hadResults })`
  when the answer renders.

**Autopilots & scheduling**
- When an autopilot card is shown / accepted — `track('autopilot_offered', { kind })` /
  `track('autopilot_accepted', { kind })`.
- `track('reminder_created')`, `track('schedule_suggested')` at the corresponding UI actions.

**Monetization funnel** (billing/gating workstream)
- `gating/Gate.tsx` — `track('feature_gated', { feature })` when a locked feature is tapped.
- Paywall screen — `track('paywall_viewed', { source })` on mount;
  `track('paywall_plan_selected', { planId })` on plan tap.
- `billing/purchases.ts` callers — `track('purchase_started', { planId })`,
  `track('purchase_completed', { planId, price })`, `track('purchase_restored')`,
  `track('purchase_failed', { reason })`.
- On entitlement resolve (`billing/EntitlementProvider.tsx`) — `setUserProps({ isPro })` and
  `identify(installId)` with a per-install anonymous id.

**Errors & growth**
- Any user-facing error toast — `track('error_shown', { context })`.
- `settings_changed` — `track('settings_changed', { key })` from the Settings save path.
- LUCY Wrapped share — `track('share_wrapped')`.

---

## 5. Feature flags

```ts
import { flag } from './src/telemetry';
if (flag('new_capture_ui', false)) { /* gated behind a PostHog flag, safe default false */ }
```

Call `reloadFlags()` after `identify()` or on foreground to pick up server-side changes.
