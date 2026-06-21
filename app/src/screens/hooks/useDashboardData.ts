/**
 * useDashboardData — the Dashboard's shared logic seam (the one big load).
 *
 * The redesigned Dashboard shell + its views read all their cross-cutting data from here. Wraps the
 * exact entry points Dashboard 1.0's mount effect used, with identical arguments + ordering
 * (docs/04_SEAM_REPORT.md Timeline/Lists/Mood rows, plus the extra calls the file actually makes):
 *
 *   db/todos|ideas|expenses|reminders → listTodos, listIdeas, listExpenses, listReminders
 *   db/captures                       → listRecentCaptures, listCaptureUpdates
 *   db/contextRequests                → listOpenContextRequests
 *   db/openLoops|followUps            → listOpenLoops, listFollowUps
 *   processing/stalenessEngine        → ensureStalenessTable, runStalenessCheck, listPendingReviews, getContextBatch
 *   db/userProfile                    → getUserProfile (first name)
 *   processing/temporalEngine         → getMoodTrend(db, 7)
 *   processing/onThisDay              → getOnThisDayMemories
 *   + the same raw mood_entries SELECT for per-capture tone.
 *
 * No logic changed — behavior matches Dashboard 1.0; presentation lives in the views.
 */
import { useEffect, useState } from 'react';
import { getDatabase } from '../../db';
import { listCaptureUpdates, listRecentCaptures, type CaptureRow } from '../../db/captures';
import { listOpenContextRequests, type ContextRequestRow } from '../../db/contextRequests';
import { listExpenses, type ExpenseRow } from '../../db/expenses';
import { listIdeas, type IdeaRow } from '../../db/ideas';
import { listOpenLoops, type OpenLoopRow } from '../../db/openLoops';
import { listFollowUps, type FollowUpRow } from '../../db/followUps';
import { listReminders, type ReminderRow } from '../../db/reminders';
import { listTodos, type TodoRow } from '../../db/todos';
import {
  ensureStalenessTable, listPendingReviews, getContextBatch, runStalenessCheck,
  type StalenessReview, type ContextBatch,
} from '../../processing/stalenessEngine';

export interface MoodTrend { dominant: string; positiveRatio: number; recentTones: string[] }

/** Group capture updates by their parent capture id (same shape Dashboard 1.0 stored). */
function groupUpdates(updates: CaptureRow[]): Record<number, CaptureRow[]> {
  return updates.reduce<Record<number, CaptureRow[]>>((grouped, update) => {
    if (update.parent_capture_id === null) return grouped;
    const existing = grouped[update.parent_capture_id] ?? [];
    grouped[update.parent_capture_id] = [...existing, update];
    return grouped;
  }, {});
}

export interface DashboardData {
  todos: TodoRow[];
  ideas: IdeaRow[];
  expenses: ExpenseRow[];
  reminders: ReminderRow[];
  captures: CaptureRow[];
  updates: Record<number, CaptureRow[]>;
  contextRequests: ContextRequestRow[];
  openLoops: OpenLoopRow[];
  followUps: FollowUpRow[];
  moodTrend: MoodTrend;
  onThisDay: import('../../processing/onThisDay').OnThisDayMemory[];
  moodsByCapture: Record<number, string>;
  userName: string;
  stalenessReviews: StalenessReview[];
  contextBatch: ContextBatch | null;
}

/**
 * Loads everything the Dashboard needs. `refreshToken` + `contextRefresh` re-run the load exactly like
 * Dashboard 1.0 (refreshToken from the parent; contextRefresh bumped after a resolve/clarification).
 */
export function useDashboardData(refreshToken: number, contextRefresh: number): DashboardData {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [captures, setCaptures] = useState<CaptureRow[]>([]);
  const [updates, setUpdates] = useState<Record<number, CaptureRow[]>>({});
  const [contextRequests, setContextRequests] = useState<ContextRequestRow[]>([]);
  const [openLoops, setOpenLoops] = useState<OpenLoopRow[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [moodTrend, setMoodTrend] = useState<MoodTrend>({ dominant: 'neutral', positiveRatio: 0.5, recentTones: [] });
  const [onThisDay, setOnThisDay] = useState<import('../../processing/onThisDay').OnThisDayMemory[]>([]);
  const [moodsByCapture, setMoodsByCapture] = useState<Record<number, string>>({});
  const [userName, setUserName] = useState('');
  const [stalenessReviews, setStalenessReviews] = useState<StalenessReview[]>([]);
  const [contextBatch, setContextBatch] = useState<ContextBatch | null>(null);

  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      const results = await Promise.all([
        listTodos(db),
        listIdeas(db),
        listExpenses(db),
        listReminders(db),
        listRecentCaptures(db, 30),
        listOpenContextRequests(db),
        listOpenLoops(db),
        listFollowUps(db),
      ]);
      setTodos(results[0]);
      setIdeas(results[1]);
      setExpenses(results[2]);
      setReminders(results[3]);
      setCaptures(results[4]);
      setContextRequests(results[5]);
      setOpenLoops(results[6]);
      setFollowUps(results[7]);
      try {
        await ensureStalenessTable(db);
        await runStalenessCheck(db);
        const reviews = await listPendingReviews(db);
        setStalenessReviews(reviews.filter((r) => r.kind !== 'context_overflow'));
        const batch = await getContextBatch(db);
        setContextBatch(batch.total > 3 ? batch : null);
      } catch { /* non-critical */ }
      try {
        const { getUserProfile } = await import('../../db/userProfile');
        const profile = await getUserProfile(db);
        setUserName((profile.name ?? '').trim().split(/\s+/)[0] ?? '');
      } catch { /* non-critical */ }
      try {
        const { getMoodTrend } = await import('../../processing/temporalEngine');
        setMoodTrend(await getMoodTrend(db, 7));
      } catch { /* non-critical */ }
      try {
        const { getOnThisDayMemories } = await import('../../processing/onThisDay');
        setOnThisDay(await getOnThisDayMemories(db));
      } catch { /* non-critical */ }
      try {
        const rows = await db.getAllAsync<{ capture_id: number; tone: string }>(
          'SELECT capture_id, tone FROM mood_entries ORDER BY created_at DESC',
        );
        const map: Record<number, string> = {};
        for (const row of rows) {
          if (!map[row.capture_id]) map[row.capture_id] = row.tone; // most recent tone per capture
        }
        setMoodsByCapture(map);
      } catch { /* non-critical */ }
      const nextUpdates = await listCaptureUpdates(db, results[4].map((capture) => capture.id));
      setUpdates(groupUpdates(nextUpdates));
    })();
  }, [refreshToken, contextRefresh]);

  return {
    todos, ideas, expenses, reminders, captures, updates, contextRequests, openLoops, followUps,
    moodTrend, onThisDay, moodsByCapture, userName, stalenessReviews, contextBatch,
  };
}
