# Telemetry (`app/src/telemetry/`)

Monitoring & observability for LUCY 2.0 — **crash/error reporting (Sentry)** + **product
analytics, funnels, retention, feature flags (PostHog)** — behind one small typed facade.

New in 2.0 (1.0 had none). The metrics dashboard (`/dashboard`) reads from PostHog + RevenueCat;
this package is the app side that emits the data.

## Zero-config by design

Everything runs with **no keys**. Both SDKs are *lazy-required* and only load when their env var
is present; otherwise every call is a **no-op that logs to the dev console** (`[telemetry] …`).
So `npm start` works out of the box, and CI never needs credentials.

Set keys in `.env` (git-ignored) to go live:

```bash
EXPO_PUBLIC_POSTHOG_KEY=phc_xxx          # enables PostHog
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # optional (defaults to PostHog cloud)
EXPO_PUBLIC_SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz   # enables Sentry
```

## npm dependencies

These are **peer/optional** — install before shipping with keys (do not commit lockfile churn
without the integration owner):

```bash
npx expo install @sentry/react-native posthog-react-native
```

If they're absent, the lazy-require fails softly and the stack stays in no-op mode.

## Files

| File | Responsibility |
|------|----------------|
| `events.ts` | **The event taxonomy** — typed union of event names + a props type per event. Single source of truth. |
| `posthog.ts` | Lazy PostHog wrapper: `init / capture / identify / screen / reset / flush / isFeatureEnabled / reloadFlags`. |
| `sentry.ts` | Lazy Sentry wrapper: `init / captureException / captureMessage / setUser / addBreadcrumb`. |
| `index.ts` | **Facade** — `initTelemetry, track, screen, identify, setUserProps, captureError, flag, reloadFlags, flush, reset`. Routes to both; safe to call before init (buffers analytics / no-ops). |
| `useScreenTracking.ts` | Hook that fires `screen_view` when a screen becomes active. |

## Public API (import from `./telemetry`)

```ts
import {
  initTelemetry, track, screen, identify, setUserProps,
  captureError, flag, reloadFlags, flush, reset,
} from './src/telemetry';
```

- `initTelemetry()` — call once on app mount. Reads env, inits both SDKs, replays buffered events.
- `track(event, props)` — **typed against `events.ts`.** Wrong name or props = compile error.
- `screen(name, props)` — manual screen view (or use the hook).
- `identify(id, traits)` — attach a stable anonymous id (never PII) to analytics + Sentry.
- `setUserProps(props)` — set person properties (e.g. `{ isPro: true }`).
- `captureError(e, ctx)` — forward a caught error to Sentry.
- `flag(key, default)` — read a boolean feature flag, synchronously, with a safe default.
- `reloadFlags()` / `flush()` / `reset()` — refresh flags, flush queue, clear identity (sign-out).

## Adding an event

1. Add one line to `EventProps` in `events.ts` (name → props shape; use `Record<string, never>`
   for no props).
2. Call `track('your_event', { … })` at the call site.

That's it — the compiler enforces the rest. Never pass an ad-hoc string to `track`.

## Conventions

- Event names: `snake_case`. Prop values: primitives only (string/number/boolean) so PostHog
  indexes them and the dashboard can group by them.
- **No PII** in events: no raw capture text, transcripts, names, or contents — only counts,
  enums, and sources.

See [INTEGRATION.md](./INTEGRATION.md) for exact wiring snippets (App.tsx, ErrorBoundary, funnel
call sites).
