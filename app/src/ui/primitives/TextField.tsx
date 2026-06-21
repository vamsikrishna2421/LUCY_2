/**
 * TextField — the labelled text input primitive. States: default / focus (accent border) / error
 * (danger border + message) / disabled (dimmed, non-editable). Supports an optional label, helper or
 * error text, leading/trailing icons, and multiline. Border animates on focus via the `base` duration
 * token. Tokens only — no raw colors/sizes.
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
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'editable'> {
  label?: string;
  /** Helper text shown under the field (hidden when `error` is set). */
  helper?: string;
  /** Error message — switches the field to its error state. */
  error?: string;
  disabled?: boolean;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  onTrailingPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export function TextField({
  label,
  helper,
  error,
  disabled = false,
  leadingIcon,
  trailingIcon,
  onTrailingPress,
  containerStyle,
  onFocus,
  onBlur,
  multiline,
  ...inputProps
}: TextFieldProps): React.ReactElement {
  const { colors, radius, spacing, typography, layout, duration } = useTheme();
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const animateFocus = (to: number): void => {
    Animated.timing(focusAnim, { toValue: to, duration: duration.base, useNativeDriver: false }).start();
  };

  const borderColor = error
    ? colors.danger
    : focusAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.accent] });

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="footnote" color="textSecondary" weight="600" style={{ marginBottom: spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: spacing.sm,
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.md,
          borderWidth: layout.hairline,
          borderColor,
          paddingHorizontal: spacing.md,
          paddingVertical: multiline ? spacing.md : 0,
          minHeight: layout.touchTarget,
          ...(disabled ? { opacity: 0.5 } : null),
        }}
      >
        {leadingIcon ? <Ionicons name={leadingIcon} size={18} color={colors.textMuted} style={{ marginTop: multiline ? 2 : 0 }} /> : null}
        <TextInput
          editable={!disabled}
          multiline={multiline}
          placeholderTextColor={colors.textFaint}
          onFocus={(e) => { setFocused(true); animateFocus(1); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); animateFocus(0); onBlur?.(e); }}
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontSize: typography.body.fontSize,
            lineHeight: typography.body.lineHeight,
            paddingVertical: multiline ? 0 : spacing.md,
            ...(multiline ? { textAlignVertical: 'top', minHeight: 80 } : null),
          }}
          {...inputProps}
        />
        {trailingIcon ? (
          <Ionicons
            name={trailingIcon}
            size={18}
            color={focused ? colors.accent : colors.textMuted}
            onPress={onTrailingPress}
            suppressHighlighting
            style={{ marginTop: multiline ? 2 : 0 }}
          />
        ) : null}
      </Animated.View>
      {error ? (
        <Text variant="caption" color="danger" style={{ marginTop: spacing.xs }}>{error}</Text>
      ) : helper ? (
        <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>{helper}</Text>
      ) : null}
    </View>
  );
}

export default TextField;
