/**
 * Avatar — a circular identity token. Renders a remote image when `uri` is given, otherwise derives
 * up-to-2-letter initials from `name` on a soft accent disc. Sizes are tokenised; an optional status
 * dot (online/away/none) sits bottom-right. Tokens only.
 */
import React from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';
import type { TextVariant } from './Text';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'none' | 'online' | 'away';

export interface AvatarProps {
  /** Remote image URI. Falls back to initials when absent or it fails to load. */
  uri?: string;
  /** Display name — initials are derived from this. */
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<AvatarSize, { d: number; variant: TextVariant }> = {
  sm: { d: 28, variant: 'caption' },
  md: { d: 40, variant: 'footnote' },
  lg: { d: 56, variant: 'h3' },
  xl: { d: 72, variant: 'h2' },
};

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ uri, name, size = 'md', status = 'none', style }: AvatarProps): React.ReactElement {
  const { colors, layout } = useTheme();
  const [failed, setFailed] = React.useState(false);
  const dims = SIZES[size];
  const showImage = uri && !failed;

  const statusColor = status === 'online' ? colors.success : status === 'away' ? colors.warning : undefined;
  const dotSize = Math.max(8, Math.round(dims.d * 0.28));

  return (
    <View style={[{ width: dims.d, height: dims.d }, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={{ width: dims.d, height: dims.d, borderRadius: dims.d / 2, backgroundColor: colors.surfaceAlt }}
        />
      ) : (
        <View
          style={{
            width: dims.d,
            height: dims.d,
            borderRadius: dims.d / 2,
            backgroundColor: colors.accentSoft,
            borderWidth: layout.hairline,
            borderColor: colors.accentLine,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant={dims.variant} color="accent" weight="700">{initials(name)}</Text>
        </View>
      )}
      {statusColor ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: statusColor,
            borderWidth: 2,
            borderColor: colors.bg,
          }}
        />
      ) : null}
    </View>
  );
}

export default Avatar;
