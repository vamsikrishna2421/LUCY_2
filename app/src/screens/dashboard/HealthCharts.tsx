/**
 * Health charts — the SVG mood graph + calorie/macro rings for the Health view, retoned onto the design
 * system (app/src/ui). The SVG PATH MATH is preserved verbatim from Dashboard 1.0 (smoothLinePath /
 * smoothAreaPath / MoodChart / ProgressRing) — only colors move from LUCY_COLORS to theme tokens, per
 * the brief ("retone the SVG, don't rebuild the math"). Data flows through the useHealth seam
 * (getMoodGraph / getDayHighlights). MoodDaySheet is a BottomSheet.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, {
  Circle as SvgCircle, Path as SvgPath, Line as SvgLine, Defs as SvgDefs,
  LinearGradient as SvgLinearGradient, Stop as SvgStop, G as SvgG, Rect as SvgRect,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet, Surface, Card, Text, Row, Stack, Spacer, useTheme, type Theme } from '../../ui';
import { LucyEmptyState } from '../../components/LucyEmptyState';
import { useHealth } from '../hooks/useHealth';
import type { MoodGraph as MoodGraphT, MoodPoint as MoodPointT, DayHighlight as DayHighlightT } from '../../processing/moodGraph';

export const MACRO = { protein: '#5BA8FF', carbs: '#F5C451', fat: '#FB7185' } as const;
const MOOD_DOMAIN = 2.2; // y-axis spans −2.2..+2.2 (valence is −2..+2, padded)

function moodWordForTone(tone: string | null): string {
  if (!tone) return 'a quiet day';
  const t = tone.toLowerCase();
  return `Mostly ${t}`;
}

// ── Path builders — verbatim from Dashboard 1.0 (no math change) ──────────────────
function smoothLinePath(pts: Array<{ x: number; y: number } | null>): string {
  let d = '';
  let seg: Array<{ x: number; y: number }> = [];
  const flush = () => {
    if (seg.length === 0) return;
    if (seg.length === 1) { d += ` M ${seg[0].x} ${seg[0].y} l 0.01 0`; seg = []; return; }
    d += ` M ${seg[0].x} ${seg[0].y}`;
    for (let i = 0; i < seg.length - 1; i++) {
      const p0 = seg[i - 1] ?? seg[i];
      const p1 = seg[i];
      const p2 = seg[i + 1];
      const p3 = seg[i + 2] ?? p2;
      const t = 0.16;
      const c1x = p1.x + (p2.x - p0.x) * t;
      const c1y = p1.y + (p2.y - p0.y) * t;
      const c2x = p2.x - (p3.x - p1.x) * t;
      const c2y = p2.y - (p3.y - p1.y) * t;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    seg = [];
  };
  for (const p of pts) { if (p) seg.push(p); else flush(); }
  flush();
  return d.trim();
}

function smoothAreaPath(pts: Array<{ x: number; y: number } | null>, baseY: number): string {
  let d = '';
  let seg: Array<{ x: number; y: number }> = [];
  const flush = () => {
    if (seg.length < 2) { seg = []; return; }
    const line = smoothLinePath(seg);
    d += ` ${line} L ${seg[seg.length - 1].x} ${baseY} L ${seg[0].x} ${baseY} Z`;
    seg = [];
  };
  for (const p of pts) { if (p) seg.push(p); else flush(); }
  flush();
  return d.trim();
}

// ── Calorie / macro rings — verbatim sweep math, retoned ──────────────────────────
export function ProgressRing({
  size, stroke, value, goal, color, track, children,
}: { size: number; stroke: number; value: number; goal: number; color: string; track?: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  const trackColor = track ?? colors.border;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.max(0, Math.min(1, value / goal)) : 0;
  const anim = useRef(new Animated.Value(0)).current;
  const [dash, setDash] = useState(circ);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDash(circ * (1 - v * pct)));
    Animated.timing(anim, { toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [pct, circ, anim]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <SvgCircle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <SvgCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

export function MacroRing({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      <ProgressRing size={66} stroke={7} value={value} goal={goal} color={color}>
        <Text variant="footnote" weight="700">{value}</Text>
        <Text variant="caption" color="textFaint" weight="700">g</Text>
      </ProgressRing>
      <Text variant="caption" weight="700" tracking={0.8} style={{ color, textTransform: 'uppercase' }}>{label}</Text>
      <Text variant="caption" color="textMuted">{goal > 0 ? `of ${goal}g` : '—'}</Text>
    </View>
  );
}

// ── The mood chart — SVG math verbatim, colors retoned ────────────────────────────
function MoodChart({ series, width, turnDate, onPickDay, theme }: { series: MoodPointT[]; width: number; turnDate: string | null; onPickDay: (p: MoodPointT) => void; theme: Theme }) {
  const { colors } = theme;
  const MOOD_UP = colors.success;
  const MOOD_DOWN = colors.danger;
  const H = 132, padX = 6, padTop = 12, padBottom = 14;
  const plotW = Math.max(1, width - padX * 2);
  const plotH = H - padTop - padBottom;
  const n = series.length;
  const xAt = (i: number) => padX + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const yAt = (v: number) => padTop + plotH * (1 - (v + MOOD_DOMAIN) / (MOOD_DOMAIN * 2));
  const zeroY = yAt(0);
  const points: Array<{ x: number; y: number } | null> = series.map((p, i) => (p.score == null ? null : { x: xAt(i), y: yAt(p.score) }));
  const linePath = smoothLinePath(points);
  const areaPath = smoothAreaPath(points, zeroY);

  const draw = useRef(new Animated.Value(0)).current;
  const [dashOffset, setDashOffset] = useState(1);
  const fillFade = useRef(new Animated.Value(0)).current;
  const [fillOpacity, setFillOpacity] = useState(0);
  const LEN = 2000;
  useEffect(() => {
    const id1 = draw.addListener(({ value }) => setDashOffset(1 - value));
    const id2 = fillFade.addListener(({ value }) => setFillOpacity(value));
    Animated.parallel([
      Animated.timing(draw, { toValue: 1, duration: 950, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.sequence([Animated.delay(280), Animated.timing(fillFade, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: false })]),
    ]).start();
    return () => { draw.removeListener(id1); fillFade.removeListener(id2); };
  }, [draw, fillFade, width]);

  const dataPts = series.map((p, i) => ({ p, i })).filter(({ p }) => p.score != null);
  const lastWithData = dataPts.length ? dataPts[dataPts.length - 1] : null;
  const splitOffset = `${Math.max(0, Math.min(1, (zeroY - padTop) / plotH))}`;

  return (
    <Svg width={width} height={H}>
      <SvgDefs>
        <SvgLinearGradient id="moodStroke" x1="0" y1={padTop} x2="0" y2={H - padBottom} gradientUnits="userSpaceOnUse">
          <SvgStop offset="0" stopColor={MOOD_UP} />
          <SvgStop offset={splitOffset} stopColor={MOOD_UP} />
          <SvgStop offset={splitOffset} stopColor={MOOD_DOWN} />
          <SvgStop offset="1" stopColor={MOOD_DOWN} />
        </SvgLinearGradient>
        <SvgLinearGradient id="moodFill" x1="0" y1={padTop} x2="0" y2={H - padBottom} gradientUnits="userSpaceOnUse">
          <SvgStop offset="0" stopColor={MOOD_UP} stopOpacity="0.28" />
          <SvgStop offset={splitOffset} stopColor={MOOD_UP} stopOpacity="0.02" />
          <SvgStop offset={splitOffset} stopColor={MOOD_DOWN} stopOpacity="0.02" />
          <SvgStop offset="1" stopColor={MOOD_DOWN} stopOpacity="0.26" />
        </SvgLinearGradient>
      </SvgDefs>
      {areaPath ? <SvgPath d={areaPath} fill="url(#moodFill)" opacity={fillOpacity} /> : null}
      <SvgLine x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} stroke={colors.textFaint} strokeWidth={1} strokeDasharray="2 5" opacity={0.5} />
      {linePath ? (
        <SvgPath d={linePath} stroke="url(#moodStroke)" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={LEN} strokeDashoffset={LEN * dashOffset} />
      ) : null}
      <SvgG opacity={fillOpacity}>
        {dataPts.map(({ p, i }) => {
          const x = xAt(i), y = yAt(p.score as number);
          const isTurn = turnDate != null && p.date === turnDate;
          const isLast = lastWithData != null && p.date === lastWithData.p.date;
          const color = (p.score as number) >= 0 ? MOOD_UP : MOOD_DOWN;
          if (isTurn) return <SvgG key={p.date}><SvgCircle cx={x} cy={y} r={7} fill={color} opacity={0.18} /><SvgCircle cx={x} cy={y} r={4} fill={colors.surface} stroke={color} strokeWidth={2.4} /></SvgG>;
          if (isLast) return <SvgCircle key={p.date} cx={x} cy={y} r={3.6} fill={color} stroke={colors.surface} strokeWidth={1.5} />;
          return <SvgCircle key={p.date} cx={x} cy={y} r={2} fill={color} opacity={0.85} />;
        })}
      </SvgG>
      {series.map((p, i) => {
        const colW = width / n;
        return <SvgRect key={`hit-${p.date}`} x={i * colW} y={0} width={colW} height={H} fill="transparent" onPress={() => onPickDay(p)} />;
      })}
    </Svg>
  );
}

// ── A day's notes — BottomSheet, lazily loaded ────────────────────────────────────
function MoodDaySheet({ point, onClose }: { point: MoodPointT | null; onClose: () => void }) {
  const { colors, spacing } = useTheme();
  const health = useHealth();
  const [items, setItems] = useState<DayHighlightT[] | null>(null);
  useEffect(() => {
    let alive = true;
    if (!point) { setItems(null); return; }
    setItems(null);
    void (async () => { const rows = await health.loadDayHighlights(point.dayMs); if (alive) setItems(rows); })();
    return () => { alive = false; };
  }, [point, health]);

  const accent = point == null ? colors.success : (point.score == null ? colors.textSecondary : point.score >= 0 ? colors.success : colors.danger);
  const dateLabel = point ? new Date(point.dayMs).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : '';

  return (
    <BottomSheet visible={point != null} onClose={onClose}>
      <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: accent, marginBottom: spacing.sm }} />
      <Text variant="caption" color="accent" weight="700" tracking={0.6}>{dateLabel}{point ? ` · ${moodWordForTone(point.dominantTone)}` : ''}</Text>
      <Text variant="h3" style={{ marginTop: spacing.xs }}>What was happening</Text>
      <Spacer size="sm" />
      {items == null ? (
        <Text variant="footnote" color="textMuted" align="center" style={{ paddingVertical: spacing.xl }}>Loading…</Text>
      ) : items.length === 0 ? (
        <Text variant="footnote" color="textMuted" style={{ paddingVertical: spacing.sm }}>
          Nothing was captured this day. When you jot or speak a thought, it'll show up here so you can see what shaped how you felt.
        </Text>
      ) : (
        <Stack gap="sm">
          {items.map((it) => (
            <Surface key={it.id} level="surfaceAlt" radius="md" border="border" padding="md">
              <Row gap="sm" align="flex-start">
                <View style={{ width: 7, height: 7, borderRadius: 3.5, marginTop: 5, backgroundColor: accent }} />
                <View style={{ flex: 1 }}>
                  <Row gap="sm" justify="space-between" align="center">
                    <Text variant="footnote" weight="700" style={{ flex: 1 }} numberOfLines={1}>{it.title}</Text>
                    <Text variant="caption" color="textMuted" weight="700">{it.time}</Text>
                  </Row>
                  {it.snippet ? <Text variant="caption" color="textMuted" numberOfLines={2} style={{ marginTop: 3 }}>{it.snippet}</Text> : null}
                </View>
              </Row>
            </Surface>
          ))}
        </Stack>
      )}
    </BottomSheet>
  );
}

/** "How you've been" — the headline wellbeing card with the mood line + human shift caption. */
export function MoodGraphCard() {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const health = useHealth();
  const [graph, setGraph] = useState<MoodGraphT | null>(null);
  const [width, setWidth] = useState(0);
  const [daySel, setDaySel] = useState<MoodPointT | null>(null);

  useEffect(() => { void (async () => setGraph(await health.loadMoodGraph(30)))(); }, [health]);

  if (graph == null) {
    return <Card level="surface" padding="lg" style={{ alignItems: 'center', paddingVertical: spacing.xxl }}><Text variant="footnote" color="textMuted">Loading…</Text></Card>;
  }
  if (!graph.hasData) {
    return (
      <Card level="surface" padding="lg">
        <Text variant="caption" color="accentGlow" weight="700" tracking={1.4}>HOW YOU'VE BEEN</Text>
        <LucyEmptyState compact title="I'll chart your mood here" message="As you check in and capture how you're feeling, I'll plot it over time — so you can see when things lifted or dipped." />
      </Card>
    );
  }

  const { series, shift } = graph;
  const turnPoint = shift.sinceDate ? series.find((p) => p.date === shift.sinceDate) ?? null : null;
  const shiftColor = shift.direction === 'up' ? colors.success : shift.direction === 'down' ? colors.danger : colors.textSecondary;
  const shiftIcon = shift.direction === 'up' ? 'trending-up' : 'trending-down';
  const monthStart = series[0] ? new Date(series[0].dayMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const monthEnd = series.length ? new Date(series[series.length - 1].dayMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

  return (
    <Card level="surface" padding="lg">
      <Row justify="space-between" align="center">
        <Text variant="caption" color="accentGlow" weight="700" tracking={1.4}>HOW YOU'VE BEEN</Text>
        <Text variant="caption" color="textFaint" weight="700">Last 30 days</Text>
      </Row>
      <Text variant="h3" style={{ marginTop: spacing.xs }}>Your mood, lately</Text>

      {shift.direction !== 'flat' && shift.message ? (
        <Card
          onPress={turnPoint ? () => setDaySel(turnPoint) : undefined}
          level="surfaceAlt"
          padding="md"
          style={{ marginTop: spacing.sm, borderColor: `${shiftColor}33`, backgroundColor: `${shiftColor}12` }}
        >
          <Row gap="md" align="center">
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: `${shiftColor}22`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={shiftIcon} size={15} color={shiftColor} />
            </View>
            <Text variant="footnote" weight="600" style={{ flex: 1 }}>{shift.message}</Text>
            {turnPoint ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
          </Row>
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.xs }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? <MoodChart series={series} width={width} turnDate={shift.sinceDate} onPickDay={setDaySel} theme={theme} /> : <View style={{ height: 132 }} />}
      </View>

      <Row justify="space-between" align="center" style={{ marginTop: spacing.xs }}>
        <Text variant="caption" color="textFaint" weight="700">{monthStart}</Text>
        <Text variant="caption" color="textFaint" style={{ fontStyle: 'italic' }}>Tap a day to see what was happening</Text>
        <Text variant="caption" color="textFaint" weight="700">{monthEnd}</Text>
      </Row>

      <MoodDaySheet point={daySel} onClose={() => setDaySel(null)} />
    </Card>
  );
}
