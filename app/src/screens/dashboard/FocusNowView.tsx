/**
 * Focus Now — LUCY 2.0 "tonight" view, rebuilt on the design system (app/src/ui).
 *
 * Logic flows through the seam hook `useFocusNow` (resolveOpenLoop/resolveFollowUp + captureStatus/
 * protectedPreview). Every NowView 1.0 capability is preserved: the TONIGHT header (priority count +
 * organizing count + this-week mood bar), On-this-day, Lucy Pulse (BrainPulseSection), Quick-Review
 * (StalenessReviewCard), Commitments (CommitmentsSection), Follow-ups (resolve), Reminders (scheduled
 * vs. stale split + unscheduled hint), Focus (top todos), and Needs-Context (single-request prompt or
 * the ContextBatchCard). Self-contained cards (CollapsibleSection/StalenessReviewCard/
 * CommitmentsSection/ContextBatchCard/LucyEmptyState) are reused as-is; the small Reminder/Focus rows
 * are rebuilt on tokens here.
 */
import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text, Card, Surface, Row, Stack, Spacer, Button, useTheme, type Theme } from '../../ui';
import { CollapsibleSection } from '../../components/CollapsibleSection';
import { StalenessReviewCard, ContextBatchCard } from '../../components/StalenessReviewCard';
import { CommitmentsSection } from '../../components/CommitmentsSection';
import { LucyEmptyState } from '../../components/LucyEmptyState';
import { BrainPulseSection } from './BrainPulse';
import { useFocusNow } from '../hooks/useFocusNow';
import type { TodoRow } from '../../db/todos';
import type { ReminderRow } from '../../db/reminders';
import type { OpenLoopRow } from '../../db/openLoops';
import type { FollowUpRow } from '../../db/followUps';
import type { CaptureRow } from '../../db/captures';
import type { StalenessReview, ContextBatch } from '../../processing/stalenessEngine';

const MOOD_EMOJI: Record<string, string> = { positive: '😊', excited: '⚡', calm: '😌', neutral: '😐', stressed: '😤', frustrated: '😤', negative: '😔' };
const MOOD_COLOR: Record<string, string> = { positive: '#4ADE80', excited: '#FFA05C', calm: '#60A5FA', neutral: '#756F68', stressed: '#F59E0B', frustrated: '#FB7185', negative: '#FB7185' };
const URGENCY: Record<string, { label: string; color: string }> = {
  high: { label: 'HIGH', color: '#EF4444' }, medium: { label: 'MED', color: '#F59E0B' }, low: { label: 'LOW', color: '#6EE7B7' },
};

export function FocusNowView({
  todos,
  reminders,
  captures,
  contextCount,
  openLoops,
  followUps,
  moodTrend,
  onThisDay,
  onOpenContext,
  onLoopResolved,
  stalenessReviews = [],
  contextBatch = null,
  onStalenessResolved,
}: {
  todos: TodoRow[];
  reminders: ReminderRow[];
  captures: CaptureRow[];
  contextCount: number;
  openLoops: OpenLoopRow[];
  followUps: FollowUpRow[];
  moodTrend: { dominant: string; positiveRatio: number; recentTones: string[] };
  onThisDay: import('../../processing/onThisDay').OnThisDayMemory[];
  onOpenContext: () => void;
  onLoopResolved: () => void;
  stalenessReviews?: StalenessReview[];
  contextBatch?: ContextBatch | null;
  onStalenessResolved?: () => void;
}) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const focus = useFocusNow();

  const organizing = captures.filter((item) => focus.captureStatus(item) !== 'complete').length;
  const nowMs = Date.now();
  const STALE_MS = 4 * 60 * 60 * 1000; // 4h past due = stale
  const scheduledReminders = reminders.filter((i) => i.remind_at && new Date(i.remind_at).getTime() > nowMs - STALE_MS);
  const staleReminders = reminders.filter((i) => i.remind_at && new Date(i.remind_at).getTime() <= nowMs - STALE_MS);
  const unscheduledCount = reminders.length - scheduledReminders.length - staleReminders.length;

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      {/* TONIGHT */}
      <Surface level="surfaceAlt" radius="lg" border="accentLine" padding="lg" style={{ marginBottom: spacing.base }}>
        <Text variant="caption" color="accent" weight="700" tracking={1.4}>TONIGHT</Text>
        <Spacer size="xs" />
        <Text variant="h3">{todos.length ? `${todos.length} priority item${todos.length === 1 ? '' : 's'} waiting` : 'Nothing urgent waiting'}</Text>
        <Spacer size="xs" />
        <Text variant="footnote" color="textMuted">{organizing ? `${organizing} capture${organizing === 1 ? '' : 's'} still organizing.` : 'Everything captured has been organized.'}</Text>
        {moodTrend.recentTones.length > 0 ? (
          <Row gap="md" align="center" style={{ marginTop: spacing.md }}>
            <Text variant="footnote" weight="600" style={{ color: MOOD_COLOR[moodTrend.dominant] ?? colors.textMuted }}>
              {MOOD_EMOJI[moodTrend.dominant] ?? '😐'} {moodTrend.dominant} this week
            </Text>
            <Row gap="xs">
              {moodTrend.recentTones.slice(0, 7).map((tone, i) => (
                <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MOOD_COLOR[tone] ?? colors.textMuted }} />
              ))}
            </Row>
          </Row>
        ) : null}
      </Surface>

      {onThisDay.length > 0 ? (
        <CollapsibleSection title="On this day" count={onThisDay.length}>
          <Card level="surfaceAlt" padding="md" style={{ marginBottom: spacing.sm }}>
            <Text variant="caption" color="accent" weight="700" tracking={1.2}>ON THIS DAY</Text>
            <Spacer size="xs" />
            <Text variant="footnote" weight="600">
              {onThisDay[0].yearsAgo === 1 ? 'A year ago' : `${onThisDay[0].yearsAgo} years ago`} — {onThisDay[0].title}
            </Text>
            {onThisDay[0].snippet ? <Text variant="footnote" color="textMuted" numberOfLines={2} style={{ marginTop: spacing.xs }}>{onThisDay[0].snippet}</Text> : null}
            {onThisDay.length > 1 ? <Text variant="caption" color="textFaint" style={{ marginTop: spacing.xs }}>+ {onThisDay.length - 1} more from this day</Text> : null}
          </Card>
        </CollapsibleSection>
      ) : null}

      <BrainPulseSection />

      {stalenessReviews.length > 0 ? (
        <CollapsibleSection title="Quick Review" count={stalenessReviews.length}>
          {stalenessReviews.map((review) => <StalenessReviewCard key={review.id} review={review} onDone={() => onStalenessResolved?.()} />)}
        </CollapsibleSection>
      ) : null}

      <CommitmentsSection onChange={onLoopResolved} />

      {followUps.length > 0 ? (
        <CollapsibleSection title="Follow-ups" count={followUps.length}>
          {followUps.map((item) => (
            <Card key={item.id} level="surfaceAlt" padding="md" style={{ marginBottom: spacing.sm }}>
              <Row gap="md" align="center">
                <Text variant="footnote" weight="600" style={{ flex: 1 }}>{item.assignee ? `${item.assignee}: ` : ''}{focus.protectedPreview(item.action)}</Text>
                <Button label="Done" variant="secondary" size="sm" onPress={() => void focus.resolveFollow(item.id).then(onLoopResolved)} />
              </Row>
            </Card>
          ))}
        </CollapsibleSection>
      ) : null}

      <SectionTitle title="Reminders" count={scheduledReminders.length || undefined} theme={theme} />
      {scheduledReminders.length ? scheduledReminders.map((item) => <ReminderCard key={item.id} item={item} theme={theme} />) : <EmptyLine text="No scheduled reminders yet." theme={theme} />}
      {unscheduledCount ? <Text variant="caption" color="textFaint" style={{ marginTop: spacing.xs }}>{unscheduledCount} captured reminder{unscheduledCount === 1 ? '' : 's'} need a specific time.</Text> : null}

      <SectionTitle title="Focus" count={todos.length || undefined} theme={theme} />
      {todos.length ? todos.map((item) => <FocusTodoCard key={item.id} item={item} protectedPreview={focus.protectedPreview} theme={theme} />) : (
        <LucyEmptyState compact title="Nothing on your plate" message="Capture a task by voice or text and I'll line it up here for you." />
      )}

      {/* Needs Context — at the bottom so it doesn't clutter the main focus. */}
      {contextCount > 0 && !contextBatch ? (
        <CollapsibleSection title="Needs Context" count={contextCount}>
          <Card onPress={onOpenContext} level="surfaceAlt" padding="md">
            <Text variant="footnote" weight="600">
              {contextCount > 5 ? `${contextCount} memories could be clearer — tap to answer one` : `${contextCount} memory detail${contextCount === 1 ? '' : 's'} could become clearer`}
            </Text>
            <Text variant="footnote" color="textMuted" style={{ marginTop: spacing.xs }}>Add context when you have time — LUCY folds your answer into that memory and re-organizes it.</Text>
          </Card>
        </CollapsibleSection>
      ) : null}
      {contextBatch ? (
        <CollapsibleSection title="Needs Context" count={contextBatch.total}>
          <ContextBatchCard batch={contextBatch} onDone={() => onStalenessResolved?.()} />
        </CollapsibleSection>
      ) : null}
    </ScrollView>
  );
}

// ─── Small cards (rebuilt on tokens) ────────────────────────────────────────────────
function SectionTitle({ title, count, theme }: { title: string; count?: number; theme: Theme }) {
  const { colors, spacing } = theme;
  return (
    <Row gap="sm" align="center" style={{ marginTop: spacing.base, marginBottom: spacing.sm }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent }} />
      <Text variant="bodyMed">{title}</Text>
      {count != null ? (
        <View style={{ minWidth: 20, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.surfaceAlt, borderWidth: theme.layout.hairline, borderColor: colors.border, alignItems: 'center' }}>
          <Text variant="caption" color="textMuted" weight="700">{count}</Text>
        </View>
      ) : null}
    </Row>
  );
}

function EmptyLine({ text, theme }: { text: string; theme: Theme }) {
  return <Text variant="footnote" color="textFaint" style={{ paddingVertical: theme.spacing.sm }}>{text}</Text>;
}

function ReminderCard({ item, theme }: { item: ReminderRow; theme: Theme }) {
  const { protectedPreview } = useFocusNow();
  const time = item.remind_at
    ? new Date(item.remind_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : 'Time not specified';
  return (
    <Card level="surfaceAlt" padding="md" style={{ marginBottom: theme.spacing.sm }}>
      <Text variant="footnote" weight="600">{protectedPreview(item.text)}</Text>
      <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>{item.notification_id ? time : `${time} · notification pending`}</Text>
    </Card>
  );
}

function FocusTodoCard({ item, protectedPreview, theme }: { item: TodoRow; protectedPreview: (s: string) => string; theme: Theme }) {
  const { colors, spacing, radius } = theme;
  const urg = URGENCY[item.urgency] ?? URGENCY.low;
  return (
    <Card level="surfaceAlt" padding="md" style={{ marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: urg.color }}>
      <Row gap="md" align="flex-start">
        <View style={{ flex: 1 }}>
          <Text variant="footnote" weight="600" numberOfLines={2}>{protectedPreview(item.task)}</Text>
          {item.category ? <Text variant="caption" color="textFaint" style={{ marginTop: 2, textTransform: 'capitalize' }}>{item.category}</Text> : null}
        </View>
        <View style={{ backgroundColor: urg.color + '22', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
          <Text variant="caption" weight="700" style={{ color: urg.color }}>{urg.label}</Text>
        </View>
      </Row>
    </Card>
  );
}
