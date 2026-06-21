/**
 * Brain Galaxy — LUCY 2.0 hierarchical topic-tree browser, rebuilt on the design system (app/src/ui).
 *
 * Navigation: Home (life areas) → Topic → Sub-topics → Items, via a simple in-component stack (no
 * navigator), with a fade on every level change — same model as Galaxy 1.0. All data/mutations flow
 * through the seam hook `useGalaxy` (docs/04 Galaxy row: UI over config + db/brainTopics). Every 1.0
 * capability is preserved: life-area grid with per-area accent + item counts, the "galaxy is forming"
 * empty state, add life-area / add sub-topic, sub-topic rows, the item list (tap a captured memory →
 * MemoryDetailSheet), "View story" → StoryView, the seeding proposal flow (shouldSeed → propose →
 * accept), long-press topic (rename / delete-to-Misc) and long-press item (delete the bad
 * capture/task/idea).
 *
 * Redesign fix (flagged): rename + add used iOS-only `Alert.prompt`, which silently no-ops on Android.
 * They now use a design-system BottomSheet + TextField, so they work on both platforms. Topic/item
 * action menus move from `Alert.alert` to the design-system ActionSheet. Behavior (the underlying
 * frozen calls) is unchanged.
 *
 * Exported name (`GalaxyView`) is unchanged so Dashboard needs no edit.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Text, Card, Surface, Row, Stack, Spacer, Button, IconButton, Badge, Chip, TextField, EmptyState,
  ActionSheet, BottomSheet, PressableScale, useTheme, type Theme,
} from '../ui';
import { haptic } from '../config/haptics';
import { StoryView, type StorySubject } from './StoryView';
import { MemoryDetailSheet } from '../components/MemoryDetailSheet';
import { useGalaxy, type ItemDisplay } from './hooks/useGalaxy';
import type { BrainTopicRow } from '../db/brainTopics';

type GalaxyFrame =
  | { kind: 'home' }
  | { kind: 'topic'; topicId: number; name: string; breadcrumb: string };

// Per-area accent palette — same eight colors as Galaxy 1.0, cycled by index.
const AREA_COLORS = ['#FF8C42', '#4ADE80', '#60A5FA', '#C084FC', '#F59E0B', '#FB7185', '#2DD4BF', '#FFA05C'];
const areaColor = (index: number): string => AREA_COLORS[index % AREA_COLORS.length];

// ─── Add / rename sheet (replaces iOS-only Alert.prompt — works on Android too) ──
function NameSheet({
  visible, title, placeholder, initialValue, confirmLabel, onClose, onSubmit,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  initialValue?: string;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [text, setText] = useState(initialValue ?? '');
  useEffect(() => { if (visible) setText(initialValue ?? ''); }, [visible, initialValue]);
  const submit = () => {
    const t = text.trim();
    if (t) onSubmit(t);
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <Stack gap="base">
        <TextField value={text} onChangeText={setText} placeholder={placeholder} autoFocus returnKeyType="done" onSubmitEditing={submit} />
        <Row gap="md">
          <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button label={confirmLabel} onPress={submit} disabled={!text.trim()} style={{ flex: 2 }} />
        </Row>
      </Stack>
    </BottomSheet>
  );
}

// ─── Seeding proposal sheet ──────────────────────────────────────────────────────
function SeedingSheet({
  proposedJson, visible, onAccept, onDismiss, theme,
}: {
  proposedJson: string;
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  theme: Theme;
}) {
  const { spacing } = theme;
  let areas: Array<{ name: string; emoji?: string; topics?: Array<{ name: string }> }> = [];
  try {
    const p = JSON.parse(proposedJson) as { areas?: typeof areas };
    areas = p.areas ?? [];
  } catch { /* show empty */ }

  return (
    <BottomSheet visible={visible} onClose={onDismiss} title="Your brain, organised">
      <Text variant="footnote" color="textMuted" align="center">
        LUCY found these areas in your captures. Approve to build your Galaxy.
      </Text>
      <Spacer size="base" />
      <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
        <Stack gap="md">
          {areas.map((area, i) => (
            <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: areaColor(i), paddingLeft: spacing.md }}>
              <Text variant="bodyMed">{area.emoji ? `${area.emoji} ` : ''}{area.name}</Text>
              <Row gap="xs" wrap style={{ marginTop: spacing.xs }}>
                {(area.topics ?? []).map((t, j) => <Chip key={j} label={t.name} />)}
              </Row>
            </View>
          ))}
        </Stack>
      </ScrollView>
      <Spacer size="base" />
      <Button label="Looks good →" fullWidth onPress={() => { haptic.capture(); onAccept(); }} />
      <Spacer size="sm" />
      <Button label="Not now" variant="ghost" fullWidth onPress={onDismiss} />
    </BottomSheet>
  );
}

export function GalaxyView() {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;
  const galaxy = useGalaxy();

  const [stack, setStack] = useState<GalaxyFrame[]>([{ kind: 'home' }]);
  const [roots, setRoots] = useState<BrainTopicRow[]>([]);
  const [children, setChildren] = useState<BrainTopicRow[]>([]);
  const [seedingJson, setSeedingJson] = useState<string | null>(null);
  const [showSeed, setShowSeed] = useState(false);
  const [nameSheet, setNameSheet] = useState<{ mode: 'add'; } | { mode: 'rename'; topic: BrainTopicRow } | null>(null);
  const [topicActions, setTopicActions] = useState<BrainTopicRow | null>(null);
  const [storySubject, setStorySubject] = useState<StorySubject | null>(null);

  const current = stack[stack.length - 1];
  const push = (frame: GalaxyFrame) => { haptic.tab(); setStack((st) => [...st, frame]); };
  const pop = () => { haptic.tab(); setStack((st) => st.slice(0, -1)); };

  // Fade-in on every stack-depth change (same as 1.0).
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [stack.length, fadeAnim]);

  const loadCurrentLevel = useCallback(async () => {
    if (current.kind === 'home') {
      setRoots(await galaxy.loadChildren(null));
      const proposal = await galaxy.maybeSeedProposal();
      if (proposal) { setSeedingJson(proposal); setShowSeed(true); }
    } else {
      setChildren(await galaxy.loadChildren(current.topicId));
    }
  }, [current, galaxy]);

  useEffect(() => { void loadCurrentLevel(); }, [loadCurrentLevel]);

  const handleAcceptSeed = async () => {
    if (!seedingJson) return;
    await galaxy.acceptSeed(seedingJson);
    setShowSeed(false);
    void loadCurrentLevel();
  };

  const submitName = async (name: string) => {
    if (!nameSheet) return;
    if (nameSheet.mode === 'add') {
      haptic.capture();
      const parentId = current.kind === 'home' ? null : current.topicId;
      await galaxy.addTopic(name, parentId);
    } else {
      await galaxy.rename(nameSheet.topic.id, name);
    }
    setNameSheet(null);
    void loadCurrentLevel();
  };

  const deleteTopic = async (t: BrainTopicRow) => {
    haptic.destructive();
    await galaxy.remove(t.id);
    void loadCurrentLevel();
  };

  // ─── Home (life areas) ───────────────────────────────────────────────────────
  if (current.kind === 'home') {
    return (
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
          {roots.length === 0 ? (
            <EmptyState
              title="Your galaxy is forming"
              message="LUCY will propose your life areas once you've captured 30+ thoughts. Or add one manually."
            />
          ) : (
            <Row gap="md" wrap paddingX="md" paddingY="md">
              {roots.map((t, i) => (
                <AreaCard key={t.id} topic={t} color={areaColor(i)} theme={theme} onPress={() => push({ kind: 'topic', topicId: t.id, name: t.name, breadcrumb: t.name })} onLongPress={() => { haptic.longPress(); setTopicActions(t); }} />
              ))}
            </Row>
          )}
          <View style={{ paddingHorizontal: spacing.md }}>
            <Button label="+ Add life area" variant="ghost" fullWidth onPress={() => setNameSheet({ mode: 'add' })} />
          </View>
        </ScrollView>

        <SeedingSheet proposedJson={seedingJson ?? '{}'} visible={showSeed && !!seedingJson} onAccept={() => void handleAcceptSeed()} onDismiss={() => setShowSeed(false)} theme={theme} />
        <NameSheet visible={nameSheet !== null} title={nameSheet?.mode === 'rename' ? 'Rename topic' : 'Add life area'} placeholder="Life area name…" initialValue={nameSheet?.mode === 'rename' ? nameSheet.topic.name : ''} confirmLabel={nameSheet?.mode === 'rename' ? 'Rename' : 'Add'} onClose={() => setNameSheet(null)} onSubmit={(n) => void submitName(n)} />
        <TopicActionSheet topic={topicActions} onClose={() => setTopicActions(null)} onRename={(t) => setNameSheet({ mode: 'rename', topic: t })} onDelete={(t) => void deleteTopic(t)} />
      </Animated.View>
    );
  }

  // ─── Topic level (sub-topics + items) ──────────────────────────────────────────
  const backLabel = stack.length > 2 && stack[stack.length - 2]?.kind === 'topic'
    ? (stack[stack.length - 2] as { name: string }).name
    : 'Galaxy';

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <Row justify="space-between" align="center" paddingX="base" paddingY="sm">
        <PressableScale onPress={pop} accessibilityLabel={`Back to ${backLabel}`}>
          <Row gap="xs" align="center">
            <Ionicons name="chevron-back" size={20} color={colors.accent} />
            <Text variant="footnote" color="textSecondary" weight="600">{backLabel}</Text>
          </Row>
        </PressableScale>
        <Chip label="View story ›" onPress={() => setStorySubject({ kind: 'topic', name: current.kind === 'topic' ? current.name : '', emoji: '◆' })} />
      </Row>

      <FlatList
        data={children}
        keyExtractor={(item) => `t-${item.id}`}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}
        ListHeaderComponent={children.length > 0 ? <Text variant="caption" color="textMuted" weight="700" tracking={1.4} style={{ marginVertical: spacing.sm }}>SUB-TOPICS</Text> : null}
        renderItem={({ item: t }) => (
          <Card
            onPress={() => push({ kind: 'topic', topicId: t.id, name: t.name, breadcrumb: `${current.name} / ${t.name}` })}
            onLongPress={() => { haptic.longPress(); setTopicActions(t); }}
            padding="md"
            accessibilityLabel={t.name}
            style={{ marginBottom: spacing.sm }}
          >
            <Row gap="md" align="center">
              <Text variant="h3" style={{ width: 32, textAlign: 'center' }}>{t.emoji ?? '◈'}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMed">{t.name}</Text>
                {t.item_count > 0 ? <Text variant="caption" color="textMuted">{t.item_count} item{t.item_count !== 1 ? 's' : ''}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Row>
          </Card>
        )}
        ListFooterComponent={<TopicItemList topicId={current.topicId} galaxy={galaxy} theme={theme} />}
      />

      <Surface level="bg" radius="none" style={{ borderTopWidth: theme.layout.hairline, borderTopColor: colors.divider, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Button label="+ Add sub-topic" variant="ghost" fullWidth onPress={() => setNameSheet({ mode: 'add' })} />
      </Surface>

      <SeedingSheet proposedJson={seedingJson ?? '{}'} visible={showSeed && !!seedingJson} onAccept={() => void handleAcceptSeed()} onDismiss={() => setShowSeed(false)} theme={theme} />
      <NameSheet visible={nameSheet !== null} title={nameSheet?.mode === 'rename' ? 'Rename topic' : 'Add sub-topic'} placeholder="Sub-topic name…" initialValue={nameSheet?.mode === 'rename' ? nameSheet.topic.name : ''} confirmLabel={nameSheet?.mode === 'rename' ? 'Rename' : 'Add'} onClose={() => setNameSheet(null)} onSubmit={(n) => void submitName(n)} />
      <TopicActionSheet topic={topicActions} onClose={() => setTopicActions(null)} onRename={(t) => setNameSheet({ mode: 'rename', topic: t })} onDelete={(t) => void deleteTopic(t)} />
      <StoryView subject={storySubject} visible={storySubject !== null} onClose={() => setStorySubject(null)} />
    </Animated.View>
  );
}

// ─── Life-area card (2-up grid) ───────────────────────────────────────────────────
function AreaCard({ topic, color, theme, onPress, onLongPress }: { topic: BrainTopicRow; color: string; theme: Theme; onPress: () => void; onLongPress: () => void }) {
  const { spacing } = theme;
  return (
    <View style={{ width: '47%' }}>
      <Card onPress={onPress} onLongPress={onLongPress} accessibilityLabel={topic.name} style={{ borderTopWidth: 3, borderTopColor: color }}>
        <Text variant="h2" style={{ marginBottom: spacing.xs }}>{topic.emoji ?? '◆'}</Text>
        <Text variant="bodyMed" numberOfLines={2}>{topic.name}</Text>
        <Text variant="caption" color="textFaint" style={{ marginTop: spacing.xs }}>{topic.item_count > 0 ? `${topic.item_count}` : '—'}</Text>
      </Card>
    </View>
  );
}

// ─── Topic long-press menu ─────────────────────────────────────────────────────────
function TopicActionSheet({ topic, onClose, onRename, onDelete }: { topic: BrainTopicRow | null; onClose: () => void; onRename: (t: BrainTopicRow) => void; onDelete: (t: BrainTopicRow) => void }) {
  return (
    <ActionSheet
      visible={topic !== null}
      onClose={onClose}
      title={topic?.name}
      message="What do you want to do?"
      actions={topic ? [
        { label: 'Rename', icon: 'create-outline', onPress: () => onRename(topic) },
        { label: 'Delete (items move to Misc)', icon: 'trash-outline', destructive: true, onPress: () => onDelete(topic) },
      ] : []}
    />
  );
}

// ─── Items list inside a topic ──────────────────────────────────────────────────────
function TopicItemList({ topicId, galaxy, theme }: { topicId: number; galaxy: ReturnType<typeof useGalaxy>; theme: Theme }) {
  const { colors, spacing } = theme;
  const [items, setItems] = useState<ItemDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const [itemActions, setItemActions] = useState<ItemDisplay | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setItems(await galaxy.loadItems(topicId)); } catch { /* non-critical */ }
    setLoading(false);
  }, [topicId, galaxy]);

  useEffect(() => { void reload(); }, [reload]);

  const niceType = (table: string) => (table === 'captures' ? 'memory' : table === 'todos' ? 'task' : 'idea');

  if (loading) return <Text variant="caption" color="textMuted" style={{ padding: spacing.base }}>Loading…</Text>;
  if (items.length === 0) return null;

  return (
    <View>
      <Text variant="caption" color="textMuted" weight="700" tracking={1.4} style={{ marginTop: spacing.base, marginBottom: spacing.xxs }}>ITEMS</Text>
      <Text variant="caption" color="textFaint" style={{ marginBottom: spacing.sm }}>Tap to open · long-press to delete</Text>
      {items.map((item) => (
        <Card
          key={`${item.table_name}-${item.row_id}`}
          onPress={item.table_name === 'captures' ? () => setSelectedCaptureId(item.row_id) : undefined}
          onLongPress={() => { haptic.longPress(); setItemActions(item); }}
          level="surface"
          padding="md"
          style={{ marginBottom: spacing.sm }}
        >
          <Text variant="caption" color="textFaint" weight="700" tracking={1}>{item.table_name.toUpperCase()}</Text>
          <Text variant="footnote" weight="600" numberOfLines={2} style={{ marginTop: 2 }}>{item.label}</Text>
          {item.subtitle ? <Text variant="caption" color="textMuted" numberOfLines={1} style={{ marginTop: 2 }}>{item.subtitle}</Text> : null}
        </Card>
      ))}

      <MemoryDetailSheet captureId={selectedCaptureId} visible={selectedCaptureId !== null} onClose={() => setSelectedCaptureId(null)} />
      <ActionSheet
        visible={itemActions !== null}
        onClose={() => setItemActions(null)}
        title={itemActions ? `Delete this ${niceType(itemActions.table_name)}?` : undefined}
        message={itemActions?.label.slice(0, 120)}
        actions={itemActions ? [
          { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: async () => { haptic.destructive(); try { await galaxy.deleteItem(itemActions); } catch { /* non-critical */ } void reload(); } },
        ] : []}
      />
    </View>
  );
}
