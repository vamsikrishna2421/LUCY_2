/**
 * Toast + ToastProvider — transient, undo-friendly notifications. Central to the design system's
 * "forgiveness" model: reversible destructive actions show a Toast-with-Undo instead of a blocking
 * confirm dialog (spec: "Undo over confirm-dialogs").
 *
 * Usage:
 *   // Once, near the app root (inside SafeAreaProvider):
 *   <ToastProvider><App /></ToastProvider>
 *
 *   // Anywhere below:
 *   const toast = useToast();
 *   toast.show({ message: 'Note deleted', actionLabel: 'Undo', onAction: restore, tone: 'danger' });
 *
 * One toast at a time (a new one replaces the current). Auto-dismisses after `duration` ms unless an
 * action is pending. Slides up from the bottom on the native driver; honours safe-area + Reduce Motion.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { PressableScale } from '../motion/PressableScale';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../motion/useReduceMotion';
import type { ColorToken } from '../theme/tokens';

export type ToastTone = 'neutral' | 'success' | 'danger' | 'info';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** Label for the inline action (e.g. "Undo"). When set, the toast waits for it before auto-hiding. */
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-dismiss delay in ms. Default 3200 (4500 when an action is present). */
  duration?: number;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface ToastApi {
  show: (opts: ToastOptions) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_ACCENT: Record<ToastTone, ColorToken> = {
  neutral: 'accent',
  success: 'success',
  danger: 'danger',
  info: 'info',
};

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { colors, radius, spacing, elevation, layout } = useTheme();
  const reduced = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = (): void => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const hide = useCallback((): void => {
    clearTimer();
    if (reduced) { anim.setValue(0); setToast(null); return; }
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true })
      .start(({ finished }) => { if (finished) setToast(null); });
  }, [anim, reduced]);

  const show = useCallback((opts: ToastOptions): void => {
    clearTimer();
    setToast(opts);
    const showFor = opts.duration ?? (opts.actionLabel ? 4500 : 3200);
    if (reduced) {
      anim.setValue(1);
    } else {
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, damping: 20, stiffness: 220, mass: 1, useNativeDriver: true }).start();
    }
    timer.current = setTimeout(() => hide(), showFor);
  }, [anim, hide, reduced]);

  useEffect(() => () => clearTimer(), []);

  const api = useRef<ToastApi>({ show, hide });
  api.current.show = show;
  api.current.hide = hide;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
  const accent: ColorToken = toast ? TONE_ACCENT[toast.tone ?? 'neutral'] : 'accent';

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: spacing.base,
            right: spacing.base,
            bottom: Math.max(insets.bottom, spacing.base) + spacing.sm,
            opacity: anim,
            transform: [{ translateY }],
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.md,
              borderWidth: layout.hairline,
              borderColor: colors.border,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.base,
              ...elevation.e4,
            }}
          >
            {toast.icon ? <Ionicons name={toast.icon} size={20} color={colors[accent]} /> : null}
            <Text variant="callout" color="textPrimary" style={{ flex: 1 }} numberOfLines={2}>{toast.message}</Text>
            {toast.actionLabel && toast.onAction ? (
              <PressableScale
                onPress={() => { const fn = toast.onAction; hide(); fn?.(); }}
                hitSlop={8}
                accessibilityLabel={toast.actionLabel}
              >
                <Text variant="callout" color={accent} weight="700">{toast.actionLabel}</Text>
              </PressableScale>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

/** Access the toast API. Throws if used outside a ToastProvider. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}

export default ToastProvider;
