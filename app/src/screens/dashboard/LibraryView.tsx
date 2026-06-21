/**
 * Library (Brain) — LUCY 2.0 workspace browser, rebuilt on the design system (app/src/ui).
 *
 * Logic flows through the seam hook `useLibrary`. Parity with Dashboard 1.0's LibraryView: Workspace
 * HOME (WorkspaceHome live-tile grid), a single "‹ Workspace" back bar per section, the full-screen
 * browsers (Galaxy/Documents/Calendar/Projects/Goals — external components, reused as-is), the simple
 * Todos/Ideas/Expenses lists (delete via swipe-to-trash button), and the 7 specialized tabs
 * (People/Resources/Meetings/Listen/Reminders/Gallery/Medications) in LibraryTabs.tsx. Keeps the in-sync
 * local copies of todos/ideas/expenses so a delete updates immediately, re-seeding on parent reload.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, Row, Stack, PressableScale, BottomSheet, Button, useTheme } from '../../ui';
import { PrivacyBadge } from '../../components/PrivacyBadge';
import { WorkspaceHome } from '../../components/WorkspaceHome';
import { DocumentsTab } from '../../components/DocumentsTab';
import { ScheduleTab } from '../../components/ScheduleTab';
import { ProjectsTab } from '../../components/ProjectsTab';
import { MoneyGoals } from '../../components/MoneyGoals';
import { GalaxyView } from '../Galaxy';
import { useLibrary } from '../hooks/useLibrary';
import {
  MedicationsTab, GalleryTab, RemindersTab, ListenTab, ResourcesTab, MeetingsTab, PeopleTab,
} from './LibraryTabs';
import type { TodoRow } from '../../db/todos';
import type { IdeaRow } from '../../db/ideas';
import type { ExpenseRow } from '../../db/expenses';

// Display names for section headers (internal keys kept stable) — same as Dashboard 1.0's TAB_LABEL.
const TAB_LABEL: Record<string, string> = {
  Home: 'Workspace', Calendar: 'Calendar', Documents: 'Documents', Resources: 'Online resources', Galaxy: 'Glossary',
  Meetings: 'Meetings', Listen: 'Listen data', Projects: 'Projects', Ideas: 'Ideas', Expenses: 'Expenses', Goals: 'Money goals',
  People: 'People', Todos: 'Todos', Reminders: 'Reminders', Gallery: 'Scans & photos', Medications: 'Medications',
};

export type LibraryTab =
  | 'Home' | 'Galaxy' | 'Documents' | 'Calendar' | 'Resources' | 'Projects' | 'Todos' | 'Ideas'
  | 'Expenses' | 'Goals' | 'People' | 'Meetings' | 'Listen' | 'Reminders' | 'Gallery' | 'Medications';

/** A simple deletable list row (Todos/Ideas/Expenses) — the redesigned 1.0 `Card`. */
function ListCard({ title, detail, privacy, onDelete, onPress }: { title: string; detail: string; privacy?: 'private' | 'local' | 'normal'; onDelete?: () => void; onPress?: () => void }) {
  const { colors, spacing } = useTheme();
  const lib = useLibrary();
  return (
    <Card level="surfaceAlt" padding="md" onPress={onPress} style={{ marginBottom: spacing.sm }}>
      <Row gap="sm" align="flex-start">
        <Text variant="footnote" weight="600" style={{ flex: 1 }}>{lib.protectedPreview(title)}</Text>
        {privacy ? <PrivacyBadge level={privacy} /> : null}
        {onDelete ? (
          <PressableScale onPress={onDelete} hitSlop={8} accessibilityLabel="Delete"><Ionicons name="trash-outline" size={16} color={colors.danger} /></PressableScale>
        ) : null}
      </Row>
      {detail ? <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>{detail}</Text> : null}
    </Card>
  );
}

export function LibraryView({
  tab,
  setTab,
  todos: initialTodos,
  ideas: initialIdeas,
  expenses: initialExpenses,
}: {
  tab: LibraryTab;
  setTab: (tab: LibraryTab) => void;
  todos: TodoRow[];
  ideas: IdeaRow[];
  expenses: ExpenseRow[];
}) {
  const { colors, spacing } = useTheme();
  const lib = useLibrary();
  const [todos, setTodos] = useState(initialTodos);
  const [ideas, setIdeas] = useState(initialIdeas);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [openIdea, setOpenIdea] = useState<IdeaRow | null>(null);

  useEffect(() => { setTodos(initialTodos); }, [initialTodos]);
  useEffect(() => { setIdeas(initialIdeas); }, [initialIdeas]);
  useEffect(() => { setExpenses(initialExpenses); }, [initialExpenses]);

  const removeTodo = async (id: number) => { await lib.deleteTodo(id); setTodos((p) => p.filter((t) => t.id !== id)); };
  const removeIdea = async (id: number) => { await lib.deleteIdea(id); setIdeas((p) => p.filter((i) => i.id !== id)); };
  const removeExpense = async (id: number) => { await lib.deleteExpense(id); setExpenses((p) => p.filter((e) => e.id !== id)); };

  // Workspace HOME = live-tile command center.
  if (tab === 'Home') {
    return (
      <View style={{ flex: 1 }}>
        <WorkspaceHome onOpen={(t) => setTab(t as LibraryTab)} onPlanDay={() => setTab('Calendar')} />
      </View>
    );
  }

  const BackBar = (
    <PressableScale onPress={() => setTab('Home')} accessibilityLabel="Back to Workspace">
      <Row gap="sm" align="center" paddingY="sm">
        <Ionicons name="chevron-back" size={18} color={colors.accent} />
        <Text variant="footnote" color="accent" weight="600">Workspace</Text>
        <Text variant="footnote" color="textMuted">/ {TAB_LABEL[tab] ?? tab}</Text>
      </Row>
    </PressableScale>
  );

  // Full-screen browsers (own scroll; no outer ScrollView) — external components, reused as-is.
  if (tab === 'Galaxy' || tab === 'Documents' || tab === 'Calendar' || tab === 'Projects' || tab === 'Goals') {
    return (
      <View style={{ flex: 1 }}>
        {BackBar}
        <View style={{ flex: 1 }}>
          {tab === 'Galaxy' ? <GalaxyView /> : tab === 'Documents' ? <DocumentsTab /> : tab === 'Calendar' ? <ScheduleTab /> : tab === 'Goals' ? <MoneyGoals /> : <ProjectsTab />}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {BackBar}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {tab === 'Todos' ? todos.map((item) => <ListCard key={item.id} title={item.task} detail={`${item.category} / ${item.urgency} / ${item.status}`} privacy={item.privacy_level} onDelete={() => void removeTodo(item.id)} />) : null}
        {tab === 'Ideas' ? ideas.map((item) => <ListCard key={item.id} title={item.title} detail={item.description} privacy={item.privacy_level} onPress={() => setOpenIdea(item)} onDelete={() => void removeIdea(item.id)} />) : null}
        {tab === 'Expenses' ? expenses.map((item) => <ListCard key={item.id} title={`${item.amount ?? '-'} - ${item.description}`} detail={item.category} privacy={item.privacy_level} onDelete={() => void removeExpense(item.id)} />) : null}
        {tab === 'People' ? <PeopleTab /> : null}
        {tab === 'Resources' ? <ResourcesTab /> : null}
        {tab === 'Meetings' ? <MeetingsTab /> : null}
        {tab === 'Listen' ? <ListenTab /> : null}
        {tab === 'Reminders' ? <RemindersTab /> : null}
        {tab === 'Gallery' ? <GalleryTab /> : null}
        {tab === 'Medications' ? <MedicationsTab /> : null}
      </ScrollView>

      {/* Idea detail — tap an idea to read it in full (its description holds any LLM elaboration), with a
          clear Done dismiss. */}
      <BottomSheet visible={openIdea !== null} onClose={() => setOpenIdea(null)} title="Idea">
        {openIdea ? (
          <Stack gap="base">
            <Text variant="h3">{lib.protectedPreview(openIdea.title)}</Text>
            <Row gap="sm" align="center">
              <Text variant="caption" color="accent" weight="700" tracking={1}>{openIdea.type.toUpperCase()}</Text>
              {openIdea.privacy_level ? <PrivacyBadge level={openIdea.privacy_level} /> : null}
              <Text variant="caption" color="textMuted">{new Date(openIdea.created_at).toLocaleDateString()}</Text>
            </Row>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator>
              <Text variant="body" color="textSecondary">
                {lib.protectedPreview(openIdea.description) || 'No additional detail captured for this idea yet.'}
              </Text>
            </ScrollView>
            <Button label="Done" variant="secondary" onPress={() => setOpenIdea(null)} />
          </Stack>
        ) : null}
      </BottomSheet>
    </View>
  );
}
