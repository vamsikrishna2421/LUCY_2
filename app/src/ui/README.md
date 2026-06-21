# LUCY 2.0 — Design System (`app/src/ui`)

Tokens-only, dependency-light primitive library for LUCY 2.0. Every component reads from the token
source of truth (`theme/tokens.ts`) — **no hardcoded colors, spacing, radii, or durations**. Built on
React Native `Animated` (native driver where possible); the only external deps used are
`react-native-svg`, `react-native-safe-area-context`, and `@expo/vector-icons` (all already in the app).

## Five constraints (precedence)

1. **Self-evidence** — one obvious next move (`EmptyState` CTA, single primary `Button`).
2. **Calm** — one primary action per surface; soft tints; progressive disclosure.
3. **Legible interaction** — everything tappable looks tappable; `PressableScale` feedback.
4. **Premium motion** — shared easing/duration/spring tokens; nothing teleports.
5. **Instant render** — `Skeleton`/`SkeletonText` render synchronously, then hydrate.

## Setup

Wrap the app once (inside `SafeAreaProvider`, which sheets/toasts need):

```tsx
import { ThemeProvider, ToastProvider } from '@/ui'; // or a relative path to src/ui

<ThemeProvider>
  <ToastProvider>
    <App />
  </ToastProvider>
</ThemeProvider>
```

Then import anything from the barrel:

```tsx
import { Button, Card, Text, Stack, useTheme, FadeInUp } from '@/ui';
```

`Gallery.tsx` renders every primitive in all states — mount `<Gallery />` for visual QA.

---

## Theme

### `useTheme()`
Returns the active theme (all tokens + `name`, `isDark`). Always prefer this over importing `tokens`
directly so components stay theme-agnostic. The theme is static (dark) today but provider-wrapped for
future light/accent variants.

```tsx
const { colors, spacing, radius } = useTheme();
```

### `ThemeProvider`
| Prop | Type | Default |
|------|------|---------|
| `children` | `ReactNode` | — |
| `theme` | `Theme` | dark theme |

---

## Layout

### `Stack` / `Row`
Flex column / row with token-based `gap` and padding. Removes ad-hoc inline layout styles.

| Prop | Type | Notes |
|------|------|-------|
| `gap` | `SpacingToken` | space between children |
| `padding` / `paddingX` / `paddingY` | `SpacingToken` | |
| `align` | `ViewStyle['alignItems']` | `Row` defaults `center` |
| `justify` | `ViewStyle['justifyContent']` | |
| `wrap` | `boolean` | `Row` only |
| `flex` | `number` | |

```tsx
<Row gap="sm" justify="space-between"><Text>Left</Text><Badge count={3} /></Row>
<Stack gap="md" padding="base">{children}</Stack>
```

### `Spacer`
| Prop | Type | Default |
|------|------|---------|
| `size` | `SpacingToken` | `base` |
| `grow` | `boolean` | fills space (flex:1) |

---

## Motion

### `PressableScale`
Canonical press feedback — springs to 0.97 and back (`spring.snappy` in / `spring.soft` out).
Honours Reduce Motion. Use for any custom tappable.

| Prop | Type | Default |
|------|------|---------|
| `onPress` / `onLongPress` | `() => void` | |
| `scaleTo` | `number` | `0.97` |
| `disabled` | `boolean` | |
| `accessibilityLabel` / `accessibilityHint` | `string` | |
| `accessibilityRole` | `'button' \| 'link' \| 'none'` | `button` |
| `hitSlop` | `number \| {…}` | |

### `FadeInUp`
Fade + slight rise on mount (animates once). `timing` uses the decelerate curve; default is a spring.

| Prop | Type | Default |
|------|------|---------|
| `delay` | `number` (ms) | `0` (Stagger sets it) |
| `distance` | `number` (px) | `12` |
| `timing` | `boolean` | `false` (spring) |

### `Stagger`
Clones children that accept a `delay` prop, cascading their entrance.

| Prop | Type | Default |
|------|------|---------|
| `step` | `number` (ms) | `55` |
| `initialDelay` | `number` (ms) | `0` |
| `maxStagger` | `number` | `8` |

```tsx
<Stagger>{items.map((it) => <FadeInUp key={it.id}><Row item={it} /></FadeInUp>)}</Stagger>
```

### `useReduceMotion()`
Live boolean of the OS Reduce-Motion setting. All motion primitives use it internally.

---

## Typography & structure

### `Text`
The only text primitive. Encodes the type scale + reads a semantic color token.

| Prop | Type | Default |
|------|------|---------|
| `variant` | `display\|h1\|h2\|h3\|body\|bodyMed\|callout\|footnote\|caption` | `body` |
| `color` | `ColorToken` | `textPrimary` |
| `align` | `TextStyle['textAlign']` | |
| `weight` | `TextStyle['fontWeight']` | scale default |
| `tracking` | `number` | |

```tsx
<Text variant="h2">Today</Text>
<Text variant="footnote" color="textMuted">3 new</Text>
```

### `Surface`
Themed container: semantic background level + elevation + radius + optional hairline border.

| Prop | Type | Default |
|------|------|---------|
| `level` | `bg\|surface\|surfaceAlt\|surfaceElevated\|sheet` | `surface` |
| `elevation` | `e0\|e1\|e2\|e3\|e4\|glow` | `e0` |
| `radius` | `none\|sm\|md\|lg\|xl\|pill` | `lg` |
| `padding`/`paddingX`/`paddingY` | `SpacingToken` | |
| `border` | `ColorToken \| false` | `false` |

### `Card`
`Surface` with comfortable padding + `e1` + border. Tappable when `onPress` is set (PressableScale).

| Prop | Type | Default |
|------|------|---------|
| `onPress` / `onLongPress` | `() => void` | static if omitted |
| `padding` | `SpacingToken` | `base` |
| `elevation` | `ElevationToken` | `e1` |
| `border` | `ColorToken \| false` | `border` |
| `disabled` | `boolean` | |

```tsx
<Card onPress={open}><Text variant="bodyMed">Tap me</Text></Card>
```

### `Divider`
Hairline separator. `orientation` `horizontal` (default) / `vertical`; `inset` and `spacing` tokens.

### `SectionHeader`
Section title (h3) + optional caption + trailing action / node.

| Prop | Type |
|------|------|
| `title` | `string` |
| `caption` | `string` |
| `actionLabel` + `onAction` | `string` + `() => void` |
| `trailing` | `ReactNode` (overrides action) |

---

## Actions

### `Button`
Variants `primary\|secondary\|ghost\|danger`; sizes `sm\|md\|lg`; states default/press/disabled/loading.
Loading swaps the label for a spinner without changing width. Always ≥ touch target.

| Prop | Type | Default |
|------|------|---------|
| `label` | `string` | — |
| `onPress` | `() => void` | |
| `variant` | `ButtonVariant` | `primary` |
| `size` | `ButtonSize` | `md` |
| `disabled` / `loading` | `boolean` | |
| `icon` | Ionicons name | |
| `iconRight` | `boolean` | leading by default |
| `fullWidth` | `boolean` | |

```tsx
<Button label="Save" icon="checkmark" onPress={save} />
<Button label="Delete" variant="danger" loading={deleting} onPress={remove} />
```

### `IconButton`
Square icon-only target. Variants `primary\|secondary\|ghost\|danger\|plain`; sizes `sm\|md\|lg`.
`accessibilityLabel` is **required**.

```tsx
<IconButton icon="close" accessibilityLabel="Close" onPress={dismiss} />
```

---

## Inputs

### `TextField`
Labelled input. States default / focus (accent border, animated) / error (danger + message) / disabled.
Supports leading/trailing icons and `multiline`. Extends RN `TextInputProps` (minus `style`/`editable`).

| Prop | Type |
|------|------|
| `label` / `helper` / `error` | `string` |
| `disabled` | `boolean` |
| `leadingIcon` / `trailingIcon` | Ionicons name |
| `onTrailingPress` | `() => void` |

```tsx
<TextField label="Email" leadingIcon="mail" error={err} value={v} onChangeText={setV} />
```

### `SearchField`
Pill search input with magnifier + clear (×) that appears when non-empty. States default/focus/disabled.

```tsx
<SearchField value={q} onChangeText={setQ} placeholder="Search" />
```

### `SegmentedControl<T>`
Switcher with a sliding spring highlight pill. Generic over the value type.

| Prop | Type |
|------|------|
| `options` | `{ value: T; label: string; icon? }[]` |
| `value` | `T` |
| `onChange` | `(v: T) => void` |
| `compact` | `boolean` |

```tsx
<SegmentedControl options={opts} value={tab} onChange={setTab} />
```

---

## Data display

### `ListItem`
Standard row (min height 56). Leading icon/avatar/custom, title + subtitle, trailing chevron/custom.
Tappable via PressableScale when `onPress` set; `destructive` colors the title.

```tsx
<ListItem title="Settings" icon="settings-outline" onPress={open} />
<ListItem title="Sign out" destructive icon="log-out" onPress={signOut} />
```

### `Badge`
Status pill / count / dot. `tone` neutral|accent|success|warning|danger|info; `solid` for filled;
`count` clamps to "9+"; `dot` for a bare indicator.

### `Chip`
Tappable filter/tag token. `selected` fills with soft accent; optional leading `icon` and trailing
`onRemove` (×).

### `Avatar`
Circular image with initials fallback. Sizes `sm\|md\|lg\|xl`; optional `status` dot (online/away).

### `LucyOrb`
Lightweight breathing amber orb (SVG radial-gradient sphere + halo). `active` quickens the breath.
Honours Reduce Motion. For the full character (eyes/expressions) use the legacy `AnimatedFace`.

```tsx
<LucyOrb size={64} active={isListening} />
```

### `ProgressRing`
Circular progress (SVG). `progress` 0–1, animated with the `slow` token. Center `label` or `children`.

```tsx
<ProgressRing progress={0.72} label="72%" />
```

---

## Feedback & overlays

### `BottomSheet`
Modal panel: slides up with `spring.soft`, backdrop fades `base`, tap-scrim / back to dismiss, grab
handle, safe-area aware. Honours Reduce Motion.

| Prop | Type |
|------|------|
| `visible` | `boolean` |
| `onClose` | `() => void` |
| `title` | `string` |
| `hideHandle` | `boolean` |

### `ActionSheet`
Choice list in a `BottomSheet` — the `Alert.alert` replacement. Actions support `icon`, `destructive`,
`disabled`; a Cancel row dismisses. Selecting closes the sheet then fires the handler.

```tsx
<ActionSheet
  visible={open}
  onClose={() => setOpen(false)}
  actions={[
    { label: 'Share', icon: 'share-outline', onPress: share },
    { label: 'Delete', icon: 'trash', destructive: true, onPress: remove },
  ]}
/>
```

### `ToastProvider` + `useToast()`
Transient, undo-friendly notifications — the forgiveness model (undo over confirm). One at a time;
auto-dismisses (longer when an action is present); slides up; safe-area + Reduce-Motion aware.

```tsx
const toast = useToast();
toast.show({ message: 'Note deleted', tone: 'danger', actionLabel: 'Undo', onAction: restore });
```

`ToastOptions`: `message`, `tone?` (neutral|success|danger|info), `actionLabel?` + `onAction?`,
`duration?`, `icon?`.

### `Banner`
Inline (non-floating) message strip. Tones info|success|warning|danger|accent; optional `title`,
`actionLabel`+`onAction`, and `onDismiss` (×).

### `EmptyState`
Warm zero-data state: `LucyOrb` (or an `icon`), title + optional message + optional CTA `Button`.
Delivers the "one obvious next move."

```tsx
<EmptyState title="Nothing yet" message="Capture a thought." ctaLabel="Capture" onCta={capture} />
```

---

## Skeletons (instant render)

### `Skeleton`
Shimmering placeholder block. `width`/`height`/`radius`, or `circle={diameter}`. Honours Reduce Motion
(static). Render synchronously while data loads.

### `SkeletonText`
N shimmer lines (last one shortened) approximating a paragraph. `lines`, `lineHeight`, `lastLineWidth`.

```tsx
{loading ? <SkeletonText lines={3} /> : <Text>{body}</Text>}
```

---

## Conventions

- **Every** file is < 300 lines, strongly typed, and imports tokens via `useTheme()`.
- Animations run on the native driver except where a layout prop (`left`, `strokeDashoffset`) forces
  the JS driver — those are single cheap values.
- All interactive primitives expose accessibility labels/roles and respect the ≥44pt touch target.
- The whole `app/src/ui` tree typechecks clean under the repo's `strict` config.
