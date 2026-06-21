/**
 * useSettings — the Settings screen's logic seam.
 *
 * The ONLY place the redesigned Settings screen + its panels/modals touch frozen logic. Wraps the exact
 * entry points named in docs/04_SEAM_REPORT.md (Settings row) with identical arguments and outcomes:
 *
 *   ai/device           → getDeviceModelState, prepareDeviceModel, selectDeviceModel,
 *                         subscribeToDeviceModel, clearDownloadedDeviceModels
 *   ai/modelCatalog     → localModelOptions
 *   ai/remoteAccess     → getRemoteAccessState (+ the lazily-imported key helpers 1.0 used:
 *                         getClaudeApiKey/storeClaudeApiKey/removeClaudeApiKey)
 *   ai/modelPreference  → getRoleModels, getTokenMode, persistRoleModel, loadRoleModels
 *   db/settings         → getSetting, setSetting
 *   db/userProfile      → getUserProfile, saveUserProfile
 *   db/captures         → getCaptureQueueSummary, getLowImportanceCaptures
 *   db/knowledge        → getLatestOrganizationRun
 *   processing/background→ getBackgroundProcessingState
 *   processing/benchmark→ runEnglishDeviceBenchmark
 *   processing/organizer→ organizeMemory
 *   voice/wakeWord      → wakeWord (status subscription)
 *   voice/tts           → listVoices, setVoice, getSelectedVoiceId, loadVoicePrefs, speak
 *
 * Plus the same lazily-imported modules Settings 1.0 reached for in handlers (memoryExport,
 * memoryImport, scheduling/availability, mealReminders, lucyWrapped, expo-updates, expo-document-picker,
 * expo-file-system/legacy, db/errorLog, ai/rateLimit, ai/provider, db/captures retry helpers). No logic
 * is changed — behavior matches Settings 1.0 exactly; presentation/copy/motion live in the screen.
 *
 * The big mutually-destructive flows that show a confirm before acting (Delete all, Reprocess all) keep
 * their native Alert in the screen — this hook exposes the underlying side-effecting calls so the screen
 * owns the confirm chrome.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  clearDownloadedDeviceModels, getDeviceModelState, prepareDeviceModel, selectDeviceModel,
  subscribeToDeviceModel, type DeviceModelState,
} from '../../ai/device';
import { type LocalModelId } from '../../ai/modelCatalog';
import { getRemoteAccessState, type RemoteAccessState } from '../../ai/remoteAccess';
import { getRoleModels, getTokenMode, persistRoleModel, type ModelRole } from '../../ai/modelPreference';
import { getDatabase } from '../../db';
import { getCaptureQueueSummary, getLowImportanceCaptures, type CaptureQueueSummary } from '../../db/captures';
import { getLatestOrganizationRun, type OrganizationRunRow } from '../../db/knowledge';
import { getSetting, setSetting } from '../../db/settings';
import { getBackgroundProcessingState, type BackgroundProcessingState } from '../../processing/background';
import { wakeWord, type WakeWordStatus } from '../../voice/wakeWord';
import { runEnglishDeviceBenchmark, type BenchmarkResult } from '../../processing/benchmark';
import { organizeMemory } from '../../processing/organizer';
import { getUserProfile, saveUserProfile, type UserProfile } from '../../db/userProfile';

const emptyQueue: CaptureQueueSummary = { queued: 0, processing: 0, retrying: 0, complete: 0, archived: 0 };
const emptyRemote: RemoteAccessState = { enabled: false, hasKey: false, usingDevelopmentKey: false, modelName: 'claude-sonnet-4-6' };

export interface SettingsData {
  queue: CaptureQueueSummary;
  background: BackgroundProcessingState | undefined;
  deviceModel: DeviceModelState;
  remote: RemoteAccessState;
  organizationRun: OrganizationRunRow | null;
  profile: UserProfile;
  roleModels: Record<ModelRole, string>;
  tokenMode: ReturnType<typeof getTokenMode>;
  hasClaudeKey: boolean;
  shieldLlm: boolean;
  checkInEnabled: boolean;
  alarmStyle: boolean;
  semanticRouter: boolean;
  mealReminders: boolean;
  dayShaped: boolean;
  lowNoteCount: number;
  wakeStatus: WakeWordStatus;
}

export interface UseSettings extends SettingsData {
  setQueue: React.Dispatch<React.SetStateAction<CaptureQueueSummary>>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  setRoleModels: React.Dispatch<React.SetStateAction<Record<ModelRole, string>>>;
  setHasClaudeKey: React.Dispatch<React.SetStateAction<boolean>>;
  setCheckInEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setDayShaped: React.Dispatch<React.SetStateAction<boolean>>;
  /** Bump to re-run the consolidated load (mirrors 1.0's localRefresh). */
  bumpRefresh: () => void;

  // Frozen-logic actions (each 1:1 with Settings 1.0)
  toggleSetting: (key: string, on: boolean) => Promise<void>;
  toggleAlarmStyle: () => Promise<void>;
  toggleMealReminders: () => Promise<void>;
  toggleSemanticRouter: () => Promise<void>;
  toggleShieldLlm: () => Promise<void>;
  prepareModel: () => Promise<void>;
  clearModel: () => Promise<void>;
  chooseModel: (modelId: LocalModelId) => Promise<void>;
  selectRoleModel: (role: ModelRole, modelId: string) => Promise<void>;
  selectPreset: (models: Record<ModelRole, string>) => Promise<void>;
  runBenchmark: (onProgress: (label: string) => void) => Promise<BenchmarkResult[]>;
  organizeNow: () => Promise<OrganizationRunRow | null>;
  saveProfile: (draft: UserProfile) => Promise<void>;
  verifyAndStoreClaudeKey: (key: string) => Promise<void>;
  removeClaudeKey: () => Promise<void>;
  reprocessAllMemories: (onReprocessAll: () => Promise<number>) => Promise<number>;
  deleteAllMemories: () => Promise<void>;
}

export function useSettings(args: {
  backgroundEnabled: boolean;
  refreshToken: number;
  voicePickerVisible: boolean;
}): UseSettings & { selectedVoiceName: string } {
  const { backgroundEnabled, refreshToken, voicePickerVisible } = args;

  const [queue, setQueue] = useState(emptyQueue);
  const [background, setBackground] = useState<BackgroundProcessingState>();
  const [deviceModel, setDeviceModel] = useState<DeviceModelState>(getDeviceModelState());
  const [remote, setRemote] = useState<RemoteAccessState>(emptyRemote);
  const [organizationRun, setOrganizationRun] = useState<OrganizationRunRow | null>(null);
  const [profile, setProfile] = useState<UserProfile>({ name: '', about: '', languages: [] });
  const [roleModels, setRoleModels] = useState<Record<ModelRole, string>>(getRoleModels());
  const [tokenMode, setTokenMode] = useState(getTokenMode());
  const [hasClaudeKey, setHasClaudeKey] = useState(false);
  const [shieldLlm, setShieldLlm] = useState(false);
  const [checkInEnabled, setCheckInEnabled] = useState(false);
  const [alarmStyle, setAlarmStyle] = useState(false);
  const [semanticRouter, setSemanticRouter] = useState(false);
  const [mealReminders, setMealReminders] = useState(false);
  const [dayShaped, setDayShaped] = useState(false);
  const [lowNoteCount, setLowNoteCount] = useState(0);
  const [wakeStatus, setWakeStatus] = useState<WakeWordStatus>(wakeWord.status);
  const [selectedVoiceName, setSelectedVoiceName] = useState('System default');
  const [localRefresh, setLocalRefresh] = useState(0);

  const bumpRefresh = useCallback(() => setLocalRefresh((v) => v + 1), []);

  useEffect(() => wakeWord.onStatusChange(setWakeStatus), []);
  useEffect(() => subscribeToDeviceModel(setDeviceModel), []);

  // Resolve the saved voice id to a friendly name (re-runs when the picker opens/closes) — same as 1.0.
  useEffect(() => {
    void (async () => {
      const { loadVoicePrefs, getSelectedVoiceId, listVoices } = await import('../../voice/tts');
      await loadVoicePrefs();
      const id = getSelectedVoiceId();
      if (!id) { setSelectedVoiceName('System default'); return; }
      const voices = await listVoices();
      setSelectedVoiceName(voices.find((v) => v.identifier === id)?.name ?? 'System default');
    })();
  }, [voicePickerVisible]);

  // Consolidated hydration — identical fan-out + settings reads to Settings 1.0's mount effect.
  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      const [queueSummary, state, latestRun, remoteState, userProfile] = await Promise.all([
        getCaptureQueueSummary(db),
        getBackgroundProcessingState(),
        getLatestOrganizationRun(db),
        getRemoteAccessState(),
        getUserProfile(db),
      ]);
      const { loadRoleModels } = await import('../../ai/modelPreference');
      await loadRoleModels(db);
      setRoleModels(getRoleModels());
      setTokenMode(getTokenMode());

      const { getClaudeApiKey } = await import('../../ai/remoteAccess');
      const ck = await getClaudeApiKey();
      setHasClaudeKey(!!ck);

      setQueue(queueSummary);
      setBackground(state);
      setOrganizationRun(latestRun);
      setRemote(remoteState);
      setProfile(userProfile);
      setCheckInEnabled(!!(await getSetting(db, 'progress_checkin_notification_id')));
      try {
        const { getAvailability } = await import('../../scheduling/availability');
        const av = await getAvailability(db);
        setDayShaped(!av.inferred && !!av.energyCurves);
      } catch { /* non-critical */ }
      try {
        setLowNoteCount((await getLowImportanceCaptures(db)).length);
      } catch { /* non-critical — count pill just hides */ }
      setShieldLlm((await getSetting(db, 'shield_use_local_llm')) === 'true');
      setAlarmStyle((await getSetting(db, 'alarm_style_enabled')) === 'on');
      setSemanticRouter((await getSetting(db, 'semantic_router_enabled')) !== 'off');
      setMealReminders((await getSetting(db, 'meal_reminders_enabled')) === 'on');
    })();
  }, [backgroundEnabled, localRefresh, refreshToken]);

  // ── Settings toggles (frozen db/settings + same side effects as 1.0) ──
  const toggleSetting = useCallback(async (key: string, on: boolean) => {
    const db = await getDatabase();
    await setSetting(db, key, on ? 'on' : 'off');
  }, []);

  const toggleAlarmStyle = useCallback(async () => {
    const next = !alarmStyle;
    setAlarmStyle(next);
    const db = await getDatabase();
    await setSetting(db, 'alarm_style_enabled', next ? 'on' : 'off');
  }, [alarmStyle]);

  const toggleMealReminders = useCallback(async () => {
    const next = !mealReminders;
    setMealReminders(next);
    const db = await getDatabase();
    await setSetting(db, 'meal_reminders_enabled', next ? 'on' : 'off');
    try {
      const { scheduleMealReminders, cancelMealReminders } = await import('../../processing/mealReminders');
      if (next) await scheduleMealReminders(); else await cancelMealReminders();
    } catch { /* non-critical */ }
  }, [mealReminders]);

  const toggleSemanticRouter = useCallback(async () => {
    const next = !semanticRouter;
    setSemanticRouter(next);
    const db = await getDatabase();
    await setSetting(db, 'semantic_router_enabled', next ? 'on' : 'off');
  }, [semanticRouter]);

  const toggleShieldLlm = useCallback(async () => {
    const db = await getDatabase();
    const next = !shieldLlm;
    await setSetting(db, 'shield_use_local_llm', next ? 'true' : 'false');
    setShieldLlm(next);
  }, [shieldLlm]);

  // ── On-device model (frozen ai/device) ──
  const prepareModel = useCallback(async () => {
    await prepareDeviceModel().catch(() => { /* service publishes its actionable error */ });
  }, []);
  const clearModel = useCallback(async () => {
    await clearDownloadedDeviceModels().catch(() => { /* keeping a downloaded model is recoverable */ });
  }, []);
  const chooseModel = useCallback(async (modelId: LocalModelId) => {
    if (modelId === getDeviceModelState().modelId) return;
    await selectDeviceModel(modelId);
  }, []);

  // ── Model preferences (frozen ai/modelPreference) ──
  const selectRoleModel = useCallback(async (role: ModelRole, modelId: string) => {
    const db = await getDatabase();
    await persistRoleModel(db, role, modelId);
    setRoleModels(getRoleModels());
  }, []);
  const selectPreset = useCallback(async (models: Record<ModelRole, string>) => {
    const db = await getDatabase();
    await Promise.all((Object.keys(models) as ModelRole[]).map((r) => persistRoleModel(db, r, models[r])));
    setRoleModels(getRoleModels());
  }, []);

  // ── Benchmark (frozen) — returns results; screen owns progress/labels ──
  const runBenchmark = useCallback(async (onProgress: (label: string) => void) => {
    const results = await runEnglishDeviceBenchmark((complete, total) => {
      onProgress(`Running check ${Math.min(complete + 1, total)} of ${total}...`);
    });
    return results;
  }, []);

  // ── Organize now (frozen organizer + re-read latest run) ──
  const organizeNow = useCallback(async () => {
    const db = await getDatabase();
    await organizeMemory(db, 'manual');
    const run = await getLatestOrganizationRun(db);
    setOrganizationRun(run);
    setLocalRefresh((v) => v + 1);
    return run;
  }, []);

  // ── Profile (frozen db/userProfile) ──
  const saveProfile = useCallback(async (draft: UserProfile) => {
    const db = await getDatabase();
    await saveUserProfile(db, draft);
    setProfile(draft);
  }, []);

  // ── BYOK Claude key — same verify-before-save call as 1.0 (test message to Anthropic) ──
  const verifyAndStoreClaudeKey = useCallback(async (key: string) => {
    const testRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': key,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    if (!testRes.ok) {
      const err = await testRes.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err.error?.message ?? `Anthropic returned status ${testRes.status}`);
    }
    const { storeClaudeApiKey } = await import('../../ai/remoteAccess');
    await storeClaudeApiKey(key);
    setHasClaudeKey(true);
  }, []);
  const removeClaudeKey = useCallback(async () => {
    const { removeClaudeApiKey } = await import('../../ai/remoteAccess');
    await removeClaudeApiKey();
    setHasClaudeKey(false);
  }, []);

  // ── Reprocess all (frozen) — confirm chrome lives in the screen ──
  const reprocessAllMemories = useCallback(async (onReprocessAll: () => Promise<number>) => {
    const count = await onReprocessAll();
    setLocalRefresh((v) => v + 1);
    return count;
  }, []);

  // ── Delete all memories — identical bulk wipe (FK off for the transaction) to 1.0 ──
  const deleteAllMemories = useCallback(async () => {
    const db = await getDatabase();
    const tables = [
      'todos', 'reminders', 'expenses', 'ideas', 'places',
      'people', 'interests', 'open_loops', 'follow_ups', 'context_requests',
      'knowledge_entities', 'knowledge_connections', 'knowledge_insights',
      'organization_runs', 'extractions', 'capture_embeddings',
      'person_contexts', 'mood_entries', 'questions', 'ask_threads',
      'ask_messages', 'battery_snapshots', 'music_captures',
      // captures last — child tables (and its own parent_capture_id self-reference) reference it.
      'captures',
    ];
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      await db.withTransactionAsync(async () => {
        for (const table of tables) {
          await db.runAsync(`DELETE FROM ${table}`).catch(() => { /* table may not exist */ });
        }
      });
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON;');
    }
    setLocalRefresh((v) => v + 1);
  }, []);

  return {
    queue, background, deviceModel, remote, organizationRun, profile, roleModels, tokenMode,
    hasClaudeKey, shieldLlm, checkInEnabled, alarmStyle, semanticRouter, mealReminders, dayShaped,
    lowNoteCount, wakeStatus, selectedVoiceName,
    setQueue, setProfile, setRoleModels, setHasClaudeKey, setCheckInEnabled, setDayShaped, bumpRefresh,
    toggleSetting, toggleAlarmStyle, toggleMealReminders, toggleSemanticRouter, toggleShieldLlm,
    prepareModel, clearModel, chooseModel, selectRoleModel, selectPreset, runBenchmark, organizeNow,
    saveProfile, verifyAndStoreClaudeKey, removeClaudeKey, reprocessAllMemories, deleteAllMemories,
  };
}
