/**
 * BottomSheet — a modal panel that slides up from the bottom with a fading backdrop (spec: "Sheets:
 * slide from edge with spring soft; backdrop fades base"). Built on RN Modal so it sits above
 * everything and traps the back button. Content slides on the native driver; the backdrop fades with
 * the `base` duration token. Tapping the scrim or back dismisses. A grab handle hints draggability;
 * dismissal is tap-scrim (no gesture dependency required). Honours safe-area bottom inset. Tokens only.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../motion/useReduceMotion';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** Optional title shown above the content. */
  title?: string;
  /** Hide the drag handle. Default false. */
  hideHandle?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

export function BottomSheet({
  visible, onClose, children, title, hideHandle = false, contentStyle,
}: BottomSheetProps): React.ReactElement {
  const { colors, radius, spacing, elevation, layout, duration, spring } = useTheme();
  const reduced = useReduceMotion();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current; // 0 = hidden (down), 1 = shown
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduced) { slide.setValue(1); return; }
      slide.setValue(0);
      Animated.spring(slide, {
        toValue: 1,
        damping: spring.soft.damping,
        stiffness: spring.soft.stiffness,
        mass: spring.soft.mass,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      if (reduced) { slide.setValue(0); setMounted(false); return; }
      Animated.timing(slide, { toValue: 0, duration: duration.base, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setMounted(false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!mounted) return <></>;

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: slide }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Dismiss" accessibilityRole="button" />
        </Animated.View>
        <Animated.View
          style={[
            {
              backgroundColor: colors.sheet,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              borderWidth: layout.hairline,
              borderColor: colors.border,
              paddingTop: spacing.sm,
              paddingHorizontal: spacing.base,
              paddingBottom: Math.max(insets.bottom, spacing.base),
              ...elevation.e3,
              transform: [{ translateY }],
            },
            contentStyle,
          ]}
        >
          {!hideHandle ? (
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm }} />
          ) : null}
          {title ? (
            <Text variant="h3" align="center" style={{ marginBottom: spacing.md }}>{title}</Text>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export default BottomSheet;
