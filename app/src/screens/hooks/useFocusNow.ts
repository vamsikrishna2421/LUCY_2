/**
 * useFocusNow — the Focus Now view's logic seam.
 *
 * The ONLY place the redesigned Focus Now view touches frozen logic. Focus Now (NowView in Dashboard
 * 1.0) is mostly presentation over data the parent already loaded (via useDashboardData) plus two
 * resolve actions and the privacy preview. Wraps the exact entry points 1.0 used:
 *
 *   db/openLoops      → resolveOpenLoop
 *   db/followUps      → resolveFollowUp
 *   db/captures       → captureStatus (pure, re-exported)
 *   processing/privacy→ protectedPreview (pure, re-exported)
 *
 * The richer Quick-Review / Commitments / Needs-Context cards inside Focus Now are self-contained
 * components (StalenessReviewCard, CommitmentsSection, ContextBatchCard, BrainPulseSection) that own
 * their own logic — unchanged. No logic changed here; behavior matches NowView 1.0.
 */
import { useCallback } from 'react';
import { getDatabase } from '../../db';
import { captureStatus } from '../../db/captures';
import { resolveOpenLoop } from '../../db/openLoops';
import { resolveFollowUp } from '../../db/followUps';
import { protectedPreview } from '../../processing/privacy';

export interface UseFocusNow {
  captureStatus: typeof captureStatus;
  protectedPreview: typeof protectedPreview;
  resolveLoop: (id: number) => Promise<void>;
  resolveFollow: (id: number) => Promise<void>;
}

export function useFocusNow(): UseFocusNow {
  const resolveLoop = useCallback(async (id: number) => {
    const db = await getDatabase();
    await resolveOpenLoop(db, id);
  }, []);

  const resolveFollow = useCallback(async (id: number) => {
    const db = await getDatabase();
    await resolveFollowUp(db, id);
  }, []);

  return { captureStatus, protectedPreview, resolveLoop, resolveFollow };
}
