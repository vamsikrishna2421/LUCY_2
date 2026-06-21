# LUCY 2.0 — Visual Preview

A look at the redesigned app. **Open the PNGs in `preview/png/` for a quick look**, or open the
HTML files in `preview/screens/` in any browser for the live version.

## What's here
| File | What it shows |
|------|---------------|
| `png/home-ios.png` | The **Home / Timeline** screen (first screen you see) — quick-capture, search, filter chips, mood-spine memory cards, LUCY action banner, bottom nav. iPhone. |
| `png/home-android.png` | Home / Timeline at Android size. |
| `png/capture-ios.png` | The redesigned **Capture** (core-loop) screen, iPhone size (390×844). |
| `png/capture-android.png` | Same screen at Android size (412×915). |
| `png/design-system.png` | The **design system** — colors, type scale, buttons, cards, badges, chips, segmented control, input/skeleton/toast, the LUCY orb. |
| `screens/capture.html` | Source of the Capture preview (open in a browser for the live render). |
| `screens/components.html` | Source of the design-system showcase. |

## How these were made (honest note)
- This is a **Windows** machine, so a real iOS Simulator can't run here and an Android emulator isn't
  practical for this app's native modules. These are **not** screenshots of the app running on a phone.
- They ARE faithful renders: the HTML is built from the **actual design tokens** (`app/src/ui/theme/tokens.ts`)
  and mirrors the **actual redesigned `Capture.tsx`** layout, copy, and component anatomy. Snapped to PNG
  with headless Edge. Because the React Native app uses the *same* tokens and components, the real app's
  colors, typography, spacing, and layout match what you see here.
- Sample data (greeting, tasks, stats) is illustrative.

## What the Capture screen shows
Breathing LUCY orb + greeting · "LUCY IS ACTIVE" status card with today/streak/tasks · NEXT UP + TOP TASK
glance · the category task board (Work/Personal/Ideas/Errands with urgency badges) · the composer dock
(camera, voice, text field, send) · the "Protect this thought" on-device privacy toggle.

This is the **calm, self-evident, one-primary-action** redesign — same logic as 1.0, new surface.

_More screens (Ask/recall, Brain, Health, Settings, paywall) are being redesigned; previews will be added
as they land._
