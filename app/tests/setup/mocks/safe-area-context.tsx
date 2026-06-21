/**
 * react-native-safe-area-context mock. Returns fixed insets so primitives that read
 * useSafeAreaInsets() (Toast, BottomSheet) can compute their bottom padding without a native provider.
 * Insets mimic a notched device (top + home-indicator) so the Math.max(insets.bottom, …) paths run.
 */
import React from 'react';

const INSETS = { top: 47, bottom: 34, left: 0, right: 0 };

export function useSafeAreaInsets() {
  return INSETS;
}
export function useSafeAreaFrame() {
  return { x: 0, y: 0, width: 390, height: 844 };
}
export function SafeAreaProvider({ children }: any) {
  return React.createElement('SafeAreaProvider', null, children);
}
export function SafeAreaView({ children, ...props }: any) {
  return React.createElement('SafeAreaView', props, children);
}
export const SafeAreaInsetsContext = React.createContext(INSETS);
export const initialWindowMetrics = { insets: INSETS, frame: { x: 0, y: 0, width: 390, height: 844 } };
