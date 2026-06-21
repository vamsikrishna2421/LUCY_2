/**
 * Dashboard view helpers — pure presentation helpers shared by the redesigned Dashboard views.
 *
 * Ported verbatim (logic-identical) from Dashboard 1.0's inline helpers, retoned onto the design system
 * (tokens via useTheme; raw hex only where a fixed semantic accent is intended, matching 1.0). No frozen
 * logic here — these shape capture rows into display strings/chips.
 */
import React from 'react';
import { Animated, Easing, View } from 'react-native';
import { Text, useTheme } from '../../ui';
import type { CaptureRow } from '../../db/captures';
import type { CaptureSource, ExtractionResult, NoteType } from '../../types/extraction';

/** Per-mood accent (fixed semantic colors — same values as Dashboard 1.0's MOOD_COLOR). */
export const MOOD_COLOR: Record<string, string> = {
  positive: '#4ADE80', excited: '#FFA05C', calm: '#60A5FA', neutral: '#756F68',
  stressed: '#F59E0B', frustrated: '#FB7185', negative: '#FB7185',
};

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Group captures by calendar day (most recent first), with Today/Yesterday labels — same as 1.0. */
export function groupByDate(captures: CaptureRow[]): Array<{ dateLabel: string; dateKey: string; items: CaptureRow[] }> {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const grouped: Record<string, CaptureRow[]> = {};
  for (const c of captures) {
    const d = new Date(c.created_at.includes('T') ? c.created_at : `${c.created_at.replace(' ', 'T')}Z`);
    const key = d.toDateString();
    (grouped[key] = grouped[key] ?? []).push(c);
  }
  return Object.entries(grouped)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([key, items]) => ({
      dateKey: key,
      dateLabel: key === today ? 'Today' : key === yesterday ? 'Yesterday' : new Date(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      items,
    }));
}

/** Source glyph + label + color for the card header badge (same mapping as 1.0). */
export function sourceLabel(source: CaptureSource): { glyph: string; label: string; color: string } {
  switch (source) {
    case 'passive': return { glyph: '◎', label: 'LISTEN', color: '#5B8CFF' };
    case 'meeting': return { glyph: '◈', label: 'MEETING', color: '#60A5FA' };
    case 'voice':   return { glyph: '◉', label: 'VOICE', color: '#FFA05C' };
    case 'text':    return { glyph: '◈', label: 'TEXT', color: '#8A7560' };
    default:        return { glyph: '◈', label: 'CAPTURE', color: '#8A7560' };
  }
}

/** Accent + short label for the AI note_type (same mapping as 1.0). */
export function noteTypeLabel(noteType: NoteType | undefined): { label: string; color: string } | null {
  if (!noteType) return null;
  const map: Partial<Record<NoteType, { label: string; color: string }>> = {
    task:           { label: 'TASK', color: '#FF8C42' },
    idea:           { label: 'IDEA', color: '#818CF8' },
    meeting:        { label: 'MEETING', color: '#60A5FA' },
    journal:        { label: 'JOURNAL', color: '#8A7560' },
    reminder:       { label: 'REMINDER', color: '#A78BFA' },
    decision:       { label: 'DECISION', color: '#FB923C' },
    project_update: { label: 'PROJECT', color: '#FFA05C' },
    resource:       { label: 'RESOURCE', color: '#2DD4BF' },
    thought:        { label: 'THOUGHT', color: '#756F68' },
  };
  return map[noteType] ?? null;
}

/** Pick the collapsed-card body text (extraction summary → structured lead line → raw) — same as 1.0. */
export function getCardSummaryText(item: CaptureRow, extraction: ExtractionResult | null): string | null {
  if (extraction?.summary && extraction.summary.trim().length > 10) return extraction.summary.trim();
  if (item.structured_text) {
    for (const line of item.structured_text.split('\n')) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const label = line.slice(0, colon).trim().toLowerCase();
      if (['title', 'type'].includes(label)) continue;
      const value = line.slice(colon + 1).trim();
      if (value.length > 15) return value;
    }
  }
  if (item.raw_transcript && item.raw_transcript.trim().length > 0) return item.raw_transcript.trim().slice(0, 200);
  return null;
}

// ─── Extraction chips ────────────────────────────────────────────────────────────
type ChipItem = { type: string; accent: string; label: string; sub: string };

function buildChips(extraction: ExtractionResult): ChipItem[] {
  const chips: ChipItem[] = [];
  for (const t of extraction.tasks ?? []) chips.push({ type: t.urgency === 'high' ? 'TASK · HIGH URGENCY' : 'TASK', accent: t.urgency === 'high' ? '#FF8C42' : '#FF8C42', label: t.task, sub: t.context ? t.context.slice(0, 50) : t.category });
  for (const e of extraction.expenses ?? []) chips.push({ type: 'EXPENSE', accent: '#4ADE80', label: `${e.amount ? '$' + e.amount + ' · ' : ''}${e.description}`, sub: `Categorised: ${e.category}` });
  for (const f of extraction.follow_ups ?? []) chips.push({ type: 'FOLLOW-UP', accent: '#FB923C', label: `${f.assignee} — ${f.action}`, sub: 'Assignee logged' });
  for (const p of extraction.people ?? []) chips.push({ type: 'PERSON', accent: '#60A5FA', label: p, sub: extraction.summary ? extraction.summary.slice(0, 50) : 'Mentioned' });
  for (const r of extraction.reminders ?? []) chips.push({ type: 'REMINDER', accent: '#A78BFA', label: r.text, sub: r.time ? new Date(r.time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : r.urgency });
  for (const i of extraction.ideas ?? []) chips.push({ type: 'IDEA', accent: '#818CF8', label: i.title, sub: i.description.slice(0, 60) });
  if (extraction.mood && extraction.mood.tone !== 'neutral') {
    chips.push({
      type: 'MOOD SIGNAL',
      accent: extraction.mood.tone === 'positive' || extraction.mood.tone === 'excited' ? '#4ADE80' : extraction.mood.tone === 'stressed' || extraction.mood.tone === 'frustrated' ? '#FB7185' : '#94A3B8',
      label: `${extraction.mood.tone.charAt(0).toUpperCase() + extraction.mood.tone.slice(1)}`,
      sub: `Energy: ${extraction.mood.energy}`,
    });
  }
  return chips.slice(0, 8);
}

export function ExtractionChips({ extraction }: { extraction: ExtractionResult | null }) {
  const { colors, spacing, radius, layout } = useTheme();
  if (!extraction) return null;
  const chips = buildChips(extraction);
  if (chips.length === 0) return null;
  return (
    <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
      {chips.map((chip, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderLeftWidth: 3, borderLeftColor: chip.accent }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: chip.accent }} />
          <Text variant="footnote" weight="700" style={{ flex: 1 }} numberOfLines={2}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Three staggered breathing dots — the calm "organizing" indicator (same motion as 1.0). */
export function OrganizingDots() {
  const { colors } = useTheme();
  const dots = [React.useRef(new Animated.Value(0)).current, React.useRef(new Animated.Value(0)).current, React.useRef(new Animated.Value(0)).current];
  React.useEffect(() => {
    const anims = dots.map((anim, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 160),
      Animated.timing(anim, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay((2 - i) * 160),
    ])));
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {dots.map((anim, i) => (
        <Animated.View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent, opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }), transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }] }} />
      ))}
    </View>
  );
}
