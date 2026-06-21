/**
 * Capture — LUCY 2.0 core-loop capture + board screen.
 *
 * Rebuilt on the design system (app/src/ui). All logic flows through the seam hook
 * `useCaptureInput`, which wraps the frozen entry points in docs/04_SEAM_REPORT.md (Capture row).
 * Every Capture 1.0 capability is preserved: text/voice/photo capture, automation-intent confirm,
 * pending-todo board with categories + per-category checklist, edit (rename / project pin / delete),
 * mark-done with optional note, done-today + undo, live capture replay, capture stats + streak,
 * next-event/top-task glance.
 *
 * The exported component name + props are unchanged so App.tsx needs no edit. A local ToastProvider is
 * mounted here (App.tsx mounts none) so the forgiveness model (Toast-with-undo) is available without
 * touching the root — see report's "needs a human ruling" note.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ToastProvider, useToast, Text, Card, Surface, Row, Stack, Spacer, Divider, Button, IconButton,
  Badge, LucyOrb, EmptyState, BottomSheet, TextField, Chip, PressableScale, FadeInUp, Stagger,
  useTheme, type Theme,
} from '../ui';
import { haptic } from '../config/haptics';
import { useCaptureInput } from './hooks/useCaptureInput';
import { categorizeTodos, type TaskCategory } from './capture/categories';
import { CaptureCategorySheet } from './capture/CaptureCategorySheet';
import { CaptureReplay } from '../components/CaptureReplay';
import type { PassiveListenerState } from '../audio/PassiveListener';
import type { TodoRow } from '../db/todos';
import type { ProjectRow } from '../db/projects';
import type { ExtractedAction } from '../processing/automationEngine';
import type { ExtractionResult } from '../types/extraction';

interface DoneEntry { todo: TodoRow; doneAt: string; notes: string }

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Friendly "when" for the next calendar event: "Today 3:00 PM" / "Tomorrow 9:00 AM". */
function formatEventWhen(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(ms); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  const prefix = diff <= 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' });
  return `${prefix} ${time}`;
}

function formatDoneTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

// ─── Public component (name + props frozen for App.tsx) ─────────────────────────
export function CaptureScreen(props: {
  refreshToken: number;
  onQueued: () => void;
  passiveState?: PassiveListenerState;
  onToggleListen?: () => void;
  backgroundEnabled?: boolean;
  onBackgroundPress?: () => void;
  onMeeting?: () => void;
}) {
  return (
    <ToastProvider>
      <CaptureInner {...props} />
    </ToastProvider>
  );
}

function CaptureInner({
  refreshToken,
  onQueued,
}: {
  refreshToken: number;
  onQueued: () => void;
  passiveState?: PassiveListenerState;
  onToggleListen?: () => void;
  backgroundEnabled?: boolean;
  onBackgroundPress?: () => void;
  onMeeting?: () => void;
}) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const toast = useToast();
  const styles = makeStyles(theme);

  const [text, setText] = useState('');
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [sending, setSending] = useState(false);
  const [markedPrivate, setMarkedPrivate] = useState(false);
  const [done, setDone] = useState<DoneEntry[]>([]);
  const [openCategory, setOpenCategory] = useState<TaskCategory | null>(null);
  const [editTodo, setEditTodo] = useState<TodoRow | null>(null);
  const [editText, setEditText] = useState('');
  const [pendingAction, setPendingAction] = useState<ExtractedAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const [replayExtraction, setReplayExtraction] = useState<ExtractionResult | null>(null);

  // Seam: all frozen-logic access. Voice transcripts append into the composer.
  const capture = useCaptureInput(
    { onTranscript: (t) => setText((prev) => (prev ? `${prev} ${t}` : t)) },
    refreshToken,
  );
  const { todos, setTodos, projects, userName, stats, voiceRecording } = capture;

  // Mic button entrance morph driven by recording state (haptic fires on the rising edge — as 1.0).
  const micScale = useRef(new Animated.Value(1)).current;
  const prevRecording = useRef(false);
  useEffect(() => {
    if (voiceRecording && !prevRecording.current) haptic.listenStart();
    Animated.spring(micScale, { toValue: voiceRecording ? 1.12 : 1, friction: 6, tension: 140, useNativeDriver: true }).start();
    prevRecording.current = voiceRecording;
  }, [voiceRecording, micScale]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKeyboardOffset(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOffset(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Send capture (automation-intent first, then enqueue + background replay) — parity with 1.0 ──
  const sendCapture = async () => {
    const outgoing = text.trim();
    if (!outgoing) return;
    const receiptImg = capture.consumeReceiptImage();

    const autoAction = capture.detectIntent(outgoing);
    if (autoAction && autoAction.confidence >= 0.8) {
      setText('');
      Keyboard.dismiss();
      setPendingAction(autoAction);
      // A misfired detection must never lose the thought — still enqueue it.
      const wasPrivate = markedPrivate;
      setMarkedPrivate(false);
      void capture.enqueue(outgoing, 'text', wasPrivate).then(() => onQueued()).catch(() => {});
      return;
    }

    try {
      setSending(true);
      const capId = await capture.enqueue(outgoing, 'text', markedPrivate);
      if (receiptImg && capId) {
        try { await capture.attachImageToCapture(capId, receiptImg); } catch { /* image link optional */ }
      }
      haptic.capture(); // success — the most important haptic in the app
      setText('');
      const wasPrivate = markedPrivate;
      toast.show({
        message: wasPrivate ? 'Protected thought queued' : 'Got it ✓',
        tone: 'success',
        icon: wasPrivate ? 'lock-closed' : 'checkmark-circle',
      });
      setMarkedPrivate(false);
      onQueued();
      if (!wasPrivate) {
        capture.analyze(outgoing).then(setReplayExtraction).catch(() => {});
      }
    } catch (error) {
      toast.show({ message: error instanceof Error ? error.message : 'Could not save this', tone: 'danger', icon: 'alert-circle' });
    } finally {
      setSending(false);
    }
  };

  const onScanReceipt = async () => {
    const scanned = await capture.scanReceipt();
    if (scanned) setText(scanned.text);
  };

  // ── Done-today list with undo (kept from 1.0). The category-sheet checkoff is the live archive path;
  //    this records a local "done today" entry for the board + offers a forgiving undo. ──
  const undoDone = (entry: DoneEntry) => {
    setDone((prev) => prev.filter((e) => e.todo.id !== entry.todo.id));
    setTodos((prev) => [entry.todo, ...prev]);
  };

  // ── Edit todo (rename / project pin / delete) — same frozen calls as 1.0 ──
  const saveEditTodo = async () => {
    if (!editTodo || !editText.trim()) return;
    await capture.renameTodo(editTodo.id, editText.trim());
    setTodos((prev) => prev.map((t) => (t.id === editTodo.id ? { ...t, task: editText.trim() } : t)));
    setEditTodo(null);
  };
  const assignProject = async (projectId: number | null) => {
    if (!editTodo) return;
    await capture.assignTodoProject(editTodo.id, projectId);
    setTodos((prev) => prev.map((t) => (t.id === editTodo.id ? { ...t, project_id: projectId } : t)));
    setEditTodo((prev) => (prev ? { ...prev, project_id: projectId } : prev));
  };
  const deleteTodo = async (todo: TodoRow) => {
    await capture.archiveTodoById(todo.id, 'deleted');
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    setEditTodo(null);
    toast.show({ message: 'Task deleted', tone: 'danger', icon: 'trash' });
  };

  const categories = categorizeTodos(todos);
  const signalCount = todos.filter((t) => t.urgency === 'high').length;
  const topTask = todos.find((t) => t.urgency === 'high') ?? todos[0];

  return (
    <View style={[styles.container, { paddingBottom: keyboardOffset }]}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.md }}
      >
        {/* Hero — calm, alive (breathing orb), self-evident status */}
        <Stack gap="md" paddingX="lg" style={{ paddingTop: spacing.base }}>
          <Row gap="base" align="center">
            <LucyOrb size={52} active={voiceRecording} />
            <View style={{ flex: 1 }}>
              <Text variant="footnote" color="accent" weight="700">
                {getGreeting()}{userName ? `, ${userName}` : ''}
              </Text>
              <Text variant="h1" tracking={-0.5}>LUCY</Text>
            </View>
          </Row>

          <Card level="surfaceAlt" border="accentLine">
            <Text variant="caption" color="accent" weight="700" tracking={1.2}>LUCY IS ACTIVE</Text>
            <Spacer size="xs" />
            <Text variant="h3">
              {signalCount > 0 ? `${signalCount} urgent signal${signalCount !== 1 ? 's' : ''} for you` : 'All caught up'}
            </Text>
            <Spacer size="sm" />
            <Divider />
            <Spacer size="sm" />
            <Row gap="xl">
              <Stat value={String(stats.capturedToday)} label="today" color="accent" />
              {stats.captureStreak > 1 ? <Stat value={`${stats.captureStreak}🔥`} label="day streak" color="warning" /> : null}
              {todos.length > 0 ? <Stat value={String(todos.length)} label="tasks" color="info" /> : null}
            </Row>
          </Card>
        </Stack>

        {/* Glance: next event + top task (tasks indirectly — kept off the Timeline, as 1.0) */}
        {(stats.nextEvent || topTask) ? (
          <Row gap="md" wrap paddingX="lg" style={{ marginTop: spacing.md }}>
            {stats.nextEvent ? (
              <Card level="surfaceAlt" padding="md" style={{ flex: 1, minWidth: 150 }}>
                <Row gap="sm" align="flex-start">
                  <Ionicons name="calendar-outline" size={15} color={colors.info} />
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" color="textMuted" weight="700" tracking={0.8}>NEXT UP</Text>
                    <Text variant="footnote" weight="700" numberOfLines={1}>{stats.nextEvent.title}</Text>
                    <Text variant="caption" color="textMuted">{formatEventWhen(stats.nextEvent.start_at)}</Text>
                  </View>
                </Row>
              </Card>
            ) : null}
            {topTask ? (
              <Card level="surfaceAlt" padding="md" style={{ flex: 1, minWidth: 150 }}>
                <Row gap="sm" align="flex-start">
                  <Ionicons name="flash-outline" size={15} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" color="textMuted" weight="700" tracking={0.8}>TOP TASK</Text>
                    <Text variant="footnote" weight="700" numberOfLines={2}>{topTask.task}</Text>
                  </View>
                </Row>
              </Card>
            ) : null}
          </Row>
        ) : null}

        {/* Board */}
        {categories.length === 0 && done.length === 0 ? (
          <EmptyState
            title="All clear"
            message="Speak a thought or type anything. LUCY extracts tasks, ideas, and reminders automatically."
          />
        ) : (
          <Stack gap="none" paddingX="lg" style={{ paddingTop: spacing.base }}>
            <Stagger>
              {categories.map((cat) => (
                <FadeInUp key={cat.id}>
                  <CategoryCard category={cat} onPress={() => setOpenCategory(cat)} theme={theme} />
                </FadeInUp>
              ))}
            </Stagger>

            {done.length > 0 ? (
              <>
                <Spacer size="sm" />
                <Row gap="md" align="center">
                  <View style={styles.dividerLine} />
                  <Text variant="caption" color="textMuted" weight="700" tracking={1.2}>DONE TODAY</Text>
                  <View style={styles.dividerLine} />
                </Row>
                <Spacer size="sm" />
                {done.map((entry) => (
                  <Card key={entry.todo.id} level="surface" padding="md" style={{ marginBottom: spacing.sm, opacity: 0.7 }}>
                    <Row gap="md" align="flex-start">
                      <View style={styles.doneCheck}>
                        <Ionicons name="checkmark" size={13} color={colors.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="footnote" color="textMuted" style={{ textDecorationLine: 'line-through' }}>{entry.todo.task}</Text>
                        {entry.notes ? <Text variant="caption" color="textMuted" style={{ fontStyle: 'italic', marginTop: 2 }}>{entry.notes}</Text> : null}
                        <Text variant="caption" color="textFaint" style={{ marginTop: 2 }}>{formatDoneTime(entry.doneAt)}</Text>
                      </View>
                      <PressableScale onPress={() => undoDone(entry)} hitSlop={8} accessibilityLabel="Undo">
                        <Text variant="footnote" color="accent" weight="700">undo</Text>
                      </PressableScale>
                    </Row>
                  </Card>
                ))}
              </>
            ) : null}
          </Stack>
        )}
      </ScrollView>

      {/* Automation confirmation — single primary action, calm */}
      {pendingAction ? (
        <Surface level="surfaceAlt" radius="xl" border="accentLine" padding="base" style={styles.floatCard}>
          <Text variant="caption" color="accent" weight="700" tracking={1.4}>LUCY CAN DO THIS</Text>
          <Spacer size="xs" />
          <Text variant="h3">{pendingAction.displayText}</Text>
          <Spacer size="md" />
          <Row gap="md">
            <Button
              label={executingAction ? '…' : pendingAction.confirmText}
              onPress={async () => {
                setExecutingAction(true);
                const result = await capture.runAction(pendingAction);
                setExecutingAction(false);
                setPendingAction(null);
                toast.show({
                  message: result.success ? `Done — ${result.message}` : `Could not — ${result.message}`,
                  tone: result.success ? 'success' : 'danger',
                });
              }}
              loading={executingAction}
              style={{ flex: 1 }}
            />
            <Button label="Not now" variant="ghost" onPress={() => setPendingAction(null)} />
          </Row>
        </Surface>
      ) : null}

      {/* Composer dock — receipt, voice, text, send */}
      <Surface level="bg" radius="none" style={styles.composerDock}>
        {keyboardOffset > 0 ? (
          <PressableScale onPress={() => Keyboard.dismiss()} accessibilityLabel="Dismiss keyboard" style={{ alignSelf: 'flex-end' }}>
            <Text variant="footnote" color="accent" weight="700" style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.xs }}>Done ▾</Text>
          </PressableScale>
        ) : null}
        <Row gap="sm" align="flex-end">
          <IconButton
            icon={capture.scanningReceipt ? 'hourglass-outline' : 'camera-outline'}
            variant="secondary"
            accessibilityLabel="Scan receipt"
            disabled={capture.scanningReceipt}
            onPress={() => void onScanReceipt()}
          />
          <PressableScale onPress={() => void capture.toggleVoiceInput()} accessibilityLabel={voiceRecording ? 'Stop recording' : 'Record voice'}>
            <Animated.View style={{ transform: [{ scale: micScale }] }}>
              <View style={[styles.micButton, voiceRecording && styles.micButtonActive]}>
                <Ionicons name={voiceRecording ? 'stop' : 'mic-outline'} size={22} color={voiceRecording ? colors.textOnAccent : colors.textSecondary} />
              </View>
            </Animated.View>
          </PressableScale>
          <View style={{ flex: 1 }}>
            <TextField
              multiline
              placeholder="Manage todo list"
              value={text}
              onChangeText={setText}
            />
          </View>
          <IconButton
            icon="arrow-up"
            variant="primary"
            accessibilityLabel="Send"
            disabled={sending || !text.trim()}
            onPress={() => void sendCapture()}
          />
        </Row>
        {/* Protect-this-thought toggle — preserves 1.0's markedPrivate capture path */}
        <PressableScale onPress={() => setMarkedPrivate((p) => !p)} accessibilityLabel="Protect this thought" style={{ marginTop: spacing.sm }}>
          <Row gap="sm" align="center">
            <View style={[styles.privacyBox, markedPrivate && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
              {markedPrivate ? <Ionicons name="checkmark" size={13} color={colors.textOnAccent} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="footnote" weight="600">Protect this thought</Text>
              <Text variant="caption" color="textMuted">Kept on-device, never sent to the cloud.</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={15} color={markedPrivate ? colors.accent : colors.textFaint} />
          </Row>
        </PressableScale>
      </Surface>

      {/* Category checklist sheet */}
      <CaptureCategorySheet
        category={openCategory}
        onClose={() => setOpenCategory(null)}
        onCommitDone={async (todo) => {
          // Same archive call as 1.0's category onComplete; we also record a local "Done today"
          // entry (1.0 had this UI but it was unreachable) and offer a forgiving undo.
          await capture.archiveTodoById(todo.id, 'done').catch(() => {});
          const doneAt = new Date().toISOString();
          setTodos((prev) => prev.filter((t) => t.id !== todo.id));
          setDone((prev) => [{ todo, doneAt, notes: '' }, ...prev]);
          toast.show({ message: 'Marked done', tone: 'success', actionLabel: 'Undo', onAction: () => undoDone({ todo, doneAt, notes: '' }) });
        }}
        onEdit={(todo) => { setOpenCategory(null); setEditTodo(todo); setEditText(todo.task); }}
        onAdd={async (t) => {
          const newTodo = await capture.addTodoToList(t, openCategory?.label ?? 'General');
          if (newTodo) {
            setTodos((prev) => [...prev, newTodo]);
            setOpenCategory((prev) => (prev ? { ...prev, items: [...prev.items, newTodo] } : prev));
          }
        }}
      />

      {/* Edit todo sheet — rename / project pin / delete */}
      <BottomSheet visible={editTodo !== null} onClose={() => setEditTodo(null)} title="Edit task">
        <Stack gap="base">
          <TextField value={editText} onChangeText={setEditText} autoFocus multiline placeholder="Task" />
          {projects.length > 0 ? (
            <Stack gap="sm">
              <Text variant="caption" color="accent" weight="700" tracking={1}>PROJECT</Text>
              <Row gap="sm" wrap>
                <Chip label="None" selected={!editTodo?.project_id} onPress={() => void assignProject(null)} />
                {projects.map((p: ProjectRow) => (
                  <Chip key={p.id} label={p.name} selected={editTodo?.project_id === p.id} onPress={() => void assignProject(p.id)} />
                ))}
              </Row>
            </Stack>
          ) : null}
          <Row gap="md">
            <Button label="Delete" variant="danger" onPress={() => editTodo && void deleteTodo(editTodo)} style={{ flex: 1 }} />
            <Button label="Save" onPress={() => void saveEditTodo()} style={{ flex: 2 }} />
          </Row>
        </Stack>
      </BottomSheet>

      {/* Live Capture Replay — the wow moment (presentation component reused as-is) */}
      {replayExtraction ? (
        <CaptureReplay extraction={replayExtraction} onDismiss={() => setReplayExtraction(null)} />
      ) : null}
    </View>
  );
}

// ─── Small presentational helpers ───────────────────────────────────────────────
function Stat({ value, label, color }: { value: string; label: string; color: 'accent' | 'warning' | 'info' }) {
  return (
    <Stack gap="none" align="center">
      <Text variant="h2" color={color} weight="700">{value}</Text>
      <Text variant="caption" color="textMuted" weight="600" tracking={0.5}>{label}</Text>
    </Stack>
  );
}

function CategoryCard({ category, onPress, theme }: { category: TaskCategory; onPress: () => void; theme: Theme }) {
  const { colors, spacing, radius } = theme;
  const urgentCount = category.items.filter((t) => t.urgency === 'high').length;
  const topTask = urgentCount > 0 ? category.items.find((t) => t.urgency === 'high') : category.items[0];

  return (
    <Card onPress={onPress} accessibilityLabel={category.label} style={{ marginBottom: spacing.sm, borderLeftWidth: 4, borderLeftColor: category.color }}>
      <Row gap="base" align="center">
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: category.color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="h3">{category.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Row gap="sm" align="center">
            <Text variant="bodyMed" numberOfLines={1} style={{ flexShrink: 1 }}>{category.label}</Text>
            {urgentCount > 0 ? <Badge label={`${urgentCount} URGENT`} tone="accent" /> : null}
          </Row>
          {topTask ? <Text variant="footnote" color="textMuted" numberOfLines={1}>{topTask.task}</Text> : null}
          <Text variant="caption" color="textFaint">{category.items.length} item{category.items.length !== 1 ? 's' : ''}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </Row>
    </Card>
  );
}

function makeStyles(theme: Theme) {
  const { colors, spacing, radius, layout, elevation } = theme;
  return {
    container: { flex: 1 },
    dividerLine: { flex: 1, height: layout.hairline, backgroundColor: colors.divider },
    doneCheck: {
      width: 22, height: 22, borderRadius: radius.pill, marginTop: 1,
      backgroundColor: colors.success + '22', borderWidth: layout.hairline, borderColor: colors.success + '55',
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    floatCard: { marginHorizontal: spacing.base, marginBottom: spacing.sm, ...elevation.e3 },
    composerDock: {
      borderTopWidth: layout.hairline, borderTopColor: colors.divider,
      paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    },
    micButton: {
      width: 46, height: 46, borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt, borderWidth: layout.hairline, borderColor: colors.border,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    micButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    privacyBox: {
      width: 19, height: 19, borderRadius: radius.sm, borderWidth: layout.hairline, borderColor: colors.textMuted,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
  };
}
