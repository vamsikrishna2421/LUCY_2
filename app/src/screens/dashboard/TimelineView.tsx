/**
 * Timeline — LUCY 2.0 memory timeline, rebuilt on the design system (app/src/ui).
 *
 * All logic flows through the seam hook `useTimeline` (docs/04 Timeline row + the extra calls the 1.0
 * view made). Every Timeline 1.0 capability is preserved: quick-capture bar (text + snap-image with
 * receipt/note branching + automation-intent gate that still saves the thought), semantic search,
 * sticky note-type filter chips, date-grouped cards (mood-colored spine, source badge, content-type
 * pill, calm processing dots, privacy shield, shielded/masked title + summary, original-photo viewer,
 * lazy extraction chips on expand, LLM "can do" action banner), the per-card menu (Ask LUCY about this /
 * Correct / Reprocess[+long-entry warning] / Pin to project / Delete), the correction sheet, and the
 * automation-confirm. Blocking Alert.alerts → ActionSheet/Toast (the forgiveness model); the reading-
 * image + photo viewer stay full-screen Modals.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useToast, Text, Card, Surface, Row, Stack, Spacer, Button, IconButton, Chip, TextField, SearchField,
  ActionSheet, BottomSheet, FadeInUp, PressableScale, useTheme, type Theme, type ActionSheetAction,
} from '../../ui';
import { PrivacyBadge } from '../../components/PrivacyBadge';
import { ShieldedText, type ProtectedValueLite } from '../../components/ShieldedText';
import { useTimeline } from '../hooks/useTimeline';
import {
  MOOD_COLOR, groupByDate, sourceLabel, noteTypeLabel, getCardSummaryText, ExtractionChips, OrganizingDots,
} from './helpers';
import type { CaptureRow } from '../../db/captures';
import type { ProjectRow } from '../../db/projects';
import type { ExtractedAction } from '../../processing/automationEngine';
import type { ExtractionResult, NoteType } from '../../types/extraction';

const NOTE_TYPE_FILTERS = ['all', 'thought', 'task', 'idea', 'journal', 'meeting', 'reminder'] as const;

export function TimelineView({
  captures,
  moodsByCapture,
  onFeedback,
  onQueued,
  onAskAbout,
}: {
  captures: CaptureRow[];
  moodsByCapture: Record<number, string>;
  onFeedback: () => void;
  onQueued?: () => void;
  onAskAbout?: (question: string) => void;
}) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const toast = useToast();
  const tl = useTimeline();

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CaptureRow[] | null>(null);
  const [noteTypeFilter, setNoteTypeFilter] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quickText, setQuickText] = useState('');
  const [quickSending, setQuickSending] = useState(false);
  const pendingReceiptImage = useRef<string | null>(null);
  const [readingImage, setReadingImage] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ExtractedAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const [menuTarget, setMenuTarget] = useState<CaptureRow | null>(null);
  const [pinTarget, setPinTarget] = useState<CaptureRow | null>(null);
  const [snapSheet, setSnapSheet] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [feedbackTarget, setFeedbackTarget] = useState<CaptureRow | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [sending, setSending] = useState(false);
  const [reprocessConfirm, setReprocessConfirm] = useState<CaptureRow | null>(null);
  const [llmActions, setLlmActions] = useState<Record<number, ExtractedAction>>({});
  const [extractionChips, setExtractionChips] = useState<Record<number, ExtractionResult>>({});
  const [noteTypes, setNoteTypes] = useState<Record<number, string>>({});

  useEffect(() => { void (async () => setProjects(await tl.loadProjects()))(); }, [tl]);

  // LLM action banners + eager note_type badges, refreshed when captures change.
  useEffect(() => {
    void (async () => {
      setLlmActions(await tl.loadLlmActions());
      if (captures.length > 0) setNoteTypes(await tl.loadNoteTypes(captures));
    })();
  }, [captures, tl]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      try { setSearchResults(await tl.search(query)); } catch { setSearchResults(null); }
    }, 300);
  };

  const sendQuick = async () => {
    const t = quickText.trim();
    if (!t || quickSending) return;
    const receiptImg = pendingReceiptImage.current; pendingReceiptImage.current = null;

    const autoAction = tl.detectIntent(t);
    if (autoAction && autoAction.confidence >= 0.8) {
      setQuickText('');
      setPendingAction(autoAction);
      // Still save the thought — a misfired detection must never lose it.
      void tl.enqueue(t).then(() => onQueued?.()).catch(() => {});
      return;
    }
    setQuickSending(true);
    try {
      const capId = await tl.enqueue(t);
      if (receiptImg && capId) { try { await tl.attachImage(capId, receiptImg); } catch { /* image link optional */ } }
      setQuickText('');
      toast.show({ message: 'Got it ✓', tone: 'success', icon: 'checkmark-circle' });
      onQueued?.();
    } catch { /* non-critical */ } finally { setQuickSending(false); }
  };

  const onSnapReceipt = async () => {
    const scanned = await tl.scanReceipt();
    if (scanned) { setQuickText(scanned.text); pendingReceiptImage.current = scanned.imagePath; }
  };
  const onSnapNote = async () => {
    const keyStatus = await tl.checkModelKey();
    if (!keyStatus.ok) { toast.show({ message: keyStatus.message, tone: 'info', icon: 'key-outline' }); return; }
    try { const ok = await tl.snapImage(setReadingImage); if (ok) onQueued?.(); } finally { setReadingImage(false); }
  };

  const submitFeedback = async () => {
    if (!feedbackTarget || !feedbackText.trim()) return;
    setSending(true);
    try {
      await tl.submitCorrection(feedbackTarget, feedbackText.trim());
      setFeedbackTarget(null); setFeedbackText(''); onFeedback();
    } finally { setSending(false); }
  };

  const runReprocess = async (capture: CaptureRow) => { await tl.reprocess(capture.id); onFeedback(); };
  const onReprocess = (capture: CaptureRow) => {
    // A long/multi-event entry fans out into many AI calls — warn before a single tap spends credits.
    if ((capture.raw_transcript?.length ?? 0) > 600) { setReprocessConfirm(capture); return; }
    void runReprocess(capture);
  };

  const deleteCapture = async (capture: CaptureRow) => { await tl.deleteCapture(capture.id); onFeedback(); };

  const pinNoteToProject = async (projectId: number | null) => {
    if (!pinTarget) return;
    try { await tl.pinToProject(pinTarget.id, projectId); } catch { /* non-critical */ }
    setPinTarget((prev) => (prev ? { ...prev, project_id: projectId } : prev));
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setExecutingAction(true);
    const result = await tl.runAction(pendingAction);
    setExecutingAction(false);
    const captureId = Object.entries(llmActions).find(([, a]) => a === pendingAction)?.[0];
    setPendingAction(null);
    onQueued?.();
    if (!result.success) toast.show({ message: result.message, tone: 'danger', icon: 'alert-circle' });
    else if (result.message) toast.show({ message: result.message, tone: 'success', icon: 'checkmark-circle' });
    if (captureId) { try { await tl.clearPendingAction(Number(captureId)); } catch { /* non-critical */ } setLlmActions((prev) => { const n = { ...prev }; delete n[Number(captureId)]; return n; }); }
  };
  const dismissAction = async () => {
    const captureId = pendingAction ? Object.entries(llmActions).find(([, a]) => a === pendingAction)?.[0] : undefined;
    if (captureId) { try { await tl.clearPendingAction(Number(captureId)); } catch { /* non-critical */ } setLlmActions((prev) => { const n = { ...prev }; delete n[Number(captureId)]; return n; }); }
    setPendingAction(null);
  };

  const toggleExpand = (item: CaptureRow) => {
    const nowExpanded = !expanded[item.id];
    setExpanded((prev) => ({ ...prev, [item.id]: nowExpanded }));
    if (nowExpanded && item.processed === 1 && !extractionChips[item.id]) {
      void tl.loadExtraction(item.id).then((ex) => { if (ex) setExtractionChips((prev) => ({ ...prev, [item.id]: ex })); });
    }
  };

  const baseCaptures = searchResults ?? captures;
  const displayCaptures = noteTypeFilter ? baseCaptures.filter((c) => noteTypes[c.id] === noteTypeFilter) : baseCaptures;
  const groups = groupByDate(displayCaptures);
  const hasChips = Object.keys(noteTypes).length > 0;

  const menuActions: ActionSheetAction[] = menuTarget ? [
    ...(onAskAbout && menuTarget.extracted_title ? [{ label: 'Ask LUCY about this', icon: 'sparkles-outline' as const, onPress: () => { const t = menuTarget; onAskAbout(`Tell me more about: "${t?.extracted_title ?? ''}"`); } }] : []),
    { label: 'Correct this memory', icon: 'help-circle-outline', onPress: () => { const t = menuTarget; setFeedbackText(''); setFeedbackTarget(t); } },
    ...(menuTarget.source !== 'passive' ? [{ label: 'Reprocess', icon: 'refresh-outline' as const, disabled: menuTarget.processed === 0, onPress: () => { const t = menuTarget; if (t) onReprocess(t); } }] : []),
    ...(projects.length > 0 ? [{ label: 'Pin to project', icon: 'pricetag-outline' as const, onPress: () => setPinTarget(menuTarget) }] : []),
    { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => { const t = menuTarget; if (t) void deleteCapture(t); } },
  ] : [];

  return (
    <View style={{ flex: 1 }}>
      {/* Quick-capture + search */}
      <Stack gap="sm" style={{ paddingBottom: spacing.sm }}>
        <Row gap="sm" align="center">
          <View style={{ flex: 1 }}>
            <TextField placeholder="Capture a thought..." value={quickText} onChangeText={setQuickText} returnKeyType="send" onSubmitEditing={() => void sendQuick()} blurOnSubmit={false} />
          </View>
          <IconButton icon="camera-outline" variant="secondary" accessibilityLabel="Snap an image" onPress={() => setSnapSheet(true)} />
          <IconButton icon="arrow-up" variant="primary" accessibilityLabel="Send" disabled={!quickText.trim() || quickSending} onPress={() => void sendQuick()} />
        </Row>
        <SearchField value={searchQuery} onChangeText={handleSearch} placeholder="Search timeline..." />
      </Stack>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} stickyHeaderIndices={hasChips ? [0] : []} keyboardShouldPersistTaps="handled">
        {/* Sticky filter chips (height collapses when no note types yet) */}
        <View style={{ height: hasChips ? undefined : 0, overflow: 'hidden', backgroundColor: colors.bg, paddingBottom: hasChips ? spacing.sm : 0 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
            {NOTE_TYPE_FILTERS.map((type) => {
              const isAll = type === 'all';
              const isActive = isAll ? !noteTypeFilter : noteTypeFilter === type;
              const nt = isAll ? null : noteTypeLabel(type as NoteType);
              return <Chip key={type} label={isAll ? 'All' : nt?.label ?? type} selected={isActive} onPress={() => setNoteTypeFilter(isAll ? null : noteTypeFilter === type ? null : type)} />;
            })}
          </ScrollView>
        </View>

        {groups.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.huge, paddingHorizontal: spacing.xxl }}>
            <Text variant="h3" align="center">{noteTypeFilter ? `No ${noteTypeFilter}s yet` : 'Nothing yet today'}</Text>
            <Text variant="footnote" color="textMuted" align="center" style={{ marginTop: spacing.sm }}>
              {noteTypeFilter ? `Capture something and LUCY will classify it as a ${noteTypeFilter} if it fits.` : 'Speak a thought or type something. LUCY handles the rest.'}
            </Text>
          </View>
        ) : groups.map((group, gi) => {
          const groupBase = groups.slice(0, gi).reduce((n, g) => n + g.items.length, 0);
          return (
            <View key={group.dateKey}>
              <Row gap="md" align="center" style={{ marginTop: spacing.base, marginBottom: spacing.sm }}>
                <Text variant="caption" color="textMuted" weight="700" tracking={1.2}>{group.dateLabel.toUpperCase()}</Text>
                <View style={{ flex: 1, height: theme.layout.hairline, backgroundColor: colors.divider }} />
              </Row>
              {group.items.map((item, idx) => (
                <FadeInUp key={item.id} delay={Math.min(groupBase + idx, 8) * 55}>
                  <TimelineCard
                    item={item}
                    theme={theme}
                    moodColor={MOOD_COLOR[moodsByCapture[item.id] ?? 'neutral'] ?? colors.textFaint}
                    isExpanded={!!expanded[item.id]}
                    isLast={idx === group.items.length - 1}
                    noteType={noteTypes[item.id]}
                    extraction={extractionChips[item.id] ?? null}
                    llmAction={llmActions[item.id]}
                    protectedPreview={tl.protectedPreview}
                    onPress={() => toggleExpand(item)}
                    onMenu={() => setMenuTarget(item)}
                    onViewImage={() => setViewerImage(item.source_image_path)}
                    onAction={() => setPendingAction(llmActions[item.id])}
                  />
                </FadeInUp>
              ))}
            </View>
          );
        })}
        <Spacer size="lg" />
      </ScrollView>

      {/* Snap-an-image chooser */}
      <ActionSheet
        visible={snapSheet}
        onClose={() => setSnapSheet(false)}
        title="Snap an image"
        message="What are you capturing?"
        actions={[
          { label: 'Receipt (expense)', icon: 'receipt-outline', onPress: () => void onSnapReceipt() },
          { label: 'Note / document / image', icon: 'document-text-outline', onPress: () => void onSnapNote() },
        ]}
      />

      {/* Card action menu */}
      <ActionSheet
        visible={menuTarget !== null}
        onClose={() => setMenuTarget(null)}
        title={menuTarget?.extracted_title ?? menuTarget?.raw_transcript?.slice(0, 48) ?? 'Memory'}
        actions={menuActions}
      />
      {/* Long-entry reprocess confirm */}
      <ActionSheet
        visible={reprocessConfirm !== null}
        onClose={() => setReprocessConfirm(null)}
        title="Reprocess this entry?"
        message="This looks like a long or multi-event entry. Reprocessing re-runs AI extraction and may make several API calls (one per event), which uses credits."
        actions={reprocessConfirm ? [{ label: 'Reprocess', icon: 'refresh-outline', destructive: true, onPress: () => { const c = reprocessConfirm; if (c) void runReprocess(c); } }] : []}
      />

      {/* Correction sheet */}
      <BottomSheet visible={feedbackTarget !== null} onClose={() => setFeedbackTarget(null)} title="Correct this memory">
        <Stack gap="base">
          <Text variant="footnote" color="textMuted" numberOfLines={2}>{feedbackTarget?.extracted_title ?? feedbackTarget?.raw_transcript?.slice(0, 80)}</Text>
          <TextField placeholder="What's wrong? What should LUCY know instead?" multiline autoFocus value={feedbackText} onChangeText={setFeedbackText} />
          <Row gap="md">
            <Button label="Cancel" variant="ghost" onPress={() => setFeedbackTarget(null)} style={{ flex: 1 }} />
            <Button label={sending ? 'Sending...' : 'Send to LUCY'} loading={sending} disabled={!feedbackText.trim() || sending} onPress={() => void submitFeedback()} style={{ flex: 2 }} />
          </Row>
        </Stack>
      </BottomSheet>

      {/* Pin-to-project sheet (opened from the card menu) */}
      <PinProjectSheet
        visible={pinTarget !== null}
        target={pinTarget}
        projects={projects}
        onPin={(pid) => void pinNoteToProject(pid)}
        onClose={() => setPinTarget(null)}
      />

      {/* Automation confirmation */}
      <BottomSheet visible={pendingAction !== null} onClose={() => void dismissAction()} title="LUCY can do this">
        {pendingAction ? (
          <Stack gap="md">
            <Text variant="h3">{pendingAction.displayText}</Text>
            <Row gap="md">
              <Button label="Not now" variant="ghost" onPress={() => void dismissAction()} style={{ flex: 1 }} />
              <Button label={executingAction ? '…' : pendingAction.confirmText} loading={executingAction} onPress={() => void confirmAction()} style={{ flex: 2 }} />
            </Row>
          </Stack>
        ) : null}
      </BottomSheet>

      {/* Reading-image overlay (vision OCR) */}
      <Modal visible={readingImage} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' }}>
          <Surface level="surfaceAlt" radius="lg" border="border" padding="xl" style={{ alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text variant="bodyMed" style={{ marginTop: spacing.md }}>Reading your image…</Text>
            <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>Pulling out the text and key details</Text>
          </Surface>
        </View>
      </Modal>

      {/* Original-photo viewer */}
      <Modal visible={!!viewerImage} transparent animationType="fade" onRequestClose={() => setViewerImage(null)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setViewerImage(null)}>
          {viewerImage ? <Image source={{ uri: viewerImage }} style={{ width: '92%', height: '80%' }} resizeMode="contain" /> : null}
          <Text variant="caption" color="textMuted" style={{ marginTop: spacing.base }}>Tap to close · original photo</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Single timeline card ──────────────────────────────────────────────────────────
function TimelineCard({
  item, theme, moodColor, isExpanded, isLast, noteType, extraction, llmAction, protectedPreview,
  onPress, onMenu, onViewImage, onAction,
}: {
  item: CaptureRow;
  theme: Theme;
  moodColor: string;
  isExpanded: boolean;
  isLast: boolean;
  noteType: string | undefined;
  extraction: ExtractionResult | null;
  llmAction: ExtractedAction | undefined;
  protectedPreview: (s: string) => string;
  onPress: () => void;
  onMenu: () => void;
  onViewImage: () => void;
  onAction: () => void;
}) {
  const { colors, spacing, radius, layout } = theme;
  const timeStr = new Date(item.created_at.includes('T') ? item.created_at : `${item.created_at.replace(' ', 'T')}Z`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const src = sourceLabel(item.source);
  const nt = noteTypeLabel((noteType ?? extraction?.note_type) as NoteType | undefined);
  const summaryText = getCardSummaryText(item, extraction);
  let pv: ProtectedValueLite[] = [];
  try { pv = item.protected_values ? JSON.parse(item.protected_values) as ProtectedValueLite[] : []; } catch { /* ignore */ }
  let shieldCount = 0;
  try { shieldCount = item.protected_values ? (JSON.parse(item.protected_values) as unknown[]).length : 0; } catch { /* ignore */ }

  return (
    <Row gap="md" align="stretch" style={{ marginBottom: spacing.xxs }}>
      {/* Spine */}
      <View style={{ width: 14, alignItems: 'center', paddingTop: spacing.base }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: moodColor }} />
        {!isLast ? <View style={{ width: 2, flex: 1, marginTop: spacing.xs, backgroundColor: colors.divider }} /> : null}
      </View>

      <View style={{ flex: 1, marginBottom: spacing.sm }}>
        <Card onPress={onPress} padding="md" accessibilityLabel={item.extracted_title ?? 'memory'} style={{ borderLeftWidth: 3, borderLeftColor: moodColor }}>
          {/* Header */}
          <Row gap="sm" align="center" style={{ marginBottom: spacing.xs }}>
            <Text variant="caption" color="textFaint" weight="600">{timeStr}</Text>
            <Text variant="caption" weight="700" style={{ color: src.color }}>{src.glyph} {src.label}</Text>
            {nt && nt.label !== src.label ? (
              <View style={{ borderWidth: layout.hairline, borderColor: nt.color + '55', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 1 }}>
                <Text variant="caption" weight="700" style={{ color: nt.color }}>{nt.label}</Text>
              </View>
            ) : null}
            {!nt && item.processed !== 1 && item.source !== 'meeting' ? <OrganizingDots /> : null}
            <View style={{ flex: 1 }} />
            {shieldCount > 0 ? <Text variant="caption">🛡</Text> : null}
            <PrivacyBadge level={item.privacy_level} />
            <PressableScale onPress={onMenu} hitSlop={10} accessibilityLabel="Memory actions">
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
            </PressableScale>
          </Row>

          {/* Title */}
          {item.extracted_title ? (
            pv.length > 0 ? (
              <ShieldedText style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', lineHeight: 22 }} text={item.extracted_title} protectedValues={pv} numberOfLines={isExpanded ? undefined : 1} />
            ) : (
              <Text variant="bodyMed" numberOfLines={isExpanded ? undefined : 1}>{protectedPreview(item.extracted_title)}</Text>
            )
          ) : item.source === 'meeting' ? (
            <Text variant="bodyMed" numberOfLines={isExpanded ? undefined : 1}>{(item.raw_transcript ?? '').split('\n')[0] || 'Meeting'}</Text>
          ) : (
            <Text variant="footnote" color="textMuted">{item.processed === -1 ? 'Saved · still organizing…' : 'Organizing your thought…'}</Text>
          )}

          {/* Summary */}
          {summaryText ? (
            <View style={{ marginTop: spacing.xs }}>
              {pv.length > 0 ? (
                <ShieldedText style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }} text={summaryText} protectedValues={pv} numberOfLines={isExpanded ? undefined : 2} />
              ) : (
                <Text variant="footnote" color="textSecondary" numberOfLines={isExpanded ? undefined : 2}>{summaryText}</Text>
              )}
            </View>
          ) : null}

          {isExpanded && item.processed === -1 && item.processing_error ? (
            <Text variant="caption" color="textFaint" style={{ marginTop: spacing.xs, fontStyle: 'italic' }} numberOfLines={3}>{item.processing_error}</Text>
          ) : null}

          {isExpanded && item.source_image_path ? (
            <PressableScale onPress={onViewImage} accessibilityLabel="View original photo">
              <Row gap="xs" align="center" style={{ marginTop: spacing.sm }}>
                <Ionicons name="image-outline" size={15} color={colors.accent} />
                <Text variant="footnote" color="accent" weight="600">View original photo</Text>
              </Row>
            </PressableScale>
          ) : null}

          {isExpanded ? <ExtractionChips extraction={extraction} /> : null}

          {llmAction ? (
            <PressableScale onPress={onAction} accessibilityLabel={llmAction.displayText}>
              <Row gap="sm" align="center" style={{ marginTop: spacing.sm, backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                <Text variant="caption" color="accent" weight="700" tracking={0.8}>CAN DO</Text>
                <Text variant="footnote" weight="600" style={{ flex: 1 }} numberOfLines={1}>{llmAction.displayText}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.accent} />
              </Row>
            </PressableScale>
          ) : null}
        </Card>
      </View>
    </Row>
  );
}

// ─── Pin-to-project sheet ────────────────────────────────────────────────────────────
function PinProjectSheet({
  visible, target, projects, onPin, onClose,
}: {
  visible: boolean;
  target: CaptureRow | null;
  projects: ProjectRow[];
  onPin: (projectId: number | null) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pin to project">
      <Row gap="sm" wrap>
        <Chip label="None" selected={!target?.project_id} onPress={() => { onPin(null); onClose(); }} />
        {projects.map((p) => (
          <Chip key={p.id} label={p.name} selected={target?.project_id === p.id} onPress={() => { onPin(p.id); onClose(); }} />
        ))}
      </Row>
    </BottomSheet>
  );
}
