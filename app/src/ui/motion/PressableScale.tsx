/**
 * PressableScale — a tap target that springs to ~0.97 on press and settles back on release. The
 * canonical press feedback for the design system (spec: "Press: PressableScale (0.97, spring
 * snappy)"). Built on RN's `Pressable` so it composes with scrolling and nested touchables, and
 * cancels the scale if a scroll interrupts the press. Falls back to a plain pressable under Reduce
 * Motion. Spring physics come from `spring.snappy` (in) / `spring.soft` (out) tokens.
 */
import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from './useReduceMotion';

export interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  /** Resting → pressed scale. Default 0.97. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  testID?: string;
}

export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  scaleTo = 0.97,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  hitSlop,
  testID,
}: PressableScaleProps): React.ReactElement {
  const reduced = useReduceMotion();
  const { spring } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = (): void => {
    if (reduced || disabled) return;
    Animated.spring(scale, {
      toValue: scaleTo,
      damping: spring.snappy.damping,
      stiffness: spring.snappy.stiffness,
      mass: spring.snappy.mass,
      useNativeDriver: true,
    }).start();
  };
  const pressOut = (): void => {
    if (reduced || disabled) return;
    Animated.spring(scale, {
      toValue: 1,
      damping: spring.soft.damping,
      stiffness: spring.soft.stiffness,
      mass: spring.soft.mass,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={hitSlop}
      testID={testID}
      // Layout style (flex, width, margin) MUST live on the Pressable itself — otherwise a `flex:1`
      // passed by a caller lands on the inner Animated.View, the Pressable stays content-sized, and any
      // flex:1 child collapses to 0 width (this is what made Settings row TITLES disappear). The inner
      // view only carries the press-scale transform; it stretches to the Pressable via default align.
      style={style}
    >
      <Animated.View style={{ flexShrink: 1, transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

export default PressableScale;
