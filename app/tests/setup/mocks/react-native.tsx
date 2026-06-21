/**
 * Minimal react-native mock for headless render tests.
 *
 * Renders RN host components as plain string-tag elements so react-test-renderer can build a tree
 * without the native runtime. Only the surface the ui/ primitives + the two screens actually touch
 * is implemented. Animated values are no-op stand-ins (enough to construct + interpolate).
 */
import React from 'react';

const host = (tag: string) =>
  React.forwardRef(function HostComponent(props: any, ref: any) {
    return React.createElement(tag, { ...props, ref });
  });

export const View = host('View');
export const Text = host('Text');
export const TextInput = host('TextInput');
export const ScrollView = host('ScrollView');
export const Pressable = host('Pressable');
export const TouchableOpacity = host('TouchableOpacity');
export const ActivityIndicator = host('ActivityIndicator');
export const Image = host('Image');
export const KeyboardAvoidingView = host('KeyboardAvoidingView');

export function Modal({ visible = true, children }: any) {
  // Mirror RN: nothing renders when not visible.
  return visible ? React.createElement('Modal', null, children) : null;
}

// ── Animated ────────────────────────────────────────────────────────────────
class AnimatedValue {
  _value: number;
  constructor(v: number) { this._value = v; }
  setValue(v: number) { this._value = v; }
  interpolate() { return new AnimatedValue(0); }
}
const animatedTiming = () => ({ start: (cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true }), stop: () => {} });
export const Animated = {
  View: host('Animated.View'),
  Text: host('Animated.Text'),
  ScrollView: host('Animated.ScrollView'),
  Value: AnimatedValue,
  timing: animatedTiming,
  spring: animatedTiming,
  sequence: animatedTiming,
  parallel: animatedTiming,
  loop: animatedTiming,
  delay: animatedTiming,
  // ProgressRing wraps an SVG Circle: Animated.createAnimatedComponent(Circle).
  createAnimatedComponent: (Comp: any) => Comp,
};

// ── Easing ────────────────────────────────────────────────────────────────────
// Every member returns an identity easing fn; primitives only need the calls not to throw.
const easingFn = (t: number) => t;
export const Easing = {
  linear: easingFn,
  ease: easingFn,
  quad: easingFn,
  cubic: easingFn,
  bezier: () => easingFn,
  in: (fn: any) => fn,
  out: (fn: any) => fn,
  inOut: (fn: any) => fn,
};

// ── StyleSheet ────────────────────────────────────────────────────────────────
export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  hairlineWidth: 1,
  flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s),
};

// ── Platform ────────────────────────────────────────────────────────────────
// Driven by global.__TEST_PLATFORM__ so a single test can mount under both OSes.
export const Platform = {
  get OS(): 'ios' | 'android' { return (global as any).__TEST_PLATFORM__ ?? 'ios'; },
  select<T>(spec: { ios?: T; android?: T; default?: T }): T | undefined {
    const os = (global as any).__TEST_PLATFORM__ ?? 'ios';
    return os in spec ? (spec as any)[os] : spec.default;
  },
};

// ── Imperative singletons ─────────────────────────────────────────────────────
const noopSub = { remove() {} };
export const BackHandler = {
  addEventListener: () => noopSub,
  removeEventListener: () => {},
  exitApp: () => {},
};
export const Keyboard = {
  addListener: () => noopSub,
  removeAllListeners: () => {},
  dismiss: () => {},
};
export const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(false),
  addEventListener: () => noopSub,
};
export const Alert = { alert: () => {} };
export const Linking = { openSettings: () => {}, addEventListener: () => noopSub, getInitialURL: () => Promise.resolve(null) };
export const AppState = { addEventListener: () => noopSub, currentState: 'active' };

export default {
  View, Text, TextInput, ScrollView, Pressable, TouchableOpacity, ActivityIndicator, Image,
  KeyboardAvoidingView, Modal, Animated, Easing, StyleSheet, Platform, BackHandler, Keyboard,
  AccessibilityInfo, Alert, Linking, AppState,
};
