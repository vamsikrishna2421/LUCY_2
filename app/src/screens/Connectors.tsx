/**
 * Connectors — LUCY 2.0 device-integration & permission center.
 *
 * Rebuilt on the design system (app/src/ui). All logic flows through the seam hook `useConnectors`,
 * which wraps the frozen entry points in docs/04_SEAM_REPORT.md (Connectors row). Every Connectors 1.0
 * capability is preserved: the six connectors (Calendar, Location context, Battery patterns, Progress
 * check-ins, Passive listening, Meeting mode) with the exact same toggle logic, the per-connector
 * description + "what LUCY does" detail, the permission name, the loading-disabled switch while a
 * toggle runs, and the closing "your data stays on your device" note. Success/info outcomes now use the
 * forgiveness-model Toast; permission-needed outcomes stay blocking Alerts (they route to system
 * Settings), matching 1.0's intent.
 *
 * The exported component name (`ConnectorsScreen`) is unchanged so App.tsx and Settings (which renders
 * it inside its Connectors panel) need no edit. A local ToastProvider is mounted so feedback works even
 * when shown inside a Settings sheet.
 */
import { Alert, ScrollView, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useToast, Text, Card, Surface, Row, Stack, Spacer, Divider, useTheme, type Theme,
} from '../ui';
import { useConnectors, type ConnectorId } from './hooks/useConnectors';

interface ConnectorConfig {
  id: ConnectorId;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  whatLucyDoes: string[];
  permissionNeeded: string;
}

// Copy is preserved verbatim from Connectors 1.0; emoji glyphs become themed Ionicons. The
// "what LUCY does" bullets were a single `\n`-joined string in 1.0 — split into an array for clean
// token-spaced rows (same text, same order).
const CONFIGS: ConnectorConfig[] = [
  {
    id: 'calendar',
    name: 'Calendar',
    icon: 'calendar-outline',
    description: 'Your device calendar events (read-only)',
    whatLucyDoes: [
      'Pre-meeting brief 30 min before meetings',
      'Post-meeting prompt to capture notes',
      'Answer "What meetings do I have today?"',
    ],
    permissionNeeded: 'Calendar read access',
  },
  {
    id: 'location',
    name: 'Location context',
    icon: 'location-outline',
    description: 'City-level travel timeline, recorded ~1 mile precision',
    whatLucyDoes: [
      'Build your weekly travel timeline (city-level, ~1 mile precision)',
      'Answer "Where am I?" in Ask',
      'Add location context to daily briefs',
      'Records every hour + when you move ~1 mile — even when app is closed',
      'Coordinates never leave your device',
    ],
    permissionNeeded: 'Location — Always for background tracking, or "When in use" for app-open only',
  },
  {
    id: 'battery_tracking',
    name: 'Battery patterns',
    icon: 'battery-charging-outline',
    description: 'Battery level recorded every few hours',
    whatLucyDoes: [
      'Answer "What is my battery level?"',
      'Detect your heaviest usage days',
      'Pattern: "Your battery drains fastest on Tuesdays"',
    ],
    permissionNeeded: 'No special permission needed',
  },
  {
    id: 'progress_checkins',
    name: 'Progress check-ins',
    icon: 'alarm-outline',
    description: 'Reminders every 2 hours during your day (8am–6pm)',
    whatLucyDoes: [
      'Nudge you to capture work updates',
      'Prevent important moments from slipping',
      'Build a richer memory over time',
    ],
    permissionNeeded: 'Notification permission',
  },
  {
    id: 'passive_listening',
    name: 'Passive listening',
    icon: 'mic-outline',
    description: 'Continuous background transcription while active',
    whatLucyDoes: [
      'Capture thoughts, meeting highlights, ideas automatically',
      "10-minute batch processing through LUCY's AI",
      'Orange indicator visible on your screen (iOS requirement)',
    ],
    permissionNeeded: 'Microphone permission',
  },
  {
    id: 'meeting_mode',
    name: 'Meeting mode',
    icon: 'people-outline',
    description: 'Dedicated meeting capture with auto-summary',
    whatLucyDoes: [
      'Record meetings with duration tracking',
      'AI summary: decisions, action items, open questions',
      'Post-meeting capture prompt',
      'Tap "Meeting" button in the header anytime',
    ],
    permissionNeeded: 'Microphone permission (same as passive listening)',
  },
];

// ToastProvider is mounted once at the app root (App.tsx), so `useToast` resolves there — no local
// provider needed (this screen is always rendered under that root, incl. inside Settings' panel).
export function ConnectorsScreen() {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const toast = useToast();
  const { connectors, loading, toggle } = useConnectors();

  const onToggle = async (id: ConnectorId, value: boolean) => {
    const result = await toggle(id, value);
    if (result.notice) {
      if (result.notice.tone === 'permission') {
        // Permission outcomes need acknowledgement + route to system Settings — keep the blocking Alert.
        Alert.alert(result.notice.title, result.notice.message);
      } else {
        toast.show({
          message: result.notice.message,
          tone: result.notice.tone === 'success' ? 'success' : 'info',
          icon: result.notice.tone === 'success' ? 'checkmark-circle' : 'information-circle',
        });
      }
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
    >
      <Stack gap="xs">
        <Text variant="h1">Connectors</Text>
        <Text variant="footnote" color="textMuted">
          Control what LUCY can access. Every permission is explained. You decide.
        </Text>
      </Stack>
      <Spacer size="lg" />

      <Stack gap="md">
        {CONFIGS.map((cfg) => (
          <Card key={cfg.id} level="surfaceAlt" padding="lg">
            <Row gap="md" align="center">
              <View
                style={{
                  width: 44, height: 44, borderRadius: theme.radius.md,
                  backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name={cfg.icon} size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMed">{cfg.name}</Text>
                <Text variant="caption" color="textFaint">{cfg.permissionNeeded}</Text>
              </View>
              <Switch
                value={connectors[cfg.id] ?? false}
                onValueChange={(val) => void onToggle(cfg.id, val)}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.border}
                disabled={loading[cfg.id]}
              />
            </Row>

            <Spacer size="sm" />
            <Text variant="footnote" color="textMuted">{cfg.description}</Text>
            <Spacer size="sm" />
            <Divider />
            <Spacer size="sm" />
            <Text variant="caption" color="accent" weight="700" tracking={1}>WHAT LUCY DOES WITH THIS</Text>
            <Spacer size="xs" />
            <Stack gap="xs">
              {cfg.whatLucyDoes.map((line, i) => (
                <Row key={i} gap="sm" align="flex-start">
                  <Text variant="footnote" color="accent" style={{ marginTop: 1 }}>•</Text>
                  <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>{line}</Text>
                </Row>
              ))}
            </Stack>
          </Card>
        ))}
      </Stack>

      <Spacer size="md" />
      <PrivacyNote theme={theme} />
    </ScrollView>
  );
}

function PrivacyNote({ theme }: { theme: Theme }) {
  return (
    <Surface level="surface" radius="lg" border="border" padding="lg">
      <Row gap="sm" align="center">
        <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.success} />
        <Text variant="bodyMed">Your data stays on your device</Text>
      </Row>
      <Spacer size="sm" />
      <Text variant="footnote" color="textMuted">
        Every connector reads data locally. Nothing is sent to any server without your explicit action.
        When you use Remote Intelligence (OpenAI), only the specific text you ask about is sent — never
        raw device data.
      </Text>
    </Surface>
  );
}
