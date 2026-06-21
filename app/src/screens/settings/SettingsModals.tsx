/**
 * Settings modals — Siri-shortcut guide, voice picker, and the per-role model picker, rebuilt on the
 * design system (app/src/ui). The two how-to/pick sheets stay RN page-sheet Modals (tall, scrollable,
 * full-height) but are restyled with tokens; the role picker is a `BottomSheet` choice list.
 *
 * Logic parity: VoicePicker calls the exact frozen voice/tts entry points Settings 1.0 used
 * (loadVoicePrefs/getSelectedVoiceId/listVoices/setVoice/speak — selecting a voice both applies and
 * previews it). SiriShortcutGuide is pure presentation (clipboard + deep-link only). RolePickerModal is
 * pure presentation over the shared model catalog.
 */
import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, ScrollView, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheet, Surface, Card, Text, Row, Stack, Spacer, Divider, Button, IconButton, Badge,
  PressableScale, useTheme,
} from '../../ui';
import { listVoices, setVoice, getSelectedVoiceId, loadVoicePrefs, speak, type TtsVoice } from '../../voice/tts';
import { ROLE_MODEL_CHOICES, ROLE_CARDS } from './models';
import type { ModelRole } from '../../ai/modelPreference';

const SIRI_STEPS = [
  { n: '1', title: 'Open Shortcuts', body: 'Tap the button below to open the iOS Shortcuts app.' },
  { n: '2', title: 'Create a new shortcut', body: 'Tap + in the top right.' },
  { n: '3', title: 'Add "Dictate Text" action', body: 'Search for "Dictate Text" and add it. This captures your voice.' },
  { n: '4', title: 'Add "Open URLs" action', body: 'Search for "Open URLs". Paste the LUCY URL (copy below) into the URL field. Insert the "Dictated Text" variable inside it.' },
  { n: '5', title: 'Name & add to Siri', body: 'Tap the shortcut name → rename it (e.g. "Send to Lucy") → tap Add to Siri → record your phrase.' },
  { n: '6', title: 'Use it!', body: 'Say "Hey Siri, Send to Lucy" → dictate "Lucy, buy milk and eggs" → LUCY receives it.' },
];

const LUCY_VOICE_URL = 'lucy://voice?text=[Dictated Text]';
const LUCY_CAPTURE_URL = 'lucy://capture?text=[Dictated Text]';

/** Full-height page-sheet shell shared by the two how-to/picker modals. */
function SheetScreen({ title, visible, onClose, children }: { title: string; visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { colors, spacing, layout } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Row
          gap="sm"
          justify="space-between"
          align="center"
          paddingX="lg"
          style={{ paddingTop: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: layout.hairline, borderBottomColor: colors.border }}
        >
          <Text variant="h3">{title}</Text>
          <Button label="Done" variant="ghost" size="sm" onPress={onClose} />
        </Row>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function SiriShortcutGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const [copied, setCopied] = useState<'voice' | 'capture' | null>(null);

  const copy = async (which: 'voice' | 'capture') => {
    await Clipboard.setStringAsync(which === 'voice' ? LUCY_VOICE_URL : LUCY_CAPTURE_URL);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  const UrlRow = ({ label, url, which }: { label: string; url: string; which: 'voice' | 'capture' }) => (
    <Row gap="sm" align="center">
      <View style={{ flex: 1 }}>
        <Text variant="footnote" weight="600">{label}</Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>{url}</Text>
      </View>
      <Button label={copied === which ? 'Copied!' : 'Copy'} variant="secondary" size="sm" onPress={() => void copy(which)} />
    </Row>
  );

  return (
    <SheetScreen title="Set up Siri Shortcut" visible={visible} onClose={onClose}>
      <Text variant="footnote" color="textMuted">
        Once set up, say your Siri phrase then speak to LUCY — e.g. "Lucy, buy milk and eggs" or "Lucy,
        schedule a meeting at 3pm". The word Lucy at the start is stripped automatically.
      </Text>
      <Spacer size="lg" />
      <Stack gap="base">
        {SIRI_STEPS.map((s) => (
          <Row key={s.n} gap="md" align="flex-start">
            <View
              style={{
                width: 28, height: 28, borderRadius: 14, marginTop: 1,
                backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text variant="footnote" color="accent" weight="700">{s.n}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="footnote" weight="600">{s.title}</Text>
              <Text variant="footnote" color="textMuted" style={{ marginTop: 2 }}>{s.body}</Text>
            </View>
          </Row>
        ))}
      </Stack>
      <Spacer size="base" />
      <Surface level="surface" radius="md" border="border" padding="base">
        <Text variant="caption" color="textMuted" weight="700" tracking={1}>LUCY URLS TO PASTE INTO SHORTCUTS</Text>
        <Spacer size="sm" />
        <UrlRow label="Smart (commands + notes)" url={LUCY_VOICE_URL} which="voice" />
        <Spacer size="sm" />
        <UrlRow label="Direct capture (save verbatim)" url={LUCY_CAPTURE_URL} which="capture" />
      </Surface>
      <Spacer size="base" />
      <Button label="Open Shortcuts App →" fullWidth onPress={() => void Linking.openURL('shortcuts://')} />
      <Spacer size="sm" />
      <Text variant="caption" color="textFaint" align="center">
        Replace [Dictated Text] in the URL with the Shortcuts variable by tapping inside the URL field and
        inserting the variable from the magic wand menu.
      </Text>
    </SheetScreen>
  );
}

export function VoicePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      setLoading(true);
      try {
        await loadVoicePrefs();
        setSelectedId(getSelectedVoiceId());
        setVoices(await listVoices());
      } finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  // Selecting a voice both applies it and previews it (same as 1.0).
  const pick = async (voiceId: string | null) => {
    await setVoice(voiceId);
    setSelectedId(voiceId);
    void speak("Hi, I'm Lucy. This is how I sound.");
  };

  const isQuality = (q?: string): boolean => {
    const s = (q ?? '').toLowerCase();
    return s.includes('enhanced') || s.includes('premium');
  };

  return (
    <SheetScreen title="Lucy's voice" visible={visible} onClose={onClose}>
      <Text variant="footnote" color="textMuted">
        Pick the voice Lucy speaks with. Tap any voice to hear a quick preview and select it.
      </Text>
      <Spacer size="base" />

      <Card
        onPress={() => void pick(null)}
        level={selectedId === null ? 'surfaceAlt' : 'surface'}
        border={selectedId === null ? 'accent' : 'border'}
        padding="md"
        style={{ marginBottom: 8 }}
      >
        <Row gap="sm" align="center">
          <View style={{ flex: 1 }}>
            <Text variant="footnote" weight="700">System default</Text>
            <Text variant="caption" color="textMuted">Use your device's default voice</Text>
          </View>
          {selectedId === null ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
        </Row>
      </Card>

      {loading ? (
        <Text variant="caption" color="textMuted">Loading voices…</Text>
      ) : voices.length === 0 ? (
        <Text variant="caption" color="textMuted">No additional voices found on this device.</Text>
      ) : (
        voices.map((v) => {
          const selected = selectedId === v.identifier;
          return (
            <Card
              key={v.identifier}
              level={selected ? 'surfaceAlt' : 'surface'}
              border={selected ? 'accent' : 'border'}
              padding="md"
              style={{ marginBottom: 8 }}
            >
              <Row gap="sm" align="center">
                <PressableScale onPress={() => void pick(v.identifier)} style={{ flex: 1 }} accessibilityLabel={`Select ${v.name}`}>
                  <Row gap="sm" align="center">
                    <View style={{ flex: 1 }}>
                      <Text variant="footnote" weight="700">{v.name}</Text>
                      <Text variant="caption" color="textMuted">{v.language}</Text>
                    </View>
                    {isQuality(v.quality) ? <Badge label="Enhanced" tone="accent" /> : null}
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
                  </Row>
                </PressableScale>
                <Button label="Preview" variant="secondary" size="sm" onPress={() => void pick(v.identifier)} />
              </Row>
            </Card>
          );
        })
      )}
    </SheetScreen>
  );
}

/**
 * Per-role model picker — a BottomSheet choice list. One filled radio = the active model; tapping a row
 * selects + persists it (the handler is owned by the screen). Claude-only choices from the catalog.
 */
export function RolePickerModal({
  role, selectedId, onSelect, onClose,
}: {
  role: ModelRole | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const roleTitle = role ? ROLE_CARDS.find((r) => r.role === role)?.title ?? '' : '';
  return (
    <BottomSheet visible={role !== null} onClose={onClose} title={`Model for ${roleTitle}`}>
      <Stack gap="sm">
        {ROLE_MODEL_CHOICES.map((m) => {
          const selected = selectedId === m.id;
          return (
            <Card
              key={m.id}
              onPress={() => onSelect(m.id)}
              level={selected ? 'surfaceAlt' : 'surface'}
              border={selected ? 'accent' : 'border'}
              accessibilityLabel={m.label}
            >
              <Row gap="md" align="flex-start">
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 11, marginTop: 1,
                    borderWidth: 2, borderColor: selected ? colors.accent : colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMed">{m.label}</Text>
                  <Text variant="caption" color="accent" weight="600">{m.tier}</Text>
                  <Text variant="footnote" color="textMuted" style={{ marginTop: 2 }}>{m.desc}</Text>
                </View>
              </Row>
            </Card>
          );
        })}
        <Button label="Done" variant="ghost" onPress={onClose} />
      </Stack>
    </BottomSheet>
  );
}
