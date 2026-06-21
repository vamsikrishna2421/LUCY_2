/**
 * useStory — the StoryView screen's logic seam.
 *
 * The ONLY place the redesigned StoryView touches frozen logic. StoryView 1.0 read its narrative
 * directly from the captures table via two raw SQL queries (person vs. topic) over `db/captures`
 * (CaptureRow) — see docs/04_SEAM_REPORT.md (StoryView row: "db/captures (CaptureRow) — UI over passed
 * captures"). This hook wraps those exact queries with identical SQL, args, ordering, and the same
 * 50-row limit. No logic changes — behavior matches StoryView 1.0; presentation/motion live in the
 * screen.
 */
import { useCallback, useState } from 'react';
import { getDatabase } from '../../db';
import type { CaptureRow } from '../../db/captures';

export interface StorySubject {
  kind: 'person' | 'topic';
  name: string;
  emoji?: string;
  mentionCount?: number;
  lastMentioned?: string | null;
  pendingFollowUps?: number;
  typicalContext?: string | null;
}

export interface StoryEntry {
  capture: CaptureRow;
  daysAgo: number;
  isFirst: boolean;
  isLast: boolean;
}

/** Normalize SQLite's `YYYY-MM-DD HH:MM:SS` (UTC, no tz) to an ISO string the Date ctor reads as UTC. */
function toUtcIso(value: string): string {
  return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
}

export interface UseStory {
  entries: StoryEntry[];
  loading: boolean;
  /** Load (or reload) the story for a subject. Safe to call with null (clears nothing, no-ops). */
  loadStory: (subject: StorySubject) => Promise<void>;
}

export function useStory(): UseStory {
  const [entries, setEntries] = useState<StoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStory = useCallback(async (subject: StorySubject) => {
    setLoading(true);
    try {
      const db = await getDatabase();
      let rows: CaptureRow[] = [];
      if (subject.kind === 'person') {
        rows = await db.getAllAsync<CaptureRow>(
          `SELECT * FROM captures
           WHERE (raw_transcript LIKE ? OR extracted_title LIKE ?)
             AND processed = 1 AND archived_at IS NULL
           ORDER BY created_at DESC LIMIT 50`,
          `%${subject.name}%`, `%${subject.name}%`,
        );
      } else {
        // For topics: search by project/area name
        rows = await db.getAllAsync<CaptureRow>(
          `SELECT c.* FROM captures c
           JOIN extractions e ON e.capture_id = c.id
           WHERE (e.structured_json LIKE ? OR c.raw_transcript LIKE ?)
             AND c.processed = 1 AND c.archived_at IS NULL
           ORDER BY c.created_at DESC LIMIT 50`,
          `%"${subject.name}"%`, `%${subject.name}%`,
        );
      }
      const now = Date.now();
      setEntries(rows.map((capture, i) => ({
        capture,
        daysAgo: Math.floor((now - new Date(toUtcIso(capture.created_at)).getTime()) / 86400000),
        isFirst: i === 0,
        isLast: i === rows.length - 1,
      })));
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, []);

  return { entries, loading, loadStory };
}
