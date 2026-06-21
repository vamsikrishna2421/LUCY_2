/**
 * useGalaxy — the Brain Galaxy screen's logic seam.
 *
 * The ONLY place the redesigned Galaxy touches frozen logic. Galaxy 1.0 read/mutated the topic tree
 * directly through db/brainTopics and lazily reached for processing/brainClassify (seeding) + the
 * per-table delete helpers. docs/04_SEAM_REPORT.md frames Galaxy as "UI over config + brain DB listers
 * (db/brainTopics)"; this hook wraps those exact calls with identical arguments and outcomes:
 *
 *   db/brainTopics            → listChildTopics, listItemsInSubtree, insertTopic, renameTopic,
 *                               archiveTopic   (moveTopicItem is imported-but-unused in 1.0 → not wrapped)
 *   processing/brainClassify  → shouldSeedBrainGalaxy, generateSeedProposal, acceptSeedProposal (lazy)
 *   db/captures|todos|ideas   → deleteCaptureCompletely / deleteTodo / deleteIdea (lazy, for leaf delete)
 *   + the same raw item-detail SELECTs 1.0 ran to label captures/todos/ideas in a subtree.
 *
 * No logic is changed — behavior matches Galaxy 1.0 exactly; presentation/motion/haptics live in the
 * screen.
 */
import { useCallback } from 'react';
import { getDatabase } from '../../db';
import {
  archiveTopic, insertTopic, listChildTopics, listItemsInSubtree, renameTopic, type BrainTopicRow,
} from '../../db/brainTopics';

export interface ItemDisplay {
  table_name: string;
  row_id: number;
  label: string;
  subtitle?: string;
}

export interface UseGalaxy {
  loadChildren: (parentId: number | null) => Promise<BrainTopicRow[]>;
  loadItems: (topicId: number) => Promise<ItemDisplay[]>;
  addTopic: (name: string, parentId: number | null) => Promise<void>;
  rename: (id: number, name: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
  deleteItem: (item: ItemDisplay) => Promise<void>;
  // Seeding (lazy brainClassify — same chain as 1.0)
  maybeSeedProposal: () => Promise<string | null>;
  acceptSeed: (json: string) => Promise<void>;
}

export function useGalaxy(): UseGalaxy {
  const loadChildren = useCallback(async (parentId: number | null) => {
    const db = await getDatabase();
    return listChildTopics(db, parentId);
  }, []);

  // Resolve up to 40 leaf items in a topic's subtree, then label captures/todos/ideas with the same
  // raw SELECTs Galaxy 1.0 used (identical columns, ordering, and slice lengths).
  const loadItems = useCallback(async (topicId: number): Promise<ItemDisplay[]> => {
    const db = await getDatabase();
    const rows = await listItemsInSubtree(db, topicId, undefined, 40);
    const ids = rows.reduce<Record<string, number[]>>((acc, r) => {
      (acc[r.table_name] = acc[r.table_name] ?? []).push(r.row_id);
      return acc;
    }, {});
    const display: ItemDisplay[] = [];
    for (const [table, rowIds] of Object.entries(ids)) {
      if (rowIds.length === 0) continue;
      const placeholders = rowIds.map(() => '?').join(',');
      if (table === 'captures') {
        const caps = await db.getAllAsync<{ id: number; extracted_title: string | null; raw_transcript: string }>(
          `SELECT id, extracted_title, raw_transcript FROM captures WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
          ...rowIds,
        );
        caps.forEach((c) => display.push({ table_name: 'captures', row_id: c.id, label: c.extracted_title ?? c.raw_transcript.slice(0, 60) }));
      } else if (table === 'todos') {
        const t = await db.getAllAsync<{ id: number; task: string; urgency: string }>(
          `SELECT id, task, urgency FROM todos WHERE id IN (${placeholders})`, ...rowIds,
        );
        t.forEach((r) => display.push({ table_name: 'todos', row_id: r.id, label: r.task, subtitle: r.urgency }));
      } else if (table === 'ideas') {
        const t = await db.getAllAsync<{ id: number; title: string; description: string }>(
          `SELECT id, title, description FROM ideas WHERE id IN (${placeholders})`, ...rowIds,
        );
        t.forEach((r) => display.push({ table_name: 'ideas', row_id: r.id, label: r.title, subtitle: r.description.slice(0, 80) }));
      }
    }
    return display;
  }, []);

  const addTopic = useCallback(async (name: string, parentId: number | null) => {
    const db = await getDatabase();
    await insertTopic(db, name, parentId);
  }, []);

  const rename = useCallback(async (id: number, name: string) => {
    const db = await getDatabase();
    await renameTopic(db, id, name);
  }, []);

  const remove = useCallback(async (id: number) => {
    const db = await getDatabase();
    await archiveTopic(db, id);
  }, []);

  const deleteItem = useCallback(async (item: ItemDisplay) => {
    const db = await getDatabase();
    if (item.table_name === 'captures') {
      const { deleteCaptureCompletely } = await import('../../db/captures');
      await deleteCaptureCompletely(db, item.row_id);
    } else if (item.table_name === 'todos') {
      const { deleteTodo } = await import('../../db/todos');
      await deleteTodo(db, item.row_id);
    } else if (item.table_name === 'ideas') {
      const { deleteIdea } = await import('../../db/ideas');
      await deleteIdea(db, item.row_id);
    }
  }, []);

  const maybeSeedProposal = useCallback(async (): Promise<string | null> => {
    const db = await getDatabase();
    const { shouldSeedBrainGalaxy, generateSeedProposal } = await import('../../processing/brainClassify');
    if (await shouldSeedBrainGalaxy(db)) {
      return (await generateSeedProposal(db)) ?? null;
    }
    return null;
  }, []);

  const acceptSeed = useCallback(async (json: string) => {
    const db = await getDatabase();
    const { acceptSeedProposal } = await import('../../processing/brainClassify');
    await acceptSeedProposal(db, json);
  }, []);

  return { loadChildren, loadItems, addTopic, rename, remove, deleteItem, maybeSeedProposal, acceptSeed };
}
