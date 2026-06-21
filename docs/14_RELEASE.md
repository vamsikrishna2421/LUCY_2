# LUCY 2.0 — Release / TestFlight Runbook

The app is feature-complete, typechecks clean, and is configured to build **on top of the existing
`com.anonymous.lucy` app** (same EAS project `1a602e40…`, ASC app `6774077314`, owner `lekkala2421`).
This is the exact path to a TestFlight build. A few steps need you (Apple 2FA + a device) — flagged below.

## Already done
- **Build numbers set** (build on top of 1.0's latest): version `2.0.0`, iOS `buildNumber 2.0.0`,
  Android `versionCode 105`, `runtimeVersion 6` (bumped — native deps changed), EAS `autoIncrement` on.
- **EAS auth** confirmed (`eas-cli whoami` → lekkala2421 / vamsy.24@gmail.com).
- `eas.json` has the `testflight` (iOS store) + `android-release` profiles; `submit.testflight.ios.ascAppId`
  is set. `@sentry/react-native` plugin added to `app.json`.

## Step 1 — pre-build dependency alignment (1 min)
`expo-doctor` flags 3 standard items (16 expo packages a patch behind SDK 56, a peer-dep gap, RN-directory
metadata). Align them before building:
```bash
cd app
npx expo install --check     # accept the suggested patch bumps
npm install                  # ensure peer deps resolved
npm run typecheck            # confirm still 0 errors
```
(Left unaligned deliberately during the build to avoid changing 16 deps unverified — your call to apply.)

## Step 2 — apply the 2 pending bug fixes
Drop your 2 functional 1.0 bug fixes into `app/src/...` first so the TestFlight build includes them
(they're real bugs → the frozen-logic exception). Send them and I'll apply + re-run typecheck.

## Step 3 — monorepo note (one-time)
1.0's app was its own git root; this fork nests the app at `lucy/app/`. EAS archives via git, so run builds
**from `app/`**. `.easignore` (carried from 1.0) is present. If EAS picks up parent files, either add a git
repo in `app/` or extend `.easignore`. Verify the first archive looks right (`eas build` prints what it uploads).

## Step 4 — build (needs Apple 2FA on first run)
The first iOS build resolves credentials. 1.0 was built on EAS, so the distribution cert + provisioning
profiles for `com.anonymous.lucy` (and the `…expo-sharing-extension` app-extension) are likely already on
EAS and reused non-interactively. If EAS needs to (re)confirm them it triggers an **Apple login + 2FA**,
which can't be done headlessly. Easiest path — run it interactively from your session so the 2FA prompt and
output land right here:
```
! cd app && eas build -p ios --profile testflight
```
(or `npx eas-cli build -p ios --profile testflight`). Android: `eas build -p android --profile android-release`.

## Step 5 — submit to TestFlight
```bash
eas submit -p ios --profile testflight --latest
```
Non-interactive submit needs an **App Store Connect API key (.p8)** (recommended) or an app-specific password —
the raw Apple password won't pass 2FA via Transporter. Create the .p8 in App Store Connect → Users & Access →
Integrations, then `eas submit` will use it. (Or `eas build … --auto-submit` once the .p8 is configured.)

## Step 6 — device QA (needs a physical iPhone/Android)
Run the `docs/12_UIUX_AUDIT.md` device checklist: keyboard-avoidance on notched/non-notched, Android
edge-to-edge + predictive-back, the LucyOrb gradient paint, native-driver animation smoothness, large
Dynamic Type. These can't be verified from the Windows build host.

## What needs you (summary)
1. Send the 2 bug fixes (Step 2). 2. OK the dep alignment (Step 1). 3. Run the interactive build for Apple
2FA, or confirm EAS can reuse 1.0's creds (Step 4). 4. Provide an ASC API key `.p8` for non-interactive
submit (Step 5). 5. Live keys for prod features — `NEEDS_FROM_YOU §A,B`.

Everything else is ready: say the word (or paste the bug fixes) and I'll drive Steps 1–2 and prep 3–5.
