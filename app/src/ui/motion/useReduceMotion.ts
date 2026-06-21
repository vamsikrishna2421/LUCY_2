/**
 * useReduceMotion — shared accessibility hook for the UI motion primitives. Reads the OS
 * "Reduce Motion" setting once (cached) then stays live, so toggling it in Settings updates new
 * mounts immediately. Mirrors the behaviour of the legacy `components/Motion.tsx` so the new design
 * system honours the same accessibility contract.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let reduceMotionCache = false;
void AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => { reduceMotionCache = on; })
  .catch(() => {});

export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(reduceMotionCache);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => { if (alive) { reduceMotionCache = on; setReduced(on); } })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
      reduceMotionCache = on;
      setReduced(on);
    });
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduced;
}

export default useReduceMotion;
