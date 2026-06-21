/**
 * ActionSheet — a list of choices presented in a BottomSheet, the design-system replacement for
 * `Alert.alert` (migration plan step 3). Each action has a label, optional icon, and optional
 * `destructive` styling; a separate Cancel row dismisses. Supports an optional title + message.
 * Selecting an action closes the sheet then fires its handler. Tokens only.
 *
 * Forgiveness: prefer this + Toast-with-Undo over blocking confirm dialogs for reversible actions.
 */
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';
import { Divider } from './Divider';
import { PressableScale } from '../motion/PressableScale';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorToken } from '../theme/tokens';

export interface ActionSheetAction {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  /** Cancel row label. Default "Cancel". Pass null to hide it. */
  cancelLabel?: string | null;
}

export function ActionSheet({
  visible, onClose, title, message, actions, cancelLabel = 'Cancel',
}: ActionSheetProps): React.ReactElement {
  const { colors, spacing, radius, layout } = useTheme();

  const select = (action: ActionSheetAction): void => {
    if (action.disabled) return;
    onClose();
    // Defer so the dismiss animation starts before the (possibly heavy) handler runs.
    requestAnimationFrame(() => action.onPress());
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} hideHandle>
      {title || message ? (
        <View style={{ alignItems: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.sm }}>
          {title ? <Text variant="h3" align="center">{title}</Text> : null}
          {message ? (
            <Text variant="footnote" color="textMuted" align="center" style={{ marginTop: spacing.xs }}>{message}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: layout.hairline, borderColor: colors.border, overflow: 'hidden' }}>
        {actions.map((action, i) => {
          const fg: ColorToken = action.destructive ? 'danger' : 'textPrimary';
          return (
            <View key={`${action.label}-${i}`}>
              {i > 0 ? <Divider /> : null}
              <PressableScale
                onPress={() => select(action)}
                disabled={action.disabled}
                scaleTo={0.99}
                accessibilityLabel={action.label}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.base,
                    paddingHorizontal: spacing.base,
                    minHeight: layout.touchTarget,
                    ...(action.disabled ? { opacity: 0.4 } : null),
                  }}
                >
                  {action.icon ? <Ionicons name={action.icon} size={20} color={colors[fg]} /> : null}
                  <Text variant="body" color={fg} weight="600">{action.label}</Text>
                </View>
              </PressableScale>
            </View>
          );
        })}
      </View>

      {cancelLabel ? (
        <PressableScale onPress={onClose} scaleTo={0.99} accessibilityLabel={cancelLabel}>
          <View
            style={{
              marginTop: spacing.sm,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.lg,
              borderWidth: layout.hairline,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.base,
              minHeight: layout.touchTarget,
            }}
          >
            <Text variant="body" color="textSecondary" weight="700">{cancelLabel}</Text>
          </View>
        </PressableScale>
      ) : null}
    </BottomSheet>
  );
}

export default ActionSheet;
