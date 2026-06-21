/**
 * Story View — LUCY 2.0 narrative timeline for a person or topic.
 *
 * Threads every capture about a subject into a chronological story — the emotional hook ("it remembers
 * everything"). Rebuilt on the design system (app/src/ui): the modal is now a `BottomSheet` (slide +
 * backdrop + safe-area + Android-back for free), rows are `Card`s, and the spine/meta chips use tokens.
 *
 * All data flows through the seam hook `useStory`, which wraps StoryView 1.0's exact capture queries
 * (docs/04_SEAM_REPORT.md, StoryView row). Every 1.0 capability is preserved: person vs. topic story,
 * timeline spine (first dot accented, last has no tail), relative-date labels, tap-to-expand raw text,
 * the meta chips (mentions / days-since-last with the >14d danger tint / pending follow-ups), typical
 * context line, building/empty states, and the "N moments · most recent first" header.
 *
 * The exported component name + props (`StoryView`) and the `StorySubject` type are unchanged so Galaxy
 * and Dashboard need no edit (both import `{ StoryView, type StorySubject } from './StoryView'`).
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  BottomSheet, Card, Text, Row, Stack, Badge, Button, Divider, PressableScale, useTheme, type Theme,
} from '../ui';
import { useStory, type StoryEntry, type StorySubject } from './hooks/useStory';

export type { StorySubject } from './hooks/useStory';

/** Same relative-date phrasing as StoryView 1.0 (Today / Yesterday / N days / weeks / months / years). */
function formatRelativeDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? '' : 's'} ago`;
}

function StoryEntryCard({ entry, accentColor, theme }: { entry: StoryEntry; accentColor: string; theme: Theme }) {
  const { colors, spacing, layout } = theme;
  const [expanded, setExpanded] = useState(false);
  const c = entry.capture;
  const title = c.extracted_title ?? c.raw_transcript?.slice(0, 80) ?? '';
  const hasMore = !!(c.structured_text && c.structured_text.length > 0);

  return (
    <Row gap="md" align="stretch" style={{ marginBottom: spacing.xxs }}>
      {/* Timeline spine — first dot accented, last entry has no trailing line. */}
      <View style={{ width: 18, alignItems: 'center', paddingTop: spacing.xs }}>
        <View
          style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: entry.isFirst ? accentColor : colors.border,
          }}
        />
        {!entry.isLast ? (
          <View style={{ width: 2, flex: 1, marginTop: spacing.xs, backgroundColor: colors.border }} />
        ) : null}
      </View>

      <View style={{ flex: 1, marginBottom: spacing.sm }}>
        <Card
          onPress={() => setExpanded((v) => !v)}
          padding="md"
          accessibilityLabel={title}
          style={{ borderTopColor: `${accentColor}55`, borderTopWidth: layout.hairline }}
        >
          <Text variant="caption" color="textMuted" weight="700" tracking={1}>
            {formatRelativeDate(c.created_at).toUpperCase()}
          </Text>
          <Text variant="footnote" weight="600" numberOfLines={expanded ? undefined : 2} style={{ marginTop: 2 }}>
            {title}
          </Text>
          {expanded && c.raw_transcript && c.raw_transcript !== title ? (
            <Text variant="footnote" color="textMuted" style={{ marginTop: spacing.xs }}>
              {c.raw_transcript.slice(0, 300)}
            </Text>
          ) : null}
          {hasMore && !expanded ? (
            <Text variant="caption" color="textFaint" style={{ marginTop: spacing.xxs }}>tap to expand</Text>
          ) : null}
        </Card>
      </View>
    </Row>
  );
}

export function StoryView({
  subject,
  visible,
  onClose,
}: {
  subject: StorySubject | null;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const { entries, loading, loadStory } = useStory();

  // Person stories accent blue; topics accent amber — same split as 1.0.
  const accentColor = subject?.kind === 'person' ? colors.info : colors.accent;

  const reload = useCallback(() => {
    if (subject) void loadStory(subject);
  }, [subject, loadStory]);

  useEffect(() => {
    if (visible) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, subject?.name]);

  if (!subject) return null;

  // How long since the last interaction (drives the days-since chip + its >14d danger tint).
  const daysSince = subject.lastMentioned
    ? Math.floor((Date.now() - new Date(subject.lastMentioned.includes('T') ? subject.lastMentioned : `${subject.lastMentioned.replace(' ', 'T')}Z`).getTime()) / 86400000)
    : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} hideHandle contentStyle={{ maxHeight: '92%' }}>
      <Stack gap="md">
        {/* Header: subject identity + meta chips + Done */}
        <Row gap="md" align="flex-start">
          <View style={{ flex: 1 }}>
            <Row gap="sm" align="center">
              {subject.emoji ? <Text variant="h2">{subject.emoji}</Text> : null}
              <Text variant="h2" style={{ flexShrink: 1 }} numberOfLines={1}>{subject.name}</Text>
            </Row>
            <Row gap="xs" wrap style={{ marginTop: spacing.xs }}>
              {subject.mentionCount ? (
                <Badge
                  label={`${subject.mentionCount} mention${subject.mentionCount !== 1 ? 's' : ''}`}
                  tone={subject.kind === 'person' ? 'info' : 'accent'}
                />
              ) : null}
              {daysSince !== null ? (
                <Badge
                  label={daysSince === 0 ? 'Today' : `${daysSince}d since last mention`}
                  tone={daysSince > 14 ? 'danger' : subject.kind === 'person' ? 'info' : 'accent'}
                />
              ) : null}
              {subject.pendingFollowUps ? (
                <Badge
                  label={`${subject.pendingFollowUps} follow-up${subject.pendingFollowUps !== 1 ? 's' : ''} pending`}
                  tone="warning"
                />
              ) : null}
            </Row>
            {subject.typicalContext ? (
              <Text variant="footnote" color="textMuted" style={{ marginTop: spacing.xs, fontStyle: 'italic' }} numberOfLines={2}>
                {subject.typicalContext}
              </Text>
            ) : null}
          </View>
          <Button label="Done" variant="ghost" size="sm" onPress={onClose} />
        </Row>

        <Divider />

        {/* Story timeline */}
        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
          {loading ? (
            <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
              <Text variant="footnote" color="textMuted">Building story…</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
              <Text variant="h3">No story yet</Text>
              <Text variant="footnote" color="textMuted" align="center" style={{ marginTop: spacing.sm }}>
                Captures mentioning {subject.name} will appear here as a narrative timeline.
              </Text>
            </View>
          ) : (
            <>
              <Text variant="caption" color="textMuted" weight="700" tracking={1.4} style={{ marginBottom: spacing.md }}>
                {entries.length} MOMENT{entries.length !== 1 ? 'S' : ''} · MOST RECENT FIRST
              </Text>
              {entries.map((entry) => (
                <StoryEntryCard key={entry.capture.id} entry={entry} accentColor={accentColor} theme={theme} />
              ))}
            </>
          )}
        </ScrollView>
      </Stack>
    </BottomSheet>
  );
}
