/**
 * FadeInUp — fade + slight upward translate on mount, the design-system entrance (spec: "Entrance:
 * FadeInUp (base + decelerate)"). Animates ONCE per mount; freshly-added list items animate while
 * existing ones stay put. Drives a single 0→1 value for opacity + translateY on the native driver.
 * Honours Reduce Motion (snaps to final state). Spring/duration come from tokens.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from './useReduceMotion';

export interface FadeInUpProps {
  children: React.ReactNode;
  /** Delay before the entrance starts, in ms (Stagger sets this automatically). */
  delay?: number;
  /** Rise distance override (px). Defaults to 12 — keep small on large surfaces. */
  distance?: number;
  /** Use a timing curve (decelerate) instead of a spring. Default false (spring). */
  timing?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function FadeInUp({
  children, delay = 0, distance = 12, timing = false, style,
}: FadeInUpProps): React.ReactElement {
  const reduced = useReduceMotion();
  const { spring, duration, easing } = useTheme();
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) { t.setValue(1); return; }
    t.setValue(0);
    const anim = timing
      ? Animated.timing(t, {
          toValue: 1,
          duration: duration.base,
          delay,
          easing: Easing.bezier(easing.decelerate[0], easing.decelerate[1], easing.decelerate[2], easing.decelerate[3]),
          useNativeDriver: true,
        })
      : Animated.spring(t, {
          toValue: 1,
          delay,
          damping: spring.soft.damping,
          stiffness: spring.soft.stiffness,
          mass: spring.soft.mass,
          useNativeDriver: true,
        });
    anim.start();
    return () => anim.stop();
    // delay is captured per-mount; re-running on delay change would replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default FadeInUp;
