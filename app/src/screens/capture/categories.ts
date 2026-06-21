/**
 * Capture task categorization — PRESENTATION grouping only (no frozen logic).
 *
 * Buckets pending todos into named categories for the board. Custom `list_name` lists (set by the user
 * or LUCY) take priority over the regex auto-categorization. This is the same grouping Capture 1.0 used,
 * extracted so the board screen and the category sheet share one source of truth.
 */
import type { TodoRow } from '../../db/todos';
import { colors } from '../../ui/theme/tokens';

export interface TaskCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  items: TodoRow[];
}

const CATEGORY_RULES: Array<{ id: string; label: string; icon: string; color: string; pattern: RegExp }> = [
  { id: 'grocery',  label: 'Grocery List',     icon: '🛒', color: '#4ADE80', pattern: /grocery|groceries|food|milk|vegetable|onion|tomato|garlic|spinach|mango|bread|butter|eggs|cereal|buy.*food|shopping list|produce/i },
  { id: 'habits',   label: 'Daily Habits',     icon: '✦',  color: '#60A5FA', pattern: /habit|routine|morning|evening|workout|exercise|run\b|yoga|meditation|daily|wake|sleep|stretc|vitamin|water|steps|walk\b|walking/i },
  // "work" alone is too broad (matches "work towards", "work on myself"). Require job-context neighbours.
  { id: 'work',     label: 'Work & Deadlines', icon: '⌘',  color: '#FF8C42', pattern: /\boffice\b|project deadline|work deadline|at work|for work|meeting\b|client\b|team\b|sprint\b|deploy\b|engineering\b|presentation\b|standup\b|code review|pull request|jira|slack|submit.*report|send.*report/i },
  { id: 'calls',    label: 'Calls & Messages', icon: '◉',  color: '#F472B6', pattern: /call|phone|text|sms|message|whatsapp|ping|contact|follow.up|reach out/i },
  { id: 'health',   label: 'Health',           icon: '♡',  color: '#FCA5A5', pattern: /health|doctor|dentist|medical|physio|appointment|clinic|pharmacy|medicine|pill|prescription|weight loss|lose weight|diet\b|calories|steps goal|walk more|gym\b|fitness/i },
  { id: 'personal', label: 'Personal',         icon: '◈',  color: '#A78BFA', pattern: /family|home|personal|mom|dad|kids|children|house|clean|laundry|bills|bank/i },
];

const CUSTOM_LIST_COLORS = ['#FF8C42', '#60A5FA', '#4ADE80', '#A78BFA', '#F472B6', '#FCA5A5', '#FBBF24'];

function colorForList(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CUSTOM_LIST_COLORS[h % CUSTOM_LIST_COLORS.length];
}

export function categorizeTodos(todos: TodoRow[]): TaskCategory[] {
  const customLists = new Map<string, TodoRow[]>();
  const autoTodos: TodoRow[] = [];
  for (const todo of todos) {
    const listName = (todo.list_name ?? '').trim();
    if (listName) {
      const existing = customLists.get(listName) ?? [];
      existing.push(todo);
      customLists.set(listName, existing);
    } else {
      autoTodos.push(todo);
    }
  }

  const buckets = new Map<string, TodoRow[]>();
  const uncategorized: TodoRow[] = [];

  for (const todo of autoTodos) {
    const haystack = [todo.task, todo.context ?? '', todo.category ?? ''].join(' ');
    let matched = false;
    for (const rule of CATEGORY_RULES) {
      if (rule.pattern.test(haystack)) {
        const existing = buckets.get(rule.id) ?? [];
        existing.push(todo);
        buckets.set(rule.id, existing);
        matched = true;
        break;
      }
    }
    if (!matched) uncategorized.push(todo);
  }

  const result: TaskCategory[] = [];
  for (const [name, items] of customLists) {
    result.push({ id: `custom:${name}`, label: name, icon: '◆', color: colorForList(name), items });
  }
  for (const rule of CATEGORY_RULES) {
    const items = buckets.get(rule.id);
    if (items && items.length > 0) result.push({ ...rule, items });
  }
  if (uncategorized.length > 0) {
    result.push({ id: 'general', label: 'General', icon: '▦', color: colors.textMuted, items: uncategorized });
  }
  return result;
}
