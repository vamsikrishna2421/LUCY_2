/**
 * CaptureCategorySheet — the per-category checklist, rebuilt on the design-system BottomSheet.
 *
 * Parity with Capture 1.0's CategoryModal: each item can be checked (staged done, still undoable),
 * undone, and is committed on close; a quick-add field appends a new task. Behavior/calls are identical
 * — only the presentation moves onto ui/ primitives (calm rows, one quiet add affordance, soft motion).
 */
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheet, Text, Row, Stack, Divider, IconButton, TextField, PressableScale, useTheme,
} from '../../ui';
import type { TodoRow } from '../../db/todos';
import type { TaskCategory } from './categories';

interface RowState { todo: TodoRow; done: boolean }

export function CaptureCategorySheet({
  category,
  onClose,
  onCommitDone,
  onAdd,
  onEdit,
}: {
  category: TaskCategory | null;
  onClose: () => void;
  onCommitDone: (todo: TodoRow) => void;
  onAdd: (text: string) => void;
  onEdit: (todo: TodoRow) => void;
}): React.ReactElement {
  const { colors, spacing, radius } = useTheme();
  const [rows, setRows] = useState<RowState[]>([]);
  const [addText, setAddText] = useState('');

  // Re-seed local row state whenever a new category opens.
  React.useEffect(() => {
    setRows((category?.items ?? []).map((todo) => ({ todo, done: false })));
    setAddText('');
  }, [category]);

  const pending = rows.filter((r) => !r.done);
  const urgent = pending.filter((r) => r.todo.urgency === 'high').length;

  const check = (id: number) => setRows((prev) => prev.map((r) => (r.todo.id === id ? { ...r, done: true } : r)));
  const undo = (id: number) => setRows((prev) => prev.map((r) => (r.todo.id === id ? { ...r, done: false } : r)));

  const commitAndClose = () => {
    // Commit every checked item (after the in-sheet undo window) — identical to 1.0's handleClose.
    rows.filter((r) => r.done).forEach((r) => onCommitDone(r.todo));
    onClose();
  };

  const submitAdd = () => {
    const t = addText.trim();
    if (t) { onAdd(t); setAddText(''); }
  };

  return (
    <BottomSheet visible={category !== null} onClose={commitAndClose}>
      {category ? (
        <Stack gap="md">
          {/* Header */}
          <Row gap="md" align="center">
            <View
              style={{
                width: 44, height: 44, borderRadius: radius.md,
                backgroundColor: category.color + '22', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text variant="h3">{category.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3" numberOfLines={1}>{category.label}</Text>
              <Text variant="footnote" color="textMuted">
                {pending.length} remaining{urgent > 0 ? ` · ${urgent} urgent` : ''}
              </Text>
            </View>
            <IconButton icon="checkmark" accessibilityLabel="Done" onPress={commitAndClose} />
          </Row>

          <Divider />

          {/* Items */}
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
            {rows.length === 0 ? (
              <Text variant="footnote" color="textMuted" align="center" style={{ paddingVertical: spacing.xl }}>
                All done ✓
              </Text>
            ) : null}
            {rows.map(({ todo, done }) =>
              done ? (
                <Row key={todo.id} gap="md" align="center" style={{ paddingVertical: spacing.sm, opacity: 0.7 }}>
                  <View
                    style={{
                      width: 26, height: 26, borderRadius: radius.pill,
                      backgroundColor: colors.success + '22', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={15} color={colors.success} />
                  </View>
                  <Text variant="callout" color="textMuted" style={{ flex: 1, textDecorationLine: 'line-through' }} numberOfLines={1}>
                    {todo.task}
                  </Text>
                  <PressableScale onPress={() => undo(todo.id)} hitSlop={8} accessibilityLabel="Undo">
                    <Text variant="footnote" color="accent" weight="700">Undo</Text>
                  </PressableScale>
                </Row>
              ) : (
                <Row key={todo.id} gap="md" align="center" style={{ paddingVertical: spacing.sm }}>
                  <PressableScale onPress={() => check(todo.id)} hitSlop={6} accessibilityLabel={`Complete ${todo.task}`}>
                    <View
                      style={{
                        width: 26, height: 26, borderRadius: radius.pill,
                        borderWidth: 1.5, borderColor: colors.textFaint,
                      }}
                    />
                  </PressableScale>
                  <Text variant="callout" style={{ flex: 1 }} weight="500">{todo.task}</Text>
                  {todo.urgency === 'high' ? (
                    <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
                      <Text variant="caption" color="accent" weight="700">urgent</Text>
                    </View>
                  ) : null}
                  <IconButton icon="ellipsis-horizontal" variant="plain" size="sm" accessibilityLabel="Edit task" onPress={() => onEdit(todo)} />
                </Row>
              ),
            )}
          </ScrollView>

          {/* Quick add */}
          <TextField
            placeholder={`Add to ${category.label}…`}
            value={addText}
            onChangeText={setAddText}
            returnKeyType="done"
            onSubmitEditing={submitAdd}
            trailingIcon="add"
            onTrailingPress={submitAdd}
          />
        </Stack>
      ) : null}
    </BottomSheet>
  );
}

export default CaptureCategorySheet;
