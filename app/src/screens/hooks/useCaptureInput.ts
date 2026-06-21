/**
 * useCaptureInput — the Capture screen's logic seam.
 *
 * This hook is the ONLY place the redesigned Capture screen touches frozen logic. It wraps the exact
 * entry points named in docs/04_SEAM_REPORT.md (Capture row) with identical arguments and outcomes:
 *
 *   processing/extract          → enqueueTranscript, analyzeTranscript
 *   processing/automationEngine → detectAutomationIntent, executeAction
 *   audio/micCoordinator        → acquireMic, releaseMic
 *   voice/wakeWord              → wakeWord
 *   voice/onDeviceSpeech        → resolveSpeechMode
 *   db/todos                    → listPendingTodos, archiveTodo
 *   db/projects                 → listProjects, assignTodoToProject
 *   types                       → ExtractionResult, ExtractedAction, TodoRow, ProjectRow
 *
 * Presentation (the screen) calls these handlers; the handlers call frozen logic. No logic is changed
 * here — behavior is preserved 1:1 with Capture 1.0. Animations, haptics, and copy live in the screen.
 *
 * `getRemoteAccessState` is listed as available in the Capture seam row, but Capture 1.0 imports it
 * without ever calling it — so for true parity (no more, no less) this hook does not call it either.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { acquireMic, releaseMic } from '../../audio/micCoordinator';
import { wakeWord } from '../../voice/wakeWord';
import { resolveSpeechMode } from '../../voice/onDeviceSpeech';
import { getDatabase } from '../../db';
import { listPendingTodos, archiveTodo, type TodoRow } from '../../db/todos';
import { listProjects, assignTodoToProject, type ProjectRow } from '../../db/projects';
import { enqueueTranscript, analyzeTranscript } from '../../processing/extract';
import { detectAutomationIntent, executeAction, type ExtractedAction } from '../../processing/automationEngine';
import type { ExtractionResult } from '../../types/extraction';

export interface CaptureStats {
  capturedToday: number;
  captureStreak: number;
  nextEvent: { title: string; start_at: number } | null;
}

export interface UseCaptureInputOptions {
  /** Called with each final voice transcript chunk so the screen can append it to the composer. */
  onTranscript: (text: string) => void;
}

export interface UseCaptureInput {
  // Board data (read via frozen db listers + capture stats)
  todos: TodoRow[];
  setTodos: React.Dispatch<React.SetStateAction<TodoRow[]>>;
  projects: ProjectRow[];
  userName: string;
  stats: CaptureStats;

  // Voice
  voiceRecording: boolean;
  toggleVoiceInput: () => Promise<void>;

  // Receipt scan
  scanningReceipt: boolean;
  scanReceipt: () => Promise<{ text: string } | null>;
  consumeReceiptImage: () => string | null;

  // Automation (frozen)
  detectIntent: (text: string) => ExtractedAction | null;
  runAction: (action: ExtractedAction) => Promise<{ success: boolean; message: string }>;

  // Capture pipeline (frozen)
  enqueue: (text: string, source: 'text', markedPrivate: boolean) => Promise<number>;
  analyze: (text: string) => Promise<ExtractionResult>;
  attachImageToCapture: (captureId: number, imagePath: string) => Promise<void>;

  // Todo mutations — same frozen db calls + raw SQL as 1.0
  archiveTodoById: (id: number, note: string) => Promise<void>;
  renameTodo: (id: number, task: string) => Promise<void>;
  assignTodoProject: (id: number, projectId: number | null) => Promise<void>;
  addTodoToList: (task: string, listLabel: string) => Promise<TodoRow | null>;
}

export function useCaptureInput({ onTranscript }: UseCaptureInputOptions, refreshToken: number): UseCaptureInput {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [userName, setUserName] = useState('');
  const [stats, setStats] = useState<CaptureStats>({ capturedToday: 0, captureStreak: 0, nextEvent: null });
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const pendingReceiptImage = useRef<string | null>(null);
  const speechSubscriptions = useRef<Array<{ remove(): void }>>([]);

  // Keep the latest transcript callback without resubscribing the recognizer.
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // ── Board load — identical queries to Capture 1.0 (frozen listers + raw capture stats) ──
  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      const [pendingTodosResult, projectsResult, { getUserProfile }] = await Promise.all([
        listPendingTodos(db),
        listProjects(db),
        import('../../db/userProfile'),
      ]);
      setTodos(pendingTodosResult);
      setProjects(projectsResult);
      const profile = await getUserProfile(db);
      setUserName(profile.name || '');
      const todayRow = await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM captures WHERE date(created_at) = date('now') AND archived_at IS NULL`,
      );
      const capturedToday = todayRow?.n ?? 0;
      const dayRows = await db.getAllAsync<{ d: string }>(
        `SELECT DISTINCT date(created_at) AS d FROM captures WHERE archived_at IS NULL AND created_at >= datetime('now', '-30 days') ORDER BY d DESC`,
      );
      let streak = 0;
      const today = new Date().toISOString().slice(0, 10);
      for (let i = 0; i < dayRows.length; i++) {
        const expected = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        if (dayRows[i].d === expected) streak++;
        else break;
      }
      const captureStreak = dayRows[0]?.d === today ? streak : 0;
      let nextEvent: CaptureStats['nextEvent'] = null;
      try {
        const now = Date.now();
        const evRow = await db.getFirstAsync<{ title: string; start_at: number }>(
          "SELECT title, start_at FROM scheduled_blocks WHERE status='committed' AND start_at > ? ORDER BY start_at ASC LIMIT 1",
          now,
        );
        nextEvent = evRow && evRow.start_at < now + 36 * 3600 * 1000 ? evRow : null;
      } catch { /* non-critical */ }
      setStats({ capturedToday, captureStreak, nextEvent });
    })();
  }, [refreshToken]);

  // ── Capture pipeline (frozen) ──
  const enqueue = useCallback(
    (text: string, source: 'text', markedPrivate: boolean) => enqueueTranscript(text, source, markedPrivate),
    [],
  );
  const analyze = useCallback((text: string) => analyzeTranscript(text), []);
  const attachImageToCapture = useCallback(async (captureId: number, imagePath: string) => {
    const db = await getDatabase();
    const { setCaptureSourceImage } = await import('../../db/captures');
    await setCaptureSourceImage(db, captureId, imagePath);
  }, []);

  // ── Automation (frozen) ──
  const detectIntent = useCallback((text: string) => detectAutomationIntent(text), []);
  const runAction = useCallback((action: ExtractedAction) => executeAction(action), []);

  // ── Receipt staging (frozen receiptScan; image link consumed by next sendCapture) ──
  const consumeReceiptImage = useCallback(() => {
    const img = pendingReceiptImage.current;
    pendingReceiptImage.current = null;
    return img;
  }, []);
  const scanReceipt = useCallback(async () => {
    setScanningReceipt(true);
    try {
      const { scanReceiptToText } = await import('../../processing/receiptScan');
      const scanned = await scanReceiptToText();
      if (scanned) {
        pendingReceiptImage.current = scanned.imagePath;
        return { text: scanned.text };
      }
      return null;
    } finally {
      setScanningReceipt(false);
    }
  }, []);

  // ── Todo mutations — same frozen db calls + raw SQL as 1.0 ──
  const archiveTodoById = useCallback(async (id: number, note: string) => {
    const db = await getDatabase();
    await archiveTodo(db, id, note);
  }, []);
  const renameTodo = useCallback(async (id: number, task: string) => {
    const db = await getDatabase();
    await db.runAsync('UPDATE todos SET task = ? WHERE id = ?', task, id);
  }, []);
  const assignTodoProject = useCallback(async (id: number, projectId: number | null) => {
    const db = await getDatabase();
    await assignTodoToProject(db, id, projectId);
  }, []);
  const addTodoToList = useCallback(async (task: string, listLabel: string): Promise<TodoRow | null> => {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO todos (task, category, urgency, context, privacy_level, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      task, 'other', 'medium', listLabel, 'normal', new Date().toISOString(),
    );
    return db.getFirstAsync<TodoRow>('SELECT * FROM todos WHERE id = last_insert_rowid()');
  }, []);

  // ── Voice input — preserves Capture 1.0's mic-coordination + speech orchestration exactly ──
  const toggleVoiceInput = useCallback(async (): Promise<void> => {
    const clearSpeechSubscriptions = () => {
      for (const subscription of speechSubscriptions.current) subscription.remove();
      speechSubscriptions.current = [];
    };

    if (voiceRecording) {
      setVoiceRecording(false);
      if (speechSubscriptions.current.length > 0) {
        try { ExpoSpeechRecognitionModule.stop(); } catch { /* already stopped */ }
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
        clearSpeechSubscriptions();
      }
      releaseMic('capture'); // let the "Hey Lucy" wake word resume
      return;
    }

    // Take the single native recognizer from the low-priority wake word BEFORE starting (audio-session
    // conflict avoidance — identical to 1.0).
    const wakeWasActive = wakeWord.isEnabled;
    acquireMic('capture');
    if (wakeWasActive) { await new Promise<void>((resolve) => setTimeout(resolve, 350)); }

    try {
      const microphonePermission = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
      if (!microphonePermission.granted) {
        releaseMic('capture');
        Alert.alert(
          'Microphone access needed',
          'LUCY needs microphone access to record voice. Go to Settings → Apps → LUCY → Microphone and turn it on.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      const recognitionReady = Platform.OS === 'ios'
        ? ExpoSpeechRecognitionModule.isRecognitionAvailable() && ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()
        : ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (recognitionReady) {
        const { getOnDeviceSpeechLocale, getUserProfile } = await import('../../db/userProfile');
        const db = await getDatabase();
        const profile = await getUserProfile(db);
        const locale = getOnDeviceSpeechLocale(profile);
        const { onDevice } = await resolveSpeechMode(locale);
        clearSpeechSubscriptions();
        speechSubscriptions.current = [
          ExpoSpeechRecognitionModule.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
            if (!event.isFinal) return;
            const transcript = event.results[0]?.transcript.trim() ?? '';
            if (transcript) onTranscriptRef.current(transcript);
          }),
          ExpoSpeechRecognitionModule.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
            if (event.error === 'aborted' || event.error === 'no-speech') return;
            clearSpeechSubscriptions();
            setVoiceRecording(false);
            releaseMic('capture');
            // No raw recognizer error code surfaced (No Scary States) — identical to 1.0.
            Alert.alert("Didn't catch that", 'You can tap the mic to try again, or type your thought below.');
          }),
          ExpoSpeechRecognitionModule.addListener('end', () => {
            clearSpeechSubscriptions();
            setVoiceRecording(false);
            releaseMic('capture'); // recognizer finished — let the wake word resume
          }),
        ];
        ExpoSpeechRecognitionModule.start({
          lang: locale,
          interimResults: false,
          maxAlternatives: 1,
          continuous: false,
          requiresOnDeviceRecognition: onDevice,
          addsPunctuation: true,
        });
      } else {
        releaseMic('capture');
        Alert.alert(
          'Voice input unavailable',
          'This device doesn’t have a speech recognizer available. You can still type your thought below.',
        );
        return;
      }
      setVoiceRecording(true);
    } catch (error) {
      clearSpeechSubscriptions();
      releaseMic('capture');
      Alert.alert('Could not start recording', error instanceof Error ? error.message : 'Check microphone permission in Settings → LUCY.');
    }
  }, [voiceRecording]);

  return {
    todos,
    setTodos,
    projects,
    userName,
    stats,
    voiceRecording,
    toggleVoiceInput,
    scanningReceipt,
    scanReceipt,
    consumeReceiptImage,
    detectIntent,
    runAction,
    enqueue,
    analyze,
    attachImageToCapture,
    archiveTodoById,
    renameTodo,
    assignTodoProject,
    addTodoToList,
  };
}
