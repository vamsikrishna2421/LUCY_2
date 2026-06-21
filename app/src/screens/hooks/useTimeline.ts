/**
 * useTimeline — the Timeline view's logic seam.
 *
 * The ONLY place the redesigned Timeline touches frozen logic. Wraps the exact entry points Timeline
 * 1.0 (inside Dashboard.tsx) used, with identical arguments + the same raw SQL:
 *
 *   processing/extract          → enqueueTranscript
 *   processing/automationEngine → detectAutomationIntent, executeAction
 *   processing/privacy          → protectedPreview (re-exported for the view)
 *   processing/vectorSearch     → findSimilarCaptures (search)
 *   processing/organizer        → organizeMemory (after delete)
 *   db/captures                 → assignCaptureToProject, setCaptureSourceImage, resetCaptureForReprocess,
 *                                 deleteCaptureCompletely, getLatestExtractionForCapture(via db/extractions)
 *   db/projects                 → listProjects
 *   db/learnedProfile           → upsertLearnedFact (durable preference/correction from feedback)
 *   processing/receiptScan      → scanReceiptToText
 *   processing/imageCapture     → snapImageToMemory
 *   ai/provider                 → getModelKeyStatus, modelKeyMissingMessage
 *   + the same raw SELECTs for pending_actions + latest note_types, and the feedback re-queue UPDATE.
 *
 * No logic changed — behavior matches Timeline 1.0; the view owns presentation/motion/state.
 */
import { useCallback, useState } from 'react';
import { getDatabase } from '../../db';
import { assignCaptureToProject, type CaptureRow } from '../../db/captures';
import { listProjects, type ProjectRow } from '../../db/projects';
import { enqueueTranscript } from '../../processing/extract';
import { detectAutomationIntent, executeAction, type ExtractedAction } from '../../processing/automationEngine';
import { protectedPreview } from '../../processing/privacy';
import type { ExtractionResult } from '../../types/extraction';

export interface UseTimeline {
  protectedPreview: typeof protectedPreview;
  loadProjects: () => Promise<ProjectRow[]>;
  /** pending_actions (LLM "can do" banners) keyed by capture id. */
  loadLlmActions: () => Promise<Record<number, ExtractedAction>>;
  /** Latest note_type per processed capture (single cheap query). */
  loadNoteTypes: (captures: CaptureRow[]) => Promise<Record<number, string>>;
  loadExtraction: (captureId: number) => Promise<ExtractionResult | null>;
  search: (query: string) => Promise<CaptureRow[]>;
  detectIntent: (text: string) => ExtractedAction | null;
  runAction: (action: ExtractedAction) => Promise<{ success: boolean; message: string }>;
  /** Remove a confirmed/dismissed LLM action banner row. */
  clearPendingAction: (captureId: number) => Promise<void>;
  enqueue: (text: string) => Promise<number>;
  attachImage: (captureId: number, imagePath: string) => Promise<void>;
  pinToProject: (captureId: number, projectId: number | null) => Promise<void>;
  reprocess: (captureId: number) => Promise<void>;
  deleteCapture: (captureId: number) => Promise<void>;
  submitCorrection: (capture: CaptureRow, text: string) => Promise<void>;
  scanReceipt: () => Promise<{ text: string; imagePath: string | null } | null>;
  snapImage: (onProgress: (v: boolean) => void) => Promise<boolean>;
  checkModelKey: () => Promise<{ ok: true } | { ok: false; message: string }>;
}

export function useTimeline(): UseTimeline {
  const loadProjects = useCallback(async () => {
    try { const db = await getDatabase(); return await listProjects(db); } catch { return []; }
  }, []);

  const loadLlmActions = useCallback(async (): Promise<Record<number, ExtractedAction>> => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<{ capture_id: number; action_json: string }>('SELECT capture_id, action_json FROM pending_actions');
      const map: Record<number, ExtractedAction> = {};
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.action_json) as ExtractedAction;
          if (parsed.type && parsed.displayText) map[row.capture_id] = { ...parsed, confidence: 0.95 };
        } catch { /* skip malformed */ }
      }
      return map;
    } catch { return {}; }
  }, []);

  const loadNoteTypes = useCallback(async (captures: CaptureRow[]): Promise<Record<number, string>> => {
    try {
      const ids = captures.filter((c) => c.processed === 1).map((c) => c.id);
      if (ids.length === 0) return {};
      const db = await getDatabase();
      const eRows = await db.getAllAsync<{ capture_id: number; structured_json: string }>(
        `SELECT e.capture_id, e.structured_json FROM extractions e
         INNER JOIN (SELECT capture_id, MAX(id) AS eid FROM extractions GROUP BY capture_id) latest
         ON latest.eid = e.id
         WHERE e.capture_id IN (${ids.map(() => '?').join(',')})`,
        ...ids,
      );
      const ntMap: Record<number, string> = {};
      for (const r of eRows) {
        try { const p = JSON.parse(r.structured_json) as { note_type?: string }; if (p.note_type) ntMap[r.capture_id] = p.note_type; } catch { /* skip */ }
      }
      return ntMap;
    } catch { return {}; }
  }, []);

  const loadExtraction = useCallback(async (captureId: number): Promise<ExtractionResult | null> => {
    try {
      const db = await getDatabase();
      const { getLatestExtractionForCapture } = await import('../../db/extractions');
      const json = await getLatestExtractionForCapture(db, captureId);
      return json ? (JSON.parse(json) as ExtractionResult) : null;
    } catch { return null; }
  }, []);

  const search = useCallback(async (query: string): Promise<CaptureRow[]> => {
    const { findSimilarCaptures } = await import('../../processing/vectorSearch');
    const db = await getDatabase();
    const results = await findSimilarCaptures(db, query, 10, 0.1);
    return results.map((r) => r.capture);
  }, []);

  const detectIntent = useCallback((text: string) => detectAutomationIntent(text), []);
  const runAction = useCallback((action: ExtractedAction) => executeAction(action), []);

  const clearPendingAction = useCallback(async (captureId: number) => {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM pending_actions WHERE capture_id = ?', captureId);
  }, []);

  const enqueue = useCallback((text: string) => enqueueTranscript(text, 'text', false), []);
  const attachImage = useCallback(async (captureId: number, imagePath: string) => {
    const db = await getDatabase();
    const { setCaptureSourceImage } = await import('../../db/captures');
    await setCaptureSourceImage(db, captureId, imagePath);
  }, []);

  const pinToProject = useCallback(async (captureId: number, projectId: number | null) => {
    const db = await getDatabase();
    await assignCaptureToProject(db, captureId, projectId);
  }, []);

  const reprocess = useCallback(async (captureId: number) => {
    const db = await getDatabase();
    const { resetCaptureForReprocess } = await import('../../db/captures');
    await resetCaptureForReprocess(db, captureId);
  }, []);

  const deleteCapture = useCallback(async (captureId: number) => {
    const db = await getDatabase();
    const { deleteCaptureCompletely } = await import('../../db/captures');
    await deleteCaptureCompletely(db, captureId, 'deleted by user');
    // Rebuild the knowledge projection so the deleted memory leaves the Brain too.
    try {
      const { organizeMemory } = await import('../../processing/organizer');
      await organizeMemory(db, 'after-delete');
    } catch { /* non-critical — derived rows already purged */ }
  }, []);

  // Correct-a-memory: append context to the SAME capture + re-queue (no new memory), and if the note
  // reads like a durable instruction, remember it as a learned fact — identical to Timeline 1.0.
  const submitCorrection = useCallback(async (capture: CaptureRow, text: string) => {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE captures SET
         raw_transcript = raw_transcript || '\n\n[Added context: ' || ? || ']',
         processed = 0, processing_error = NULL, attempt_count = 0,
         extracted_title = NULL, structured_text = NULL
       WHERE id = ?`,
      text, capture.id,
    );
    if (/\b(always|never|don'?t|do not|stop|please keep|i prefer|i like|i hate|make sure|from now on|in future|going forward|remember to)\b/i.test(text)) {
      try {
        const { upsertLearnedFact } = await import('../../db/learnedProfile');
        await upsertLearnedFact(db, /\b(don'?t|do not|stop|never)\b/i.test(text) ? 'correction' : 'preference', text, 'feedback');
      } catch { /* non-critical */ }
    }
  }, []);

  const scanReceipt = useCallback(async () => {
    const { scanReceiptToText } = await import('../../processing/receiptScan');
    return scanReceiptToText();
  }, []);

  const snapImage = useCallback(async (onProgress: (v: boolean) => void) => {
    const { snapImageToMemory } = await import('../../processing/imageCapture');
    return snapImageToMemory(onProgress);
  }, []);

  const checkModelKey = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { getModelKeyStatus, modelKeyMissingMessage } = await import('../../ai/provider');
    const status = await getModelKeyStatus();
    if (status.remote && !status.keyPresent) return { ok: false, message: modelKeyMissingMessage(status) };
    return { ok: true };
  }, []);

  return {
    protectedPreview, loadProjects, loadLlmActions, loadNoteTypes, loadExtraction, search, detectIntent,
    runAction, clearPendingAction, enqueue, attachImage, pinToProject, reprocess, deleteCapture,
    submitCorrection, scanReceipt, snapImage, checkModelKey,
  };
}
