/**
 * useAsk — the Ask/Recall screen's logic seam.
 *
 * The ONLY place the redesigned Ask screen touches frozen logic. Wraps the exact entry points named in
 * docs/04_SEAM_REPORT.md (Ask row) with identical arguments and outcomes:
 *
 *   processing/ask             → askLucy
 *   processing/lucyActions     → executeActions, summarizeAction
 *   processing/insightEngine   → getStoredInsights, generateDailyInsights
 *   processing/automationEngine→ detectAutomationIntent, executeAction
 *   processing/artifactCleanup → isInvalidDeadline, isInvalidPendingTask
 *   processing/privacy         → protectedPreview
 *   processing/extract         → enqueueTranscript
 *
 * Plus the conversation-store calls Ask 1.0 used (db/askThreads) and the same lazily-imported insight
 * sources (healthInsights, deviceInsights) and scheduling.commitBlock. No logic is changed — behavior
 * matches Ask 1.0 exactly; presentation, copy and motion live in the screen.
 */
import { useCallback } from 'react';
import { getDatabase } from '../../db';
import {
  createAskThread,
  insertLucyAskMessage,
  insertUserAskMessage,
  listAskMessages,
  listAskThreads,
  type AskThreadSummaryRow,
} from '../../db/askThreads';
import { askLucy, type LucyAnswer } from '../../processing/ask';
import { executeActions, summarizeAction, type LucyAction } from '../../processing/lucyActions';
import { isInvalidDeadline, isInvalidPendingTask } from '../../processing/artifactCleanup';
import { protectedPreview } from '../../processing/privacy';
import { enqueueTranscript } from '../../processing/extract';
import { getStoredInsights, generateDailyInsights, type GeneratedInsight } from '../../processing/insightEngine';
import { detectAutomationIntent, executeAction, type ExtractedAction } from '../../processing/automationEngine';

export interface AskHistoryItem { role: 'user' | 'lucy'; content: string }

export interface UseAsk {
  // Conversation store (db/askThreads — same calls as Ask 1.0)
  startThread: (firstQuestion: string) => Promise<number>;
  saveUserMessage: (threadId: number, text: string) => Promise<void>;
  saveLucyMessage: (threadId: number, answer: LucyAnswer) => Promise<void>;
  loadThreads: () => Promise<AskThreadSummaryRow[]>;
  loadMessages: (threadId: number) => Promise<Awaited<ReturnType<typeof listAskMessages>>>;

  // Core Q&A (frozen) — captureCallback enqueues a thought mid-conversation (extract.enqueueTranscript)
  ask: (question: string, history: AskHistoryItem[]) => Promise<LucyAnswer>;

  // Automation (frozen)
  detectIntent: (text: string) => ExtractedAction | null;
  runAction: (action: ExtractedAction) => Promise<{ success: boolean; message: string }>;

  // Proposed-changes action plan (frozen)
  applyActions: (actions: LucyAction[]) => Promise<{ applied: number; summary: string }>;
  summarizeAction: (action: LucyAction) => string;

  // Insights (frozen + same lazily-imported sources as Ask 1.0)
  loadInsights: () => Promise<GeneratedInsight[]>;

  // Schedule-suggestion commit (scheduling.commitBlock — same call as Ask 1.0's ScheduleAnswerBubble)
  commitScheduleBlock: (block: { title: string; startMs: number; endMs: number }) => Promise<
    Awaited<ReturnType<(typeof import('../../scheduling'))['commitBlock']>>
  >;

  // Artifact filters + privacy preview (frozen, pure)
  isInvalidDeadline: typeof isInvalidDeadline;
  isInvalidPendingTask: typeof isInvalidPendingTask;
  protectedPreview: typeof protectedPreview;
}

export function useAsk(): UseAsk {
  const startThread = useCallback(async (firstQuestion: string): Promise<number> => {
    const db = await getDatabase();
    const thread = await createAskThread(db, firstQuestion.slice(0, 62));
    return thread.id;
  }, []);

  const saveUserMessage = useCallback(async (threadId: number, text: string) => {
    const db = await getDatabase();
    await insertUserAskMessage(db, threadId, text);
  }, []);

  const saveLucyMessage = useCallback(async (threadId: number, answer: LucyAnswer) => {
    const db = await getDatabase();
    await insertLucyAskMessage(db, threadId, answer);
  }, []);

  const loadThreads = useCallback(async () => {
    const db = await getDatabase();
    return listAskThreads(db);
  }, []);

  const loadMessages = useCallback(async (threadId: number) => {
    const db = await getDatabase();
    return listAskMessages(db, threadId);
  }, []);

  // askLucy with the exact captureCallback Ask 1.0 used (enqueue a captured thought mid-chat).
  const ask = useCallback(async (question: string, history: AskHistoryItem[]): Promise<LucyAnswer> => {
    const captureCallback = async (text: string) => { await enqueueTranscript(text, 'text', false); };
    return askLucy(question, captureCallback, history);
  }, []);

  const detectIntent = useCallback((text: string) => detectAutomationIntent(text), []);
  const runAction = useCallback((action: ExtractedAction) => executeAction(action), []);

  const applyActions = useCallback((actions: LucyAction[]) => executeActions(actions), []);

  const commitScheduleBlock = useCallback(
    async (block: { title: string; startMs: number; endMs: number }) => {
      const db = await getDatabase();
      const { commitBlock } = await import('../../scheduling');
      return commitBlock(db, block);
    },
    [],
  );

  // Insight loading — identical fallback chain to Ask 1.0 (HealthKit → device intelligence → daily),
  // including the same dedup-by-question heuristic.
  const loadInsights = useCallback(async (): Promise<GeneratedInsight[]> => {
    const db = await getDatabase();
    let stored = await getStoredInsights(db);

    const { generateHealthInsights } = await import('../../processing/healthInsights');
    const healthInsights = await generateHealthInsights().catch(() => [] as typeof stored);

    if (stored.length === 0) {
      const { generateDeviceIntelligence } = await import('../../processing/deviceInsights');
      const deviceReport = await generateDeviceIntelligence().catch(() => null);
      if (deviceReport) {
        const deviceInsights = [
          { question: 'What are my capture habits this week?', answer: deviceReport.captureRhythm, category: 'habits' as const, generatedAt: new Date().toISOString() },
          { question: 'What does my battery pattern reveal?', answer: deviceReport.batteryPattern, category: 'device' as const, generatedAt: new Date().toISOString() },
          { question: 'How does my mood connect to my activity?', answer: deviceReport.moodCorrelation, category: 'wellbeing' as const, generatedAt: new Date().toISOString() },
          { question: 'What\'s the most important thing I should notice?', answer: deviceReport.topInsight, category: 'habits' as const, generatedAt: new Date().toISOString() },
        ];
        stored = [...deviceInsights, ...stored];
      }
      if (stored.length === 0) {
        const generated = await generateDailyInsights(db);
        stored = generated;
      }
    }
    const seenQuestions = new Set<string>();
    const dedup = (list: typeof stored) => list.filter((ins) => {
      const key = ins.question.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
      if (seenQuestions.has(key)) return false;
      seenQuestions.add(key);
      return true;
    });
    return [...dedup(healthInsights), ...dedup(stored)];
  }, []);

  return {
    startThread,
    saveUserMessage,
    saveLucyMessage,
    loadThreads,
    loadMessages,
    ask,
    detectIntent,
    runAction,
    applyActions,
    summarizeAction,
    loadInsights,
    commitScheduleBlock,
    isInvalidDeadline,
    isInvalidPendingTask,
    protectedPreview,
  };
}
