/**
 * Settings — LUCY 2.0 control center, rebuilt on the design system (app/src/ui).
 *
 * Decomposed for clarity (this orchestrator stays well under the file-size limit):
 *   hooks/useSettings           — the frozen-logic seam (data load + every mutation; docs/04 Settings row)
 *   settings/SettingsPrimitives — the calm accordion `SettingsGroup` + `SettingsRow`
 *   settings/SettingsPanels     — the BottomSheet detail panels (intelligence/background/…/queue/profile)
 *   settings/SettingsModals     — Siri guide, voice picker, per-role model picker
 *   settings/models             — shared Claude-first model catalog
 *
 * Every Settings 1.0 capability is preserved: You & profile (about/check-ins/alarm-ring/meal/smarter-
 * answers/scheduled-reminders/guided-tour), Your day & energy (Shape your day), AI & intelligence
 * (presets + per-agent model picks + BYOK Anthropic key + on-device intel + background organizing +
 * re-organize + processing queue), Voice (wake word/voice/Siri), Connections (connectors + calendar +
 * laptop access), Storage (free up space), Privacy & data (privacy/Wrapped/export JSON+MD/import/delete
 * all), About & updates, Developer (AI call log). Destructive flows keep their confirm Alert; success
 * uses the design-system surfaces. The exported `SettingsScreen` name + props are unchanged so App.tsx
 * needs no edit.
 */
import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, View } from 'react-native';
import { shareAsync } from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast, Text, Row, Stack, Spacer, Button, BottomSheet, useTheme } from '../ui';
import { config } from '../config';
import { getDatabase } from '../db';
import { DevLogViewer } from '../components/DevLogViewer';
import { CheckInScheduler } from '../components/CheckInScheduler';
import { DayShaper } from '../components/DayShaper';
import { FreeUpSpace } from '../components/FreeUpSpace';
import { ScheduledRemindersManager } from '../components/ScheduledRemindersManager';
import { LaptopAccessPanel } from '../components/LaptopAccessPanel';
import type { ModelRole } from '../ai/modelPreference';
import type { UserProfile } from '../db/userProfile';
import { useSettings } from './hooks/useSettings';
import { SettingsGroup, SettingsRow } from './settings/SettingsPrimitives';
import { IntelligenceModelsBlock } from './settings/IntelligenceModelsBlock';
import {
  IntelligencePanel, BackgroundPanel, OrganizationPanel, PrivacyPanel, ProfilePanel, ConnectorsPanel,
  QueuePanel,
} from './settings/SettingsPanels';
import { SiriShortcutGuide, VoicePicker, RolePickerModal } from './settings/SettingsModals';

interface SettingsScreenProps {
  backgroundEnabled: boolean;
  refreshToken: number;
  onChangeBackground: (enabled: boolean) => Promise<boolean>;
  onReprocessAll: () => Promise<number>;
  onOpenWrapped?: () => void;
  wakeWordEnabled: boolean;
  onChangeWakeWord: (enabled: boolean) => Promise<void>;
  onStartTour?: () => void;
}

type SettingsPanel = 'intelligence' | 'background' | 'organization' | 'queue' | 'privacy' | 'profile' | 'connectors' | null;

function panelTitle(panel: SettingsPanel): string {
  switch (panel) {
    case 'connectors': return 'Connectors & permissions';
    case 'profile': return 'About you';
    case 'intelligence': return 'On-device intelligence';
    case 'background': return 'Background organizing';
    case 'organization': return 'Re-organize now';
    case 'queue': return 'Processing queue';
    case 'privacy': return 'Privacy';
    default: return '';
  }
}

// ToastProvider is mounted once at the app root (App.tsx); `useToast` resolves there. Settings is
// always rendered under that root, so no local provider is needed.
export function SettingsScreen({
  backgroundEnabled, refreshToken, onChangeBackground, onReprocessAll, onOpenWrapped,
  wakeWordEnabled, onChangeWakeWord, onStartTour,
}: SettingsScreenProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  // Screen-owned UI state (modals/panels/drafts). All logic state lives in the seam hook.
  const [activePanel, setActivePanel] = useState<SettingsPanel>(null);
  const [devLogVisible, setDevLogVisible] = useState(false);
  const [checkInSchedulerVisible, setCheckInSchedulerVisible] = useState(false);
  const [remindersManagerVisible, setRemindersManagerVisible] = useState(false);
  const [siriGuideVisible, setSiriGuideVisible] = useState(false);
  const [voicePickerVisible, setVoicePickerVisible] = useState(false);
  const [dayShaperVisible, setDayShaperVisible] = useState(false);
  const [freeUpSpaceVisible, setFreeUpSpaceVisible] = useState(false);
  const [pickerRole, setPickerRole] = useState<ModelRole | null>(null);
  const [profileDraft, setProfileDraft] = useState<UserProfile>({ name: '', about: '', languages: [] });
  const [savingProfile, setSavingProfile] = useState(false);
  const [claudeKey, setClaudeKey] = useState('');
  const [savingClaudeKey, setSavingClaudeKey] = useState(false);
  const [changingBackground, setChangingBackground] = useState(false);
  const [organizingNow, setOrganizingNow] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const s = useSettings({ backgroundEnabled, refreshToken, voicePickerVisible });

  const usesDeviceModel = config.localInference === 'device';
  const deviceModel = s.deviceModel;
  const modelStatus = deviceModel.status === 'ready' ? 'Ready on this device'
    : deviceModel.status === 'downloading' ? `Preparing ${Math.round(deviceModel.progress * 100)}%`
    : deviceModel.status === 'unavailable' ? 'Unavailable on this device'
    : deviceModel.status === 'error' ? 'Setup needs attention'
    : 'Not prepared';
  const waiting = s.queue.queued + s.queue.processing + s.queue.retrying;
  const runSummary = s.organizationRun
    ? `Last run ${new Date(`${s.organizationRun.created_at.replace(' ', 'T')}Z`).toLocaleString()}`
    : 'Not run yet';

  // ── Background toggle (frozen via App callback + hook refresh) ──
  const changeBackground = async () => {
    setChangingBackground(true);
    try {
      await onChangeBackground(!backgroundEnabled);
      s.bumpRefresh();
    } finally {
      setChangingBackground(false);
    }
  };

  // ── Re-organize now (frozen organizer) ──
  const organizeNow = async () => {
    setOrganizingNow(true);
    const startedAt = Date.now();
    try {
      const run = await s.organizeNow();
      const elapsed = Date.now() - startedAt;
      if (elapsed < 600) await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
      if (run) {
        Alert.alert('Memory organized', run.summary || `Found ${run.entity_count ?? 0} entities and ${run.connection_count ?? 0} connections.`);
      } else {
        Alert.alert('Memory organized', 'Nothing new to reorganize — your memory map is already up to date.');
      }
    } finally {
      setOrganizingNow(false);
    }
  };

  // ── Reprocess all (frozen) — same confirm copy as 1.0 ──
  const confirmFullReprocess = () => {
    Alert.alert(
      'Reprocess ALL memories?',
      'This re-runs AI extraction on EVERY memory from scratch. With a remote model (OpenAI/Claude) that means one API call per memory — it can use a lot of credits and take a while. Your raw thoughts are kept; only the derived interpretation is rebuilt. Use this only after changing models or schema — not to retry one item (use the ⋯ menu on a single memory for that).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reprocess everything', style: 'destructive',
          onPress: () => void (async () => {
            setReprocessing(true);
            try {
              const count = await s.reprocessAllMemories(onReprocessAll);
              Alert.alert('Reprocessing started', `${count} original memories are queued for fresh interpretation.`);
            } catch (error) {
              Alert.alert('Could not start reprocessing', error instanceof Error ? error.message : 'Try again after current organizing completes.');
            } finally {
              setReprocessing(false);
            }
          })(),
        },
      ],
    );
  };

  // ── Delete all memories (frozen bulk wipe) — same confirm copy as 1.0 ──
  const deleteAllData = () => {
    Alert.alert(
      'Delete all memories?',
      'This permanently deletes all your captures, tasks, reminders, expenses, ideas, and organized memory. Your app settings are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything', style: 'destructive',
          onPress: async () => {
            try {
              await s.deleteAllMemories();
              Alert.alert('Done', 'All memories have been deleted. LUCY starts fresh.');
            } catch {
              Alert.alert('Error', 'Could not delete all data. Please try again.');
            }
          },
        },
      ],
    );
  };

  // ── Export / import (same lazy-imported logic + file flow as 1.0) ──
  const exportAllData = async () => {
    try {
      const db = await getDatabase();
      const { buildMemoryExport } = await import('../processing/memoryExport');
      const exportData = await buildMemoryExport(db, { includeArchived: true });
      const json = JSON.stringify(exportData, null, 2);
      const { cacheDirectory, writeAsStringAsync } = require('expo-file-system/legacy') as { cacheDirectory: string; writeAsStringAsync: (path: string, content: string) => Promise<void> };
      const exportPath = `${cacheDirectory}lucy-export-${Date.now()}.json`;
      await writeAsStringAsync(exportPath, json);
      await shareAsync(exportPath, { mimeType: 'application/json', dialogTitle: 'Export LUCY data' });
    } catch {
      Alert.alert('Export failed', 'Could not export data. Please try again.');
    }
  };

  const exportMarkdown = async () => {
    try {
      const db = await getDatabase();
      const captures = await db.getAllAsync<{ extracted_title: string | null; raw_transcript: string | null; created_at: string; privacy_level: string }>(
        `SELECT extracted_title, raw_transcript, created_at, privacy_level FROM captures WHERE privacy_level != 'private' ORDER BY created_at DESC LIMIT 100`,
      );
      const md = [
        '# LUCY Memory Export',
        `*Exported: ${new Date().toLocaleDateString()}*`,
        '',
        ...captures.map((c) => [
          `## ${c.extracted_title ?? 'Memory'} — ${new Date(c.created_at.includes('T') ? c.created_at : `${c.created_at.replace(' ', 'T')}Z`).toLocaleDateString()}`,
          '', c.raw_transcript ?? '', '', '---', '',
        ].join('\n')),
      ].join('\n');
      const { cacheDirectory, writeAsStringAsync } = await import('expo-file-system/legacy') as any;
      const path = `${cacheDirectory}lucy-export-${Date.now()}.md`;
      await writeAsStringAsync(path, md);
      await shareAsync(path, { mimeType: 'text/markdown', dialogTitle: 'Export LUCY as Markdown' });
    } catch {
      Alert.alert('Export failed', 'Please try again.');
    }
  };

  const importMemory = async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const { readAsStringAsync } = await import('expo-file-system/legacy');
      const text = await readAsStringAsync(res.assets[0].uri);
      let data: unknown;
      try { data = JSON.parse(text); } catch { Alert.alert('Import failed', 'That file is not valid JSON.'); return; }
      const db = await getDatabase();
      const { importMemoryExport } = await import('../processing/memoryImport');
      const r = await importMemoryExport(db, data);
      if (!r.ok) { Alert.alert('Import failed', r.error ?? 'Could not import.'); return; }
      const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
      await import('../processing/organizer').then(({ organizeMemory }) => organizeMemory(db, 'manual')).catch(() => {});
      Alert.alert('Imported ✓', `Restored ${total} items. Rebuilding your brain…`);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const openWrapped = async () => {
    const db = await getDatabase();
    const { hasEnoughForWrapped, wrappedMemoryCount } = await import('../processing/lucyWrapped');
    if (!(await hasEnoughForWrapped(db))) {
      const n = await wrappedMemoryCount(db);
      Alert.alert('Not ready yet', `LUCY Wrapped needs at least 30 organized memories. You have ${n} so far — keep capturing!`);
      return;
    }
    onOpenWrapped?.();
  };

  const connectCalendar = async () => {
    const { requestCalendarPermission } = await import('../processing/calendarConnector');
    const granted = await requestCalendarPermission();
    Alert.alert(
      granted ? 'Calendar connected' : 'Permission denied',
      granted
        ? 'LUCY will send a brief 30 minutes before meetings, and prompt you to capture notes afterward.'
        : 'Go to Settings → LUCY → Calendars to grant access.',
    );
  };

  const checkForUpdates = async () => {
    try {
      const Updates = await import('expo-updates');
      if (!Updates.isEnabled) {
        Alert.alert('Updates unavailable', 'Over-the-air updates run only in installed release builds, not in Expo Go / dev.');
        return;
      }
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) { Alert.alert('You’re up to date', 'LUCY already has the latest version.'); return; }
      await Updates.fetchUpdateAsync();
      Alert.alert('Update ready', 'LUCY will restart to apply the latest version.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart now', onPress: () => { void Updates.reloadAsync(); } },
      ]);
    } catch (e) {
      Alert.alert('Update check failed', e instanceof Error ? e.message : 'Please try again later.');
    }
  };

  const saveClaudeKey = async () => {
    setSavingClaudeKey(true);
    try {
      if (!claudeKey.trim() && s.hasClaudeKey) {
        await s.removeClaudeKey();
        toast.show({ message: 'Claude API key cleared.', tone: 'info', icon: 'key-outline' });
      } else if (claudeKey.trim()) {
        await s.verifyAndStoreClaudeKey(claudeKey.trim());
        setClaudeKey('');
        toast.show({ message: 'Claude key verified and saved.', tone: 'success', icon: 'checkmark-circle' });
      }
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSavingClaudeKey(false);
    }
  };

  const onRetryQueue = async () => {
    const db = await getDatabase();
    const { forceRetryAll } = await import('../db/captures');
    const n = await forceRetryAll(db);
    s.setQueue(await import('../db/captures').then((m) => m.getCaptureQueueSummary(db)));
    await import('../processing/extract').then((m) => m.processQueue(() => {})).catch(() => {});
    Alert.alert('Retry started', `${n} capture${n !== 1 ? 's' : ''} queued for processing.`);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingTop: spacing.base, paddingBottom: spacing.huge + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="h1">Settings</Text>
        <Text variant="footnote" color="textMuted" style={{ marginTop: spacing.xs }}>Quiet controls for your memory.</Text>
        <Spacer size="lg" />

        {/* ── You & profile ── */}
        <SettingsGroup icon="person-circle-outline" title="Profile" summary="Who you are, learned profile, check-ins & reminders">
          <SettingsRow
            title="About you"
            value={s.profile.name ? `${s.profile.name}${s.profile.about ? ' · ' + s.profile.about.slice(0, 30) + (s.profile.about.length > 30 ? '…' : '') : ''}` : 'Tell LUCY who you are'}
            badge={s.profile.name ? '✓' : 'Set up'}
            active={!!s.profile.name}
            onInfo={() => { setProfileDraft({ ...s.profile }); setActivePanel('profile'); }}
          />
          <SettingsRow title="Progress check-ins" value={s.checkInEnabled ? 'Reminders on — tap to edit your times' : 'Off — set your own reminder times'} badge={s.checkInEnabled ? 'On' : 'Off'} active={s.checkInEnabled} onInfo={() => setCheckInSchedulerVisible(true)} />
          <SettingsRow title="Ring like an alarm" value={s.alarmStyle ? 'On — reminders buzz and re-ring until you react' : 'Off — reminders give one gentle notification'} badge={s.alarmStyle ? 'On' : 'Off'} active={s.alarmStyle} onInfo={() => void s.toggleAlarmStyle()} />
          <SettingsRow title="Meal photo reminders" value={s.mealReminders ? 'On — gentle nudges at meal times to snap your food' : 'Off — no meal reminders'} badge={s.mealReminders ? 'On' : 'Off'} active={s.mealReminders} onInfo={() => void s.toggleMealReminders()} />
          <SettingsRow title="Smarter answers" value={s.semanticRouter ? 'On — LUCY routes questions through focused tools' : 'Off — using the standard answer engine'} badge={s.semanticRouter ? 'On' : 'Off'} active={s.semanticRouter} onInfo={() => void s.toggleSemanticRouter()} />
          <SettingsRow title="Scheduled reminders" value="Browse and cancel every reminder LUCY has scheduled" actionLabel="Manage" onAction={() => setRemindersManagerVisible(true)} onInfo={() => setRemindersManagerVisible(true)} />
          {onStartTour ? <SettingsRow title="Guided tour with Lucy" value="Lucy walks you through the app out loud — try each feature live as she explains" actionLabel="Start" onAction={onStartTour} /> : null}
        </SettingsGroup>

        {/* ── Your day & energy ── */}
        <SettingsGroup icon="partly-sunny-outline" title="Customize energy levels" summary="Office hours, sleep & when you're at your best">
          <SettingsRow
            title="Shape your day"
            value={s.dayShaped ? 'Custom hours & energy — tap to fine-tune when Lucy schedules' : 'Set your work hours and how your energy moves through the day'}
            badge={s.dayShaped ? 'Custom' : 'Set up'}
            active={s.dayShaped}
            actionLabel={s.dayShaped ? 'Edit' : 'Shape'}
            onAction={() => setDayShaperVisible(true)}
            onInfo={() => setDayShaperVisible(true)}
          />
        </SettingsGroup>

        {/* ── AI & intelligence ── */}
        <SettingsGroup icon="sparkles-outline" title="AI & intelligence" summary="Models, on-device intelligence & organizing">
          <IntelligenceModelsBlock s={s} claudeKey={claudeKey} setClaudeKey={setClaudeKey} savingClaudeKey={savingClaudeKey} onSaveKey={() => void saveClaudeKey()} />

          <Spacer size="sm" />
          <SettingsRow title="On-device intelligence" value={modelStatus} badge={usesDeviceModel && deviceModel.status === 'ready' ? 'Local' : usesDeviceModel ? 'Setup' : 'Dev'} active={usesDeviceModel && deviceModel.status === 'ready'} onInfo={() => setActivePanel('intelligence')} />
          <SettingsRow title="Background organizing" value={backgroundEnabled ? 'Allowed' : 'Off'} badge={backgroundEnabled ? 'On' : 'Off'} active={backgroundEnabled} onInfo={() => setActivePanel('background')} />
          <SettingsRow title="Re-organize now" value={runSummary} actionLabel={organizingNow ? 'Working...' : 'Run'} actionDisabled={organizingNow} onAction={() => void organizeNow()} onInfo={() => setActivePanel('organization')} />
          <SettingsRow title="Processing queue" value={waiting ? `${waiting} waiting for attention` : 'All caught up'} badge={waiting ? `${waiting}` : undefined} active={waiting === 0} onInfo={() => setActivePanel('queue')} />
        </SettingsGroup>

        {/* ── Voice ── */}
        <SettingsGroup icon="mic-outline" title="Voice" summary="Hey Lucy wake word, Lucy's voice, hands-free" pill={wakeWordEnabled ? 'On' : undefined}>
          <SettingsRow
            title="Hey Lucy wake word"
            value={
              !wakeWordEnabled ? 'Off — say “Hey Lucy” hands-free (uses more battery)'
              : s.wakeStatus === 'listening' ? 'Active — say “Hey Lucy” anytime'
              : s.wakeStatus === 'unavailable' ? 'Unavailable — speech recognition failed to start'
              : 'Starting up…'
            }
            badge={wakeWordEnabled ? (s.wakeStatus === 'listening' ? 'Listening' : s.wakeStatus === 'unavailable' ? 'Error' : 'Starting') : 'Off'}
            active={wakeWordEnabled && s.wakeStatus === 'listening'}
            actionLabel={wakeWordEnabled ? 'Turn off' : 'Turn on'}
            onAction={() => void onChangeWakeWord(!wakeWordEnabled)}
          />
          <SettingsRow title="Lucy's voice" value={s.selectedVoiceName === 'System default' ? 'System default — tap to pick a voice & preview' : s.selectedVoiceName} badge={s.selectedVoiceName === 'System default' ? undefined : 'Custom'} active={s.selectedVoiceName !== 'System default'} actionLabel="Choose" onAction={() => setVoicePickerVisible(true)} onInfo={() => setVoicePickerVisible(true)} />
          {Platform.OS === 'ios' ? <SettingsRow title="Set up Siri Shortcut" value={'Say "Hey Siri, [your phrase]" to send notes to LUCY hands-free'} onAction={() => setSiriGuideVisible(true)} actionLabel="Set up" /> : null}
        </SettingsGroup>

        {/* ── Connections ── */}
        <SettingsGroup icon="link-outline" title="Connections" summary="Permissions, calendar & laptop access">
          <SettingsRow title="Connectors & permissions" value="Calendar, location, passive listening, meeting mode" badge="Manage" active onInfo={() => setActivePanel('connectors')} />
          <SettingsRow title="Calendar integration" value="Pre-meeting briefs + post-meeting capture prompts" badge="Connect" onAction={() => void connectCalendar()} actionLabel="Grant access" />
          <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.md }}>
            <LaptopAccessPanel />
          </View>
        </SettingsGroup>

        {/* ── Storage ── */}
        <SettingsGroup icon="trash-bin-outline" title="Storage" summary="Clear low-importance notes to reclaim space" pill={s.lowNoteCount > 0 ? `${s.lowNoteCount}` : undefined}>
          <SettingsRow
            title="Free up space"
            value={s.lowNoteCount > 0 ? `${s.lowNoteCount} least-important note${s.lowNoteCount === 1 ? '' : 's'} ready to review` : 'Nothing to clear — your memory is already tidy'}
            badge={s.lowNoteCount > 0 ? `${s.lowNoteCount}` : undefined}
            active={s.lowNoteCount > 0}
            actionLabel="Review"
            onAction={() => setFreeUpSpaceVisible(true)}
            onInfo={() => setFreeUpSpaceVisible(true)}
          />
        </SettingsGroup>

        {/* ── Privacy & data ── */}
        <SettingsGroup icon="lock-closed-outline" title="Privacy & data" summary="Privacy shield, export, import & your story">
          <SettingsRow title="Privacy" value="Original private thoughts stay local" onInfo={() => setActivePanel('privacy')} />
          <SettingsRow title="🎁 LUCY Wrapped" value="Your quarterly story — captures, tasks, people, mood" onAction={() => void openWrapped()} actionLabel="View" />
          <SettingsRow title="Export as JSON" value="All memories, tasks, expenses as structured data" onAction={() => void exportAllData()} actionLabel="Export" />
          <SettingsRow title="Export as Markdown" value="Human-readable notes you can use anywhere" onAction={() => void exportMarkdown()} actionLabel="Export" />
          <SettingsRow title="Import memory" value="Restore from an exported JSON (e.g. switching devices)" onAction={() => void importMemory()} actionLabel="Import" />
          <SettingsRow title="Delete all memories" value="Permanently erase everything LUCY knows" onAction={deleteAllData} actionLabel="Delete" actionDestructive />
        </SettingsGroup>

        {/* ── About & updates ── */}
        <SettingsGroup icon="information-circle-outline" title="Check for updates" summary="Keep LUCY up to date">
          <SettingsRow title="Check for updates" value="Fetch the latest LUCY improvements and restart into them" onAction={() => void checkForUpdates()} actionLabel="Check" />
        </SettingsGroup>

        {/* ── Developer ── */}
        <SettingsGroup icon="construct-outline" title="Developer" summary="Diagnostics & AI call log">
          <SettingsRow title="AI call log" value="View all AI requests, responses, and errors" actionLabel="Open" onAction={() => setDevLogVisible(true)} />
        </SettingsGroup>
      </ScrollView>

      {/* Detail panels (design-system BottomSheet replaces the custom SettingsSheet) */}
      <BottomSheet visible={activePanel !== null} onClose={() => setActivePanel(null)} title={panelTitle(activePanel)}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>
          {activePanel === 'intelligence' ? <IntelligencePanel s={s} /> : null}
          {activePanel === 'background' ? <BackgroundPanel s={s} backgroundEnabled={backgroundEnabled} changing={changingBackground} onToggle={() => void changeBackground()} /> : null}
          {activePanel === 'organization' ? <OrganizationPanel s={s} organizing={organizingNow} onOrganize={() => void organizeNow()} reprocessing={reprocessing} onReprocess={confirmFullReprocess} /> : null}
          {activePanel === 'queue' ? <QueuePanel queue={s.queue} onRetry={onRetryQueue} /> : null}
          {activePanel === 'privacy' ? <PrivacyPanel /> : null}
          {activePanel === 'connectors' ? <ConnectorsPanel /> : null}
          {activePanel === 'profile' ? (
            <ProfilePanel
              draft={profileDraft}
              setDraft={setProfileDraft}
              saving={savingProfile}
              onSave={async () => {
                setSavingProfile(true);
                try { await s.saveProfile(profileDraft); setActivePanel(null); }
                finally { setSavingProfile(false); }
              }}
            />
          ) : null}
        </ScrollView>
      </BottomSheet>

      {/* Modals + external feature components (unchanged props) */}
      <DevLogViewer visible={devLogVisible} onClose={() => setDevLogVisible(false)} />
      <SiriShortcutGuide visible={siriGuideVisible} onClose={() => setSiriGuideVisible(false)} />
      <VoicePicker visible={voicePickerVisible} onClose={() => setVoicePickerVisible(false)} />
      <CheckInScheduler visible={checkInSchedulerVisible} onClose={() => setCheckInSchedulerVisible(false)} onChange={(en) => s.setCheckInEnabled(en)} />
      <ScheduledRemindersManager visible={remindersManagerVisible} onClose={() => setRemindersManagerVisible(false)} />
      <DayShaper visible={dayShaperVisible} onClose={() => setDayShaperVisible(false)} onSaved={() => { s.setDayShaped(true); s.bumpRefresh(); }} />
      <FreeUpSpace visible={freeUpSpaceVisible} onClose={() => setFreeUpSpaceVisible(false)} onChanged={() => s.bumpRefresh()} />
      <RolePickerModal role={pickerRole} selectedId={pickerRole ? s.roleModels[pickerRole] : null} onClose={() => setPickerRole(null)} onSelect={(id) => { if (pickerRole) void s.selectRoleModel(pickerRole, id); }} />
    </View>
  );
}
