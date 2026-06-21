/**
 * Health cards — the smaller retoned Health building blocks (metric card, trend bar, Dr.Lucy card,
 * meal timeline, weekly travel+health widget, and the body-profile sheet). Split out of HealthView.tsx
 * to keep that file focused. Pure presentation over the useHealth seam; logic identical to 1.0.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useToast, Text, Card, Surface, Row, Stack, Spacer, Button, Chip, PressableScale, useTheme, type Theme,
} from '../../ui';
import { useHealth } from '../hooks/useHealth';
import type { HealthSnapshot } from '../../db/healthSnapshots';
import type { BodyProfileRow, FoodLogRow } from '../../db/healthNutrition';
import type { GuardianGuidance } from '../../processing/drLucy';

export const TEAL = '#2DD4BF';

export function HealthMetricCard({ icon, label, value, unit, sub, accent = TEAL, theme }: { icon: string; label: string; value: string | number | null; unit?: string; sub?: string; accent?: string; theme: Theme }) {
  const { spacing } = theme;
  return (
    <Card level="surfaceAlt" padding="md" style={{ flex: 1 }}>
      <Text variant="h2">{icon}</Text>
      <Text variant="caption" weight="700" tracking={1.4} style={{ color: accent, textTransform: 'uppercase', marginTop: spacing.xs }}>{label}</Text>
      {value !== null && value !== undefined ? (
        <Row gap="xxs" align="flex-end">
          <Text variant="h2" weight="700">{value}</Text>
          {unit ? <Text variant="caption" color="textFaint" weight="600" style={{ marginBottom: 4 }}>{unit}</Text> : null}
        </Row>
      ) : <Text variant="footnote" color="textFaint" style={{ fontStyle: 'italic' }}>—</Text>}
      {sub ? <Text variant="caption" color="textFaint">{sub}</Text> : null}
    </Card>
  );
}

export function HealthTrendBar({ label, value, maxValue, accent, theme }: { label: string; value: number; maxValue: number; accent: string; theme: Theme }) {
  const { colors } = theme;
  const pct = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  return (
    <View style={{ gap: 4 }}>
      <Row justify="space-between">
        <Text variant="caption" color="textMuted">{label}</Text>
        <Text variant="caption" color="textSecondary" weight="700">{value.toLocaleString()}</Text>
      </Row>
      <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: accent, borderRadius: 3 }} />
      </View>
    </View>
  );
}

const SEVERITY_STYLE: Record<GuardianGuidance['severity'], { color: (t: Theme) => string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  care: { color: (t) => t.colors.accent, label: 'A gentle note', icon: 'heart-outline' },
  gentle: { color: (t) => t.colors.info, label: 'Something Lucy noticed', icon: 'leaf-outline' },
  caution: { color: (t) => t.colors.gold, label: 'Worth a glance', icon: 'alert-circle-outline' },
  emergency: { color: (t) => t.colors.danger, label: 'Please take care', icon: 'medkit-outline' },
};

export function DrLucyCard({ g, theme }: { g: GuardianGuidance; theme: Theme }) {
  const { spacing } = theme;
  const s = SEVERITY_STYLE[g.severity] ?? SEVERITY_STYLE.gentle;
  const color = s.color(theme);
  return (
    <Card level="surface" padding="md" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      <Row gap="sm" align="center">
        <Ionicons name={s.icon} size={14} color={color} />
        <Text variant="caption" weight="700" tracking={1.2} style={{ color, textTransform: 'uppercase' }}>{s.label}</Text>
      </Row>
      <Spacer size="xs" />
      <Text variant="footnote" weight="600">{g.observation}</Text>
      {g.suggestion ? <Text variant="footnote" color="textMuted" style={{ marginTop: spacing.xs }}>{g.suggestion}</Text> : null}
    </Card>
  );
}

// Today's meal items grouped by meal_type, each deletable.
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_META: Record<string, { label: string; icon: string }> = {
  breakfast: { label: 'Breakfast', icon: '🌅' }, lunch: { label: 'Lunch', icon: '🥗' }, dinner: { label: 'Dinner', icon: '🍽️' }, snack: { label: 'Snacks', icon: '🍎' },
};

export function MealTimeline({ items, onDelete, theme }: { items: FoodLogRow[]; onDelete: (id: number) => void; theme: Theme }) {
  const { colors } = theme;
  const groups = new Map<string, FoodLogRow[]>();
  for (const it of items) {
    const key = (it.meal_type && MEAL_META[it.meal_type]) ? it.meal_type : 'snack';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  const ordered = MEAL_ORDER.filter((k) => groups.has(k));
  if (ordered.length === 0) return null;
  return (
    <Stack gap="md">
      {ordered.map((key) => {
        const rows = groups.get(key)!;
        const meta = MEAL_META[key];
        const cals = rows.reduce((s, r) => s + (r.calories ?? 0), 0);
        return (
          <Surface key={key} level="surfaceAlt" radius="lg" border="border" padding="md">
            <Row justify="space-between" align="center">
              <Row gap="sm" align="center"><Text variant="footnote">{meta.icon}</Text><Text variant="footnote" weight="700">{meta.label}</Text></Row>
              <Text variant="footnote" color="textMuted" weight="700">{Math.round(cals)} kcal</Text>
            </Row>
            {rows.map((r) => (
              <Row key={r.id} gap="sm" align="center" style={{ paddingVertical: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="footnote" weight="600" numberOfLines={1}>{r.name}{r.qty ? ` · ${r.qty}${r.unit ? ' ' + r.unit : ''}` : ''}</Text>
                  <Text variant="caption" color="textMuted">{r.calories ?? 0} kcal{r.protein_g != null ? ` · P ${r.protein_g}` : ''}{r.carbs_g != null ? ` · C ${r.carbs_g}` : ''}{r.fat_g != null ? ` · F ${r.fat_g}` : ''}</Text>
                </View>
                <PressableScale onPress={() => onDelete(r.id)} hitSlop={12} accessibilityLabel="Remove food"><Ionicons name="close-circle-outline" size={20} color={colors.textMuted} /></PressableScale>
              </Row>
            ))}
          </Surface>
        );
      })}
    </Stack>
  );
}

// Weekly travel + health context.
export function WeeklyLifeWidget({ theme, healthTip }: { theme: Theme; healthTip: ReturnType<typeof useHealth>['healthTip'] }) {
  const { colors, spacing, radius, layout } = theme;
  const [locations, setLocations] = useState<import('../../db/locationSnapshots').DayLocationSummary[]>([]);
  const [healthRows, setHealthRows] = useState<HealthSnapshot[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const { getDatabase } = await import('../../db');
        const db = await getDatabase();
        const [locs, h] = await Promise.all([
          import('../../db/locationSnapshots').then((m) => m.listLocationSnapshots(db, 7)),
          import('../../db/healthSnapshots').then((m) => m.listHealthSnapshots(db, 7)),
        ]);
        setLocations(locs); setHealthRows(h);
      } catch { /* non-critical */ }
    })();
  }, []);

  if (locations.length === 0 && healthRows.length === 0) return null;
  const healthByDate = new Map(healthRows.map((h) => [h.date_key, h]));
  const locationByDate = new Map(locations.map((l) => [l.date_key, l]));
  const last7: string[] = [];
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); last7.push(d.toISOString().slice(0, 10)); }
  const hasTravelData = locations.length > 0;
  const hasHealthData = healthRows.some((h) => h.steps > 0 || h.sleep_hours !== null);
  if (!hasTravelData && !hasHealthData) return null;

  const todayRow = healthByDate.get(last7[0]);
  const tip = todayRow ? healthTip(todayRow.steps, todayRow.sleep_hours, todayRow.resting_hr) : null;
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View>
      {tip ? (
        <Card level="surface" padding="md" style={{ borderLeftWidth: 3, borderLeftColor: TEAL, borderColor: `${TEAL}44`, marginBottom: spacing.sm }}>
          <Text variant="caption" weight="700" tracking={1.2} style={{ color: TEAL }}>HEALTH TIP</Text>
          <Spacer size="xs" />
          <Text variant="footnote" color="textMuted">{tip}</Text>
        </Card>
      ) : null}
      <Text variant="caption" weight="700" tracking={1.2} style={{ color: TEAL, marginBottom: spacing.sm }}>YOUR WEEK {hasTravelData ? '· TRAVEL & HEALTH' : '· HEALTH'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row gap="sm">
          {last7.map((dateKey) => {
            const loc = locationByDate.get(dateKey);
            const h = healthByDate.get(dateKey);
            const d = new Date(dateKey + 'T12:00:00');
            const isToday = dateKey === last7[0];
            const hasAnything = (loc && loc.cities.length > 0) || (h && (h.steps > 0 || h.sleep_hours !== null));
            if (!hasAnything && !isToday) return null;
            const cityLabel = loc && loc.cities.length > 1 ? `${loc.cities[0]} → ${loc.cities[loc.cities.length - 1]}` : loc?.firstCity ?? null;
            return (
              <View key={dateKey} style={{ width: 96, backgroundColor: isToday ? `${TEAL}18` : colors.surface, borderWidth: layout.hairline, borderColor: isToday ? `${TEAL}55` : colors.border, borderRadius: radius.md, padding: spacing.sm, gap: 4 }}>
                <Text variant="caption" weight="700" style={{ color: isToday ? TEAL : colors.textMuted }}>{isToday ? 'TODAY' : dayLabels[d.getDay()]}</Text>
                {cityLabel ? <Text variant="caption" weight="700" numberOfLines={2}>📍 {cityLabel}</Text> : null}
                {h?.sleep_hours ? <Text variant="caption" color="textMuted">😴 {h.sleep_hours}h</Text> : null}
                {h?.steps && h.steps > 0 ? <Text variant="caption" color="textMuted">{h.steps >= 1000 ? `👟 ${(h.steps / 1000).toFixed(1)}k` : `👟 ${h.steps}`}</Text> : null}
                {!loc && (!h || (h.steps === 0 && !h.sleep_hours)) ? <Text variant="caption" color="textFaint">–</Text> : null}
              </View>
            );
          })}
        </Row>
      </ScrollView>
    </View>
  );
}

// Body-profile onboarding sheet → goals auto-derive on save.
const ACTIVITY_OPTS: Array<{ key: import('../../processing/calorieEngine').ActivityLevel; label: string }> = [
  { key: 'sedentary', label: 'Sedentary' }, { key: 'light', label: 'Light' }, { key: 'moderate', label: 'Moderate' }, { key: 'active', label: 'Active' }, { key: 'very_active', label: 'Very active' },
];
const GOAL_OPTS: Array<{ key: import('../../processing/calorieEngine').GoalKind; label: string }> = [
  { key: 'lose', label: 'Lose weight' }, { key: 'maintain', label: 'Maintain' }, { key: 'gain', label: 'Gain weight' },
];

export function BodyProfileSheet({ visible, initial, onClose, onSaved }: { visible: boolean; initial: BodyProfileRow | null; onClose: () => void; onSaved: () => void }) {
  const { colors, spacing, radius, layout } = useTheme();
  const toast = useToast();
  const health = useHealth();
  const [sex, setSex] = useState<import('../../processing/calorieEngine').Sex>(initial?.sex ?? 'female');
  const [birthYear, setBirthYear] = useState(initial?.birth_year ? String(initial.birth_year) : '');
  const [heightCm, setHeightCm] = useState(initial?.height_cm ? String(initial.height_cm) : '');
  const [weightKg, setWeightKg] = useState(initial?.weight_kg ? String(initial.weight_kg) : '');
  const [activity, setActivity] = useState<import('../../processing/calorieEngine').ActivityLevel>(initial?.activity_level ?? 'moderate');
  const [goal, setGoal] = useState<import('../../processing/calorieEngine').GoalKind>(initial?.goal ?? 'maintain');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSex(initial?.sex ?? 'female');
    setBirthYear(initial?.birth_year ? String(initial.birth_year) : '');
    setHeightCm(initial?.height_cm ? String(initial.height_cm) : '');
    setWeightKg(initial?.weight_kg ? String(initial.weight_kg) : '');
    setActivity(initial?.activity_level ?? 'moderate');
    setGoal(initial?.goal ?? 'maintain');
  }, [visible, initial]);

  const valid = !!birthYear && !!heightCm && !!weightKg && Number(birthYear) > 1900 && Number(heightCm) > 50 && Number(weightKg) > 20;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await health.saveBodyProfile({ sex, birth_year: Number(birthYear), height_cm: Number(heightCm), weight_kg: Number(weightKg), activity_level: activity, goal });
      onSaved();
      onClose();
    } catch (e) { toast.show({ message: e instanceof Error ? e.message : 'Could not save. Please try again.', tone: 'danger', icon: 'alert-circle' }); }
    finally { setSaving(false); }
  };

  const numField = (label: string, v: string, set: (s: string) => void, ph: string) => (
    <View style={{ flex: 1, gap: 6 }}>
      <Text variant="caption" color="textMuted" weight="700" tracking={0.8}>{label}</Text>
      <TextInput value={v} onChangeText={set} placeholder={ph} placeholderTextColor={colors.textFaint} keyboardType="number-pad" style={{ backgroundColor: colors.surfaceAlt, borderWidth: layout.hairline, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary, fontSize: 16, fontWeight: '700' }} />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Surface level="sheet" radius="xl" border="border" style={{ maxHeight: '90%', paddingTop: spacing.sm }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.base }} keyboardShouldPersistTaps="handled">
              <Stack gap="xs">
                <Text variant="caption" color="accentGlow" weight="700" tracking={1.2}>SET UP YOUR PROFILE</Text>
                <Text variant="h2">A few details, then I'll tailor your day</Text>
                <Text variant="footnote" color="textMuted">This stays on your device. It lets me estimate your energy and set gentle, realistic goals.</Text>
              </Stack>

              <Stack gap="sm">
                <Text variant="caption" color="textMuted" weight="700" tracking={0.8}>SEX</Text>
                <Row gap="sm">{(['female', 'male'] as const).map((s) => <Chip key={s} label={s === 'female' ? 'Female' : 'Male'} selected={sex === s} onPress={() => setSex(s)} />)}</Row>
              </Stack>

              <Row gap="md">{numField('BIRTH YEAR', birthYear, setBirthYear, '1995')}{numField('HEIGHT (CM)', heightCm, setHeightCm, '170')}{numField('WEIGHT (KG)', weightKg, setWeightKg, '65')}</Row>

              <Stack gap="sm">
                <Text variant="caption" color="textMuted" weight="700" tracking={0.8}>ACTIVITY</Text>
                <Row gap="sm" wrap>{ACTIVITY_OPTS.map((o) => <Chip key={o.key} label={o.label} selected={activity === o.key} onPress={() => setActivity(o.key)} />)}</Row>
              </Stack>

              <Stack gap="sm">
                <Text variant="caption" color="textMuted" weight="700" tracking={0.8}>GOAL</Text>
                <Row gap="sm">{GOAL_OPTS.map((o) => <Chip key={o.key} label={o.label} selected={goal === o.key} onPress={() => setGoal(o.key)} />)}</Row>
              </Stack>

              <Row gap="md" style={{ marginTop: spacing.xs }}>
                <Button label="Later" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
                <Button label={saving ? 'Saving…' : 'Save & set my goals'} loading={saving} disabled={!valid || saving} onPress={() => void save()} style={{ flex: 2 }} />
              </Row>
            </ScrollView>
          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
