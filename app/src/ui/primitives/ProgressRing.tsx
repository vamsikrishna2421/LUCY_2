/**
 * ProgressRing — a circular progress indicator drawn with react-native-svg. A track circle plus an
 * accent arc whose length follows `progress` (0–1), animated with the `slow` duration token. An
 * optional center label/child sits inside. Tokens only for colors + motion; size/stroke are props.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../motion/useReduceMotion';
import type { ColorToken } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** 0–1. Clamped. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: ColorToken;
  trackColor?: ColorToken;
  /** Center label (e.g. "72%"). Ignored when `children` is given. */
  label?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 6,
  color = 'accent',
  trackColor = 'surfaceElevated',
  label,
  children,
  style,
}: ProgressRingProps): React.ReactElement {
  const { colors, duration } = useTheme();
  const reduced = useReduceMotion();
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const anim = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    if (reduced) { anim.setValue(clamped); return; }
    Animated.timing(anim, {
      toValue: clamped,
      duration: duration.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // strokeDashoffset is not native-driver compatible.
    }).start();
  }, [clamped, reduced, anim, duration]);

  const dashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors[trackColor]}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors[color]}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          // Start the arc at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ?? (label ? <Text variant="footnote" color="textPrimary" weight="700">{label}</Text> : null)}
    </View>
  );
}

export default ProgressRing;
