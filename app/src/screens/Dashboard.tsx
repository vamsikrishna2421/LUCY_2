import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReviewCardDeck, type ReviewCard } from '../components/ReviewCardDeck';
import { LucyEmptyState } from '../components/LucyEmptyState';
import { LUCY_COLORS } from '../config/colors';
import { getDatabase } from '../db';
import { answerContextRequest, type ContextRequestRow } from '../db/contextRequests';
import { protectedPreview } from '../processing/privacy';
import { organizeMemory } from '../processing/organizer';
import { AskScreen } from './Ask';
// Redesigned Dashboard views (design system + per-view seam hooks). The whole Dashboard is rebuilt on
// app/src/ui; this file is now just the shell + the (unchanged) NeedsContextView export.
import { TimelineView } from './dashboard/TimelineView';
import { FocusNowView } from './dashboard/FocusNowView';
import { LibraryView, type LibraryTab } from './dashboard/LibraryView';
import { HealthView } from './dashboard/HealthView';
import { useDashboardData } from './hooks/useDashboardData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text as DsText, Stack, SegmentedControl as DsSegmentedControl, tokens as dsTokens } from '../ui';

const VIEW_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Timeline': 'time-outline',
  'Focus Now': 'flash-outline',
  'Ask Lucy': 'chatbubble-ellipses-outline',
  'Health': 'heart-outline',
};

type ViewMode = 'Focus Now' | 'Timeline' | 'Ask Lucy' | 'Health' | 'Brain';
// LibraryTab is imported from ./dashboard/LibraryView (single source of truth).

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardScreen({ refreshToken, onAskAbout, requestedView, requestKey, onViewChange, initialAskQuestion }: {
  refreshToken: number;
  onAskAbout?: (question: string) => void;
  requestedView?: ViewMode;
  requestKey?: number;
  onViewChange?: (v: ViewMode) => void;
  initialAskQuestion?: string;
}) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ViewMode>('Timeline');
  const [tab, setTab] = useState<LibraryTab>('Home');
  const [contextRefresh, setContextRefresh] = useState(0);

  // Allow the parent (bottom nav) to push a view in (e.g. Brain, Ask Lucy). Tapping Workspace always
  // lands on its Home grid, not whatever sub-section (Calendar/Documents) was last open.
  useEffect(() => {
    if (requestedView) setView(requestedView);
    if (requestedView === 'Brain') setTab('Home');
  }, [requestKey]);

  // Report the current view up so the bottom nav can highlight Home vs Brain.
  useEffect(() => { onViewChange?.(view); }, [view]);

  // All cross-cutting data comes from the seam hook (same frozen calls as Dashboard 1.0's load effect).
  const data = useDashboardData(refreshToken, contextRefresh);
  const { todos, ideas, expenses, reminders, captures, contextRequests, openLoops, followUps, moodTrend, onThisDay, moodsByCapture, userName, stalenessReviews, contextBatch } = data;

  const pendingTodos = todos.filter((item) => item.status === 'pending');
  const focusTasks = pendingTodos.filter((item) => item.urgency === 'high').slice(0, 3);
  const displayTasks = focusTasks.length ? focusTasks : pendingTodos.slice(0, 3);
  // Brain is reached via the bottom nav, so it's not in the top tab row.
  const views: ViewMode[] = ['Timeline', 'Focus Now', 'Ask Lucy', 'Health'];
  const viewOptions = views.map((v) => ({ value: v, label: v, icon: VIEW_ICON[v] }));

  // Lucy "speaks" — a warm, reactive greeting that mirrors the day's state. The breathing orb is the
  // global overlay (App.tsx) that sits in this hero's top-right, so the copy reads as her voice.
  const heroLine = pendingTodos.length
    ? `I'm holding ${pendingTodos.length} open task${pendingTodos.length === 1 ? '' : 's'} for you — tap Focus Now when you're ready.`
    : captures.length
      ? "You're all caught up. I'll keep watch and tidy things quietly."
      : 'Hold the mic or snap anything — I\'ll organize what matters.';

  return (
    <View style={{ flex: 1, paddingHorizontal: dsTokens.spacing.base, paddingTop: insets.top + dsTokens.spacing.sm }}>
      <Stack gap="xxs" style={{ marginBottom: dsTokens.spacing.md }}>
        <DsText variant="footnote" color="accent" weight="700">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</DsText>
        <DsText variant="h1" numberOfLines={1}>{greetingForHour(new Date().getHours())}{userName ? `, ${userName}` : ''}</DsText>
        <DsText variant="footnote" color="textMuted" numberOfLines={2}>{heroLine}</DsText>
      </Stack>
      <DsSegmentedControl options={viewOptions} value={view} onChange={setView} style={{ marginBottom: dsTokens.spacing.md }} />
      {view === 'Focus Now' ? <FocusNowView todos={displayTasks} reminders={reminders} captures={captures} contextCount={contextRequests.length} openLoops={openLoops} followUps={followUps} moodTrend={moodTrend} onThisDay={onThisDay} onOpenContext={() => {}} onLoopResolved={() => setContextRefresh((v) => v + 1)} stalenessReviews={stalenessReviews} contextBatch={contextBatch} onStalenessResolved={() => setContextRefresh((v) => v + 1)} /> : null}
      {view === 'Timeline' ? <TimelineView captures={captures} moodsByCapture={moodsByCapture} onFeedback={() => setContextRefresh((v) => v + 1)} onQueued={() => setContextRefresh((v) => v + 1)} onAskAbout={onAskAbout} /> : null}
      {view === 'Ask Lucy' ? <AskScreen initialQuestion={initialAskQuestion} /> : null}
      {view === 'Brain' ? <LibraryView tab={tab} setTab={setTab} todos={todos} ideas={ideas} expenses={expenses} /> : null}
      {view === 'Health' ? <HealthView /> : null}
    </View>
  );
}

// ─── (Extraction chips + organizing dots moved to ./dashboard/helpers) ───

export function NeedsContextView({
  requests,
  onAnswered,
}: {
  requests: ContextRequestRow[];
  onAnswered: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [proposals, setProposals] = useState<import('../db/memoryUpdateProposals').MemoryUpdateProposalRow[]>([]);
  const [feedbackOpen, setFeedbackOpen] = useState<Record<number, boolean>>({});
  const [feedbackText, setFeedbackText] = useState<Record<number, string>>({});
  const [entityProps, setEntityProps] = useState<import('../db/entityEditProposals').EntityEditProposalRow[]>([]);

  const loadProposals = async () => {
    const db = await getDatabase();
    const { listOpenMemoryUpdateProposals } = await import('../db/memoryUpdateProposals');
    setProposals(await listOpenMemoryUpdateProposals(db));
    const { listOpenEntityEditProposals } = await import('../db/entityEditProposals');
    setEntityProps(await listOpenEntityEditProposals(db));
  };
  useEffect(() => { void loadProposals(); }, [requests.length]);

  const applyEntityProp = async (id: number) => {
    const db = await getDatabase();
    const { applyEntityEditProposal } = await import('../db/entityEditProposals');
    await applyEntityEditProposal(db, id);
    setEntityProps((p) => p.filter((x) => x.id !== id));
    onAnswered();
  };
  const dismissEntityProp = async (id: number) => {
    const db = await getDatabase();
    const { setEntityEditProposalStatus } = await import('../db/entityEditProposals');
    await setEntityEditProposalStatus(db, id, 'dismissed');
    setEntityProps((p) => p.filter((x) => x.id !== id));
    onAnswered();
  };

  // Self-improving brain (propose-and-confirm): apply folds the context into the OLD note + re-extracts.
  const applyProposal = async (id: number) => {
    const db = await getDatabase();
    const { applyMemoryUpdateProposal } = await import('../processing/proposeMemoryUpdates');
    await applyMemoryUpdateProposal(db, id);
    setProposals((p) => p.filter((x) => x.id !== id));
    onAnswered();
  };
  const dismissProposal = async (id: number) => {
    const db = await getDatabase();
    const { setMemoryUpdateProposalStatus } = await import('../db/memoryUpdateProposals');
    await setMemoryUpdateProposalStatus(db, id, 'dismissed');
    setProposals((p) => p.filter((x) => x.id !== id));
  };
  // "No, that's wrong" — reject the proposal AND teach LUCY the correction so it sticks and isn't
  // re-suggested (the opposite of silently accepting a bad change).
  const rejectProposal = async (id: number) => {
    const note = (feedbackText[id] ?? '').trim();
    const db = await getDatabase();
    if (note) {
      try {
        const { upsertLearnedFact } = await import('../db/learnedProfile');
        await upsertLearnedFact(db, 'correction', note, 'feedback');
      } catch { /* non-fatal */ }
    }
    const { setMemoryUpdateProposalStatus } = await import('../db/memoryUpdateProposals');
    await setMemoryUpdateProposalStatus(db, id, 'dismissed');
    setProposals((p) => p.filter((x) => x.id !== id));
    setFeedbackOpen((f) => ({ ...f, [id]: false }));
    setFeedbackText((f) => ({ ...f, [id]: '' }));
    onAnswered();
  };

  const rememberContext = async (request: ContextRequestRow) => {
    const answer = (answers[request.id] ?? '').trim();
    if (!answer) {
      return;
    }
    const db = await getDatabase();
    await answerContextRequest(db, request.id, answer);
    // Make the answer actually CORRECT the brain: append it to the source capture as a marked
    // addendum (original words preserved) and re-extract, so anything mis-stored / mis-linked /
    // mis-understood is re-derived with the new context — not just filed as a side "clarification".
    if (request.capture_id) {
      try {
        const cap = await db.getFirstAsync<{ raw_transcript: string | null }>(
          'SELECT raw_transcript FROM captures WHERE id = ?', request.capture_id,
        );
        const base = (cap?.raw_transcript ?? '').trim();
        const q = (request.question || 'clarification').replace(/\s+/g, ' ').trim();
        const addendum = `\n\n[Added context — ${q}: ${answer}]`;
        await db.runAsync('UPDATE captures SET raw_transcript = ? WHERE id = ?', base + addendum, request.capture_id);
        const { resetCaptureForReprocess } = await import('../db/captures');
        await resetCaptureForReprocess(db, request.capture_id);
        const { processQueue } = await import('../processing/extract');
        void processQueue();
      } catch { /* non-fatal — the organize below still records the clarification */ }
    }
    await organizeMemory(db, 'clarification');
    setAnswers((existing) => ({ ...existing, [request.id]: '' }));
    onAnswered();
  };

  // One card per item, rendered one-at-a-time in a full-screen swipeable deck (proposals first).
  const deckCards: ReviewCard[] = [
    ...entityProps.map((p) => ({
      key: `ent-${p.id}`,
      render: () => (
        <View>
          <Text style={styles.contextLucyLabel}>this looks related to a project —</Text>
          <Text style={styles.contextQuestion}>Add this note to “{p.project_name ?? 'a project'}”?</Text>
          {p.suggested_text ? <Text style={styles.contextSnippet} numberOfLines={5}>{protectedPreview(p.suggested_text)}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={[styles.contextButton, { flex: 1 }]} onPress={() => void applyEntityProp(p.id)}>
              <Text style={styles.contextButtonText}>Add to project</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contextButton, styles.contextButtonDisabled, { flex: 0, paddingHorizontal: 18 }]} onPress={() => void dismissEntityProp(p.id)}>
              <Text style={styles.contextButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      ),
    })),
    ...proposals.map((p) => ({
      key: `prop-${p.id}`,
      render: () => (
        <View>
          <Text style={styles.contextLucyLabel}>{p.kind === 'correction' ? 'i think this corrects an earlier note —' : 'i can enrich an earlier note —'}</Text>
          <Text style={styles.contextQuestion}>{p.summary}</Text>
          {(p.old_created_at || p.old_title) ? (
            <Text style={styles.contextSource}>
              Earlier note{p.old_created_at ? ` · ${new Date(`${String(p.old_created_at).replace(' ', 'T')}Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}{p.old_title ? ` · ${p.old_title}` : ''}
            </Text>
          ) : null}
          {p.old_excerpt ? <Text style={styles.contextSnippet} numberOfLines={4}>Old: "{protectedPreview(p.old_excerpt)}"</Text> : null}
          <Text style={[styles.contextSnippet, { color: LUCY_COLORS.primaryGlow }]} numberOfLines={4}>Add: {protectedPreview(p.suggested_context)}</Text>
          {feedbackOpen[p.id] ? (
            <>
              <TextInput
                multiline
                placeholder="What's actually right? (e.g. it's 'AD groups' — Azure AD, not 'AB')"
                placeholderTextColor={LUCY_COLORS.textSubtle}
                style={styles.contextInput}
                value={feedbackText[p.id] ?? ''}
                onChangeText={(v) => setFeedbackText((f) => ({ ...f, [p.id]: v }))}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity style={[styles.contextButton, { flex: 1 }]} onPress={() => void rejectProposal(p.id)}>
                  <Text style={styles.contextButtonText}>Send feedback & discard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.contextButton, styles.contextButtonDisabled, { flex: 0, paddingHorizontal: 16 }]} onPress={() => setFeedbackOpen((f) => ({ ...f, [p.id]: false }))}>
                  <Text style={styles.contextButtonText}>Back</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.contextButton, { flex: 1 }]} onPress={() => void applyProposal(p.id)}>
                <Text style={styles.contextButtonText}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.contextButton, styles.contextButtonDisabled, { flex: 1 }]} onPress={() => setFeedbackOpen((f) => ({ ...f, [p.id]: true }))}>
                <Text style={styles.contextButtonText}>No, that's wrong</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.contextButton, styles.contextButtonDisabled, { flex: 0, paddingHorizontal: 14 }]} onPress={() => void dismissProposal(p.id)}>
                <Text style={styles.contextButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ),
    })),
    ...requests.map((request) => ({
      key: `req-${request.id}`,
      render: () => (
        <View>
          <Text style={styles.contextLucyLabel}>hey, quick question —</Text>
          <Text style={styles.contextQuestion}>
            {request.question || 'Can you add any context that might help me organize this memory?'}
          </Text>
          {(request.source_created_at || request.source_title) ? (
            <Text style={styles.contextSource}>
              From your note{request.source_created_at ? ` · ${new Date(`${String(request.source_created_at).replace(' ', 'T')}Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}{request.source_title ? ` · ${request.source_title}` : ''}
            </Text>
          ) : null}
          {(request.source_excerpt || request.snippet) ? (
            <Text style={styles.contextSnippet} numberOfLines={5}>You said: "{protectedPreview(request.source_excerpt || request.snippet || '')}"</Text>
          ) : null}
          <TextInput
            multiline
            placeholder="Your answer here..."
            placeholderTextColor={LUCY_COLORS.textSubtle}
            style={styles.contextInput}
            value={answers[request.id] ?? ''}
            onChangeText={(value) => setAnswers((existing) => ({ ...existing, [request.id]: value }))}
          />
          <TouchableOpacity
            style={[styles.contextButton, !(answers[request.id] ?? '').trim() && styles.contextButtonDisabled]}
            disabled={!(answers[request.id] ?? '').trim()}
            onPress={() => void rememberContext(request)}
          >
            <Text style={styles.contextButtonText}>Tell LUCY</Text>
          </TouchableOpacity>
        </View>
      ),
    })),
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 80}>
      <ReviewCardDeck
        cards={deckCards}
        emptyText="Nothing needs clarification right now. LUCY will ask only when extra context can help."
        emptyNode={(
          <LucyEmptyState
            title="All clear"
            message="Nothing needs clarification right now. I'll only ask when a little context helps me help you."
          />
        )}
        header={(
          <View style={[styles.contextIntro, { paddingHorizontal: 18 }]}>
            <Text style={styles.eyebrow}>CONNECT</Text>
            <Text style={styles.tonightTitle}>Needs Context</Text>
            <Text style={styles.tonightDetail}>One at a time — swipe through. Your answers stay in encrypted local memory.</Text>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  homeHero: { position: 'relative', overflow: 'hidden', backgroundColor: LUCY_COLORS.surface, borderWidth: 1, borderColor: LUCY_COLORS.borderSoft, borderRadius: 18, paddingLeft: 14, paddingRight: 70, paddingTop: 10, paddingBottom: 10, marginTop: 6, marginBottom: 8 },
  homeHeroGlow: { position: 'absolute', right: -72, top: -92, width: 156, height: 156, borderRadius: 78, backgroundColor: 'rgba(255,140,66,0.10)' },
  todayDate: { color: LUCY_COLORS.primaryGlow, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2, textTransform: 'uppercase' },
  title: { fontSize: 22, letterSpacing: -0.2, fontWeight: '900', color: LUCY_COLORS.textDark, lineHeight: 25 },
  subtitle: { color: LUCY_COLORS.textMuted, fontSize: 12.5, marginTop: 3, lineHeight: 17, maxWidth: 280 },
  viewNav: { marginBottom: 8 },
  // "Today" glance strip
  content: { flex: 1 },
  tonight: { backgroundColor: LUCY_COLORS.surface, borderColor: LUCY_COLORS.primarySoft, borderWidth: 1, borderRadius: 24, padding: 19, marginBottom: 16 },
  eyebrow: { color: LUCY_COLORS.primaryGlow, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  tonightTitle: { color: LUCY_COLORS.textDark, fontSize: 21, fontWeight: '700', marginTop: 9 },
  tonightDetail: { color: LUCY_COLORS.textMuted, fontSize: 14, marginTop: 7 },
  // Timeline
  tlDateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 13, marginBottom: 8 },
  tlDateLabel: { color: LUCY_COLORS.primary, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', flexShrink: 0 },
  tlDateLine: { flex: 1, height: 1, backgroundColor: LUCY_COLORS.divider },
  tlRow: { flexDirection: 'row', gap: 0, marginBottom: 5, alignItems: 'stretch' },
  tlLeft: { width: 18, alignItems: 'center', paddingTop: 14 },
  tlSpineWrap: { alignItems: 'center', flex: 1 },
  tlDot: { width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.45, shadowRadius: 3, elevation: 2 },
  tlLine: { width: 1, backgroundColor: LUCY_COLORS.divider, flex: 1, minHeight: 36 },
  tlCard: { flex: 1, backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 14, borderWidth: 1, borderColor: LUCY_COLORS.border, borderTopColor: LUCY_COLORS.primaryLine, marginBottom: 0, flexDirection: 'row', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.16, shadowRadius: 5, elevation: 2 },
  tlCardExpanded: { borderColor: 'rgba(255,140,66,0.32)' },
  tlAccent: { width: 2, borderRadius: 0 },
  tlCardContent: { flex: 1, paddingTop: 8, paddingBottom: 9, paddingHorizontal: 10, gap: 0 },

  // Header row: source badge + type pill + privacy dot
  tlCardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  tlTimeChip: { color: LUCY_COLORS.textSubtle, fontSize: 10.5, fontWeight: '800', minWidth: 45 },
  tlSourceBadge: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  tlTypePill: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.28)',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tlTypePillText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.05 },
  tlShieldPillText: { fontSize: 12, marginRight: 3 },

  // Card body
  tlTitle: { color: LUCY_COLORS.textDark, fontSize: 13.5, fontWeight: '700', lineHeight: 18, marginBottom: 0 },

  // Summary text — the main readable body
  tlSummaryText: {
    color: LUCY_COLORS.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '400',
  },
  tlSnippet: { color: LUCY_COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  tlKeyPoints: { marginTop: 8, gap: 3 },
  tlKeyPoint: { color: LUCY_COLORS.textDark, fontSize: 12, lineHeight: 18 },
  tlActionBanner: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: LUCY_COLORS.primarySoft, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 8 },
  tlActionLabel: { color: LUCY_COLORS.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  tlActionText: { color: LUCY_COLORS.textDark, fontSize: 11.5, fontWeight: '700', flex: 1 },
  tlActionChevron: { color: LUCY_COLORS.primary, fontSize: 12, fontWeight: '900' },
  otdCard: { backgroundColor: LUCY_COLORS.surface, borderWidth: 1, borderColor: 'rgba(255,140,66,0.2)', borderRadius: 20, padding: 16, marginBottom: 14 },
  otdLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: LUCY_COLORS.primaryGlow, textTransform: 'uppercase', marginBottom: 6 },
  otdTitle: { fontSize: 15, fontWeight: '700', color: LUCY_COLORS.textDark, lineHeight: 22, marginBottom: 4 },
  otdSnippet: { fontSize: 13, color: LUCY_COLORS.textMuted, lineHeight: 19, fontStyle: 'italic' },
  otdMore: { fontSize: 11, color: LUCY_COLORS.textSubtle, marginTop: 6 },
  moodBar: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,140,66,0.12)' },
  moodLabel: { fontSize: 12, fontWeight: '700' },
  moodDots: { flexDirection: 'row', gap: 4 },
  moodDot: { width: 10, height: 10, borderRadius: 5 },
  contextPrompt: { backgroundColor: LUCY_COLORS.surfaceRaised, borderColor: LUCY_COLORS.primarySoft, borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 19 },
  contextPromptTitle: { color: LUCY_COLORS.textDark, fontSize: 17, fontWeight: '700', marginTop: 8 },
  contextIntro: { backgroundColor: LUCY_COLORS.surfaceRaised, borderColor: LUCY_COLORS.primarySoft, borderWidth: 1, borderRadius: 22, padding: 22, marginBottom: 14 },  // was 18
  contextCard: { backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 18, borderWidth: 1, borderColor: LUCY_COLORS.border, padding: 18, marginBottom: 12, gap: 9 },  // was 15
  contextLucyLabel: { color: LUCY_COLORS.primaryGlow, fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 },
  contextSnippet: { color: LUCY_COLORS.textMuted, fontSize: 13, fontStyle: 'italic' },
  contextSource: { color: LUCY_COLORS.textSubtle, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  contextQuestion: { color: LUCY_COLORS.textDark, fontSize: 17, fontWeight: '800', lineHeight: 24 },
  contextInput: { minHeight: 64, color: LUCY_COLORS.textDark, borderRadius: 13, borderWidth: 1, borderColor: LUCY_COLORS.border, backgroundColor: LUCY_COLORS.surface, padding: 12, textAlignVertical: 'top' },
  contextButton: { backgroundColor: LUCY_COLORS.primary, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  contextButtonDisabled: { opacity: 0.42 },
  contextButtonText: { color: LUCY_COLORS.white, fontWeight: '700' },
  knowledgeHero: { backgroundColor: LUCY_COLORS.surfaceRaised, borderColor: LUCY_COLORS.primarySoft, borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 15 },
  runTime: { color: LUCY_COLORS.textSubtle, fontSize: 12, marginTop: 10 },
  knowledgeCard: { backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 18, borderWidth: 1, borderColor: LUCY_COLORS.border, padding: 15, marginBottom: 10, gap: 7 },
  confidence: { color: LUCY_COLORS.primaryGlow, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  connection: { color: LUCY_COLORS.textDark, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  relation: { color: LUCY_COLORS.primaryGlow },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 8 },
  sectionTitleAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: LUCY_COLORS.primary },
  sectionTitle: { color: LUCY_COLORS.textDark, fontSize: 16, fontWeight: '800', flex: 1 },
  sectionTitleBadge: { backgroundColor: LUCY_COLORS.primarySoft, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  sectionTitleBadgeText: { color: LUCY_COLORS.primaryGlow, fontSize: 11, fontWeight: '800' },
  empty: { color: LUCY_COLORS.textMuted, backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 18, padding: 17, marginBottom: 17, lineHeight: 20 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 16, borderWidth: 1, borderColor: LUCY_COLORS.border, padding: 15, marginBottom: 10 },
  reminderText: { color: LUCY_COLORS.textDark, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  reminderMeta: { color: LUCY_COLORS.textMuted, fontSize: 12, marginTop: 4 },
  reminderDone: { backgroundColor: LUCY_COLORS.primarySoft, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  reminderDoneText: { color: LUCY_COLORS.primaryGlow, fontWeight: '700', fontSize: 13 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  galleryCell: { width: '32%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: LUCY_COLORS.surfaceRaised, borderWidth: 1, borderColor: LUCY_COLORS.border },
  galleryThumb: { width: '100%', height: '100%' },
  medAddBtn: { backgroundColor: LUCY_COLORS.primarySoft, borderRadius: 13, paddingVertical: 11, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: LUCY_COLORS.primaryLine },
  medAddBtnText: { color: LUCY_COLORS.primaryGlow, fontWeight: '800', fontSize: 14 },
  medForm: { backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 16, borderWidth: 1, borderColor: LUCY_COLORS.border, padding: 14, marginBottom: 14, gap: 10 },
  medInput: { backgroundColor: LUCY_COLORS.surface, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: LUCY_COLORS.textDark, fontSize: 14, borderWidth: 1, borderColor: LUCY_COLORS.border },
  medNote: { color: LUCY_COLORS.textSubtle, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
  medCard: { backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 16, borderWidth: 1, borderColor: LUCY_COLORS.border, padding: 15, marginBottom: 10 },
  medName: { color: LUCY_COLORS.textDark, fontSize: 16, fontWeight: '800', flex: 1 },
  medDose: { color: LUCY_COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  medRemove: { color: LUCY_COLORS.textSubtle, fontSize: 12, fontWeight: '700' },
  medTimes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  medTimeChip: { backgroundColor: LUCY_COLORS.surface, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: LUCY_COLORS.primaryLine },
  medTimeChipDone: { backgroundColor: 'rgba(52,199,89,0.12)', borderColor: 'rgba(52,199,89,0.4)' },
  medTimeText: { color: LUCY_COLORS.primaryGlow, fontWeight: '700', fontSize: 13 },
  medTimeTextDone: { color: '#2FBF71' },
  pendingHint: { color: LUCY_COLORS.textMuted, fontSize: 13, marginBottom: 17, paddingHorizontal: 3 },
  library: { flex: 1 },
  wsBack: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, marginBottom: 8 },
  wsBackText: { color: LUCY_COLORS.primary, fontSize: 14, fontWeight: '700' },
  wsBackTitle: { color: LUCY_COLORS.textDark, fontSize: 16, fontWeight: '700' },
  tabs: { flexGrow: 0, marginBottom: 15 },
  tab: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, marginRight: 7, backgroundColor: LUCY_COLORS.surfaceRaised },
  activeTab: { backgroundColor: LUCY_COLORS.primary },
  tabText: { color: LUCY_COLORS.textMuted, fontWeight: '600' },
  activeText: { color: LUCY_COLORS.white },
  card: { backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 18, borderWidth: 1, borderColor: LUCY_COLORS.border, borderTopColor: LUCY_COLORS.primaryLine, padding: 15, marginBottom: 10, gap: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 7, elevation: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, color: LUCY_COLORS.textDark, fontWeight: '700', fontSize: 16 },
  detail: { color: LUCY_COLORS.textMuted, fontSize: 14, lineHeight: 19 },
  loopCard: { backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 18, borderWidth: 1, borderColor: LUCY_COLORS.border, padding: 15, marginBottom: 10, gap: 10 },
  loopDescription: { color: LUCY_COLORS.textDark, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  resolveButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: LUCY_COLORS.primarySoft },
  resolveText: { color: LUCY_COLORS.primaryGlow, fontSize: 13, fontWeight: '600' },
  musicCard: { backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 18, borderWidth: 1, borderColor: LUCY_COLORS.border, padding: 15, marginBottom: 10, gap: 10 },
  musicInfo: { gap: 3 },
  musicTitle: { color: LUCY_COLORS.textDark, fontSize: 16, fontWeight: '700' },
  musicArtist: { color: LUCY_COLORS.primaryGlow, fontSize: 13, fontWeight: '600' },
  musicTime: { color: LUCY_COLORS.textSubtle, fontSize: 12 },
  musicActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  streamButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: '#1DB954' },
  streamButtonApple: { backgroundColor: '#fc3c44' },
  streamButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dismissText: { color: LUCY_COLORS.textSubtle, fontSize: 13, paddingVertical: 7 },
  captureRow: { backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 18, borderWidth: 1, borderColor: LUCY_COLORS.border, padding: 15, marginBottom: 10 },
  captureTitle: { color: LUCY_COLORS.textDark, fontSize: 15, fontWeight: '800', lineHeight: 21, marginBottom: 4 },  // was 700 — clearer hierarchy
  captureText: { color: LUCY_COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  captureTime: { color: LUCY_COLORS.textSubtle, fontSize: 12, marginTop: 7 },
  keyPoints: { marginTop: 8, gap: 3 },
  keyPoint: { color: LUCY_COLORS.textDark, fontSize: 13, lineHeight: 19 },
  structuredMemory: { backgroundColor: LUCY_COLORS.surface, borderRadius: 13, borderWidth: 1, borderColor: LUCY_COLORS.border, padding: 11, marginTop: 10 },
  structureToggle: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 4 },
  structureToggleText: { color: LUCY_COLORS.primaryGlow, fontSize: 12, fontWeight: '700' },
  structuredLabel: { color: LUCY_COLORS.primaryGlow, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 7 },
  structuredText: { color: LUCY_COLORS.textDark, fontSize: 13, lineHeight: 19 },
  captureMeta: { marginTop: 10, alignItems: 'center', justifyContent: 'flex-end', flexDirection: 'row', gap: 8 },
  captureStatus: { color: LUCY_COLORS.primaryGlow, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  tlQuickBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 14, borderWidth: 1, borderColor: LUCY_COLORS.primary + '44', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, gap: 10 },
  tlQuickInput: { flex: 1, color: LUCY_COLORS.textDark, fontSize: 15, paddingVertical: 0 },
  tlReceiptBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: LUCY_COLORS.surface, borderWidth: 1, borderColor: LUCY_COLORS.border },
  readingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  readingCard: { backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 18, paddingVertical: 26, paddingHorizontal: 30, alignItems: 'center', borderWidth: 1, borderColor: LUCY_COLORS.border, maxWidth: 280 },
  readingText: { color: LUCY_COLORS.textDark, fontSize: 16, fontWeight: '600', marginTop: 16 },
  readingSubText: { color: LUCY_COLORS.textSubtle, fontSize: 13, marginTop: 5, textAlign: 'center' },
  tlViewOriginal: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, backgroundColor: LUCY_COLORS.surface, borderWidth: 1, borderColor: LUCY_COLORS.border },
  tlViewOriginalText: { color: LUCY_COLORS.primary, fontSize: 12.5, fontWeight: '600' },
  imageViewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  imageViewerImg: { width: '94%', height: '80%' },
  imageViewerHint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 14 },
  tlReceiptIcon: { fontSize: 16 },
  tlQuickSend: { backgroundColor: LUCY_COLORS.primary, width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tlQuickSendText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 12, borderWidth: 1, borderColor: LUCY_COLORS.border, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, gap: 8 },
  searchInput: { flex: 1, color: LUCY_COLORS.textDark, fontSize: 14 },
  searchClear: { color: LUCY_COLORS.textSubtle, fontSize: 14, fontWeight: '700' },
  searchResultsLabel: { color: LUCY_COLORS.textSubtle, fontSize: 11, marginBottom: 8, fontWeight: '600' },
  captureActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: LUCY_COLORS.primarySoft, borderWidth: 1, borderColor: LUCY_COLORS.primarySoft },  // bigger tap target
  actionBtnText: { color: LUCY_COLORS.primary, fontSize: 12, fontWeight: '800' },
  actionOptionBtn: { backgroundColor: LUCY_COLORS.surfaceRaised, borderWidth: 1, borderColor: LUCY_COLORS.border, borderRadius: 12, padding: 14 },
  actionOptionText: { color: LUCY_COLORS.textDark, fontSize: 15, fontWeight: '600' },
  modalDone: { backgroundColor: LUCY_COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' as const },
  modalDoneText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalSkip: { borderWidth: 1, borderColor: LUCY_COLORS.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' as const },
  modalSkipText: { color: LUCY_COLORS.textMuted, fontSize: 15, fontWeight: '600' },
  feedbackBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: LUCY_COLORS.border, alignItems: 'center', justifyContent: 'center' },  // was 22 (too small)
  feedbackBtnText: { color: LUCY_COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  tlMenuBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tlMenuBtnText: { color: LUCY_COLORS.textMuted, fontSize: 20, fontWeight: '800', lineHeight: 20, marginTop: -4 },
  actionSheet: { backgroundColor: LUCY_COLORS.surfaceElevated ?? '#2A2219', borderRadius: 20, paddingVertical: 8, width: '100%', borderWidth: 1, borderColor: LUCY_COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 16, elevation: 12 },
  actionSheetTitle: { color: LUCY_COLORS.textSubtle, fontSize: 12, fontWeight: '700', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  actionSheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  actionSheetIcon: { width: 22, textAlign: 'center', color: LUCY_COLORS.textMuted, fontSize: 16, fontWeight: '700' },
  actionSheetLabel: { color: LUCY_COLORS.textDark, fontSize: 15, fontWeight: '600' },
  actionSheetPin: { paddingHorizontal: 20, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: LUCY_COLORS.divider },
  actionSheetPinLabel: { color: LUCY_COLORS.primaryGlow, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  actionSheetPinChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionSheetChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: LUCY_COLORS.surfaceRaised, borderWidth: 1, borderColor: LUCY_COLORS.border, maxWidth: 220 },
  actionSheetChipActive: { backgroundColor: LUCY_COLORS.primaryMist, borderColor: LUCY_COLORS.primary },
  actionSheetChipText: { color: LUCY_COLORS.textMuted, fontSize: 13, fontWeight: '700' },
  actionSheetChipTextActive: { color: LUCY_COLORS.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  feedbackModal: { backgroundColor: LUCY_COLORS.surfaceElevated ?? '#2A2219', borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: LUCY_COLORS.border, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 16, elevation: 12 },
  feedbackModalTitle: { color: LUCY_COLORS.primaryGlow, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  feedbackModalSub: { color: LUCY_COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  feedbackInput: { backgroundColor: LUCY_COLORS.surfaceRaised, borderRadius: 12, borderWidth: 1, borderColor: LUCY_COLORS.border, padding: 12, color: LUCY_COLORS.textDark, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  feedbackButtons: { flexDirection: 'row', gap: 10 },
  feedbackCancel: { flex: 1, paddingVertical: 12, borderRadius: 11, borderWidth: 1, borderColor: LUCY_COLORS.border, alignItems: 'center' },
  feedbackCancelText: { color: LUCY_COLORS.textMuted, fontWeight: '600' },
  feedbackSend: { flex: 2, paddingVertical: 12, borderRadius: 11, backgroundColor: LUCY_COLORS.primary, alignItems: 'center' },
  feedbackSendText: { color: '#fff', fontWeight: '700' },
  activity: { borderLeftWidth: 2, borderLeftColor: LUCY_COLORS.primary, paddingLeft: 12, paddingTop: 9, marginTop: 10 },
  activityTitle: { color: LUCY_COLORS.textDark, fontSize: 14, fontWeight: '600' },
  activityTime: { color: LUCY_COLORS.textMuted, fontSize: 12, marginTop: 3 },
});
