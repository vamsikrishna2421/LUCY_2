/**
 * LucyOrb — a lightweight, breathing amber orb that represents LUCY's presence. Built with
 * react-native-svg (a radial-gradient sphere + specular highlight) and a single Animated value that
 * gently scales the orb + pulses a soft halo (the "breath"). An optional `active` prop quickens the
 * breath for working states. Honours Reduce Motion (still orb). Tokens only.
 *
 * This is intentionally simpler than the legacy AnimatedFace — no eyes/expressions — so it is cheap
 * to render anywhere (headers, empty states, loading). For the full character, use AnimatedFace.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../motion/useReduceMotion';

export interface LucyOrbProps {
  size?: number;
  /** Quicken the breath + brighten the halo for working/listening states. */
  active?: boolean;
  /** Show the soft outer halo. Default true. */
  halo?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LucyOrb({ size = 64, active = false, halo = true, style }: LucyOrbProps): React.ReactElement {
  const { colors } = useTheme();
  const reduced = useReduceMotion();
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) { breathe.setValue(0.5); return; }
    const period = active ? 1500 : 2600;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: period, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: period, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduced, breathe]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.05] });
  const haloOpacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: active ? [0.25, 0.5] : [0.15, 0.34],
  });
  // React.useId() returns ids containing ':' (e.g. ":r0:"). SVG ids referenced via url(#id) must not
  // contain ':' — on Android the gradient silently fails to resolve and the orb renders unfilled.
  // Strip non-alphanumerics to keep a valid, still-unique id.
  const gradId = `lucyOrb${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {halo ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: size * 0.7,
            backgroundColor: colors.accentGlow,
            opacity: haloOpacity,
            transform: [{ scale }],
          }}
        />
      ) : null}
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={gradId} cx="38%" cy="32%" r="75%">
              <Stop offset="0%" stopColor={colors.accentGlow} stopOpacity="1" />
              <Stop offset="55%" stopColor={colors.accent} stopOpacity="1" />
              <Stop offset="100%" stopColor={colors.accentDeep} stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill={`url(#${gradId})`} />
          {/* Specular highlight — sells the glossy sphere. */}
          <Circle cx={size * 0.36} cy={size * 0.3} r={size * 0.12} fill={colors.white} opacity={0.5} />
        </Svg>
      </Animated.View>
    </View>
  );
}

export default LucyOrb;
