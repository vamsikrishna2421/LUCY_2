/**
 * SearchField — a pill-shaped search input with a leading magnifier and a clear (×) affordance that
 * appears once there's text. States: default / focus (accent ring) / disabled. A thin wrapper over a
 * controlled TextInput so it stays light on list screens. Tokens only.
 */
import React, { useRef, useState } from 'react';
import {
  Animated,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

export interface SearchFieldProps extends Omit<TextInputProps, 'style' | 'editable' | 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Called when the clear (×) button is pressed. Defaults to clearing the text. */
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  disabled = false,
  onClear,
  onFocus,
  onBlur,
  containerStyle,
  ...inputProps
}: SearchFieldProps): React.ReactElement {
  const { colors, radius, spacing, typography, layout, duration } = useTheme();
  const focusAnim = useRef(new Animated.Value(0)).current;
  const [, setFocused] = useState(false);

  const animateFocus = (to: number): void => {
    Animated.timing(focusAnim, { toValue: to, duration: duration.base, useNativeDriver: false }).start();
  };

  const borderColor = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.accent] });

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.pill,
          borderWidth: layout.hairline,
          borderColor,
          paddingHorizontal: spacing.base,
          minHeight: layout.touchTarget,
          ...(disabled ? { opacity: 0.5 } : null),
        },
        containerStyle,
      ]}
    >
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        returnKeyType="search"
        clearButtonMode="never"
        onFocus={(e) => { setFocused(true); animateFocus(1); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); animateFocus(0); onBlur?.(e); }}
        style={{
          flex: 1,
          color: colors.textPrimary,
          fontSize: typography.body.fontSize,
          paddingVertical: spacing.sm,
        }}
        {...inputProps}
      />
      {value.length > 0 ? (
        <Ionicons
          name="close-circle"
          size={18}
          color={colors.textMuted}
          onPress={() => (onClear ? onClear() : onChangeText(''))}
          suppressHighlighting
          accessibilityLabel="Clear search"
        />
      ) : null}
    </Animated.View>
  );
}

export default SearchField;
