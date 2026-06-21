# 12 — iOS + Android UI/UX Audit (LUCY 2.0 redesigned core loop)

**Scope:** `app/src/screens/Capture.tsx`, `app/src/screens/Ask.tsx`, their seam hooks
(`useCaptureInput`, `useAsk`) + subcomponents (`screens/capture/*`, `screens/ask/*`), and the design
system (`app/src/ui/**`).

**Method:** STATIC review on a Windows host (no iOS simulator, no Android emulator) plus a HEADLESS
render smoke test (`react-test-renderer`) that mounts every `ui/` primitive under both `Platform.OS`
values. This is **not** a device run — see "Needs a real device" below for everything that genuinely
requires hardware. **No network / LLM calls were made** (UI audit + render need none).

**Finish state:** `npm run typecheck` = 0 errors. `npm run test:render` = 16/16 pass (8 cases ×
iOS + Android). No `git commit` performed.

---

## Architecture context that shapes every finding

The redesigned screens do **not** own the device edges. `App.tsx` renders them inside a single shell:

```
SafeAreaProvider
└─ ThemeProvider → ToastProvider → EntitlementProvider → PaywallController   (ToastProvider is here, at the ROOT)
   └─ SafeAreaView  (styles.safe — applies TOP + BOTTOM safe-area insets)
      ├─ header (brand bar)
      ├─ <View styles.container>  ← CaptureScreen / AskScreen mount here, inside ScreenFade
      └─ <View styles.bottomNav>  ← the tab bar (sits above the home-indicator inset)
```

Consequences used throughout the audit:

- **Top inset** is owned by the App's `SafeAreaView`. Screens correctly add **no** top inset. ✔
- **Bottom inset** is consumed by `SafeAreaView`; the tab bar sits above it; the Capture composer and
  Ask input row sit **above the tab bar**, not at the device edge. So those docks must **not** add
  their own `insets.bottom` (doing so would double-pad). ✔ (neither screen does)
- `BottomSheet` and `Toast` are the exception: `BottomSheet` is a full-screen RN `Modal` and `Toast`
  is an absolutely-positioned overlay mounted by the **root** provider (outside `SafeAreaView`), so
  both correctly use `Math.max(insets.bottom, …)`. ✔

---

## Cross-cutting findings (affect iOS **and** Android)

### FIXED

| # | Issue | Fix |
|---|-------|-----|
| C1 | **Manual keyboard offset instead of `KeyboardAvoidingView`.** Both screens listened to keyboard events and applied `paddingBottom: <full keyboard height>` to the root view. On iOS this over-shifts (the tab bar below also moves); on Android it used the laggy `keyboardDidShow`. The rest of the app already uses `KeyboardAvoidingView`. | Replaced with a Platform-aware `KeyboardAvoidingView` (`behavior='padding'` on iOS, `undefined` on Android so the OS `adjustResize` handles it). Capture keeps a tiny listener only to toggle its "Done ▾" dismiss affordance (`keyboardVisible` boolean). |
| C2 | **Redundant per-screen `<ToastProvider>`** in Capture + Ask. The root already provides one (`App.tsx:859`); nesting a second one renders toasts *inside* the screen layer (behind the tab bar) instead of the root overlay. | Removed both wrappers + the `ToastProvider` import; folded `CaptureInner`/`AskInner` back into the exported component. `useToast()` now resolves from the root provider. Exported component **names + props unchanged** → `App.tsx` needs no edit. |
| C3 | **`LucyOrb` SVG gradient id from `React.useId()`** (`ui/primitives/LucyOrb.tsx`). `useId()` returns ids containing `:` (e.g. `":r0:"`). In `react-native-svg`, a gradient referenced via `fill="url(#:r0:)"` **fails to resolve on Android** — the orb renders unfilled (black/empty). The orb is on the Capture hero, every EmptyState, and loading states. | Sanitize to a valid SVG id: `` `lucyOrb${useId().replace(/[^a-zA-Z0-9]/g, '')}` ``. Guarded by a render test that asserts no `:` appears in any SVG id/`url(#…)`. |
| C4 | **No cap on dynamic-type scaling.** Largest accessibility font sizes could break dense layouts (composer row, segmented control, stat row). Nothing set `maxFontSizeMultiplier` anywhere. | Set a default `maxFontSizeMultiplier={1.3}` on the `Text` primitive (still honours scaling up to 1.3×; every screen routes text through `Text`; callers can still override per-instance). |
| C5 | **No drag-to-dismiss for the keyboard** on the scroll surfaces. `keyboardShouldPersistTaps="handled"` was set (good) but there was no dismiss-on-scroll. | Added `keyboardDismissMode` (`'interactive'` iOS / `'on-drag'` Android) to Capture's board ScrollView and Ask's conversation ScrollView. |

### OPEN — for the "remaining screens" workstream (out of this task's Capture/Ask + ui scope)

| # | Issue | Note |
|---|-------|------|
| C6 | **`Settings.tsx` and `Connectors.tsx` also nest their own redundant `<ToastProvider>`** — identical anti-pattern to C2. | Not edited here (these screens belong to the remaining-screens workstream). They should drop the wrapper the same way; toasts there currently render one layer too deep. Harmless (toasts still fire) but should be cleaned for correct layering. |

---

## iOS-specific

### Reviewed — OK
- **Notch / Dynamic Island / home-indicator:** handled by the App-level `SafeAreaView`; screens add no
  top inset (correct). Composer/input sit above the tab bar (correct — no extra bottom inset).
- **Status bar:** `<StatusBar style="light" />` at the root — correct for the dark palette.
- **`keyboardWillShow/Hide`** (the iOS-correct events) were already used for the dismiss-button toggle;
  retained. Layout shifting now goes through `KeyboardAvoidingView behavior="padding"` (the iOS-correct
  behavior).
- **Toast / BottomSheet** honour `insets.bottom` via `Math.max` — correct for the home indicator.

### Needs a real device / simulator
- Verify `KeyboardAvoidingView behavior="padding"` leaves the composer fully visible above the keyboard
  on a notched device (e.g. iPhone 15/16) and a non-notched device, in both orientations.
- Verify the `interactive` keyboard dismiss gesture feels right on the board + conversation scrolls.
- Confirm the breathing `LucyOrb` and Toast slide animations run on the native driver without jank.

---

## Android-specific

### FIXED

| # | Issue | Fix |
|---|-------|-----|
| A1 | **Hardware/gesture BACK exits the app instead of dismissing the inline automation-confirm card.** In both screens the "LUCY CAN DO THIS" confirm is an inline `Surface` (not a Modal), so Android back wasn't trapped. | Added a `BackHandler` effect in each screen that, while `pendingAction` is set, consumes back and clears the prompt (returns `true`). |
| C3 | (see cross-cutting) the SVG-id bug is **Android-only in effect** — the orb renders fine on iOS but unfilled on Android. | Fixed as above. |

### Reviewed — OK
- **Other overlays already trap back:** `BottomSheet` (used for Capture's edit sheet + the category
  sheet) registers a `hardwareBackPress` listener **and** is a `Modal` with `onRequestClose`
  (defense-in-depth). `ActionSheet` is built on `BottomSheet`. `CaptureReplay` is a `Modal` with
  `onRequestClose`. So edit / category / replay all dismiss on back. ✔
- **Status bar translucency:** `BottomSheet` uses `statusBarTranslucent` so the scrim covers the status
  bar area. ✔
- **`keyboardDidShow/Hide`** retained for the dismiss-button toggle; layout shift delegated to the OS
  (`behavior={undefined}`), which is the Android-correct choice with `adjustResize`.

### Needs a real device / emulator
- Confirm `android:windowSoftInputMode` is `adjustResize` (in `app.json`/native manifest) so the
  `undefined` KAV behavior resizes correctly — verify the composer rises with the keyboard.
- Confirm edge-to-edge / gesture-nav: with Android 15 edge-to-edge defaults, verify the tab bar and
  composer clear the gesture pill and the status bar. (App relies on `react-native-safe-area-context`;
  validate on a gesture-nav device.)
- Verify the predictive-back gesture (Android 14+) dismisses sheets/prompts as expected.
- **Re-verify the LucyOrb fill renders** (the C3 fix) on a real Android device — the render test proves
  the id is valid, but only a device proves the gradient paints.

---

## Touch targets / hit slop — reviewed

- `IconButton` floors its box at `layout.touchTarget` (44) and adds `hitSlop={6}`. ✔
- `Button` floors `minHeight` at 44. ✔
- Small text-only "undo" pressables (Capture done-row, category-sheet undo) use `hitSlop={8}`. ✔
- Category-sheet checkbox is 26×26 with `hitSlop={6}` → ~38px tappable. **Minor** (below 44); left as-is
  to avoid changing the sheet's visual density — flagged for a future polish pass.

## States per surface — reviewed
- **Capture:** empty (`EmptyState`), populated (category cards + done-today), error (Toast on enqueue
  failure), inline loading (`sending`, `scanningReceipt`, executing action). No blank states. ✔
- **Ask:** empty (insights `EmptyState` + cold-start helper), loading (`SkeletonText`, never blank),
  populated, error (calm fallback bubble + schedule-error toast). ✔
- Both honour Reduce Motion through the motion primitives (`useReduceMotion`). ✔

---

## Headless render smoke test

- **Added:** `app/jest.config.js`, `app/tests/setup/render-mocks.ts`,
  `app/tests/setup/mocks/{react-native,react-native-svg,safe-area-context,vector-icons}.tsx`,
  `app/tests/ui/primitives.render.test.tsx`.
- **devDeps added (owned by this task):** `jest`, `ts-jest`, `react-test-renderer`,
  `@types/react-test-renderer`, `@types/jest`, `jest-environment-node`.
- **Run:** `npm run test:render` (from `app/`). **Result: 16/16 pass** — every `ui/` primitive mounts
  under both `Platform.OS='ios'` and `'android'`, an open `BottomSheet` + `ActionSheet` mount, `useToast`
  resolves from the provider, and the LucyOrb SVG-id regression is guarded.
- **Why not `jest-expo`:** the SDK 56 / RN 0.85 `jest-expo` preset pulls a heavy native-mock surface and
  needs `babel-preset-expo` (absent in this project). `ts-jest` transpiles the TS/TSX primitives directly
  with the native modules mocked — enough to catch render crashes without that weight.
- **Deliberately out of scope of the render test:** full-screen mounts of `Capture`/`Ask`. They pull deep
  frozen-logic graphs (`db`, `processing`, `audio`, `voice`, expo-speech-recognition, …) that would need
  a large mock surface for little extra signal. The primitives they render are all covered. Full-screen
  render verification needs a device/simulator.
- **Known cosmetic:** one benign React `act()` warning prints from the `useToast` test (a state update in
  a mount effect); it does not fail the suite (exit 0) and reflects a `react-test-renderer` quirk, not a
  product bug.

---

## What genuinely needs a physical device / simulator

1. Keyboard avoidance correctness (composer/input visible above keyboard) — iOS notched + non-notched,
   Android `adjustResize`, both orientations.
2. Android edge-to-edge + gesture nav (tab bar / composer clear the gesture pill; status bar handling).
3. Android predictive-back + the C3 LucyOrb fill actually painting on-device.
4. Native-driver animation smoothness (orb breath, FadeInUp/Stagger entrances, Toast/BottomSheet slide,
   SegmentedControl pill slide) and Reduce-Motion behavior.
5. Real keyboard dismiss-gesture feel (`interactive` / `on-drag`).
6. Dynamic Type / font-scale at the largest OS sizes against the 1.3× cap on real screens.
7. Haptics, voice capture, receipt scan, and any flow that touches frozen logic / native modules.

---

## Re-runnable checklist

```bash
cd app
npm run typecheck     # must be 0 errors
npm run test:render   # must be 16/16 pass (primitives × iOS + Android)
```

Then, on devices:

- [ ] iPhone (notched) + iPhone SE (non-notched): open Tasks (Capture) and Ask, raise the keyboard —
      composer/input fully visible, content not obscured; drag to dismiss works.
- [ ] iOS: status bar legible (light) over the dark palette on every screen.
- [ ] Android (gesture nav, edge-to-edge): Capture + Ask clear the gesture pill and status bar; the
      composer rises with the keyboard (confirm `adjustResize`).
- [ ] Android: hardware/gesture BACK dismisses — automation-confirm card (Capture **and** Ask), edit
      sheet, category sheet, Capture replay — without exiting the app.
- [ ] Android: the LucyOrb shows its amber gradient fill (not black) on the hero + empty states.
- [ ] Both: set the OS font size to max — composer row, segmented control, and stat row stay intact.
- [ ] Both: enable Reduce Motion — entrances/toasts/orb settle to final state with no animation.
```
