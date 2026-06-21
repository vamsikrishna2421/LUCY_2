/**
 * Design-system render smoke test (headless, no device, no network).
 *
 * Goal: catch runtime render crashes in the ui/ primitives — invalid hook order, undefined token
 * reads, bad SVG gradient ids, missing providers — on BOTH iOS and Android (Platform is mocked and
 * flipped per run). This does NOT validate layout, gestures, or native animation; those need a device.
 *
 * Native modules (react-native, svg, safe-area-context, vector-icons) are mocked in tests/setup/*.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import {
  ThemeProvider, ToastProvider, useToast,
  Text, Surface, Card, Divider, SectionHeader,
  Button, IconButton,
  TextField, SearchField, SegmentedControl,
  ListItem, Badge, Chip, Avatar, LucyOrb, ProgressRing,
  BottomSheet, ActionSheet, Banner, EmptyState,
  Skeleton, SkeletonText,
  Stack, Row, Spacer,
  PressableScale, FadeInUp, Stagger,
} from '../../src/ui';

async function renderUnderProviders(node: React.ReactNode): Promise<TestRenderer.ReactTestRenderer> {
  let tree!: TestRenderer.ReactTestRenderer;
  // Async act flushes mount effects, pending timers (Toast auto-dismiss, Skeleton/Orb loops) AND the
  // microtask from useReduceMotion's AccessibilityInfo promise, so state settles with no act() warnings.
  await act(async () => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <ToastProvider>{node}</ToastProvider>
      </ThemeProvider>,
    );
  });
  await act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  });
  return tree;
}

/** Assert a node mounts without throwing (async because rendering flushes effects/promises). */
async function expectMounts(node: React.ReactNode): Promise<void> {
  await expect(renderUnderProviders(node)).resolves.toBeDefined();
}

/** Collect every prop value across the rendered tree (for assertions like "no ':' in svg ids"). */
function collectPropStrings(json: any, out: string[] = []): string[] {
  if (!json) return out;
  if (Array.isArray(json)) { json.forEach((c) => collectPropStrings(c, out)); return out; }
  if (typeof json === 'object') {
    for (const v of Object.values(json.props ?? {})) {
      if (typeof v === 'string') out.push(v);
    }
    collectPropStrings(json.children, out);
  }
  return out;
}

const PLATFORMS: Array<'ios' | 'android'> = ['ios', 'android'];

describe.each(PLATFORMS)('ui/ primitives render on %s', (platform) => {
  beforeEach(() => { (global as any).__TEST_PLATFORM__ = platform; });
  afterEach(() => { delete (global as any).__TEST_PLATFORM__; });

  it('mounts typography + structure primitives', async () => {
    await expectMounts(
      <>
        <Text variant="h1">Heading</Text>
        <Text variant="caption" color="textMuted">Caption</Text>
        <Surface level="surfaceAlt" padding="base"><Text>In surface</Text></Surface>
        <Card><Text>In card</Text></Card>
        <Card onPress={() => {}}><Text>Tappable card</Text></Card>
        <Divider />
        <SectionHeader title="Section" />
      </>,
    );
  });

  it('mounts action primitives in every variant', async () => {
    await expectMounts(
      <>
        <Button label="Primary" onPress={() => {}} />
        <Button label="Secondary" variant="secondary" />
        <Button label="Ghost" variant="ghost" />
        <Button label="Danger" variant="danger" />
        <Button label="Loading" loading />
        <Button label="Disabled" disabled />
        <IconButton icon="add" accessibilityLabel="Add" variant="primary" />
        <IconButton icon="trash" accessibilityLabel="Delete" variant="danger" />
        <IconButton icon="ellipsis-horizontal" accessibilityLabel="More" variant="plain" />
      </>,
    );
  });

  it('mounts input primitives', async () => {
    await expectMounts(
      <>
        <TextField label="Field" value="" onChangeText={() => {}} />
        <TextField multiline value="multi" onChangeText={() => {}} error="Required" />
        <SearchField value="" onChangeText={() => {}} />
        <SegmentedControl
          options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', icon: 'time-outline' }]}
          value="a"
          onChange={() => {}}
        />
      </>,
    );
  });

  it('mounts data-display primitives', async () => {
    await expectMounts(
      <>
        <ListItem title="Row" subtitle="Sub" />
        <Badge label="NEW" tone="accent" />
        <Chip label="Chip" onPress={() => {}} />
        <Chip label="Selected" selected onPress={() => {}} />
        <Avatar name="Lucy User" />
        <LucyOrb size={48} />
        <LucyOrb size={48} active />
        <ProgressRing progress={0.6} />
      </>,
    );
  });

  it('mounts feedback / overlay primitives (incl. open BottomSheet + ActionSheet)', async () => {
    await expectMounts(
      <>
        <BottomSheet visible onClose={() => {}} title="Sheet"><Text>Body</Text></BottomSheet>
        <ActionSheet
          visible
          onClose={() => {}}
          title="Choose"
          actions={[
            { label: 'Edit', icon: 'create-outline', onPress: () => {} },
            { label: 'Delete', destructive: true, onPress: () => {} },
          ]}
        />
        <Banner tone="info" message="Heads up" />
        <EmptyState title="All clear" message="Nothing here yet" />
      </>,
    );
  });

  it('mounts skeletons + layout + motion primitives', async () => {
    await expectMounts(
      <>
        <Skeleton width="80%" height={14} />
        <SkeletonText lines={3} />
        <Stack gap="md"><Text>A</Text><Text>B</Text></Stack>
        <Row gap="sm"><Text>L</Text><Spacer size="sm" /><Text>R</Text></Row>
        <PressableScale onPress={() => {}}><Text>Press me</Text></PressableScale>
        <Stagger>
          <FadeInUp><Text>1</Text></FadeInUp>
          <FadeInUp><Text>2</Text></FadeInUp>
        </Stagger>
      </>,
    );
  });

  it('LucyOrb produces an SVG gradient id with no ":" (Android url(#id) regression guard)', async () => {
    const tree = await renderUnderProviders(<LucyOrb size={64} />);
    const strings = collectPropStrings(tree.toJSON());
    const idLike = strings.filter((s) => s.includes('lucyOrb') || s.startsWith('url(#'));
    expect(idLike.length).toBeGreaterThan(0);
    for (const s of idLike) expect(s).not.toContain(':');
  });

  it('useToast resolves from the provider and show() does not throw', async () => {
    function Probe() {
      const toast = useToast();
      React.useEffect(() => { toast.show({ message: 'Saved', tone: 'success', icon: 'checkmark-circle' }); }, [toast]);
      return <Text>probe</Text>;
    }
    await expectMounts(<Probe />);
  });
});
