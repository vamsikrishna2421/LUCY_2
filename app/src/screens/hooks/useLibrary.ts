/**
 * useLibrary — the Library (Brain) view's logic seam.
 *
 * The ONLY place the redesigned Library + its tabs touch frozen logic. Wraps the exact entry points
 * Dashboard 1.0's LibraryView + inline tabs used, with identical arguments + the same raw SQL:
 *
 *   db/todos|ideas|expenses        → deleteTodo, deleteIdea, deleteExpense
 *   db/medications                 → listMedications, takenTimesToday, addMedication, logMedicationTaken, deactivateMedication
 *   processing/medicationReminders → scheduleMedReminders, cancelMedReminders
 *   db/reminders                   → listReminders, archiveReminder
 *   db/captures                    → listListenSessions, deleteCaptureCompletely (+ the gallery + listen-clip raw SELECTs)
 *   processing/listenDigest        → hasUnsummarizedListenCaptures, generateListenDigest
 *   processing/onlineResource      → listOnlineResources, deleteOnlineResource
 *   db/meetingSummaries            → listMeetingSummaries, deleteMeetingSummary
 *   processing/relationshipEngine  → getAllPersonContexts
 *   processing/privacy             → protectedPreview (pure, re-exported)
 *
 * No logic changed — behavior matches Library 1.0; the view/tabs own presentation/state.
 */
import { useCallback } from 'react';
import { getDatabase } from '../../db';
import { listListenSessions, type ListenSessionGroup } from '../../db/captures';
import { protectedPreview } from '../../processing/privacy';
import type { MedicationRow } from '../../db/medications';

export interface GalleryRow { id: number; source_image_path: string; extracted_title: string | null; created_at: string }
export interface ReminderLite { id: number; text: string; remind_at: string | null; urgency: string | null; recurrence: string | null }
export interface PersonContext { name: string; lastMentioned: string | null; mentionCount: number; typicalContext: string | null; pendingFollowUps: number }

export interface UseLibrary {
  protectedPreview: typeof protectedPreview;

  // Simple list deletes
  deleteTodo: (id: number) => Promise<void>;
  deleteIdea: (id: number) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;

  // Medications
  loadMedications: () => Promise<{ meds: MedicationRow[]; taken: Record<number, string[]> }>;
  addMedication: (name: string, dosage: string, times: string[]) => Promise<void>;
  markMedicationTaken: (id: number, time: string) => Promise<void>;
  removeMedication: (m: MedicationRow) => Promise<void>;

  // Gallery
  loadGallery: () => Promise<GalleryRow[]>;

  // Reminders tab
  loadReminders: () => Promise<ReminderLite[]>;
  dismissReminder: (id: number) => Promise<void>;

  // Listen
  loadListen: () => Promise<{ sessions: ListenSessionGroup[]; digestCount: number }>;
  loadListenClips: (captureIds: number[]) => Promise<string[]>;
  generateListenDigest: () => Promise<ListenSessionGroup[] | null>;
  deleteListenSession: (captureIds: number[]) => Promise<void>;

  // Resources
  loadResources: () => Promise<import('../../processing/onlineResource').OnlineResourceRow[]>;
  deleteResource: (id: number) => Promise<void>;

  // Meetings
  loadMeetings: () => Promise<import('../../db/meetingSummaries').MeetingSummaryRow[]>;
  deleteMeeting: (id: number) => Promise<void>;

  // People
  loadPeople: () => Promise<PersonContext[]>;
}

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

export function useLibrary(): UseLibrary {
  const deleteTodo = useCallback(async (id: number) => {
    const db = await getDatabase();
    const { deleteTodo: del } = await import('../../db/todos');
    await del(db, id);
  }, []);
  const deleteIdea = useCallback(async (id: number) => {
    const db = await getDatabase();
    const { deleteIdea: del } = await import('../../db/ideas');
    await del(db, id);
  }, []);
  const deleteExpense = useCallback(async (id: number) => {
    const db = await getDatabase();
    const { deleteExpense: del } = await import('../../db/expenses');
    await del(db, id);
  }, []);

  // ── Medications ──
  const loadMedications = useCallback(async () => {
    const db = await getDatabase();
    const { listMedications, takenTimesToday } = await import('../../db/medications');
    const meds = await listMedications(db);
    const taken: Record<number, string[]> = {};
    const dk = today();
    for (const m of meds) taken[m.id] = await takenTimesToday(db, m.id, dk);
    return { meds, taken };
  }, []);
  const addMedication = useCallback(async (name: string, dosage: string, times: string[]) => {
    const db = await getDatabase();
    const { addMedication: add, listMedications } = await import('../../db/medications');
    const id = await add(db, name, dosage, times, null);
    const { scheduleMedReminders } = await import('../../processing/medicationReminders');
    const fresh = (await listMedications(db)).find((m) => m.id === id);
    if (fresh) await scheduleMedReminders(fresh);
  }, []);
  const markMedicationTaken = useCallback(async (id: number, time: string) => {
    const db = await getDatabase();
    const { logMedicationTaken } = await import('../../db/medications');
    await logMedicationTaken(db, id, today(), time);
  }, []);
  const removeMedication = useCallback(async (m: MedicationRow) => {
    const db = await getDatabase();
    const { deactivateMedication } = await import('../../db/medications');
    const { cancelMedReminders } = await import('../../processing/medicationReminders');
    await cancelMedReminders(m);
    await deactivateMedication(db, m.id);
  }, []);

  // ── Gallery ──
  const loadGallery = useCallback(async (): Promise<GalleryRow[]> => {
    const db = await getDatabase();
    return db.getAllAsync<GalleryRow>(
      "SELECT id, source_image_path, extracted_title, created_at FROM captures WHERE source_image_path IS NOT NULL AND source_image_path != '' ORDER BY created_at DESC LIMIT 200",
    );
  }, []);

  // ── Reminders tab ──
  const loadReminders = useCallback(async (): Promise<ReminderLite[]> => {
    const db = await getDatabase();
    const { listReminders } = await import('../../db/reminders');
    const list = await listReminders(db);
    return list.map((r) => ({ id: r.id, text: r.text, remind_at: r.remind_at ?? null, urgency: (r as { urgency?: string | null }).urgency ?? null, recurrence: (r as { recurrence?: string | null }).recurrence ?? null }));
  }, []);
  const dismissReminder = useCallback(async (id: number) => {
    const db = await getDatabase();
    const { archiveReminder } = await import('../../db/reminders');
    await archiveReminder(db, id, 'dismissed from workspace');
  }, []);

  // ── Listen ──
  const loadListen = useCallback(async () => {
    const db = await getDatabase();
    const [sessions, digestCount] = await Promise.all([
      listListenSessions(db),
      import('../../processing/listenDigest').then(({ hasUnsummarizedListenCaptures }) => hasUnsummarizedListenCaptures(db)).catch(() => 0),
    ]);
    return { sessions, digestCount: digestCount as number };
  }, []);
  const loadListenClips = useCallback(async (captureIds: number[]): Promise<string[]> => {
    if (captureIds.length === 0) return [];
    const db = await getDatabase();
    const placeholders = captureIds.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ id: number; raw_transcript: string; extracted_title: string | null }>(
      `SELECT id, raw_transcript, extracted_title FROM captures WHERE id IN (${placeholders}) ORDER BY created_at ASC, id ASC`,
      ...captureIds,
    );
    return rows.map((r) => r.extracted_title ?? (r.raw_transcript ?? '').slice(0, 300));
  }, []);
  const generateListenDigest = useCallback(async (): Promise<ListenSessionGroup[] | null> => {
    const db = await getDatabase();
    const { generateListenDigest: gen } = await import('../../processing/listenDigest');
    const result = await gen(db);
    if (!result) return null;
    return listListenSessions(db);
  }, []);
  const deleteListenSession = useCallback(async (captureIds: number[]) => {
    const db = await getDatabase();
    const { deleteCaptureCompletely } = await import('../../db/captures');
    await Promise.all(captureIds.map((id) => deleteCaptureCompletely(db, id)));
  }, []);

  // ── Resources ──
  const loadResources = useCallback(async () => {
    const db = await getDatabase();
    const { listOnlineResources } = await import('../../processing/onlineResource');
    return listOnlineResources(db);
  }, []);
  const deleteResource = useCallback(async (id: number) => {
    const db = await getDatabase();
    const { deleteOnlineResource } = await import('../../processing/onlineResource');
    await deleteOnlineResource(db, id);
  }, []);

  // ── Meetings ──
  const loadMeetings = useCallback(async () => {
    const db = await getDatabase();
    const { listMeetingSummaries } = await import('../../db/meetingSummaries');
    return listMeetingSummaries(db);
  }, []);
  const deleteMeeting = useCallback(async (id: number) => {
    const db = await getDatabase();
    const { deleteMeetingSummary } = await import('../../db/meetingSummaries');
    await deleteMeetingSummary(db, id);
  }, []);

  // ── People ──
  const loadPeople = useCallback(async (): Promise<PersonContext[]> => {
    const { getAllPersonContexts } = await import('../../processing/relationshipEngine');
    const db = await getDatabase();
    return getAllPersonContexts(db);
  }, []);

  return {
    protectedPreview,
    deleteTodo, deleteIdea, deleteExpense,
    loadMedications, addMedication, markMedicationTaken, removeMedication,
    loadGallery, loadReminders, dismissReminder,
    loadListen, loadListenClips, generateListenDigest, deleteListenSession,
    loadResources, deleteResource, loadMeetings, deleteMeeting, loadPeople,
  };
}
