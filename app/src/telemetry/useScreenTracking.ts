/**
 * useScreenTracking — fire a `screen_view` analytics event when a screen becomes active.
 *
 * LUCY 2.0 uses manual screen state (App.tsx holds `screen`/`view` in useState) rather than
 * react-navigation, so this hook keys off the *name you pass in*: it emits once on mount and
 * again whenever that name changes. Drive it from your current-screen state and every screen
 * transition is tracked from one place.
 *
 *   // In a screen component:
 *   useScreenTracking('Capture');
 *
 *   // Or from the root, following the active view:
 *   useScreenTracking(currentView, { active: screen === 'dashboard' });
 *
 * If/when react-navigation is adopted, see `useScreenTrackingOnFocus` below.
 */

import { useEffect, useRef } from 'react';
import { track } from './index';

interface Options {
  /** When false, suppresses tracking (e.g. screen mounted but not the foreground tab). Default true. */
  active?: boolean;
  /** Extra props merged into the screen_view event. */
  props?: Record<string, unknown>;
}

/**
 * Track a screen view on mount and whenever `name` changes (while `active`). De-duplicates
 * consecutive identical names so re-renders don't emit repeat events.
 */
export function useScreenTracking(name: string, options: Options = {}): void {
  const { active = true, props } = options;
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    if (!name || last.current === name) return;
    last.current = name;
    track('screen_view', { name, ...(props ?? {}) });
    // `props` intentionally excluded from deps: only name/active changes should re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, active]);
}

/**
 * react-navigation variant (for future use, once that dependency exists). Pass the value
 * returned by `useIsFocused()` so the event fires each time the screen gains focus.
 *
 *   import { useIsFocused } from '@react-navigation/native';
 *   useScreenTrackingOnFocus('Capture', useIsFocused());
 */
export function useScreenTrackingOnFocus(
  name: string,
  isFocused: boolean,
  props?: Record<string, unknown>,
): void {
  const wasFocused = useRef(false);

  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      track('screen_view', { name, ...(props ?? {}) });
    }
    wasFocused.current = isFocused;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, name]);
}
