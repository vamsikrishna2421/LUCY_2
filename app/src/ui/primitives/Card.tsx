/**
 * Card — the standard content container (spec: "cards use e1"). A Surface with comfortable default
 * padding, a hairline border, and `e1` elevation. When `onPress` is given it becomes tappable with
 * the design-system PressableScale feedback; otherwise it's a plain panel.
 */
import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { Surface, type ElevationToken, type RadiusToken, type SurfaceLevel } from './Surface';
import { PressableScale } from '../motion/PressableScale';
import type { ColorToken, SpacingToken } from '../theme/tokens';

export interface CardProps {
  children?: React.ReactNode;
  level?: SurfaceLevel;
  elevation?: ElevationToken;
  radius?: RadiusToken;
  padding?: SpacingToken;
  /** Hairline border color token, or false for none. Defaults to `border`. */
  border?: ColorToken | false;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({
  children,
  level = 'surface',
  elevation = 'e1',
  radius = 'lg',
  padding = 'base',
  border = 'border',
  onPress,
  onLongPress,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: CardProps): React.ReactElement {
  const surface = (
    <Surface level={level} elevation={elevation} radius={radius} padding={padding} border={border} style={style}>
      {children}
    </Surface>
  );

  if (!onPress && !onLongPress) return surface;

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {surface}
    </PressableScale>
  );
}

export default Card;
