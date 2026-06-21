/**
 * Settings detail panels — the bodies shown inside the design-system BottomSheet, rebuilt on app/src/ui.
 *
 * One component per panel (intelligence / background / organization / queue / privacy / profile), each
 * preserving every Settings 1.0 control + copy and binding through the `useSettings` seam (or, for the
 * self-contained QueuePanel, the same frozen lazy-imports 1.0 used). ConnectorsPanel reuses the
 * redesigned ConnectorsScreen as 1.0 did. Tokens only; the bulky inline RN styles are gone.
 */
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Surface, Card, Text, Row, Stack, Spacer, Divider, Button, Chip, TextField, PressableScale, useTheme,
} from '../../ui';
import { config } from '../../config';
import { getDatabase } from '../../db';
import { setSetting } from '../../db/settings';
import { localModelOptions } from '../../ai/modelCatalog';
import type { CaptureQueueSummary } from '../../db/captures';
import type { UserProfile } from '../../db/userProfile';
import { LearnedProfilePanel } from '../../components/LearnedProfilePanel';
import { ConnectorsScreen } from '../Connectors';
import { modelLabel } from './models';
import type { UseSettings } from '../hooks/useSettings';

/** Small reusable block label inside panels. */
function PanelLabel({ children }: { children: string }) {
  return <Text variant="caption" color="textMuted" weight="700" tracking={1}>{children}</Text>;
}

// ─── On-device intelligence ────────────────────────────────────────────────────
export function IntelligencePanel({ s }: { s: UseSettings }) {
  const { colors, spacing } = useTheme();
  const [preparing, setPreparing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchProgress, setBenchProgress] = useState('');
  const [benchResults, setBenchResults] = useState<Awaited<ReturnType<UseSettings['runBenchmark']>>>([]);

  const usesDeviceModel = config.localInference === 'device';
  const dm = s.deviceModel;
  const modelStatus = dm.status === 'ready' ? 'Ready on this device'
    : dm.status === 'downloading' ? `Preparing ${Math.round(dm.progress * 100)}%`
    : dm.status === 'unavailable' ? 'Unavailable on this device'
    : dm.status === 'error' ? 'Setup needs attention'
    : 'Not prepared';
  const benchStatus = benchResults.length ? `${benchResults.filter((r) => r.passed).length}/${benchResults.length} passed` : 'Quality check';

  if (!usesDeviceModel) {
    return <Text variant="footnote" color="textMuted">Set `EXPO_PUBLIC_LOCAL_INFERENCE=device` before validating phone-only privacy.</Text>;
  }

  return (
    <Stack gap="md">
      <Text variant="footnote" color="textSecondary">Private thoughts are analyzed on this phone after its local model is prepared.</Text>
      <Text variant="bodyMed">{modelStatus}</Text>
      <Text variant="footnote" color="textMuted">
        {dm.modelName}. Select the depth that fits your phone and journal style; once prepared, thought analysis stays on this device.
      </Text>

      {localModelOptions.map((option) => {
        const selected = dm.modelId === option.id;
        return (
          <Card
            key={option.id}
            onPress={selecting ? undefined : () => { setSelecting(true); void s.chooseModel(option.id).finally(() => setSelecting(false)); }}
            level={selected ? 'surfaceAlt' : 'surface'}
            border={selected ? 'accent' : 'border'}
            padding="md"
          >
            <Row gap="md" align="center">
              <View style={{ flex: 1 }}>
                <Text variant="footnote" weight="600">{option.name} / {option.journalFit}</Text>
                <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>{option.guidance}</Text>
              </View>
              <Text variant="footnote" color={selected ? 'accent' : 'textMuted'} weight="700">{selected ? 'Selected' : 'Choose'}</Text>
            </Row>
          </Card>
        );
      })}

      <Text variant="footnote" color="textMuted">After changing model, use Reprocess all memories to rebuild LUCY's understanding from the original journal entries.</Text>
      {config.deviceModelAssetBaseUrl ? <Text variant="footnote" color="textMuted">Development asset relay enabled. Processing still runs on this device.</Text> : null}
      {dm.error ? <Text variant="footnote" color="danger">{dm.error}</Text> : null}

      {dm.status !== 'ready' && dm.status !== 'unavailable' ? (
        <Button
          label={dm.status === 'downloading' || preparing ? 'Preparing...' : 'Prepare on-device intelligence'}
          loading={preparing}
          disabled={preparing || dm.status === 'downloading'}
          onPress={() => { setPreparing(true); void s.prepareModel().finally(() => setPreparing(false)); }}
        />
      ) : null}
      <Button
        label={clearing ? 'Removing...' : 'Remove local model download'}
        variant="secondary"
        loading={clearing}
        disabled={clearing || dm.status === 'downloading'}
        onPress={() => { setClearing(true); void s.clearModel().finally(() => setClearing(false)); }}
      />

      {/* Opt-in: use the on-device model to detect names for the Privacy Shield */}
      <Row gap="md" align="center" style={{ marginTop: spacing.xs }}>
        <View style={{ flex: 1 }}>
          <Text variant="footnote" weight="600">Use on-device AI to protect names</Text>
          <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            When on, the local model also finds people's names to mask from the cloud — including unfamiliar ones. Needs a prepared model and adds ~20-30s per note. Passwords and known/listed names are always protected either way.
          </Text>
        </View>
        <Chip label={s.shieldLlm ? 'On' : 'Off'} selected={s.shieldLlm} onPress={() => void s.toggleShieldLlm()} />
      </Row>

      <Divider />
      <Text variant="bodyMed">Local quality check</Text>
      <Text variant="footnote" color="textMuted">Test common English memory and privacy cases locally. Test phrases are never remembered.</Text>
      {benchProgress ? <Text variant="footnote" weight="600">{benchProgress}</Text> : null}
      {benchResults.map((result) => (
        <Row key={result.id} gap="md" align="center">
          <View style={{ flex: 1 }}>
            <Text variant="footnote" weight="600">{result.label}</Text>
            <Text variant="caption" color="textMuted">{result.detail}</Text>
          </View>
          <Text variant="footnote" color={result.passed ? 'success' : 'danger'} weight="700">
            {result.passed ? 'Pass' : 'Fail'} / {(result.durationMs / 1000).toFixed(1)}s
          </Text>
        </Row>
      ))}
      <Button
        label={benchRunning ? 'Checking local intelligence...' : `Run local check${benchResults.length ? ` (${benchStatus})` : ''}`}
        loading={benchRunning}
        disabled={benchRunning || dm.status !== 'ready'}
        onPress={() => {
          setBenchRunning(true);
          setBenchProgress('Starting local checks...');
          setBenchResults([]);
          void s.runBenchmark(setBenchProgress)
            .then((results) => { setBenchResults(results); setBenchProgress(`${results.filter((r) => r.passed).length} of ${results.length} checks passed`); })
            .finally(() => setBenchRunning(false));
        }}
      />
    </Stack>
  );
}

// ─── Background organizing ──────────────────────────────────────────────────────
export function BackgroundPanel({ s, backgroundEnabled, onToggle, changing }: { s: UseSettings; backgroundEnabled: boolean; onToggle: () => void; changing: boolean }) {
  const b = s.background;
  return (
    <Stack gap="md">
      <Text variant="footnote" color="textSecondary">LUCY can organize waiting thoughts when your device grants a battery-friendly background window.</Text>
      <Text variant="footnote" color="textMuted">Your phone decides the exact time, commonly while idle or charging. LUCY does not set alarms or keep the processor awake.</Text>
      <Text variant="bodyMed">{b?.lastRun ? `Last activity: ${new Date(b.lastRun).toLocaleString()}` : 'No background activity recorded yet.'}</Text>
      <Text variant="footnote" color="textMuted">{b?.lastResult ?? (b?.registered ? 'Background organizing is ready.' : 'Background organizing is currently off.')}</Text>
      <Button
        label={changing ? 'Updating...' : backgroundEnabled ? 'Turn off background organizing' : 'Allow background organizing'}
        loading={changing}
        disabled={changing}
        onPress={onToggle}
      />
    </Stack>
  );
}

// ─── Re-organize now ────────────────────────────────────────────────────────────
export function OrganizationPanel({ s, organizing, onOrganize, reprocessing, onReprocess }: { s: UseSettings; organizing: boolean; onOrganize: () => void; reprocessing: boolean; onReprocess: () => void }) {
  const run = s.organizationRun;
  return (
    <Stack gap="md">
      <Text variant="footnote" color="textSecondary">Rebuild LUCY's local Memory Map on demand during quiet time, such as a nap or while charging.</Text>
      <Text variant="footnote" color="textMuted">Stored evidence is reorganized from remembered material. When remote intelligence is enabled, protected thoughts are locally masked before GPT-5.4 Nano sees placeholder text.</Text>
      {run ? (
        <>
          <Text variant="bodyMed">{run.summary}</Text>
          <Text variant="footnote" color="textMuted">Last run: {new Date(`${run.created_at.replace(' ', 'T')}Z`).toLocaleString()} / {run.trigger}</Text>
        </>
      ) : null}
      <Button label={organizing ? 'Re-organizing memory...' : 'Re-organize now'} loading={organizing} disabled={organizing} onPress={onOrganize} />
      <Button label={reprocessing ? 'Preparing rebuild...' : 'Reprocess all memories'} variant="secondary" loading={reprocessing} disabled={reprocessing || s.deviceModel.status !== 'ready'} onPress={onReprocess} />
      {s.deviceModel.status !== 'ready' ? <Text variant="footnote" color="textMuted">Prepare the selected local model before rebuilding all memories.</Text> : null}
    </Stack>
  );
}

// ─── Privacy ────────────────────────────────────────────────────────────────────
export function PrivacyPanel() {
  return (
    <Text variant="footnote" color="textSecondary">
      Original private thoughts stay encrypted on your device and remain visible to you in LUCY. With
      remote intelligence enabled, a protected thought can be sent for analysis only after the selected
      on-device model replaces private details with placeholders. This protection path is experimental
      during beta testing. Credentials and passwords remain masked in previews.
    </Text>
  );
}

// ─── About you (profile) ────────────────────────────────────────────────────────
const LANGS = [
  { code: 'en', label: 'English' }, { code: 'te', label: 'Telugu' }, { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' }, { code: 'kn', label: 'Kannada' }, { code: 'ml', label: 'Malayalam' },
  { code: 'mr', label: 'Marathi' },
];

export function ProfilePanel({ draft, setDraft, saving, onSave }: { draft: UserProfile; setDraft: React.Dispatch<React.SetStateAction<UserProfile>>; saving: boolean; onSave: () => void }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Stack gap="base">
        <Text variant="footnote" color="textMuted">LUCY uses your name and background to personalize every response — no more "the user said" language.</Text>
        <TextField label="Your name" placeholder="e.g. Vamsy" value={draft.name} onChangeText={(v) => setDraft((p) => ({ ...p, name: v }))} />
        <TextField label="About you" placeholder="e.g. Data engineer, interested in AI, music lover, work at a tech company" multiline value={draft.about} onChangeText={(v) => setDraft((p) => ({ ...p, about: v }))} />

        <View>
          <Text variant="footnote" color="textSecondary" weight="600">Languages you speak</Text>
          <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            LUCY uses these languages as context. With multiple languages selected, Listen uses automatic detection so mixed speech is not forced into one language.
          </Text>
          <Spacer size="sm" />
          <Row gap="sm" wrap>
            {LANGS.map(({ code, label }) => {
              const selected = draft.languages.includes(code);
              return (
                <Chip
                  key={code}
                  label={label}
                  selected={selected}
                  onPress={() => setDraft((p) => ({ ...p, languages: selected ? p.languages.filter((l) => l !== code) : [...p.languages, code] }))}
                />
              );
            })}
          </Row>
        </View>

        <View>
          <Text variant="footnote" color="textSecondary" weight="600">Voice transcription</Text>
          <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            LUCY transcribes your voice entirely on-device — private, free, and offline. Your spoken languages above set the recognition locale.
          </Text>
        </View>

        <Button label={saving ? 'Saving...' : 'Save'} variant="secondary" loading={saving} disabled={saving} onPress={onSave} />

        <View>
          <Text variant="footnote" color="textSecondary" weight="600">What LUCY has learned about you</Text>
          <Spacer size="sm" />
          <LearnedProfilePanel />
        </View>
      </Stack>
    </KeyboardAvoidingView>
  );
}

// ─── Connectors (reuses the redesigned ConnectorsScreen, as 1.0 did) ────────────
export function ConnectorsPanel() {
  return <ConnectorsScreen />;
}

// ─── Processing queue (self-contained; same frozen lazy-imports as 1.0) ─────────
export function QueuePanel({ queue, onRetry }: { queue: CaptureQueueSummary; onRetry: () => Promise<void> }) {
  const { colors, spacing, radius, layout } = useTheme();
  const [retrying, setRetrying] = useState(false);
  const [stuck, setStuck] = useState<Array<{ id: number; raw_transcript: string | null; extracted_title: string | null; processing_error: string | null }>>([]);
  const [queued, setQueued] = useState<Array<{ id: number; raw_transcript: string | null; extracted_title: string | null }>>([]);
  const [diag, setDiag] = useState<{ model: string; available: boolean } | null>(null);
  const [errors, setErrors] = useState<Array<{ id: number; occurred_at: string; context: string; message: string }>>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [guard, setGuard] = useState<{ enabled: boolean; max: number; used: number; snoozedUntil: string | null } | null>(null);
  const [guardRefresh, setGuardRefresh] = useState(0);

  useEffect(() => {
    void (async () => {
      const [{ resolveRemoteAvailability }, { getPreferredModel }, { config: cfg }] = await Promise.all([
        import('../../ai/provider'), import('../../ai/modelPreference'), import('../../config'),
      ]);
      const model = getPreferredModel(cfg.openAIModel);
      const { available } = await resolveRemoteAvailability();
      setDiag({ model, available });
      try {
        const db = await getDatabase();
        const { listRecentErrors } = await import('../../db/errorLog');
        setErrors(await listRecentErrors(db, 20));
        const { getCostGuard } = await import('../../ai/rateLimit');
        setGuard(await getCostGuard(db));
      } catch { /* non-critical */ }
    })();
  }, [queue.queued, queue.complete, queue.retrying, guardRefresh]);

  const toggleGuard = async () => {
    const db = await getDatabase();
    const { COST_GUARD_ENABLED_KEY } = await import('../../ai/rateLimit');
    await setSetting(db, COST_GUARD_ENABLED_KEY, guard?.enabled ? 'false' : 'true');
    setGuardRefresh((v) => v + 1);
  };
  const cycleGuardLimit = async () => {
    const presets = [60, 120, 240, 500];
    const next = presets[(presets.indexOf(guard?.max ?? 120) + 1) % presets.length];
    const db = await getDatabase();
    const { COST_GUARD_MAX_KEY } = await import('../../ai/rateLimit');
    await setSetting(db, COST_GUARD_MAX_KEY, String(next));
    setGuardRefresh((v) => v + 1);
  };
  const snoozeGuard = async () => {
    const db = await getDatabase();
    const { snoozeCostGuard } = await import('../../ai/rateLimit');
    if (guard?.snoozedUntil) { await snoozeCostGuard(db, 0); setGuardRefresh((v) => v + 1); return; }
    Alert.alert('Pause cost guard', 'Temporarily allow unlimited AI calls (e.g. for a bulk import). It re-enables automatically.', [
      { text: 'Cancel', style: 'cancel' },
      { text: '30 min', onPress: async () => { await snoozeCostGuard(db, 30); setGuardRefresh((v) => v + 1); } },
      { text: '1 hour', onPress: async () => { await snoozeCostGuard(db, 60); setGuardRefresh((v) => v + 1); } },
      { text: '3 hours', onPress: async () => { await snoozeCostGuard(db, 180); setGuardRefresh((v) => v + 1); } },
    ]);
  };

  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      const { getRetryingCaptures } = await import('../../db/captures');
      setStuck(await getRetryingCaptures(db));
      const queuedItems = await db.getAllAsync<{ id: number; raw_transcript: string | null; extracted_title: string | null }>(
        `SELECT id, raw_transcript, extracted_title FROM captures WHERE processed = 0 AND archived_at IS NULL ORDER BY created_at DESC LIMIT 5`,
      );
      setQueued(queuedItems);
    })();
  }, [queue.queued, queue.retrying]);

  const deleteQueueItem = async (id: number) => {
    const db = await getDatabase();
    const { archiveCapture } = await import('../../db/captures');
    await archiveCapture(db, id, 'deleted from queue by user');
    setQueued((prev) => prev.filter((c) => c.id !== id));
    setStuck((prev) => prev.filter((c) => c.id !== id));
  };

  const renderCapture = (c: { id: number; raw_transcript: string | null; extracted_title: string | null; processing_error?: string | null }, warm = false) => (
    <Surface key={c.id} level={warm ? 'surfaceAlt' : 'surface'} radius="sm" border={warm ? 'warning' : 'border'} padding="sm" style={{ marginTop: spacing.xs }}>
      <Row gap="sm" align="flex-start">
        <View style={{ flex: 1 }}>
          <Text variant="footnote" weight="600" numberOfLines={1}>{c.extracted_title ?? c.raw_transcript?.slice(0, 80) ?? '(no text)'}</Text>
          {c.raw_transcript && !c.extracted_title ? <Text variant="caption" color="textMuted" numberOfLines={1}>{c.raw_transcript.slice(0, 100)}</Text> : null}
          {c.processing_error ? <Text variant="caption" color="danger" numberOfLines={1}>Error: {c.processing_error}</Text> : null}
        </View>
        <PressableScale onPress={() => void deleteQueueItem(c.id)} hitSlop={8} accessibilityLabel="Delete from queue">
          <Ionicons name="close" size={16} color={colors.danger} />
        </PressableScale>
      </Row>
    </Surface>
  );

  const Metric = ({ label, value, warm }: { label: string; value: number; warm?: boolean }) => (
    <Stack gap="none" align="center" flex={1}>
      <Text variant="h3" color={warm && value > 0 ? 'warning' : 'textPrimary'} weight="700">{value}</Text>
      <Text variant="caption" color="textMuted">{label}</Text>
    </Stack>
  );

  return (
    <Stack gap="md">
      <Row gap="xs">
        <Metric label="Queued" value={queue.queued} />
        <Metric label="Organizing" value={queue.processing} />
        <Metric label="Will retry" value={queue.retrying} warm />
        <Metric label="Remembered" value={queue.complete} />
        <Metric label="Archived" value={queue.archived} />
      </Row>

      {diag ? (
        <Surface level="surface" radius="md" border={diag.available ? 'border' : 'danger'} padding="md">
          <PanelLabel>PROCESSING WITH</PanelLabel>
          <Text variant="footnote" weight="700" style={{ marginTop: 3 }}>{modelLabel(diag.model)}</Text>
          <Text variant="caption" color={diag.available ? 'success' : 'danger'} weight="600" style={{ marginTop: 2 }}>
            {diag.available ? 'Ready — captures will process' : 'Not ready — captures will stay queued. Add your Anthropic key under AI & intelligence.'}
          </Text>
        </Surface>
      ) : null}

      {guard ? (
        <Surface level="surface" radius="md" border={guard.enabled && guard.used >= guard.max ? 'warning' : 'border'} padding="md">
          <Row justify="space-between" align="center">
            <PanelLabel>COST GUARD</PanelLabel>
            <Chip label={guard.enabled ? 'ON' : 'OFF'} selected={guard.enabled} onPress={() => void toggleGuard()} />
          </Row>
          {guard.enabled ? (
            <>
              {guard.snoozedUntil ? (
                <Text variant="caption" color="success" weight="600" style={{ marginTop: spacing.xs }}>
                  Paused (unlimited) until {new Date(guard.snoozedUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
              ) : (
                <Text variant="caption" color={guard.used >= guard.max ? 'warning' : 'textMuted'} weight="600" style={{ marginTop: spacing.xs }}>
                  {guard.used} / {guard.max} AI calls this hour{guard.used >= guard.max ? ' — paused until the hour clears' : ''}
                </Text>
              )}
              <Row gap="lg" style={{ marginTop: spacing.xs }}>
                <PressableScale onPress={() => void cycleGuardLimit()} accessibilityLabel="Cycle cost guard limit">
                  <Text variant="caption" color="accent" weight="700">Limit: {guard.max}/hr</Text>
                </PressableScale>
                <PressableScale onPress={() => void snoozeGuard()} accessibilityLabel="Pause or resume cost guard">
                  <Text variant="caption" color={guard.snoozedUntil ? 'success' : 'accent'} weight="700">{guard.snoozedUntil ? 'Resume now' : 'Pause for a while'}</Text>
                </PressableScale>
              </Row>
            </>
          ) : (
            <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>No automatic limit on AI calls. Tap ON to cap spend.</Text>
          )}
        </Surface>
      ) : null}

      {queued.length > 0 ? (
        <View>
          <Text variant="caption" color="accent" weight="700" tracking={1.2}>WAITING TO PROCESS</Text>
          {queued.map((c) => renderCapture(c))}
        </View>
      ) : null}

      {stuck.length > 0 ? (
        <View>
          <Text variant="caption" color="warning" weight="700" tracking={1.2}>STUCK — WILL RETRY</Text>
          {stuck.map((c) => renderCapture(c, true))}
          <Spacer size="sm" />
          <Button
            label={retrying ? 'Retrying...' : `Retry now (${queue.retrying})`}
            loading={retrying}
            disabled={retrying}
            onPress={() => { setRetrying(true); void onRetry().finally(() => setRetrying(false)); }}
          />
        </View>
      ) : null}

      <Text variant="footnote" color="textMuted">Unfinished thoughts retry automatically. Tap "Retry now" to force them immediately.</Text>

      {errors.length > 0 ? (
        <View>
          <PressableScale onPress={() => setShowErrors((v) => !v)} accessibilityLabel="Toggle recent errors">
            <Row justify="space-between" align="center">
              <PanelLabel>{`RECENT ERRORS (${errors.length})`}</PanelLabel>
              <Ionicons name={showErrors ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.textMuted} />
            </Row>
          </PressableScale>
          {showErrors ? (
            <>
              {errors.map((e) => (
                <Surface key={e.id} level="surface" radius="sm" border="danger" padding="sm" style={{ marginTop: spacing.xs }}>
                  <Text variant="caption" color="textMuted">{e.context} · {e.occurred_at}</Text>
                  <Text variant="caption" color="danger" numberOfLines={3}>{e.message}</Text>
                </Surface>
              ))}
              <Spacer size="sm" />
              <PressableScale
                onPress={async () => { const db = await getDatabase(); const { clearErrorLog } = await import('../../db/errorLog'); await clearErrorLog(db); setErrors([]); }}
                accessibilityLabel="Clear errors"
              >
                <Text variant="footnote" color="textMuted" weight="700">Clear errors</Text>
              </PressableScale>
            </>
          ) : null}
        </View>
      ) : null}
    </Stack>
  );
}
