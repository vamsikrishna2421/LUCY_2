/**
 * Settings — shared model metadata (Claude-first). Extracted verbatim from Settings 1.0 so the role
 * cards, presets, and pickers all read from one source. Pure data + label helpers, no logic.
 */
import type { ModelRole } from '../../ai/modelPreference';

export interface RoleModelChoice { id: string; label: string; short: string; tier: string; desc: string; }

export const ROLE_MODEL_CHOICES: RoleModelChoice[] = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  short: 'Haiku 4.5',  tier: 'Fast · lowest cost',          desc: 'Fastest, most affordable — great for routine work.' },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6', short: 'Sonnet 4.6', tier: 'Balanced',                    desc: 'The sweet spot of quality and cost.' },
  { id: 'claude-opus-4-8',            label: 'Claude Opus 4.8',   short: 'Opus 4.8',   tier: 'Most capable · highest cost', desc: 'Deepest reasoning — use when quality matters most.' },
];

export function roleChoice(id: string): RoleModelChoice | undefined {
  return ROLE_MODEL_CHOICES.find((m) => m.id === id);
}

// Friendly model name for the processing-queue diagnostic (active id can be any historical value).
const MODEL_LABELS: Record<string, string> = {
  'gpt-4o-mini': 'gpt-4o-mini', 'gpt-4o': 'gpt-4o', 'gpt-4.1-mini': 'gpt-4.1-mini',
  'gpt-4.1': 'gpt-4.1', 'gpt-5-mini': 'gpt-5-mini', 'gpt-5': 'gpt-5', 'gpt-5.4': 'gpt-5.4', 'gpt-5.5': 'gpt-5.5',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5', 'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-opus-4-7': 'Claude Opus 4.7', 'claude-opus-4-8': 'Claude Opus 4.8',
};
export function modelLabel(id: string): string {
  return MODEL_LABELS[id] ?? roleChoice(id)?.label ?? id;
}

// The three model roles, in display order, with their human framing + a leading glyph.
export const ROLE_CARDS: { role: ModelRole; title: string; desc: string; icon: string }[] = [
  { role: 'capture',   title: 'Capture & organize',  desc: 'Turns every note into tasks, expenses, reminders, and topics.', icon: '🗂️' },
  { role: 'insight',   title: 'Insight & synthesis', desc: 'Weekly brain pulse, reflections, and your daily brief.',        icon: '💡' },
  { role: 'assistant', title: 'Assistant',           desc: 'Ask Lucy and voice conversations.',                             icon: '💬' },
];

// Model ids used for the segmented toggle + presets.
export const M_OPUS = 'claude-opus-4-8';
export const M_SONNET = 'claude-sonnet-4-6';
export const M_HAIKU = 'claude-haiku-4-5-20251001';
// Segmented-control order (best → cheapest, left → right).
export const MODEL_DISPLAY_ORDER = [M_OPUS, M_SONNET, M_HAIKU];

// One-tap presets that set every agent at once.
export const MODEL_PRESETS: { id: 'quality' | 'balanced' | 'economy'; label: string; blurb: string; models: Record<ModelRole, string> }[] = [
  { id: 'quality',  label: 'Best quality', blurb: 'Top models everywhere — deepest reasoning, highest cost.', models: { capture: M_SONNET, insight: M_OPUS,   assistant: M_OPUS } },
  { id: 'balanced', label: 'Balanced',     blurb: 'Lucy picks the cheapest model that still nails each job.',  models: { capture: M_HAIKU,  insight: M_SONNET, assistant: M_SONNET } },
  { id: 'economy',  label: 'Economy',      blurb: 'Haiku & Sonnet only — fastest and cheapest.',               models: { capture: M_HAIKU,  insight: M_HAIKU,  assistant: M_SONNET } },
];
