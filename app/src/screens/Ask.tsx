/**
 * Ask / Recall — LUCY 2.0 conversational memory screen.
 *
 * Rebuilt on the design system (app/src/ui). All logic flows through the seam hook `useAsk`, which
 * wraps the frozen entry points in docs/04_SEAM_REPORT.md (Ask row). Every Ask 1.0 capability is
 * preserved: insights (default view) with expand + ask-follow-up, history of past threads, chat with
 * quick questions, automation-intent confirm, all answer kinds (llm/memory/spending/schedule/tasks+
 * deadlines), action-plan apply, schedule commit, and the calm cold-start fallback.
 *
 * Exported name + props unchanged so App.tsx / Dashboard need no edit. A local ToastProvider is mounted
 * here (App.tsx mounts none) so non-scary feedback works without touching the root.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, View } from 'react-native';
import {
  ToastProvider, useToast, Text, Card, Surface, Row, Stack, Spacer, Button, IconButton, Chip,
  SegmentedControl, TextField, EmptyState, SkeletonText, FadeInUp, Stagger, useTheme,
} from '../ui';
import { useAsk, type AskHistoryItem } from './hooks/useAsk';
import { MessageBubble, type ChatMessage, type BubbleDeps } from './ask/AnswerBubbles';
import type { LucyAnswer } from '../processing/ask';
import type { AskThreadSummaryRow } from '../db/askThreads';
import type { GeneratedInsight } from '../processing/insightEngine';
import type { ExtractedAction } from '../processing/automationEngine';

const QUICK_QUESTIONS = [
  'What do I need to do today?',
  'What have I been stressed about lately?',
  'Who should I follow up with?',
  'What ideas have I had recently?',
  'How has my mood been this week?',
  'What expenses did I capture?',
];

const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'lucy',
  text: 'Ask about today, or name a project, area, or person to explore connected memory. I answer on this device.',
};

type AskView = 'new' | 'history' | 'insights' | 'thread';

export function AskScreen(props: { initialQuestion?: string } = {}) {
  return (
    <ToastProvider>
      <AskInner {...props} />
    </ToastProvider>
  );
}

function AskInner({ initialQuestion }: { initialQuestion?: string }) {
  const { spacing } = useTheme();
  const toast = useToast();
  const ask = useAsk();

  const [question, setQuestion] = useState(initialQuestion ?? '');
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [asking, setAsking] = useState(false);
  const [threadId, setThreadId] = useState<number>();
  const [view, setView] = useState<AskView>('insights');
  const [history, setHistory] = useState<AskThreadSummaryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [insights, setInsights] = useState<GeneratedInsight[]>([]);
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [pendingAction, setPendingAction] = useState<ExtractedAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const conversationRef = useRef<ScrollView>(null);

  const bubbleDeps: BubbleDeps = {
    isInvalidPendingTask: ask.isInvalidPendingTask,
    isInvalidDeadline: ask.isInvalidDeadline,
    protectedPreview: ask.protectedPreview,
    applyActions: ask.applyActions,
    summarizeAction: ask.summarizeAction,
    commitScheduleBlock: ask.commitScheduleBlock,
    onScheduleError: (message) => toast.show({ message, tone: 'danger', icon: 'calendar-outline' }),
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKeyboardOffset(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOffset(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => { void loadInsights(); }, []); // insights is the default view

  function scrollToLatest() {
    setTimeout(() => conversationRef.current?.scrollToEnd({ animated: true }), 20);
  }

  function startNewChat() {
    setView('new');
    setThreadId(undefined);
    setQuestion('');
    setMessages([welcomeMessage]);
  }

  async function loadInsights() {
    setLoadingInsights(true);
    try {
      setInsights(await ask.loadInsights());
    } finally {
      setLoadingInsights(false);
    }
  }

  async function openHistory() {
    setLoadingHistory(true);
    setHistory(await ask.loadThreads());
    setView('history');
    setLoadingHistory(false);
  }

  async function openThread(thread: AskThreadSummaryRow) {
    setLoadingHistory(true);
    const storedMessages = await ask.loadMessages(thread.id);
    const restored = storedMessages.flatMap<ChatMessage>((message) => {
      if (message.role === 'user' && message.text) {
        return [{ id: `stored-${message.id}`, role: 'user', text: message.text }];
      }
      if (message.role === 'lucy' && message.answer_json) {
        try {
          return [{ id: `stored-${message.id}`, role: 'lucy', answer: JSON.parse(message.answer_json) as LucyAnswer }];
        } catch {
          return [];
        }
      }
      return [];
    });
    setThreadId(thread.id);
    setMessages([welcomeMessage, ...restored]);
    setView('thread');
    setLoadingHistory(false);
    scrollToLatest();
  }

  async function submitAsk(presetQuestion?: string) {
    const trimmed = (presetQuestion ?? question).trim();
    if (!trimmed || asking) return;

    // Automation intent first (before the LLM) — identical gate to Ask 1.0.
    const autoAction = ask.detectIntent(trimmed);
    if (autoAction && autoAction.confidence >= 0.85) {
      setQuestion('');
      setPendingAction(autoAction);
      return;
    }

    const messageId = `${Date.now()}`;
    let currentThreadId = threadId;
    if (!currentThreadId) {
      currentThreadId = await ask.startThread(trimmed);
      setThreadId(currentThreadId);
      setView('thread');
    }
    await ask.saveUserMessage(currentThreadId, trimmed);
    setMessages((existing) => [...existing, { id: `user-${messageId}`, role: 'user', text: trimmed }]);
    setQuestion('');
    setAsking(true);
    scrollToLatest();

    try {
      // Build the same trailing-8 conversation history Ask 1.0 sent for follow-up context.
      const historyForLlm: AskHistoryItem[] = messages
        .map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('lucy' as const),
          content: m.role === 'user' ? (m.text ?? '') : (m.answer?.llmResponse ?? m.answer?.message ?? m.text ?? ''),
        }))
        .filter((h) => h.content.trim().length > 0)
        .slice(-8);
      const answer = await ask.ask(trimmed, historyForLlm);
      await ask.saveLucyMessage(currentThreadId, answer);
      setMessages((existing) => [...existing, { id: `lucy-${messageId}`, role: 'lucy', answer }]);
      if (answer.needsApiKey) {
        toast.show({ message: answer.message || 'Add your model API key in Settings → Remote intelligence.', tone: 'info', icon: 'key-outline' });
      }
    } catch {
      // Never leave the user with no reply — calm, non-scary, invites a retry (same fallback as 1.0).
      const fallback: LucyAnswer = {
        supported: true, answerKind: 'llm', title: '', message: '', tasks: [], deadlines: [],
        recordedSignal: '', llmResponse: 'I had a brief hiccup reaching that just now — give me another try in a moment and I’ll get it.',
      };
      setMessages((existing) => [...existing, { id: `lucy-${messageId}`, role: 'lucy', answer: fallback }]);
    } finally {
      setAsking(false);
      scrollToLatest();
    }
  }

  return (
    <View style={{ flex: 1, paddingBottom: keyboardOffset }}>
      {/* Heading + view switcher */}
      <Stack gap="sm" style={{ marginBottom: spacing.sm }}>
        <Row justify="space-between" align="center">
          <Text variant="h1">Ask LUCY</Text>
          <Row gap="xs">
            {view !== 'new' ? <Button label="New chat" variant="ghost" size="sm" onPress={startNewChat} /> : null}
            <IconButton icon="time-outline" variant="secondary" size="sm" accessibilityLabel="History" onPress={() => void openHistory()} />
          </Row>
        </Row>
        <SegmentedControl<'insights' | 'new' | 'history'>
          options={[
            { value: 'insights', label: 'Insights', icon: 'sparkles-outline' },
            { value: 'new', label: 'Ask', icon: 'chatbubble-outline' },
            { value: 'history', label: 'History', icon: 'time-outline' },
          ]}
          value={view === 'thread' ? 'new' : view}
          onChange={(v) => {
            if (v === 'insights') { setView('insights'); void loadInsights(); }
            else if (v === 'history') void openHistory();
            else setView('new');
          }}
        />
      </Stack>

      {/* Automation confirmation */}
      {pendingAction ? (
        <Surface level="surfaceAlt" radius="xl" border="accentLine" padding="base" style={{ marginBottom: spacing.sm }}>
          <Text variant="caption" color="accent" weight="700" tracking={1.4}>LUCY CAN DO THIS</Text>
          <Spacer size="xs" />
          <Text variant="h3">{pendingAction.displayText}</Text>
          <Spacer size="md" />
          <Row gap="md">
            <Button
              label={executingAction ? '…' : pendingAction.confirmText}
              loading={executingAction}
              onPress={async () => {
                setExecutingAction(true);
                const result = await ask.runAction(pendingAction);
                setExecutingAction(false);
                setPendingAction(null);
                setMessages((prev) => [...prev, {
                  id: `action-${Date.now()}`, role: 'lucy',
                  text: result.success ? `Done — ${result.message}` : `Hmm, ${result.message}`,
                }]);
              }}
              style={{ flex: 2 }}
            />
            <Button label="Not now" variant="ghost" onPress={() => setPendingAction(null)} style={{ flex: 1 }} />
          </Row>
        </Surface>
      ) : null}

      {view === 'insights' ? (
        <InsightsView
          insights={insights}
          loading={loadingInsights}
          expanded={expandedInsight}
          onToggle={(i) => setExpandedInsight(expandedInsight === i ? null : i)}
          onAskThis={(q) => { setView('new'); setQuestion(q); }}
          onOpenChat={() => { setView('new'); setQuestion(''); }}
        />
      ) : view === 'history' ? (
        <HistoryView history={history} loading={loadingHistory} onSelect={openThread} />
      ) : (
        <>
          <ScrollView
            ref={conversationRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: spacing.md, gap: spacing.sm }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => conversationRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((message) => <MessageBubble key={message.id} message={message} deps={bubbleDeps} />)}
            {messages.length === 1 ? (
              <Stack gap="sm" style={{ paddingTop: spacing.sm }}>
                <Text variant="caption" color="textMuted" weight="700" tracking={1.2}>QUICK QUESTIONS</Text>
                <Stagger initialDelay={40}>
                  {QUICK_QUESTIONS.map((q) => (
                    <FadeInUp key={q}>
                      <Card onPress={() => { setQuestion(q); void submitAsk(q); }} padding="md" accessibilityLabel={q} style={{ marginBottom: spacing.xs }}>
                        <Text variant="footnote">{q}</Text>
                      </Card>
                    </FadeInUp>
                  ))}
                </Stagger>
              </Stack>
            ) : null}
            {asking ? (
              <View style={{ alignSelf: 'flex-start' }}>
                <ThinkingBubble />
              </View>
            ) : null}
          </ScrollView>
          <Row gap="sm" align="flex-end" style={{ paddingTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                multiline
                value={question}
                onChangeText={setQuestion}
                placeholder={threadId ? 'Ask a follow-up…' : 'Ask LUCY anything…'}
              />
            </View>
            <IconButton
              icon="arrow-up"
              variant="primary"
              accessibilityLabel="Send question"
              disabled={!question.trim() || asking}
              onPress={() => void submitAsk()}
            />
          </Row>
        </>
      )}
    </View>
  );
}

// ─── Thinking indicator ─────────────────────────────────────────────────────────
function ThinkingBubble() {
  const { colors, radius, spacing, layout } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: layout.hairline,
        borderRadius: radius.lg, borderBottomLeftRadius: radius.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.base,
      }}
    >
      <Row gap="sm" align="center">
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
        <Text variant="caption" color="textMuted">Searching your memory…</Text>
      </Row>
    </View>
  );
}

// ─── Insights view ──────────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { tone: string; icon: string; label: string }> = {
  habits:        { tone: '#FF8C42', icon: '◈', label: 'Habit' },
  relationships: { tone: '#60A5FA', icon: '◉', label: 'People' },
  progress:      { tone: '#4ADE80', icon: '▲', label: 'Progress' },
  wellbeing:     { tone: '#F472B6', icon: '♡', label: 'Health' },
  memory:        { tone: '#FFA05C', icon: '⟳', label: 'Memory' },
  device:        { tone: '#A78BFA', icon: '⌘', label: 'Device' },
};

function InsightCard({
  insight, expanded, onToggle, onAskThis,
}: {
  insight: GeneratedInsight;
  expanded: boolean;
  onToggle: () => void;
  onAskThis: (q: string) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const meta = CATEGORY_META[insight.category] ?? { tone: colors.accent, icon: '✦', label: 'Insight' };
  return (
    <Card onPress={onToggle} accessibilityLabel={insight.question} style={{ marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: meta.tone }}>
      <Row gap="md" align="center">
        <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: meta.tone + '20', alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="bodyMed" style={{ color: meta.tone }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" weight="700" tracking={1.2} style={{ color: meta.tone }}>{meta.label.toUpperCase()}</Text>
          <Text variant="footnote" weight="600">{insight.question}</Text>
        </View>
      </Row>
      {expanded ? (
        <Stack gap="md" style={{ marginTop: spacing.md }}>
          <Text variant="footnote" color="textMuted">{insight.answer}</Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Chip label="Ask follow-up →" onPress={() => onAskThis(insight.question)} />
          </View>
        </Stack>
      ) : null}
    </Card>
  );
}

function InsightsView({
  insights, loading, expanded, onToggle, onAskThis, onOpenChat,
}: {
  insights: GeneratedInsight[];
  loading: boolean;
  expanded: number | null;
  onToggle: (i: number) => void;
  onAskThis: (q: string) => void;
  onOpenChat: () => void;
}) {
  const { spacing } = useTheme();
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.huge }}>
      <Stack gap="sm" style={{ marginBottom: spacing.base }}>
        <Text variant="h3">What LUCY noticed</Text>
        <Text variant="footnote" color="textMuted">Tap any card to reveal the insight.</Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button label="✦ Ask LUCY something →" variant="secondary" size="sm" onPress={onOpenChat} />
        </View>
      </Stack>

      {loading ? (
        <Stack gap="sm">
          <SkeletonText lines={3} />
          <SkeletonText lines={3} />
        </Stack>
      ) : insights.length === 0 ? (
        <Stack gap="base">
          <EmptyState title="No insights yet" message="As you capture thoughts, I'll surface gentle patterns and ideas here — no need to ask." />
          <Surface level="surfaceAlt" radius="md" border="accentLine" padding="base">
            <Text variant="footnote" color="accentGlow" weight="700">To generate insights:</Text>
            <Spacer size="xs" />
            <Text variant="footnote" color="textMuted">
              1. Enable Remote Intelligence in Settings{'\n'}
              2. Add your OpenAI API key{'\n'}
              3. Capture a few thoughts — LUCY generates them automatically
            </Text>
          </Surface>
        </Stack>
      ) : (
        <Stagger>
          {insights.map((insight, i) => (
            <FadeInUp key={`${insight.question}-${i}`}>
              <InsightCard insight={insight} expanded={expanded === i} onToggle={() => onToggle(i)} onAskThis={onAskThis} />
            </FadeInUp>
          ))}
        </Stagger>
      )}
    </ScrollView>
  );
}

// ─── History view ───────────────────────────────────────────────────────────────
function HistoryView({
  history, loading, onSelect,
}: {
  history: AskThreadSummaryRow[];
  loading: boolean;
  onSelect: (thread: AskThreadSummaryRow) => Promise<void>;
}) {
  const { spacing } = useTheme();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.md, gap: spacing.sm }}>
      {loading ? <SkeletonText lines={4} /> : null}
      {!loading && history.map((thread) => (
        <Card key={thread.id} onPress={() => void onSelect(thread)} accessibilityLabel={thread.first_question}>
          <Text variant="footnote" weight="600" numberOfLines={2}>{thread.first_question}</Text>
          <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
            {new Date(`${thread.updated_at.replace(' ', 'T')}Z`).toLocaleString()} / {thread.message_count} messages
          </Text>
        </Card>
      ))}
      {!loading && !history.length ? (
        <EmptyState title="No past conversations yet" message="Ask LUCY something and it'll be saved here, privately on this device." />
      ) : null}
    </ScrollView>
  );
}
