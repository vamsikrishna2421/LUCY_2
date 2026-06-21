/**
 * Surface — a themed container at a chosen depth level. The base building block under Card, Sheet,
 * etc. Maps a semantic surface token + an elevation token to background + shadow, and exposes
 * token-based radius/padding so callers never hand-roll a panel style.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorToken, SpacingToken } from '../theme/tokens';

export type SurfaceLevel = 'bg' | 'surface' | 'surfaceAlt' | 'surfaceElevated' | 'sheet';
export type ElevationToken = 'e0' | 'e1' | 'e2' | 'e3' | 'e4' | 'glow';
export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'pill';

export interface SurfaceProps {
  children?: React.ReactNode;
  /** Background depth. Defaults to `surface`. */
  level?: SurfaceLevel;
  /** Shadow/elevation token. Defaults to `e0` (flat). */
  elevation?: ElevationToken;
  radius?: RadiusToken;
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  /** Draw a 1px hairline border in the given token color. */
  border?: ColorToken | false;
  style?: StyleProp<ViewStyle>;
}

export function Surface({
  children,
  level = 'surface',
  elevation = 'e0',
  radius = 'lg',
  padding,
  paddingX,
  paddingY,
  border = false,
  style,
}: SurfaceProps): React.ReactElement {
  const { colors, radius: radii, spacing, elevation: elev, layout } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors[level],
          borderRadius: radii[radius],
          ...elev[elevation],
          ...(border ? { borderWidth: layout.hairline, borderColor: colors[border] } : null),
          ...(padding !== undefined ? { padding: spacing[padding] } : null),
          ...(paddingX !== undefined ? { paddingHorizontal: spacing[paddingX] } : null),
          ...(paddingY !== undefined ? { paddingVertical: spacing[paddingY] } : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default Surface;
