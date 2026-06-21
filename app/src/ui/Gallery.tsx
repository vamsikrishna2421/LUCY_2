/**
 * Gallery — a visual QA screen that renders every design-system primitive in its key states. Not
 * shipped in the product nav; mount it from a dev entry point to eyeball the system on-device:
 *
 *   import { Gallery } from '@/ui/Gallery';
 *   // render <Gallery /> inside <SafeAreaProvider> (Toast/Sheets need it).
 *
 * Every block below pulls from the barrel, so it doubles as an import smoke-test.
 */
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActionSheet,
  Avatar,
  Badge,
  Banner,
  BottomSheet,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  IconButton,
  ListItem,
  LucyOrb,
  ProgressRing,
  Row,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  SkeletonText,
  Spacer,
  Stack,
  Surface,
  Text,
  TextField,
  ThemeProvider,
  ToastProvider,
  useTheme,
  useToast,
  FadeInUp,
  Stagger,
} from './index';

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  const { spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <SectionHeader title={title} />
      <Stack gap="sm">{children}</Stack>
    </View>
  );
}

function GalleryBody(): React.ReactElement {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const [seg, setSeg] = useState<'all' | 'unread' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [chip, setChip] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [action, setAction] = useState(false);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.base, paddingBottom: spacing.huge }}
    >
      <Text variant="display">Design System</Text>
      <Text variant="footnote" color="textMuted" style={{ marginBottom: spacing.xl }}>
        Every primitive, every state — LUCY 2.0
      </Text>

      <Section title="Typography">
        <Text variant="display">Display 34</Text>
        <Text variant="h1">Heading 1</Text>
        <Text variant="h2">Heading 2</Text>
        <Text variant="h3">Heading 3</Text>
        <Text variant="body">Body — the default reading size.</Text>
        <Text variant="bodyMed">Body medium — emphasised.</Text>
        <Text variant="callout">Callout — slightly smaller.</Text>
        <Text variant="footnote" color="textSecondary">Footnote — secondary.</Text>
        <Text variant="caption" color="textMuted">CAPTION — MUTED</Text>
      </Section>

      <Section title="Buttons">
        <Row gap="sm" wrap>
          <Button label="Primary" onPress={() => {}} />
          <Button label="Secondary" variant="secondary" onPress={() => {}} />
          <Button label="Ghost" variant="ghost" onPress={() => {}} />
          <Button label="Danger" variant="danger" onPress={() => {}} />
        </Row>
        <Row gap="sm" wrap>
          <Button label="Small" size="sm" onPress={() => {}} />
          <Button label="Loading" loading onPress={() => {}} />
          <Button label="Disabled" disabled onPress={() => {}} />
          <Button label="Icon" icon="add" onPress={() => {}} />
        </Row>
        <Button label="Full width" fullWidth icon="sparkles" onPress={() => {}} />
        <Row gap="sm">
          <IconButton icon="heart" variant="primary" accessibilityLabel="Like" onPress={() => {}} />
          <IconButton icon="bookmark" variant="secondary" accessibilityLabel="Save" onPress={() => {}} />
          <IconButton icon="share-outline" variant="ghost" accessibilityLabel="Share" onPress={() => {}} />
          <IconButton icon="trash" variant="danger" accessibilityLabel="Delete" onPress={() => {}} />
          <IconButton icon="ellipsis-horizontal" accessibilityLabel="More" onPress={() => {}} />
          <IconButton icon="close" disabled accessibilityLabel="Close" onPress={() => {}} />
        </Row>
      </Section>

      <Section title="Surfaces & Cards">
        <Surface level="surface" elevation="e1" border="border" padding="base">
          <Text>Surface e1</Text>
        </Surface>
        <Card padding="base"><Text>Static Card</Text></Card>
        <Card onPress={() => toast.show({ message: 'Card tapped' })} padding="base" accessibilityLabel="Tappable card">
          <Text>Tappable Card (press me)</Text>
          <Text variant="footnote" color="textMuted">Springs on press.</Text>
        </Card>
        <Card padding="none">
          <ListItem title="List item" subtitle="With chevron" icon="albums" onPress={() => {}} />
          <Divider inset="base" />
          <ListItem title="Another row" icon="settings-outline" onPress={() => {}} />
          <Divider inset="base" />
          <ListItem title="Delete" destructive icon="trash" onPress={() => {}} />
        </Card>
      </Section>

      <Section title="Inputs">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search memories" />
        <TextField label="Label" placeholder="Default" value={text} onChangeText={setText} helper="Helper text." />
        <TextField label="With icons" placeholder="Email" leadingIcon="mail" trailingIcon="checkmark-circle" value="" onChangeText={() => {}} />
        <TextField label="Error" placeholder="Required" error="This field is required." value="" onChangeText={() => {}} />
        <TextField label="Disabled" placeholder="Disabled" disabled value="" onChangeText={() => {}} />
        <TextField label="Multiline" placeholder="Notes…" multiline value="" onChangeText={() => {}} />
        <SegmentedControl
          options={[
            { value: 'all', label: 'All', icon: 'list' },
            { value: 'unread', label: 'Unread' },
            { value: 'archived', label: 'Archived' },
          ]}
          value={seg}
          onChange={setSeg}
        />
      </Section>

      <Section title="Badges & Chips">
        <Row gap="sm" wrap>
          <Badge label="New" tone="accent" />
          <Badge label="Done" tone="success" />
          <Badge label="Warn" tone="warning" />
          <Badge label="Error" tone="danger" />
          <Badge count={3} tone="danger" solid />
          <Badge count={42} tone="accent" />
          <Badge dot tone="success" />
        </Row>
        <Row gap="sm" wrap>
          <Chip label="Selected" selected={chip} onPress={() => setChip((v) => !v)} icon="pricetag" />
          <Chip label="Unselected" selected={false} onPress={() => {}} />
          <Chip label="Removable" selected onPress={() => {}} onRemove={() => toast.show({ message: 'Removed' })} />
          <Chip label="Disabled" disabled onPress={() => {}} />
        </Row>
      </Section>

      <Section title="Identity & Progress">
        <Row gap="base" align="center">
          <Avatar name="Lucy Lin" size="sm" />
          <Avatar name="Ada Lovelace" size="md" status="online" />
          <Avatar name="Grace Hopper" size="lg" status="away" />
          <Avatar size="xl" name="X" />
        </Row>
        <Row gap="base" align="center">
          <LucyOrb size={56} />
          <LucyOrb size={56} active />
          <ProgressRing progress={0.72} label="72%" />
          <ProgressRing progress={0.3} size={56} color="success" />
        </Row>
      </Section>

      <Section title="Banners">
        <Banner tone="info" message="Heads up — this is an informational banner." />
        <Banner tone="success" title="Saved" message="Your changes are synced." />
        <Banner tone="warning" message="Storage is almost full." actionLabel="Free up space" onAction={() => {}} />
        <Banner tone="danger" title="Sync failed" message="Tap to retry." actionLabel="Retry" onAction={() => {}} onDismiss={() => {}} />
      </Section>

      <Section title="Skeletons (instant render)">
        <Card padding="base">
          <Row gap="md" align="center" style={{ marginBottom: spacing.md }}>
            <Skeleton circle={40} />
            <View style={{ flex: 1 }}>
              <Skeleton height={14} width="50%" style={{ marginBottom: spacing.sm }} />
              <Skeleton height={10} width="30%" />
            </View>
          </Row>
          <SkeletonText lines={3} />
        </Card>
      </Section>

      <Section title="Overlays & Toasts">
        <Row gap="sm" wrap>
          <Button label="Bottom Sheet" variant="secondary" onPress={() => setSheet(true)} />
          <Button label="Action Sheet" variant="secondary" onPress={() => setAction(true)} />
        </Row>
        <Row gap="sm" wrap>
          <Button label="Toast" size="sm" onPress={() => toast.show({ message: 'Saved to your brain', tone: 'success', icon: 'checkmark-circle' })} />
          <Button label="Undo Toast" size="sm" variant="secondary" onPress={() => toast.show({ message: 'Note deleted', tone: 'danger', actionLabel: 'Undo', onAction: () => toast.show({ message: 'Restored' }) })} />
        </Row>
      </Section>

      <Section title="Empty States">
        <Card padding="none">
          <EmptyState title="Nothing here yet" message="Capture your first thought and it'll show up here." ctaLabel="Capture" onCta={() => {}} />
        </Card>
        <Card padding="none">
          <EmptyState icon="search" title="No results" message="Try a different search." compact />
        </Card>
      </Section>

      <Section title="Motion">
        <Stagger>
          {[1, 2, 3].map((n) => (
            <FadeInUp key={n}>
              <Card padding="base"><Text>FadeInUp + Stagger row {n}</Text></Card>
            </FadeInUp>
          ))}
        </Stagger>
        <Spacer size="sm" />
      </Section>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Bottom Sheet">
        <Text variant="body" color="textSecondary">Slides up with a soft spring; backdrop fades. Tap outside or back to dismiss.</Text>
        <Spacer size="base" />
        <Button label="Close" fullWidth onPress={() => setSheet(false)} />
      </BottomSheet>

      <ActionSheet
        visible={action}
        onClose={() => setAction(false)}
        title="Manage note"
        message="Choose an action"
        actions={[
          { label: 'Share', icon: 'share-outline', onPress: () => toast.show({ message: 'Shared' }) },
          { label: 'Archive', icon: 'archive-outline', onPress: () => toast.show({ message: 'Archived' }) },
          { label: 'Delete', icon: 'trash', destructive: true, onPress: () => toast.show({ message: 'Note deleted', tone: 'danger', actionLabel: 'Undo', onAction: () => {} }) },
        ]}
      />
    </ScrollView>
  );
}

/** Standalone, self-wrapping Gallery (provides Theme + Toast). Mount anywhere for visual QA. */
export function Gallery(): React.ReactElement {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <GalleryBody />
        </SafeAreaView>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default Gallery;
