/**
 * SegmentedControl — a switcher with a single highlight pill that SLIDES (spring) between options
 * instead of hard-cutting (spec: "SegmentedControl (sliding)"). One motion signature reused across
 * the app. The pill animates left/width (layout props → JS driver, cheap single value); everything
 * else is token-driven. Generic over the option value type.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Tighter padding for dense rows. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({
  options, value, onChange, compact = false, style,
}: SegmentedControlProps<T>): React.ReactElement {
  const { colors, radius, spacing, layout, spring } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const count = options.length || 1;
  const pad = 3;
  const segWidth = trackWidth > 0 ? (trackWidth - pad * 2) / count : 0;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: activeIndex,
      damping: spring.snappy.damping,
      stiffness: spring.snappy.stiffness,
      mass: spring.snappy.mass,
      useNativeDriver: false, // animating `left` (layout) — native driver can't.
    }).start();
  }, [activeIndex, slide, spring]);

  const onTrackLayout = (e: LayoutChangeEvent): void => setTrackWidth(e.nativeEvent.layout.width);

  const pillLeft = slide.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => pad + i * segWidth),
    extrapolate: 'clamp',
  });

  return (
    <View
      onLayout={onTrackLayout}
      style={[
        {
          flexDirection: 'row',
          padding: pad,
          borderRadius: radius.md,
          backgroundColor: colors.sheet,
          borderWidth: layout.hairline,
          borderColor: colors.borderSoft,
          position: 'relative',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Thin pipe dividers at each segment boundary so the options read as distinct tabs, not one
          continuous bar. They sit behind the sliding pill (which covers the active segment's edges). */}
      {segWidth > 0 ? options.slice(1).map((_, i) => (
        <View
          key={`sep-${i}`}
          pointerEvents="none"
          style={{ position: 'absolute', left: pad + (i + 1) * segWidth, top: '28%', bottom: '28%', width: layout.hairline, backgroundColor: colors.border }}
        />
      )) : null}
      {segWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: pad,
            bottom: pad,
            width: segWidth,
            left: pillLeft,
            borderRadius: radius.sm,
            backgroundColor: colors.surfaceAlt,
            borderWidth: layout.hairline,
            borderColor: colors.border,
          }}
        />
      ) : null}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: spacing.xs,
              paddingVertical: compact ? spacing.sm : spacing.md,
              borderRadius: radius.sm,
              zIndex: 1,
            }}
            onPress={() => { if (!active) onChange(opt.value); }}
          >
            {opt.icon ? (
              <Ionicons name={opt.icon} size={14} color={active ? colors.accent : colors.textMuted} />
            ) : null}
            <Text variant="footnote" color={active ? 'accent' : 'textMuted'} weight={active ? '700' : '600'} numberOfLines={1}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default SegmentedControl;
