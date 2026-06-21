/**
 * Stagger — wraps a list and gives each child an increasing entrance `delay` so items cascade in
 * gently (spec: "staggered for lists"). Clones direct children that accept a `delay` prop (e.g.
 * FadeInUp); children with an explicit `delay` are left untouched; non-elements pass through. The
 * cascade is delay-only — it never re-runs on scroll. Caps the delay so long lists don't drag.
 */
import React from 'react';

export interface StaggerProps {
  children: React.ReactNode;
  /** Per-item delay step, in ms. */
  step?: number;
  /** Delay before the whole group begins, in ms. */
  initialDelay?: number;
  /** Cap on how many items get an increasing delay; beyond this they share the max. Default 8. */
  maxStagger?: number;
}

export function Stagger({
  children, step = 55, initialDelay = 0, maxStagger = 8,
}: StaggerProps): React.ReactElement {
  let i = 0;
  const mapped = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    const existing = (child.props as { delay?: number }).delay;
    if (typeof existing === 'number') return child; // respect an explicit delay
    const delay = initialDelay + Math.min(i, maxStagger) * step;
    i += 1;
    return React.cloneElement(child as React.ReactElement<{ delay?: number }>, { delay });
  });
  return <>{mapped}</>;
}

export default Stagger;
