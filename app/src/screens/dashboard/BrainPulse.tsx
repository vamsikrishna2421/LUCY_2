/**
 * BrainPulse — the "Lucy Pulse" cross-domain insight cards on the Focus Now view, rebuilt on the
 * design system (app/src/ui). Logic is identical to Dashboard 1.0's BrainPulseSection/PulseCard:
 * loads unseen pulses + marks them seen on mount (db/brainPulses.listUnseenPulses/markPulseSeen),
 * dismiss (dismissPulse), the archive list (listDismissedPulses), and the viral plain-text share
 * (expo-sharing + a temp file). No frozen logic changed; only chrome moves onto tokens + BottomSheet.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheet, Surface, Text, Row, Stack, Spacer, PressableScale, useTheme,
} from '../../ui';
import { CollapsibleSection } from '../../components/CollapsibleSection';
import { getDatabase } from '../../db';
import type { BrainPulseRow } from '../../db/brainPulses';

const PULSE_ACCENT = '#C084FC'; // violet — distinct from all existing palette colors

const ACCENT_MAP: Record<string, string> = {
  pattern: PULSE_ACCENT, person: '#60A5FA', mood: '#F59E0B', connection: '#4ADE80', overdue: '#FB7185',
};
const LABEL_MAP: Record<string, string> = {
  pattern: 'PATTERN', person: 'PATTERN · PEOPLE', mood: 'PATTERN · MOOD', connection: 'CONNECTION', overdue: 'HEADS UP',
};

function pulseAge(generatedAt: string): string {
  const ms = Date.now() - new Date(generatedAt.includes('T') ? generatedAt : `${generatedAt.replace(' ', 'T')}Z`).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ago` : `${m}m ago`;
}

async function sharePulse(headline: string): Promise<void> {
  try {
    const { shareAsync, isAvailableAsync } = await import('expo-sharing');
    const shareText = `LUCY noticed: "${headline}" — captured by my second brain`;
    if (await isAvailableAsync()) {
      const fs = await import('expo-file-system/legacy');
      const writeAsStringAsync = (fs as unknown as { writeAsStringAsync: (uri: string, contents: string) => Promise<void> }).writeAsStringAsync;
      const cacheDirectory = (fs as unknown as { cacheDirectory: string }).cacheDirectory ?? '';
      const uri = `${cacheDirectory}lucy-pulse.txt`;
      await writeAsStringAsync(uri, shareText);
      await shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Share LUCY insight' });
    }
  } catch { /* non-critical */ }
}

function PulseCard({ pulse, onDismiss }: { pulse: BrainPulseRow; onDismiss: () => void }) {
  const { colors, spacing, radius, layout } = useTheme();
  const accent = ACCENT_MAP[pulse.category] ?? PULSE_ACCENT;
  const label = LABEL_MAP[pulse.category] ?? 'PULSE';
  return (
    <Surface
      level="surface"
      radius="lg"
      border="border"
      padding="md"
      style={{ marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: accent, opacity: pulse.seen_at ? 0.78 : 1 }}
    >
      <Row justify="space-between" align="center" style={{ marginBottom: spacing.xs }}>
        <Text variant="caption" weight="700" tracking={1.2} style={{ color: accent }}>{label}</Text>
        <Row gap="md" align="center">
          <Text variant="caption" color="textMuted">{pulseAge(pulse.generated_at)}</Text>
          <PressableScale onPress={() => void sharePulse(pulse.headline)} hitSlop={8} accessibilityLabel="Share insight">
            <Ionicons name="share-outline" size={15} color={accent} />
          </PressableScale>
          <PressableScale onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={15} color={colors.textMuted} />
          </PressableScale>
        </Row>
      </Row>
      <Text variant="footnote" weight="600">{pulse.headline}</Text>
    </Surface>
  );
}

export function BrainPulseSection() {
  const { colors, spacing } = useTheme();
  const [pulses, setPulses] = useState<BrainPulseRow[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [archived, setArchived] = useState<BrainPulseRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const db = await getDatabase();
        const { listUnseenPulses, markPulseSeen } = await import('../../db/brainPulses');
        const rows = await listUnseenPulses(db);
        setPulses(rows);
        for (const p of rows.filter((r) => !r.seen_at)) await markPulseSeen(db, p.id);
      } catch { /* non-critical */ }
    })();
  }, []);

  const dismiss = async (id: number) => {
    const db = await getDatabase();
    const { dismissPulse } = await import('../../db/brainPulses');
    await dismissPulse(db, id);
    setPulses((prev) => prev.filter((p) => p.id !== id));
  };

  const openArchive = async () => {
    const db = await getDatabase();
    const { listDismissedPulses } = await import('../../db/brainPulses');
    setArchived(await listDismissedPulses(db));
    setShowArchive(true);
  };

  if (pulses.length === 0) return null;

  return (
    <>
      <CollapsibleSection title="Lucy Pulse" count={pulses.filter((p) => !p.seen_at).length || pulses.length} accent={PULSE_ACCENT}>
        {pulses.map((p) => <PulseCard key={p.id} pulse={p} onDismiss={() => void dismiss(p.id)} />)}
        <PressableScale onPress={() => void openArchive()} accessibilityLabel="View archived pulses" style={{ alignSelf: 'flex-start', marginBottom: spacing.sm }}>
          <Text variant="caption" color="textMuted">View archived pulses</Text>
        </PressableScale>
      </CollapsibleSection>

      <BottomSheet visible={showArchive} onClose={() => setShowArchive(false)} title="Archived pulses">
        {archived.length === 0 ? (
          <Text variant="footnote" color="textMuted" align="center" style={{ paddingVertical: spacing.xl }}>No archived pulses yet.</Text>
        ) : (
          <Stack gap="sm">
            {archived.map((p) => (
              <View key={p.id} style={{ opacity: 0.7, borderLeftWidth: 2, borderLeftColor: PULSE_ACCENT, paddingLeft: spacing.md }}>
                <Text variant="footnote" weight="600">{p.headline}</Text>
                <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                  {new Date(p.generated_at.includes('T') ? p.generated_at : `${p.generated_at.replace(' ', 'T')}Z`).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </Stack>
        )}
        <Spacer size="sm" />
      </BottomSheet>
    </>
  );
}
