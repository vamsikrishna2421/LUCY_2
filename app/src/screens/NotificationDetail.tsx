/**
 * NotificationDetail — LUCY 2.0 "from LUCY" explanation dialog.
 *
 * Rebuilt on the design system (app/src/ui). This screen is pure presentation: it imports no frozen
 * logic, so there is no seam hook — `buildExplanation` is local copy-shaping and is preserved verbatim
 * from 1.0 (every payload kind → same headline + explanation strings). Only the chrome moves onto ui/
 * primitives (Surface dialog, Text scale, Button, Badge), gaining safe-area + Android-back parity.
 *
 * The exported component name + props (`NotificationDetailModal`, `NotificationDetailPayload`) are
 * unchanged so App.tsx needs no edit.
 */
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, Text, Button, Badge, Stack, Spacer, useTheme } from '../ui';

export type NotificationDetailPayload =
  | { kind: 'guardian'; entityNames: string[]; evidenceCount: number; message?: string }
  | { kind: 'digest'; openCount: number; followCount: number }
  | { kind: 'open-loop'; description: string }
  | { kind: 'captured-reminder'; text?: string | null }
  | { kind: 'pre-meeting'; eventTitle: string }
  | { kind: 'post-meeting'; eventTitle: string }
  | { kind: 'on-this-day'; memoryCount: number; yearsAgo: number }
  | { kind: 'morning-brief' }
  | { kind: 'weekly-insight' }
  | { kind: 'raw'; title?: string; body?: string };

function buildExplanation(payload: NotificationDetailPayload): { headline: string; explanation: string } {
  if (payload.kind === 'guardian') {
    const { entityNames, message } = payload;
    const names = (entityNames ?? []).slice(0, 2).join(' and ');
    const overflow = (entityNames ?? []).length > 2 ? `, and ${entityNames.length - 2} more` : '';
    // Prefer the actual actionable insight LUCY generated; only fall back to a neutral line.
    if (message && message.trim()) {
      return { headline: `something worth a look`, explanation: message.trim() };
    }
    return {
      headline: names ? `a thought on ${names}${overflow}` : `a thought from me`,
      explanation: `I noticed something in your recent notes worth keeping an eye on.`,
    };
  }

  if (payload.kind === 'digest') {
    const { openCount, followCount } = payload;
    const parts: string[] = [];
    if (openCount > 0) parts.push(`${openCount} thing${openCount === 1 ? '' : 's'} you said you'd come back to`);
    if (followCount > 0) parts.push(`${followCount} follow-up${followCount === 1 ? '' : 's'} still in the air`);
    const summary = parts.length === 2 ? `${parts[0]}, and ${parts[1]}` : (parts[0] ?? 'a few things worth checking');
    return {
      headline: `quick check-in from me`,
      explanation: `I went through everything you've shared and found ${summary}. Not trying to stress you out — just making sure nothing important slips through while you're busy with everything else.`,
    };
  }

  if (payload.kind === 'open-loop') {
    const { description } = payload;
    return {
      headline: `I saved this for you`,
      explanation: description
        ? `You mentioned "${description}" but didn't close the loop — so I kept it here instead of letting it disappear. The things we park are usually the ones that matter most.`
        : `You said you'd come back to this, so I held onto it. The things we park are usually the ones that matter most.`,
    };
  }

  if (payload.kind === 'pre-meeting') {
    return {
      headline: `meeting coming up`,
      explanation: `Your "${payload.eventTitle}" is starting soon. I pulled together everything I know about the people and topics involved — check your memories for context.`,
    };
  }

  if (payload.kind === 'post-meeting') {
    return {
      headline: `good time to capture`,
      explanation: `Your "${payload.eventTitle}" just ended. Capturing notes now — while it's fresh — will help me surface the right context next time.`,
    };
  }

  if (payload.kind === 'on-this-day') {
    const yearLabel = payload.yearsAgo === 1 ? 'a year ago' : `${payload.yearsAgo} years ago`;
    return {
      headline: `on this day ${yearLabel}`,
      explanation: `You captured ${payload.memoryCount} memory${payload.memoryCount !== 1 ? ' (and more)' : ''} on this exact date in a past year. Open Today to see what your past self was thinking.`,
    };
  }

  if (payload.kind === 'morning-brief' || payload.kind === 'weekly-insight') {
    return {
      headline: `a note from me`,
      explanation: `I went through your memories and patterns to put this together. It's not a statistic — it's something I actually noticed about how you've been living lately.`,
    };
  }

  if (payload.kind === 'raw') {
    return {
      headline: (payload.title && payload.title.trim()) || 'a note from me',
      explanation: (payload.body && payload.body.trim()) || 'Tap done when you have got this.',
    };
  }

  const { text } = payload as { kind: 'captured-reminder'; text?: string | null };
  return {
    headline: `you asked me to remind you`,
    explanation: text
      ? `You told me: "${text}". I figured you meant it, so here we are.`
      : `You asked me to ping you about this. Consider yourself pinged.`,
  };
}

interface Props {
  payload: NotificationDetailPayload | null;
  onDismiss: () => void;
}

export function NotificationDetailModal({ payload, onDismiss }: Props) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  if (!payload) return null;
  const { headline, explanation } = buildExplanation(payload);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: colors.scrim,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.xl,
          paddingTop: spacing.xl + insets.top,
          paddingBottom: spacing.xl + insets.bottom,
        }}
      >
        {/* Inner Pressable swallows taps so the card itself doesn't dismiss. */}
        <Pressable style={{ width: '100%', maxWidth: 380 }}>
          <Surface level="surface" radius="xl" elevation="e4" border="accentLine" padding="xl">
            <View style={{ alignSelf: 'flex-start' }}>
              <Badge label="from LUCY" tone="accent" />
            </View>
            <Spacer size="base" />
            <Text variant="h2">{headline}</Text>
            <Spacer size="md" />
            <Text variant="body" color="textSecondary">{explanation}</Text>
            <Spacer size="xl" />
            <Stack gap="none">
              <Button label="got it" onPress={onDismiss} fullWidth />
            </Stack>
          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
