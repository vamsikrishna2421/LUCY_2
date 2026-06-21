/**
 * Skeleton — a shimmering placeholder block. Powers the design system's "instant render" rule: every
 * data surface renders Skeletons synchronously, then hydrates. A looping horizontal sheen sweeps a
 * subtle highlight across a tinted box on the native driver (transform/opacity only, cheap). Honours
 * Reduce Motion (static block, no sweep). Tokens only.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../motion/useReduceMotion';
import type { RadiusToken } from './Surface';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: RadiusToken;
  /** Render a perfect circle of the given diameter (overrides width/height/radius). */
  circle?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, radius = 'sm', circle, style }: SkeletonProps): React.ReactElement {
  const { colors, radius: radii } = useTheme();
  const reduced = useReduceMotion();
  const sheen = useRef(new Animated.Value(0)).current;
  const [boxWidth, setBoxWidth] = React.useState(0);

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.delay(400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, sheen]);

  const dims = circle !== undefined
    ? { width: circle, height: circle, borderRadius: circle / 2 }
    : { width, height, borderRadius: radii[radius] };

  const translateX = sheen.interpolate({
    inputRange: [0, 1],
    outputRange: [-(boxWidth || 200), boxWidth || 200],
  });

  return (
    <View
      onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}
      style={[{ backgroundColor: colors.surfaceAlt, overflow: 'hidden' }, dims, style]}
    >
      {!reduced ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '60%',
            backgroundColor: colors.surfaceElevated,
            opacity: 0.55,
            transform: [{ translateX }],
          }}
        />
      ) : null}
    </View>
  );
}

export default Skeleton;
