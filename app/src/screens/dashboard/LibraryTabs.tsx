/**
 * Library tabs — the seven inline Library sub-views (Medications / Gallery / Reminders / Listen /
 * Resources / Meetings / People), rebuilt on the design system (app/src/ui). Each keeps its frozen
 * calls 1:1 via the useLibrary seam. Confirms (delete medication/session/meeting) use ActionSheet;
 * image/meeting detail stay full-screen Modals. SectionTitle/EmptyLine are shared small helpers.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Text, Card, Surface, Row, Stack, Spacer, Button, IconButton, Chip, TextField, EmptyState,
  ActionSheet, PressableScale, useTheme, type Theme,
} from '../../ui';
import { LucyEmptyState } from '../../components/LucyEmptyState';
import { MeetingShareBar } from '../../components/MeetingShareBar';
import { formatMeetingRowText } from '../../processing/meetingFormat';
import { StoryView, type StorySubject } from '../StoryView';
import { useLibrary } from '../hooks/useLibrary';
import type { MedicationRow } from '../../db/medications';
import type { ListenSessionGroup } from '../../db/captures';

const BLUE = '#5B8CFF';

// ─── Shared small helpers (tokens) ─────────────────────────────────────────────────
export function SectionTitle({ title, count }: { title: string; count?: number }) {
  const { colors, spacing, layout } = useTheme();
  return (
    <Row gap="sm" align="center" style={{ marginTop: spacing.base, marginBottom: spacing.sm }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent }} />
      <Text variant="bodyMed">{title}</Text>
      {count != null ? (
        <View style={{ minWidth: 20, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.surfaceAlt, borderWidth: layout.hairline, borderColor: colors.border, alignItems: 'center' }}>
          <Text variant="caption" color="textMuted" weight="700">{count}</Text>
        </View>
      ) : null}
    </Row>
  );
}

export function EmptyLine({ text }: { text: string }) {
  const { spacing } = useTheme();
  return <Text variant="footnote" color="textFaint" style={{ paddingVertical: spacing.sm }}>{text}</Text>;
}

function Loading() {
  const { colors, spacing } = useTheme();
  return <View style={{ paddingVertical: spacing.xxl }}><ActivityIndicator color={colors.accent} /></View>;
}

// ─── Medications ────────────────────────────────────────────────────────────────────
export function MedicationsTab() {
  const { colors, spacing, radius } = useTheme();
  const lib = useLibrary();
  const [meds, setMeds] = useState<MedicationRow[]>([]);
  const [taken, setTaken] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(''); const [dosage, setDosage] = useState(''); const [times, setTimes] = useState('');
  const [removeTarget, setRemoveTarget] = useState<MedicationRow | null>(null);

  const load = async () => {
    try { const r = await lib.loadMedications(); setMeds(r.meds); setTaken(r.taken); } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    const parsed = times.split(/[,\s]+/).map((s) => s.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s));
    await lib.addMedication(name, dosage, parsed);
    setName(''); setDosage(''); setTimes(''); setAdding(false);
    await load();
  };
  const markTaken = async (m: MedicationRow, t: string) => {
    setTaken((prev) => ({ ...prev, [m.id]: [...(prev[m.id] ?? []), t] }));
    await lib.markMedicationTaken(m.id, t);
  };
  const parse = (s: string | null) => { try { return s ? (JSON.parse(s) as string[]) : []; } catch { return []; } };

  if (loading) return <Loading />;
  return (
    <>
      <Button label={adding ? 'Close' : '＋ Add medication'} variant="secondary" onPress={() => setAdding((v) => !v)} />
      {adding ? (
        <Surface level="surfaceAlt" radius="lg" border="border" padding="md" style={{ marginTop: spacing.sm }}>
          <Stack gap="sm">
            <TextField placeholder="Name (e.g. Metformin)" value={name} onChangeText={setName} />
            <TextField placeholder="Dosage (e.g. 500mg)" value={dosage} onChangeText={setDosage} />
            <TextField placeholder="Times — 08:00, 21:00" value={times} onChangeText={setTimes} />
            <Button label="Save & set reminders" disabled={!name.trim()} onPress={() => void add()} />
            <Text variant="caption" color="textMuted">LUCY only reminds you to take what you enter — it never advises on drugs or doses. Check with your doctor.</Text>
          </Stack>
        </Surface>
      ) : null}
      <Spacer size="sm" />
      {!meds.length ? <EmptyLine text="No medications tracked. Add one and LUCY will remind you at each dose time." /> : null}
      {meds.map((m) => {
        const ts = parse(m.times); const done = taken[m.id] ?? [];
        return (
          <Card key={m.id} level="surfaceAlt" padding="md" style={{ marginBottom: spacing.sm }}>
            <Row justify="space-between" align="flex-start">
              <Text variant="bodyMed">{m.name}{m.dosage ? <Text variant="footnote" color="textMuted">  ·  {m.dosage}</Text> : null}</Text>
              <PressableScale onPress={() => setRemoveTarget(m)} hitSlop={8} accessibilityLabel="Remove medication"><Text variant="footnote" color="danger" weight="600">Remove</Text></PressableScale>
            </Row>
            {ts.length ? (
              <Row gap="sm" wrap style={{ marginTop: spacing.sm }}>
                {ts.map((t) => {
                  const isDone = done.includes(t);
                  return <Chip key={t} label={isDone ? `✓ ${t}` : t} selected={isDone} disabled={isDone} onPress={() => void markTaken(m, t)} />;
                })}
              </Row>
            ) : <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>No times set — add some to get reminders.</Text>}
          </Card>
        );
      })}
      <ActionSheet
        visible={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Stop tracking?"
        message={removeTarget ? `"${removeTarget.name}" and its reminders will be removed.` : undefined}
        actions={removeTarget ? [{ label: 'Remove', icon: 'trash-outline', destructive: true, onPress: async () => { await lib.removeMedication(removeTarget); await load(); } }] : []}
      />
    </>
  );
}

// ─── Gallery ────────────────────────────────────────────────────────────────────────
export function GalleryTab() {
  const { colors, spacing, radius } = useTheme();
  const lib = useLibrary();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof lib.loadGallery>>>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<string | null>(null);

  useEffect(() => { void (async () => { try { setRows(await lib.loadGallery()); } catch { /* ignore */ } finally { setLoading(false); } })(); }, []);

  if (loading) return <Loading />;
  if (!rows.length) return <LucyEmptyState title="No photos yet" message="Snap a note, receipt, or whiteboard — I'll read it and keep the original right here." />;
  return (
    <>
      <Row gap="sm" wrap>
        {rows.map((r) => (
          <PressableScale key={r.id} onPress={() => setViewer(r.source_image_path)} accessibilityLabel="View photo">
            <Image source={{ uri: r.source_image_path }} style={{ width: 104, height: 104, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }} resizeMode="cover" />
          </PressableScale>
        ))}
      </Row>
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setViewer(null)}>
          {viewer ? <Image source={{ uri: viewer }} style={{ width: '92%', height: '80%' }} resizeMode="contain" /> : null}
          <Text variant="caption" color="textMuted" style={{ marginTop: spacing.base }}>Tap to close · original photo</Text>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Reminders ────────────────────────────────────────────────────────────────────────
export function RemindersTab() {
  const { spacing } = useTheme();
  const lib = useLibrary();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof lib.loadReminders>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void (async () => { try { setRows(await lib.loadReminders()); } catch { /* ignore */ } finally { setLoading(false); } })(); }, []);

  const dismiss = async (id: number) => { setRows((r) => r.filter((x) => x.id !== id)); try { await lib.dismissReminder(id); } catch { /* ignore */ } };
  const whenLabel = (iso: string | null) => {
    if (!iso) return 'No time set';
    const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
    if (Number.isNaN(d.getTime())) return 'No time set';
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  if (loading) return <Loading />;
  if (!rows.length) return <LucyEmptyState title="No reminders yet" message={'Say or type "remind me to…" and I\'ll nudge you at the right moment.'} />;
  return (
    <>
      {rows.map((r) => (
        <Card key={r.id} level="surfaceAlt" padding="md" style={{ marginBottom: spacing.sm }}>
          <Row gap="md" align="center">
            <View style={{ flex: 1 }}>
              <Text variant="footnote" weight="600">{lib.protectedPreview(r.text)}</Text>
              <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>{whenLabel(r.remind_at)}{r.recurrence ? ` · repeats ${r.recurrence}` : ''}{r.urgency ? ` · ${r.urgency}` : ''}</Text>
            </View>
            <Button label="Done" variant="secondary" size="sm" onPress={() => void dismiss(r.id)} />
          </Row>
        </Card>
      ))}
    </>
  );
}

// ─── Listen ────────────────────────────────────────────────────────────────────────
export function ListenTab() {
  const { colors, spacing, radius } = useTheme();
  const lib = useLibrary();
  const [sessions, setSessions] = useState<ListenSessionGroup[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [clipTexts, setClipTexts] = useState<Record<string, string[]>>({});
  const [digestCount, setDigestCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ sessionId: string; captureIds: number[] } | null>(null);
  const [notEnough, setNotEnough] = useState(false);

  useEffect(() => { void (async () => { const r = await lib.loadListen(); setSessions(r.sessions); setDigestCount(r.digestCount); })(); }, []);

  const generateDigest = async () => {
    setGenerating(true);
    try {
      const next = await lib.generateListenDigest();
      if (next) { setSessions(next); setDigestCount(0); } else setNotEnough(true);
    } catch { /* non-critical */ } finally { setGenerating(false); }
  };
  const toggleExpand = async (s: ListenSessionGroup) => {
    const wasExpanded = expanded[s.sessionId];
    setExpanded((prev) => ({ ...prev, [s.sessionId]: !wasExpanded }));
    if (!wasExpanded && !clipTexts[s.sessionId] && s.captureIds.length > 0) {
      try { setClipTexts((prev) => ({ ...prev, [s.sessionId]: [] })); const clips = await lib.loadListenClips(s.captureIds); setClipTexts((prev) => ({ ...prev, [s.sessionId]: clips })); } catch { /* non-critical */ }
    }
  };
  const formatDate = (iso: string) => new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const durationLabel = (start: string, end: string) => {
    const ms = new Date(end.includes('T') ? end : `${end.replace(' ', 'T')}Z`).getTime() - new Date(start.includes('T') ? start : `${start.replace(' ', 'T')}Z`).getTime();
    return `${Math.max(1, Math.round(ms / 60000))} min`;
  };

  if (sessions.length === 0) {
    return (
      <Stack gap="sm" style={{ paddingVertical: spacing.base }}>
        <Text variant="footnote" color="textFaint">No listen sessions yet.</Text>
        <Text variant="footnote" color="textMuted">Tap the Listen button in the header to start. LUCY captures ambient audio in batches — stop early and it processes immediately.</Text>
        <Text variant="caption" color="warning">⚠ Transcription requires an OpenAI API key (Settings → Remote intelligence).</Text>
      </Stack>
    );
  }
  return (
    <>
      {digestCount >= 5 ? (
        <Card onPress={() => void generateDigest()} level="surfaceAlt" border="accentLine" padding="md" disabled={generating} style={{ marginBottom: spacing.md }}>
          <Row gap="sm" align="center">
            <View style={{ flex: 1 }}>
              <Text variant="footnote" color="accentGlow" weight="700">{generating ? 'Generating digest…' : '✦ Generate Day Listen Digest'}</Text>
              <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>Stitch {digestCount} clips from today into one insight summary</Text>
            </View>
            {!generating ? <Ionicons name="chevron-forward" size={16} color={colors.accent} /> : null}
          </Row>
        </Card>
      ) : null}
      {sessions.map((s) => {
        const isDigest = s.sessionId.startsWith('digest_');
        return (
          <Card key={s.sessionId} level="surfaceAlt" padding="md" style={{ marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: isDigest ? colors.accent : BLUE }}>
            <Row gap="sm" align="flex-start">
              <View style={{ flex: 1 }}>
                <Text variant="caption" weight="700" tracking={1} style={{ color: isDigest ? colors.accentGlow : BLUE }}>{isDigest ? '✦ LISTEN DIGEST' : '🎙 LISTEN SESSION'}</Text>
                <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>{formatDate(s.startedAt)} · {durationLabel(s.startedAt, s.endedAt)} · {s.captureCount} clip{s.captureCount !== 1 ? 's' : ''}</Text>
              </View>
              <PressableScale onPress={() => void toggleExpand(s)} hitSlop={6} accessibilityLabel="Toggle session"><Ionicons name={expanded[s.sessionId] ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textMuted} /></PressableScale>
              <PressableScale onPress={() => setDeleteTarget({ sessionId: s.sessionId, captureIds: s.captureIds })} hitSlop={8} accessibilityLabel="Delete session"><Ionicons name="close" size={16} color={colors.danger} /></PressableScale>
            </Row>
            {!expanded[s.sessionId] ? s.snippets.map((snip, i) => (
              <Text key={i} variant="footnote" color="textMuted" numberOfLines={2} style={{ marginTop: i === 0 ? spacing.sm : 2 }}>"{snip}"</Text>
            )) : null}
            {expanded[s.sessionId] ? (
              <Stack gap="sm" style={{ marginTop: spacing.sm }}>
                {(clipTexts[s.sessionId]?.length ? clipTexts[s.sessionId] : s.snippets).map((text, i) => (
                  <Surface key={i} level="surface" radius="sm" padding="sm">
                    <Text variant="caption" weight="700" tracking={1} style={{ color: BLUE }}>CLIP {i + 1}</Text>
                    <Text variant="footnote" color="textMuted" style={{ marginTop: 2 }}>{text || '(no transcript)'}</Text>
                  </Surface>
                ))}
              </Stack>
            ) : null}
          </Card>
        );
      })}
      <ActionSheet
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete listen session?"
        message="All clips from this session will be permanently removed."
        actions={deleteTarget ? [{ label: 'Delete', icon: 'trash-outline', destructive: true, onPress: async () => { const t = deleteTarget; await lib.deleteListenSession(t.captureIds); setSessions((prev) => prev.filter((s) => s.sessionId !== t.sessionId)); } }] : []}
      />
      <ActionSheet visible={notEnough} onClose={() => setNotEnough(false)} title="Not enough captures" message="Need at least 5 listen clips today to generate a digest." actions={[]} cancelLabel="OK" />
    </>
  );
}

// ─── Resources ────────────────────────────────────────────────────────────────────────
const PLATFORM_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  youtube: 'logo-youtube', instagram: 'logo-instagram', tiktok: 'logo-tiktok', twitter: 'logo-twitter', vimeo: 'videocam', web: 'link',
};
export function ResourcesTab() {
  const { colors, spacing } = useTheme();
  const lib = useLibrary();
  const [resources, setResources] = useState<Awaited<ReturnType<typeof lib.loadResources>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void (async () => { try { setResources(await lib.loadResources()); } finally { setLoading(false); } })(); }, []);
  const remove = async (id: number) => { await lib.deleteResource(id); setResources((prev) => prev.filter((r) => r.id !== id)); };

  if (loading) return <Loading />;
  if (resources.length === 0) {
    return (
      <Stack gap="sm" style={{ paddingVertical: spacing.base }}>
        <Text variant="footnote" color="textFaint">No saved resources yet.</Text>
        <Text variant="footnote" color="textMuted">Share a YouTube short, Instagram reel, TikTok, or article link to LUCY — it saves here, organized by topic.</Text>
      </Stack>
    );
  }
  const byTopic = new Map<string, typeof resources>();
  for (const r of resources) { const arr = byTopic.get(r.topic) ?? []; arr.push(r); byTopic.set(r.topic, arr); }
  return (
    <>
      {[...byTopic.entries()].map(([topic, items]) => (
        <View key={topic}>
          <SectionTitle title={topic} count={items.length} />
          {items.map((r) => (
            <Card key={r.id} onPress={() => void Linking.openURL(r.url).catch(() => {})} level="surfaceAlt" padding="md" style={{ marginBottom: spacing.sm }}>
              <Row gap="md" align="center">
                <Ionicons name={PLATFORM_ICON[r.platform] ?? 'link'} size={22} color={colors.accentGlow} />
                <View style={{ flex: 1 }}>
                  <Text variant="footnote" weight="600" numberOfLines={2}>{r.title}</Text>
                  <Text variant="caption" color="textMuted" style={{ marginTop: 2, textTransform: 'capitalize' }}>{r.platform}</Text>
                </View>
                <PressableScale onPress={() => void remove(r.id)} hitSlop={8} accessibilityLabel="Remove resource"><Ionicons name="close" size={16} color={colors.danger} /></PressableScale>
              </Row>
            </Card>
          ))}
        </View>
      ))}
    </>
  );
}

// ─── Meetings ────────────────────────────────────────────────────────────────────────
export function MeetingsTab() {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const lib = useLibrary();
  const [meetings, setMeetings] = useState<Awaited<ReturnType<typeof lib.loadMeetings>>>([]);
  const [selected, setSelected] = useState<(typeof meetings)[number] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(typeof meetings)[number] | null>(null);
  const meetingCardRef = useRef<View>(null);

  useEffect(() => { void (async () => setMeetings(await lib.loadMeetings()))(); }, []);
  const formatDate = (iso: string) => new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const parseArr = <T,>(s: string | null): T[] => { try { return s ? (JSON.parse(s) as T[]) : []; } catch { return []; } };

  if (meetings.length === 0) return <Text variant="footnote" color="textFaint" style={{ paddingVertical: spacing.sm }}>No meetings saved yet. Use Meeting Mode in the header to record and summarise a meeting.</Text>;
  return (
    <>
      {meetings.map((m) => {
        const actions = parseArr<{ task: string }>(m.action_items);
        return (
          <Card key={m.id} onPress={() => setSelected(m)} level="surfaceAlt" padding="md" style={{ marginBottom: spacing.sm }}>
            <Row gap="sm" align="flex-start">
              <View style={{ flex: 1 }}>
                <Text variant="footnote" weight="600">⌘ {m.title}</Text>
                <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>{formatDate(m.recorded_at)} · {m.duration_minutes} min</Text>
              </View>
              <PressableScale onPress={() => setDeleteTarget(m)} hitSlop={8} accessibilityLabel="Delete meeting"><Ionicons name="close" size={16} color={colors.danger} /></PressableScale>
            </Row>
            {m.headline ? <Text variant="footnote" color="textMuted" numberOfLines={2} style={{ marginTop: spacing.xs }}>{m.headline}</Text> : null}
            {actions.length > 0 ? <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>{actions.length} action item{actions.length !== 1 ? 's' : ''}</Text> : null}
          </Card>
        );
      })}

      <Modal transparent animationType="slide" visible={selected !== null} onRequestClose={() => setSelected(null)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }} onPress={() => setSelected(null)}>
          <Pressable>
            <Surface level="sheet" radius="xl" border="border" padding="base" style={{ maxHeight: '90%' }}>
              <Row justify="flex-end"><Button label="Done" variant="ghost" size="sm" onPress={() => setSelected(null)} /></Row>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View ref={meetingCardRef} collapsable={false} style={{ backgroundColor: colors.surface, borderRadius: theme.radius.lg, padding: spacing.md }}>
                  <Text variant="h3" numberOfLines={2}>{selected?.title}</Text>
                  <Text variant="caption" color="textMuted" style={{ marginTop: 2, marginBottom: spacing.md }}>{selected ? formatDate(selected.recorded_at) : ''} · {selected?.duration_minutes} min</Text>
                  {selected?.headline ? <Text variant="bodyMed" style={{ marginBottom: spacing.md }}>{selected.headline}</Text> : null}
                  {selected ? <MeetingDetail meeting={selected} parseArr={parseArr} /> : null}
                  <Text variant="caption" color="textMuted" weight="700" align="right" style={{ marginTop: spacing.lg }}>LUC<Text variant="caption" color="accent" weight="700">Y</Text> · meeting summary</Text>
                </View>
              </ScrollView>
              {selected ? <MeetingShareBar cardRef={meetingCardRef} getText={() => formatMeetingRowText(selected)} /> : null}
            </Surface>
          </Pressable>
        </Pressable>
      </Modal>

      <ActionSheet
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete meeting?"
        message="Removes this summary permanently."
        actions={deleteTarget ? [{ label: 'Delete', icon: 'trash-outline', destructive: true, onPress: async () => { const t = deleteTarget; await lib.deleteMeeting(t.id); setMeetings((prev) => prev.filter((x) => x.id !== t.id)); } }] : []}
      />
    </>
  );
}

function MeetingDetail({ meeting, parseArr }: { meeting: import('../../db/meetingSummaries').MeetingSummaryRow; parseArr: <T,>(s: string | null) => T[] }) {
  const { spacing } = useTheme();
  const decisions = parseArr<string>(meeting.key_decisions);
  const actions = parseArr<{ task: string; owner?: string; deadline?: string }>(meeting.action_items);
  const questions = parseArr<string>(meeting.open_questions);
  const attendees = parseArr<string>(meeting.attendees);
  const Label = ({ children }: { children: string }) => <Text variant="caption" color="accent" weight="700" tracking={1} style={{ marginTop: spacing.md, marginBottom: spacing.xs }}>{children}</Text>;
  return (
    <>
      {decisions.length > 0 ? <><Label>DECISIONS</Label>{decisions.map((d, i) => <Text key={i} variant="footnote" color="textMuted" style={{ marginBottom: 4 }}>• {d}</Text>)}</> : null}
      {actions.length > 0 ? <><Label>ACTION ITEMS</Label>{actions.map((a, i) => <Text key={i} variant="footnote" color="textMuted" style={{ marginBottom: 5 }}>→ {a.task}{a.owner ? ` (${a.owner})` : ''}{a.deadline ? ` · ${a.deadline}` : ''}</Text>)}</> : null}
      {questions.length > 0 ? <><Label>OPEN QUESTIONS</Label>{questions.map((q, i) => <Text key={i} variant="footnote" color="textMuted" style={{ marginBottom: 4 }}>? {q}</Text>)}</> : null}
      {meeting.next_steps ? <><Label>NEXT STEPS</Label><Text variant="footnote" color="textMuted">{meeting.next_steps}</Text></> : null}
      {attendees.length > 0 ? <Text variant="caption" color="textMuted" style={{ marginTop: spacing.md }}>Mentioned: {attendees.join(', ')}</Text> : null}
    </>
  );
}

// ─── People ────────────────────────────────────────────────────────────────────────
export function PeopleTab() {
  const { spacing } = useTheme();
  const lib = useLibrary();
  const [people, setPeople] = useState<Awaited<ReturnType<typeof lib.loadPeople>>>([]);
  const [storySubject, setStorySubject] = useState<StorySubject | null>(null);

  useEffect(() => { void (async () => setPeople(await lib.loadPeople()))(); }, []);
  if (people.length === 0) return <EmptyLine text="People will appear here as you capture notes mentioning names." />;
  return (
    <>
      {people.map((p) => {
        const daysSince = p.lastMentioned ? Math.floor((Date.now() - new Date(p.lastMentioned.includes('T') ? p.lastMentioned : `${p.lastMentioned.replace(' ', 'T')}Z`).getTime()) / 86400000) : null;
        const detail = [
          `${p.mentionCount} mention${p.mentionCount !== 1 ? 's' : ''}`,
          daysSince !== null ? (daysSince === 0 ? 'today' : `${daysSince}d ago`) : null,
          p.pendingFollowUps > 0 ? `${p.pendingFollowUps} follow-up${p.pendingFollowUps !== 1 ? 's' : ''} pending` : null,
        ].filter(Boolean).join(' · ');
        return (
          <Card key={p.name} onPress={() => setStorySubject({ kind: 'person', name: p.name, mentionCount: p.mentionCount, lastMentioned: p.lastMentioned, pendingFollowUps: p.pendingFollowUps, typicalContext: p.typicalContext })} level="surfaceAlt" padding="md" style={{ marginBottom: spacing.sm }}>
            <Text variant="footnote" weight="600">{p.name}</Text>
            <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>{detail}</Text>
          </Card>
        );
      })}
      <StoryView subject={storySubject} visible={storySubject !== null} onClose={() => setStorySubject(null)} />
    </>
  );
}
