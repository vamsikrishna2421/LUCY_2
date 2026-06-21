/**
 * FloatingLucy — LUCY's animated face as a GLOBAL, DRAGGABLE floating orb.
 *
 * Why: the face used to live in the header/hero and ate fixed layout space. Here it's an absolutely
 * positioned overlay that occupies ZERO layout space and floats above every screen. The user can drag it
 * anywhere so it never covers what they're reading; on release it gently docks to the nearest side and the
 * position is remembered (persisted to settings). A tap (no drag) still opens the conversation, exactly like
 * the old face.
 *
 * Pure presentation: PanResponder is React Native built-in (no new native module), so this ships fine over
 * OTA. Reads/writes only via db/settings — no frozen logic edited.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedFace, type LucyStatus } from './AnimatedFace';
import { getDatabase } from '../db';

const POS_KEY = 'floating_lucy_pos';
const MARGIN = 10;
const FALLBACK = 76; // assumed orb box until onLayout measures the real size

export function FloatingLucy({
  status,
  unreadCount = 0,
  celebrateKey,
  onPress,
}: {
  status: LucyStatus;
  unreadCount?: number;
  celebrateKey?: number;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const win = Dimensions.get('window');
  const sizeRef = useRef(FALLBACK);

  // Default: lower-right — out of the top reading zone, and clear of the header, bottom nav, and the
  // dashboard camera FAB. The user can drag it anywhere; position is then remembered.
  const startPos = { x: win.width - FALLBACK - MARGIN, y: Math.round(win.height * 0.62) };
  const pan = useRef(new Animated.ValueXY(startPos)).current;
  const posRef = useRef(startPos);
  const draggingRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  const clamp = (x: number, y: number) => {
    const s = sizeRef.current;
    return {
      x: Math.max(MARGIN, Math.min(x, win.width - s - MARGIN)),
      y: Math.max(insets.top + MARGIN, Math.min(y, win.height - s - insets.bottom - MARGIN)),
    };
  };

  // Restore the last position (per device). Falls back to bottom-right.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const db = await getDatabase();
        const { getSetting } = await import('../db/settings');
        const raw = await getSetting(db, POS_KEY);
        if (alive && raw) {
          const p = JSON.parse(raw) as { x: number; y: number };
          const c = clamp(p.x, p.y);
          pan.setValue(c);
          posRef.current = c;
        }
      } catch { /* first run / no DB — keep the default corner */ }
      if (alive) setHydrated(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (p: { x: number; y: number }) => {
    try {
      const db = await getDatabase();
      const { setSetting } = await import('../db/settings');
      await setSetting(db, POS_KEY, JSON.stringify(p));
    } catch { /* best-effort */ }
  };

  const responder = useRef(
    PanResponder.create({
      // Don't grab on touch-start (let taps reach the face); only claim once a real drag begins.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        draggingRef.current = false;
        pan.setOffset(posRef.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (e, g) => {
        if (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5) draggingRef.current = true;
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(e, g);
      },
      onPanResponderRelease: (_e, g) => {
        pan.flattenOffset();
        const rawX = posRef.current.x + g.dx;
        const rawY = posRef.current.y + g.dy;
        // Dock to whichever side is nearer (tidy, thumb-reachable), keep the vertical drop point.
        const s = sizeRef.current;
        const dockedX = rawX + s / 2 < win.width / 2 ? MARGIN : win.width - s - MARGIN;
        const target = clamp(dockedX, rawY);
        Animated.spring(pan, { toValue: target, useNativeDriver: false, friction: 7, tension: 80 }).start();
        posRef.current = target;
        void persist(target);
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - sizeRef.current) > 1) {
      sizeRef.current = w;
      const c = clamp(posRef.current.x, posRef.current.y);
      posRef.current = c;
      pan.setValue(c);
    }
  };

  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.wrap, { opacity: hydrated ? 1 : 0, transform: pan.getTranslateTransform() }]}
      {...responder.panHandlers}
      accessibilityLabel="LUCY — drag to move, tap to talk"
    >
      <AnimatedFace
        status={status}
        unreadCount={unreadCount}
        celebrateKey={celebrateKey}
        onPress={() => { if (!draggingRef.current) onPress(); }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, zIndex: 1000, elevation: 1000 },
});
