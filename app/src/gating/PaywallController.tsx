/**
 * LUCY 2.0 — PaywallController.
 *
 * Mounts a single `<Paywall>` in a modal at the app root and exposes `usePaywall()` so any screen or
 * `<Gate>` can open it from anywhere — no per-screen modal wiring. Keeping one instance means a Pro
 * upgrade triggered from a locked autopilot card and one from Settings share the same surface.
 *
 * Wrap the tree once (inside `EntitlementProvider`); see billing/INTEGRATION.md.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal } from 'react-native';

import { Paywall } from '../billing/Paywall';

/** Options when opening the paywall (lets a lock pass context-specific copy). */
export interface OpenPaywallOptions {
  /** Headline shown under the title, e.g. "Unlock Meeting mode". */
  headline?: string;
  /** Source tag for telemetry (e.g. the feature/screen that triggered it). */
  source?: string;
}

/** Value exposed by {@link usePaywall}. */
export interface PaywallControllerValue {
  /** True while the paywall modal is visible. */
  visible: boolean;
  /** Open the paywall (optionally with context). */
  open: (options?: OpenPaywallOptions) => void;
  /** Close the paywall. */
  close: () => void;
}

const PaywallControllerContext = createContext<PaywallControllerValue>({
  visible: false,
  open: () => {},
  close: () => {},
});

export interface PaywallControllerProps {
  children: React.ReactNode;
}

export function PaywallController({ children }: PaywallControllerProps): React.ReactElement {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<OpenPaywallOptions>({});

  const open = useCallback((opts?: OpenPaywallOptions) => {
    setOptions(opts ?? {});
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  const value = useMemo<PaywallControllerValue>(() => ({ visible, open, close }), [visible, open, close]);

  return (
    <PaywallControllerContext.Provider value={value}>
      {children}
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={close}
        statusBarTranslucent
      >
        <Paywall headline={options.headline} onClose={close} onPurchased={close} />
      </Modal>
    </PaywallControllerContext.Provider>
  );
}

/**
 * Trigger the paywall from anywhere under {@link PaywallController}. Safe outside the provider — returns
 * no-op handlers so callers don't need to null-check.
 */
export function usePaywall(): PaywallControllerValue {
  return useContext(PaywallControllerContext);
}

export { PaywallControllerContext };
