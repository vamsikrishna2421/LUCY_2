/**
 * Ask answer bubbles — presentation for every LucyAnswer kind, rebuilt on ui/ primitives.
 *
 * Parity with Ask 1.0's MessageBubble + the per-kind bubbles (llm / memory / spending / schedule /
 * tasks+deadlines). Logic stays in the seam (useAsk): artifact filters, protectedPreview, action-plan
 * apply, and schedule commit are passed in. No new logic — same calls, same outcomes.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Text, Surface, Row, Stack, Spacer, Divider, Button, Chip, useTheme,
} from '../../ui';
import type { LucyAnswer } from '../../processing/ask';
import type { LucyAction } from '../../processing/lucyActions';
import type { UseAsk } from '../hooks/useAsk';

export type ChatMessage =
  | { id: string; role: 'lucy'; text: string; answer?: undefined }
  | { id: string; role: 'lucy'; text?: undefined; answer: LucyAnswer }
  | { id: string; role: 'user'; text: string; answer?: undefined };

interface BubbleDeps {
  isInvalidPendingTask: UseAsk['isInvalidPendingTask'];
  isInvalidDeadline: UseAsk['isInvalidDeadline'];
  protectedPreview: UseAsk['protectedPreview'];
  applyActions: UseAsk['applyActions'];
  summarizeAction: UseAsk['summarizeAction'];
  commitScheduleBlock: UseAsk['commitScheduleBlock'];
  onScheduleError: (message: string) => void;
}

function LucyShell({ label, children }: { label?: string; children: React.ReactNode }) {
  const { colors, radius, spacing, layout } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start', maxWidth: '94%',
        backgroundColor: colors.surfaceAlt, borderColor: colors.border,
        borderWidth: layout.hairline, borderRadius: radius.lg, borderBottomLeftRadius: radius.sm,
        padding: spacing.base,
      }}
    >
      {label ? <Text variant="caption" color="accent" weight="700" tracking={0.8} style={{ marginBottom: spacing.sm }}>{label}</Text> : null}
      {children}
    </View>
  );
}

function ActionPlanCard({ actions, deps }: { actions: LucyAction[]; deps: BubbleDeps }) {
  const { colors, radius, spacing, layout } = useTheme();
  const [state, setState] = useState<'idle' | 'applying' | 'done'>('idle');
  const [resultText, setResultText] = useState('');

  const apply = async () => {
    setState('applying');
    try {
      const { applied, summary } = await deps.applyActions(actions);
      setResultText(applied > 0 ? `✓ ${summary} Open Tasks to see the changes.` : 'Nothing was changed.');
    } catch {
      setResultText('Could not apply the changes.');
    }
    setState('done');
  };

  return (
    <Surface level="surface" radius="md" border="accentLine" padding="md" style={{ marginBottom: spacing.sm }}>
      <Text variant="caption" color="accent" weight="700" tracking={1}>PROPOSED CHANGES</Text>
      <Spacer size="xs" />
      {actions.map((a, i) => (
        <Row key={i} gap="sm" align="flex-start" style={{ marginTop: spacing.xs }}>
          <Text variant="footnote" color="accent" weight="700">•</Text>
          <Text variant="footnote" style={{ flex: 1 }}>{deps.summarizeAction(a)}</Text>
        </Row>
      ))}
      <Spacer size="sm" />
      {state === 'done' ? (
        <Text variant="footnote" color="success" weight="700">{resultText}</Text>
      ) : (
        <Button label={state === 'applying' ? 'Applying…' : 'Apply changes'} loading={state === 'applying'} onPress={() => void apply()} fullWidth />
      )}
    </Surface>
  );
}

function TasksDeadlinesBubble({ answer, deps }: { answer: LucyAnswer; deps: BubbleDeps }) {
  const { spacing } = useTheme();
  const tasks = answer.tasks.filter((t) => !deps.isInvalidPendingTask(t));
  const deadlines = answer.deadlines.filter((d) => !deps.isInvalidDeadline(d));
  const scope = answer.taskScope ? ` for ${answer.taskScope}` : '';
  const hasAnything = tasks.length > 0 || deadlines.length > 0;

  return (
    <LucyShell label="LUCY">
      {!hasAnything ? (
        <Stack gap="sm">
          <Text variant="footnote" color="textMuted">{`Nothing captured${scope} yet — here's how to get something here:`}</Text>
          <Text variant="footnote">{'→  "Meeting with Sam about Q3, need to follow up on budget"'}</Text>
          <Text variant="footnote">{'→  "Remind me to call the client tomorrow morning"'}</Text>
          <Text variant="footnote">{'→  "Deadline: submit the proposal by Friday"'}</Text>
          <Text variant="caption" color="textFaint" style={{ fontStyle: 'italic' }}>Mention names, projects, and deadlines in Capture — LUCY picks them up automatically.</Text>
        </Stack>
      ) : (
        <Stack gap="xs">
          {tasks.length > 0 ? (
            <>
              <Text variant="caption" color="accentGlow" weight="700" tracking={0.6}>{`TASKS${scope.toUpperCase()}`}</Text>
              {tasks.map((task) => (
                <View key={task.id} style={{ paddingVertical: spacing.xs }}>
                  <Text variant="footnote">{deps.protectedPreview(task.task)}</Text>
                </View>
              ))}
            </>
          ) : null}
          {deadlines.length > 0 ? (
            <>
              <Spacer size="xs" />
              <Text variant="caption" color="accentGlow" weight="700" tracking={0.6}>DEADLINES TODAY</Text>
              {deadlines.map((deadline) => (
                <View key={deadline.id} style={{ paddingVertical: spacing.xs }}>
                  <Text variant="footnote">{deps.protectedPreview(deadline.text)}</Text>
                  <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                    {new Date(deadline.remind_at as string).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </Stack>
      )}
      {answer.recordedSignal ? <Text variant="caption" color="textMuted" style={{ marginTop: spacing.md }}>{answer.recordedSignal}</Text> : null}
    </LucyShell>
  );
}

function MemoryBubble({ answer, deps }: { answer: LucyAnswer; deps: BubbleDeps }) {
  const { spacing } = useTheme();
  const connections = answer.connections ?? [];
  const sources = answer.sources ?? [];
  return (
    <LucyShell label="LUCY MEMORY">
      {answer.title ? <Text variant="h3" style={{ marginBottom: spacing.xs }}>{answer.title}</Text> : null}
      <Text variant="footnote" color="textMuted">{answer.message}</Text>
      {connections.length ? (
        <>
          <Spacer size="sm" />
          <Text variant="caption" color="accentGlow" weight="700">{`CONNECTIONS (${connections.length})`}</Text>
          {connections.map((c) => (
            <View key={c.statement} style={{ paddingVertical: spacing.xs }}>
              <Text variant="footnote">{deps.protectedPreview(c.statement)}</Text>
              <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                {c.confidence} / {c.evidenceCount} supporting thought{c.evidenceCount === 1 ? '' : 's'}
              </Text>
            </View>
          ))}
        </>
      ) : null}
      <Spacer size="sm" />
      <Text variant="caption" color="accentGlow" weight="700">{`REMEMBERED CONTEXT (${sources.length})`}</Text>
      {sources.map((source) => (
        <Surface key={source.captureId} level="surface" radius="md" border="border" padding="md" style={{ marginTop: spacing.xs }}>
          <Text variant="footnote" weight="700">{deps.protectedPreview(source.title)}</Text>
          {source.actions.map((action) => (
            <Text key={action} variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>Action: {deps.protectedPreview(action)}</Text>
          ))}
          {!source.actions.length && source.summary ? (
            <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>{deps.protectedPreview(source.summary)}</Text>
          ) : null}
        </Surface>
      ))}
      {!sources.length ? <Text variant="footnote" color="textMuted" style={{ marginTop: spacing.sm }}>No connected context is remembered yet.</Text> : null}
      {answer.recordedSignal ? <Text variant="caption" color="textMuted" style={{ marginTop: spacing.md }}>{answer.recordedSignal}</Text> : null}
    </LucyShell>
  );
}

function SpendingBubble({ answer, deps }: { answer: LucyAnswer; deps: BubbleDeps }) {
  const { spacing } = useTheme();
  const categories = answer.spendingCategories ?? [];
  const expenses = answer.expenses ?? [];
  return (
    <LucyShell label="LUCY INSIGHT">
      {answer.title ? <Text variant="h3" style={{ marginBottom: spacing.xs }}>{answer.title}</Text> : null}
      <Text variant="footnote" color="textMuted">{answer.message}</Text>
      {categories.length ? <><Spacer size="sm" /><Text variant="caption" color="accentGlow" weight="700">BY CATEGORY</Text></> : null}
      {categories.map((c) => (
        <Row key={c.category} justify="space-between" style={{ paddingVertical: spacing.xs }}>
          <Text variant="footnote" style={{ flex: 1 }}>{c.category}</Text>
          <Text variant="footnote" weight="600">{c.total.toFixed(2)}</Text>
        </Row>
      ))}
      {expenses.length ? <><Spacer size="sm" /><Text variant="caption" color="accentGlow" weight="700">REMEMBERED PAYMENTS</Text></> : null}
      {expenses.map((e) => (
        <Row key={e.id} justify="space-between" style={{ paddingVertical: spacing.xs }}>
          <Text variant="footnote" style={{ flex: 1 }}>{deps.protectedPreview(e.description)}</Text>
          <Text variant="footnote" weight="600">{typeof e.amount === 'number' ? e.amount.toFixed(2) : '-'}</Text>
        </Row>
      ))}
      {!expenses.length ? <Text variant="footnote" color="textMuted" style={{ marginTop: spacing.sm }}>Capture a payment and I will start building this view.</Text> : null}
      {answer.recordedSignal ? <Text variant="caption" color="textMuted" style={{ marginTop: spacing.md }}>{answer.recordedSignal}</Text> : null}
    </LucyShell>
  );
}

function ScheduleBubble({ answer, deps }: { answer: LucyAnswer; deps: BubbleDeps }) {
  const { spacing } = useTheme();
  const suggestions = answer.scheduleSuggestions ?? [];
  const [added, setAdded] = useState<number[]>([]);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const fmt = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const add = async (i: number, s: NonNullable<LucyAnswer['scheduleSuggestions']>[number]) => {
    if (busyIdx !== null || added.includes(i)) return;
    setBusyIdx(i);
    try {
      const r = await deps.commitScheduleBlock({ title: s.title, startMs: s.start, endMs: s.end });
      if (r.ok) setAdded((a) => [...a, i]);
      else deps.onScheduleError(r.conflict?.b?.title ? `It clashes with "${r.conflict.b.title}". Pick another slot.` : 'Pick another slot.');
    } catch {
      deps.onScheduleError('Please try again.');
    } finally {
      setBusyIdx(null);
    }
  };

  return (
    <LucyShell label="LUCY">
      {answer.title ? <Text variant="h3" style={{ marginBottom: spacing.xs }}>{answer.title}</Text> : null}
      <Text variant="footnote" color="textMuted">{answer.message}</Text>
      {suggestions.length ? (
        <>
          <Spacer size="sm" />
          <Text variant="caption" color="accentGlow" weight="700">ADD TO CALENDAR</Text>
          {suggestions.map((s, i) => (
            <Row key={`${s.start}-${i}`} gap="sm" align="center" style={{ paddingVertical: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="footnote">{deps.protectedPreview(s.title)}</Text>
                <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>{fmt(s.start)} · {s.durationMin} min</Text>
              </View>
              <Chip
                label={added.includes(i) ? 'Added ✓' : busyIdx === i ? '…' : '＋ Add'}
                selected={added.includes(i)}
                onPress={() => void add(i, s)}
              />
            </Row>
          ))}
        </>
      ) : null}
      {answer.recordedSignal ? <Text variant="caption" color="textMuted" style={{ marginTop: spacing.md }}>{answer.recordedSignal}</Text> : null}
    </LucyShell>
  );
}

export function MessageBubble({ message, deps }: { message: ChatMessage; deps: BubbleDeps }) {
  const { colors, radius, spacing, layout } = useTheme();

  if (message.role === 'user') {
    return (
      <View
        style={{
          alignSelf: 'flex-end', maxWidth: '94%',
          backgroundColor: colors.accentSoft, borderColor: colors.accentLine,
          borderWidth: layout.hairline, borderRadius: radius.lg, borderBottomRightRadius: radius.sm,
          padding: spacing.base,
        }}
      >
        <Text variant="footnote">{message.text}</Text>
      </View>
    );
  }
  if (!message.answer) {
    return <LucyShell><Text variant="footnote">{message.text}</Text></LucyShell>;
  }

  const answer = message.answer;
  if (answer.answerKind === 'llm') {
    return (
      <LucyShell label="LUCY">
        <Text variant="callout">{answer.llmResponse}</Text>
        {answer.proposedActions && answer.proposedActions.length > 0 ? (
          <><Spacer size="sm" /><ActionPlanCard actions={answer.proposedActions} deps={deps} /></>
        ) : null}
        {answer.citedSources && answer.citedSources.length > 0 ? (
          <>
            <Spacer size="sm" />
            <Divider />
            <Spacer size="sm" />
            <Text variant="caption" color="accent" weight="700" tracking={1}>FROM YOUR MEMORY</Text>
            {answer.citedSources.map((src) => (
              <Surface key={src.captureId} level="surface" radius="sm" border="border" padding="md" style={{ marginTop: spacing.xs }}>
                <Text variant="caption" weight="700" numberOfLines={1}>{src.title}</Text>
                <Text variant="caption" color="textMuted" numberOfLines={1}>{src.snippet}</Text>
              </Surface>
            ))}
          </>
        ) : null}
      </LucyShell>
    );
  }
  if (answer.answerKind === 'memory') return <MemoryBubble answer={answer} deps={deps} />;
  if (answer.answerKind === 'spending') return <SpendingBubble answer={answer} deps={deps} />;
  if (answer.answerKind === 'schedule') return <ScheduleBubble answer={answer} deps={deps} />;
  return <TasksDeadlinesBubble answer={answer} deps={deps} />;
}

export type { BubbleDeps };
