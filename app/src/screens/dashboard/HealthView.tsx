/**
 * Health — LUCY 2.0 wellbeing view, rebuilt on the design system (app/src/ui).
 *
 * Logic flows through the seam hook `useHealth`. Every HealthView 1.0 capability is preserved: the
 * profile-setup CTA OR the calories-remaining ring + macro rings + energy-balance trend; the mood graph
 * (HealthCharts — SVG math kept, retoned); meal logging (snap photo / text / quick-add frequent foods);
 * today's meal timeline (grouped by meal, deletable); Activity & Energy metric cards (steps/sleep/HR +
 * BMR/TDEE/active); the health tip; 7-day steps + sleep trend bars; WeeklyLifeWidget (travel+health);
 * mood-this-week distribution; Dr.Lucy guardian cards + disclaimer; the no-data empty state; and the
 * BodyProfileSheet. Blocking flows use a calm ActionSheet + Toast (as 1.0 did). The MoodChart/Progress
 * rings keep their exact path math per the brief.
 *
 * Presentation: split into two tabs — "Food" (calorie intake: energy ring, meal logging, today's meals)
 * and "Activity" (calorie output + wellbeing: steps/sleep/HR/energy, trends, mood, Dr. Lucy) — so the
 * activity side isn't buried below a long food scroll. Mirrors the Ask-Lucy segmented pattern.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useToast, Text, Card, Surface, Row, Stack, Spacer, Button, IconButton, Chip, TextField, ActionSheet,
  PressableScale, SegmentedControl, useTheme,
} from '../../ui';
import { DR_LUCY_DISCLAIMER as DR_LUCY_DISCLAIMER_TEXT } from '../../processing/drLucy';
import { useHealth } from '../hooks/useHealth';
import { MoodGraphCard, ProgressRing, MacroRing, MACRO } from './HealthCharts';
import { HealthMetricCard, HealthTrendBar, DrLucyCard, MealTimeline, WeeklyLifeWidget, BodyProfileSheet, TEAL } from './HealthCards';
import type { HealthSnapshot } from '../../db/healthSnapshots';
import type { HealthSummary } from '../../processing/healthSummary';
import type { BodyProfileRow } from '../../db/healthNutrition';

const MOOD_EMOJI: Record<string, string> = { positive: '😊', excited: '⚡', calm: '😌', neutral: '😐', stressed: '😤', frustrated: '😤', negative: '😔' };

type HealthTab = 'Food' | 'Activity';

export function HealthView() {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const toast = useToast();
  const health = useHealth();

  const [tab, setTab] = useState<HealthTab>('Food');
  const [health7, setHealth7] = useState<HealthSnapshot[]>([]);
  const [mood7, setMood7] = useState<Array<{ tone: string; created_at: string }>>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [profileRow, setProfileRow] = useState<BodyProfileRow | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [mealText, setMealText] = useState('');
  const [quickFoods, setQuickFoods] = useState<string[]>([]);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [reading, setReading] = useState(false);
  const [netExpanded, setNetExpanded] = useState(false);
  const [sheet, setSheet] = useState<{ title: string; message?: string } | null>(null);

  const refreshNutrition = async () => {
    const r = await health.loadNutrition();
    setSummary(r.summary);
    setProfileRow(r.profile);
    setQuickFoods(r.frequentFoods);
  };

  const logQuick = async (name: string) => {
    if (quickBusy) return;
    setQuickBusy(name);
    try { await health.logFoodText(name); await refreshNutrition(); toast.show({ message: `Logged ${name}`, tone: 'success', icon: 'checkmark-circle' }); }
    catch (e) { setSheet({ title: 'Could not log', message: e instanceof Error ? e.message : 'Please try again.' }); }
    finally { setQuickBusy(null); }
  };

  const logText = async () => {
    const text = mealText.trim();
    if (!text || logging) return;
    setLogging(true);
    try {
      const key = await health.checkModelKey();
      if (!key.ok) { setLogging(false); setSheet({ title: 'Add your API key', message: key.message }); return; }
      const res = await health.logFoodText(text);
      setMealText('');
      if (!res.estimated) setSheet({ title: 'Saved your meal', message: 'I couldn\'t estimate the calories from that. Name the foods and rough amounts — like "2 eggs and toast" — and I\'ll add a calorie count. (Estimates use remote intelligence — add a key in Settings.)' });
      else toast.show({ message: 'Meal logged', tone: 'success', icon: 'checkmark-circle' });
      await refreshNutrition();
    } catch (e) { setSheet({ title: 'Could not log', message: e instanceof Error ? e.message : 'Please try again.' }); }
    finally { setLogging(false); }
  };

  const logPhoto = async () => {
    if (reading) return;
    try {
      const uri = await health.pickMealImage();
      if (!uri) return;
      const key = await health.checkModelKey();
      if (!key.ok) { setSheet({ title: 'Add your API key', message: key.message }); return; }
      setReading(true);
      const res = await health.logFoodPhoto(uri);
      setReading(false);
      if (!res.estimated) setSheet({ title: 'Saved your meal', message: 'I couldn\'t make out the food well enough to estimate calories. Try a clearer, well-lit photo from above, or type what it was.' });
      else toast.show({ message: 'Meal logged', tone: 'success', icon: 'checkmark-circle' });
      await refreshNutrition();
    } catch (e) { setReading(false); setSheet({ title: 'Could not read meal', message: e instanceof Error ? e.message : 'Please try again.' }); }
  };

  const removeFood = async (id: number) => { try { await health.deleteFood(id); await refreshNutrition(); } catch { /* non-critical */ } };

  useEffect(() => {
    void (async () => { const r = await health.loadActivity(); setHealth7(r.health7); setMood7(r.mood7); })();
    void refreshNutrition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = health7[0] ?? null;
  const maxSteps = Math.max(10000, ...health7.map((h) => h.steps));
  const avgSteps = health7.length > 0 ? Math.round(health7.reduce((s, h) => s + h.steps, 0) / health7.length) : 0;
  const sleepRows = health7.filter((h) => h.sleep_hours);
  const avgSleep = sleepRows.length > 0 ? Math.round(sleepRows.reduce((s, h) => s + (h.sleep_hours ?? 0), 0) / sleepRows.length * 10) / 10 : null;

  const moodCount = mood7.reduce<Record<string, number>>((acc, m) => { acc[m.tone] = (acc[m.tone] ?? 0) + 1; return acc; }, {});
  const dominantMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const last7Keys: string[] = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last7Keys.push(d.toISOString().slice(0, 10)); }
  const healthByDate = new Map(health7.map((h) => [h.date_key, h]));

  const goals = summary?.goals ?? null;
  const intake = summary?.intake ?? null;
  const calGoal = goals?.calorie_goal ?? 0;
  const calEaten = intake?.calories ?? 0;
  const calRemaining = summary?.remaining;
  const drLucy = summary?.drLucy ?? [];

  // ─── FOOD tab: calorie intake — energy ring, meal logging, today's meals ────────
  const foodTab = (
    <>
      {!summary ? (
        <Card level="surface" padding="xl" style={{ alignItems: 'center' }}><ActivityIndicator color={colors.accent} /></Card>
      ) : !summary.profileComplete ? (
        <Card onPress={() => setShowProfile(true)} level="surface" border="accentLine" padding="lg">
          <Row gap="md" align="center">
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="accentGlow" weight="700" tracking={1.2}>LET'S PERSONALISE THIS</Text>
              <Text variant="h3">Set up your profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
          </Row>
          <Spacer size="sm" />
          <Text variant="footnote" color="textMuted">A few details (kept on your device) let me estimate your energy and set gentle calorie + macro goals.</Text>
        </Card>
      ) : (
        <Card level="surface" padding="lg">
          <Row justify="space-between" align="center">
            <Text variant="caption" color="accentGlow" weight="700" tracking={1.4}>TODAY'S ENERGY</Text>
            <IconButton icon="settings-outline" variant="plain" size="sm" accessibilityLabel="Edit profile" onPress={() => setShowProfile(true)} />
          </Row>
          <Spacer size="md" />
          <Row gap="lg" align="center">
            <ProgressRing size={132} stroke={13} value={calEaten} goal={calGoal || 1} color={colors.accent}>
              <Text variant="display" weight="700">{calGoal > 0 ? Math.max(0, calRemaining ?? 0) : calEaten}</Text>
              <Text variant="caption" color="textMuted" weight="700">{calGoal > 0 ? 'kcal left' : 'kcal eaten'}</Text>
            </ProgressRing>
            <Stack gap="sm" flex={1}>
              <Row justify="space-between"><Text variant="footnote" color="textMuted">Eaten</Text><Text variant="footnote" weight="700">{calEaten} kcal</Text></Row>
              <Row justify="space-between"><Text variant="footnote" color="textMuted">Goal</Text><Text variant="footnote" weight="700">{calGoal > 0 ? `${calGoal} kcal` : '—'}</Text></Row>
              {summary.energy.tdee ? <Row justify="space-between"><Text variant="footnote" color="textMuted">Burned (est.)</Text><Text variant="footnote" color="textSecondary" weight="700">{summary.energy.tdee} kcal</Text></Row> : null}
            </Stack>
          </Row>
          {goals ? (
            <Row gap="sm" style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: theme.layout.hairline, borderTopColor: colors.divider }}>
              <MacroRing label="Protein" value={intake?.protein_g ?? 0} goal={goals.protein_g} color={MACRO.protein} />
              <MacroRing label="Carbs" value={intake?.carbs_g ?? 0} goal={goals.carbs_g} color={MACRO.carbs} />
              <MacroRing label="Fat" value={intake?.fat_g ?? 0} goal={goals.fat_g} color={MACRO.fat} />
            </Row>
          ) : null}
          {summary.net_rolling_7 != null ? (
            <View style={{ borderTopWidth: theme.layout.hairline, borderTopColor: colors.divider, paddingTop: spacing.sm, marginTop: spacing.sm }}>
              <PressableScale onPress={() => setNetExpanded((v) => !v)} accessibilityLabel="Energy balance trend">
                <Row justify="space-between" align="center">
                  <Text variant="footnote" color="textMuted" weight="600">Energy balance trend</Text>
                  <Ionicons name={netExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                </Row>
              </PressableScale>
              {netExpanded ? (
                <Text variant="footnote" color="textMuted" style={{ marginTop: spacing.xs }}>
                  Over the last 7 days you've averaged about {summary.net_rolling_7 >= 0 ? '+' : ''}{summary.net_rolling_7} kcal vs what you burn. This is a rough trend (±15–25%), not a daily score — a gentle direction, nothing to chase.
                </Text>
              ) : null}
            </View>
          ) : null}
        </Card>
      )}

      {/* Log a meal */}
      {summary && summary.profileComplete ? (
        <Stack gap="sm">
          <Text variant="caption" color="accentGlow" weight="700" tracking={1.4}>LOG A MEAL</Text>
          {quickFoods.length > 0 ? (
            <Stack gap="sm">
              <Text variant="caption" color="textMuted" weight="700">Quick add</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xs }}>
                {quickFoods.map((name) => (
                  <Chip key={name} label={name} icon={quickBusy === name ? 'checkmark' : 'add'} disabled={!!quickBusy} onPress={() => void logQuick(name)} />
                ))}
              </ScrollView>
            </Stack>
          ) : null}
          <Row gap="sm" align="stretch">
            <PressableScale onPress={() => void logPhoto()} disabled={reading} accessibilityLabel="Snap a meal" style={{ flex: 1 }}>
              <Surface level="surfaceAlt" radius="lg" border="border" padding="md" style={{ alignItems: 'center', gap: spacing.xs, minHeight: 44, justifyContent: 'center' }}>
                {reading ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="camera-outline" size={22} color={colors.accent} />}
                <Text variant="footnote" weight="700">{reading ? 'Reading…' : 'Snap a meal'}</Text>
              </Surface>
            </PressableScale>
            <Surface level="surfaceAlt" radius="lg" border="border" padding="md" style={{ flex: 2, gap: spacing.sm }}>
              <TextField placeholder="Say or type a meal — “2 eggs and toast”" value={mealText} onChangeText={setMealText} onSubmitEditing={() => void logText()} returnKeyType="done" multiline />
              <Button label={logging ? 'Estimating…' : 'Log'} icon={logging ? undefined : 'add'} loading={logging} disabled={!mealText.trim() || logging} onPress={() => void logText()} />
            </Surface>
          </Row>
        </Stack>
      ) : null}

      {/* Today's meals */}
      {intake && intake.items.length > 0 ? (
        <Stack gap="sm">
          <Text variant="caption" color="accentGlow" weight="700" tracking={1.4}>TODAY'S MEALS</Text>
          <MealTimeline items={intake.items} onDelete={removeFood} theme={theme} />
        </Stack>
      ) : summary && summary.profileComplete ? (
        <Surface level="surfaceAlt" radius="lg" border="border" padding="lg" style={{ alignItems: 'center', gap: spacing.xs }}>
          <Text variant="h2">🍵</Text>
          <Text variant="footnote" weight="700">Nothing logged yet today</Text>
          <Text variant="footnote" color="textMuted" align="center">Snap or describe a meal above and I'll keep a gentle running tally.</Text>
        </Surface>
      ) : null}
    </>
  );

  // ─── ACTIVITY tab: calorie output + wellbeing — energy, trends, mood, Dr. Lucy ──
  const activityTab = (
    <>
      {/* Activity & energy */}
      <Text variant="caption" weight="700" tracking={1.4} style={{ color: TEAL }}>ACTIVITY & ENERGY</Text>
      <Row gap="sm">
        <HealthMetricCard icon="👟" label="Steps" theme={theme} value={today?.steps && today.steps > 0 ? (today.steps >= 1000 ? `${(today.steps / 1000).toFixed(1)}k` : today.steps) : null} sub={avgSteps > 0 ? `7-day avg: ${avgSteps >= 1000 ? `${(avgSteps / 1000).toFixed(1)}k` : avgSteps}` : undefined} />
        <HealthMetricCard icon="😴" label="Sleep" theme={theme} value={today?.sleep_hours ?? null} unit="h" sub={avgSleep ? `7-day avg: ${avgSleep}h` : undefined} accent="#818CF8" />
        <HealthMetricCard icon="❤️" label="HR" theme={theme} value={today?.resting_hr ?? null} unit="bpm" accent="#FB7185" />
      </Row>
      {summary && summary.profileComplete && summary.energy.bmr ? (
        <Row gap="sm">
          <HealthMetricCard icon="🔥" label="BMR" theme={theme} value={summary.energy.bmr} unit="kcal" sub="At rest" accent={colors.accent} />
          <HealthMetricCard icon="⚡" label="Burned" theme={theme} value={summary.energy.tdee ?? null} unit="kcal" sub="Estimated total" accent={colors.gold} />
          <HealthMetricCard icon="🏃" label="Active" theme={theme} value={summary.activity.active_energy_kcal ?? null} unit="kcal" sub={summary.activity.active_energy_source === 'measured' ? 'Measured' : 'Estimated'} accent={TEAL} />
        </Row>
      ) : null}

      {health7.some((h) => h.steps > 0) ? (
        <Surface level="surfaceAlt" radius="lg" border="border" padding="md">
          <Text variant="caption" weight="700" tracking={1.4} style={{ color: TEAL }}>STEPS — LAST 7 DAYS</Text>
          <Spacer size="sm" />
          <Stack gap="md">
            {last7Keys.map((dateKey) => {
              const h = healthByDate.get(dateKey);
              const d = new Date(dateKey + 'T12:00:00');
              const isToday = dateKey === last7Keys[6];
              return <HealthTrendBar key={dateKey} theme={theme} label={isToday ? 'Today' : dayLabels[d.getDay()]} value={h?.steps ?? 0} maxValue={maxSteps} accent={h && h.steps >= 10000 ? '#4ADE80' : h && h.steps >= 5000 ? TEAL : '#60A5FA'} />;
            })}
          </Stack>
          <Text variant="caption" color="textFaint" style={{ marginTop: spacing.xs }}>Goal: 10,000 steps</Text>
        </Surface>
      ) : null}

      {health7.some((h) => h.sleep_hours) ? (
        <Surface level="surfaceAlt" radius="lg" border="border" padding="md">
          <Text variant="caption" weight="700" tracking={1.4} style={{ color: '#818CF8' }}>SLEEP — LAST 7 DAYS</Text>
          <Spacer size="sm" />
          <Stack gap="md">
            {last7Keys.map((dateKey) => {
              const h = healthByDate.get(dateKey);
              const d = new Date(dateKey + 'T12:00:00');
              const isToday = dateKey === last7Keys[6];
              const hrs = h?.sleep_hours ?? 0;
              return <HealthTrendBar key={dateKey} theme={theme} label={isToday ? 'Today' : dayLabels[d.getDay()]} value={Math.round(hrs * 10) / 10} maxValue={10} accent={hrs >= 8 ? '#4ADE80' : hrs >= 6 ? '#818CF8' : '#FB7185'} />;
            })}
          </Stack>
          <Text variant="caption" color="textFaint" style={{ marginTop: spacing.xs }}>Goal: 8h sleep</Text>
        </Surface>
      ) : null}

      <WeeklyLifeWidget theme={theme} healthTip={health.healthTip} />

      {/* How you've been — mood graph grouped with the weekly mood summary at the very bottom */}
      <MoodGraphCard />

      {dominantMood ? (
        <Surface level="surfaceAlt" radius="lg" border="border" padding="md">
          <Text variant="caption" weight="700" tracking={1.4} style={{ color: '#C084FC' }}>MOOD THIS WEEK</Text>
          <Spacer size="sm" />
          <Row gap="md" align="center">
            <Text variant="h1">{MOOD_EMOJI[dominantMood] ?? '😐'}</Text>
            <View>
              <Text variant="bodyMed">{dominantMood.charAt(0).toUpperCase() + dominantMood.slice(1)}</Text>
              <Text variant="caption" color="textMuted">{mood7.length} mood entries this week</Text>
            </View>
          </Row>
          <Spacer size="sm" />
          <Stack gap="md">
            {Object.entries(moodCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([tone, count]) => (
              <HealthTrendBar key={tone} theme={theme} label={tone} value={count} maxValue={mood7.length} accent="#C084FC" />
            ))}
          </Stack>
        </Surface>
      ) : null}

      {/* Dr. Lucy */}
      {drLucy.length > 0 ? (
        <Stack gap="sm">
          <Row gap="xs" align="center">
            <Ionicons name="medkit-outline" size={14} color={colors.accent} />
            <Text variant="caption" color="accentGlow" weight="700" tracking={1.4}>DR. LUCY</Text>
          </Row>
          {drLucy.map((g, i) => <DrLucyCard key={`${g.category}-${i}`} g={g} theme={theme} />)}
          <Text variant="caption" color="textFaint">{DR_LUCY_DISCLAIMER_TEXT}</Text>
        </Stack>
      ) : null}

      {/* No data */}
      {!today && health7.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.huge, gap: spacing.md }}>
          <Text variant="h1">💚</Text>
          <Text variant="h3">Health tracking will appear here</Text>
          <Text variant="footnote" color="textMuted" align="center" style={{ maxWidth: 280 }}>Enable Location in Connectors to start. Steps and sleep data come from your device — no extra setup needed.</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.base }}>
      <SegmentedControl<HealthTab>
        options={[
          { value: 'Activity', label: 'Activity', icon: 'walk-outline' },
          { value: 'Food', label: 'Food', icon: 'restaurant-outline' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'Food' ? foodTab : activityTab}

      <BodyProfileSheet visible={showProfile} initial={profileRow} onClose={() => setShowProfile(false)} onSaved={() => { void refreshNutrition(); }} />
      <ActionSheet visible={!!sheet} onClose={() => setSheet(null)} title={sheet?.title ?? ''} message={sheet?.message} actions={[]} cancelLabel="Got it" />
    </ScrollView>
  );
}
