/**
 * Text — the typographic primitive. Encodes the type scale (display…caption) and reads color from a
 * semantic token, so no screen sets raw font sizes or hex colors. Everything else (numberOfLines,
 * onPress, etc.) passes through to RN Text. Use this instead of bare `<Text>` everywhere.
 */
import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorToken } from '../theme/tokens';

export type TextVariant =
  | 'display' | 'h1' | 'h2' | 'h3'
  | 'body' | 'bodyMed' | 'callout' | 'footnote' | 'caption';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** Semantic color token. Defaults to `textPrimary`. */
  color?: ColorToken;
  align?: TextStyle['textAlign'];
  /** Override weight from the scale when needed (e.g. emphasise a body line). */
  weight?: TextStyle['fontWeight'];
  /** Letter spacing tweak in px. */
  tracking?: number;
  children?: React.ReactNode;
}

export function Text({
  variant = 'body',
  color = 'textPrimary',
  align,
  weight,
  tracking,
  style,
  children,
  ...rest
}: TextProps): React.ReactElement {
  const { typography, colors } = useTheme();
  const t = typography[variant];
  return (
    <RNText
      style={[
        {
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          fontWeight: weight ?? (t.fontWeight as TextStyle['fontWeight']),
          color: colors[color],
          ...(align ? { textAlign: align } : null),
          ...(tracking !== undefined ? { letterSpacing: tracking } : null),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export default Text;
