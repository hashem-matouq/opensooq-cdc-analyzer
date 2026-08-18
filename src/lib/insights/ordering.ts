import { safeString, toNumberish } from "@/lib/utils";
import type { CDCRecord } from "@/types/cdc";

/**
 * CDC exports are frequently stored newest-first and their SF_TIMESTAMP only has
 * second precision, so several events can share the same second. SF_OFFSET_ID is
 * the streaming offset and increases strictly with event order, making it the
 * only reliable chronological key. Timestamp and file position are fallbacks for
 * sources that lack an offset (e.g. statuses recovered from a PDF log history).
 */
export function recordOffset(record: CDCRecord): number | undefined {
  const raw =
    record.raw.SF_OFFSET_ID ??
    record.raw.SF_OFFSET ??
    record.raw.OFFSET_ID ??
    record.raw.LAST_EVENT_ID;
  return toNumberish(raw);
}

export function recordTime(record: CDCRecord): number | undefined {
  if (!record.timestamp) return undefined;
  const value = new Date(record.timestamp).getTime();
  return Number.isNaN(value) ? undefined : value;
}

export function compareRecords(
  a: CDCRecord,
  b: CDCRecord,
  indexA: number,
  indexB: number,
): number {
  const oa = recordOffset(a);
  const ob = recordOffset(b);
  if (oa !== undefined && ob !== undefined && oa !== ob) return oa - ob;

  const ta = recordTime(a);
  const tb = recordTime(b);
  if (ta !== undefined && tb !== undefined && ta !== tb) return ta - tb;
  if (ta === undefined && tb !== undefined) return 1;
  if (ta !== undefined && tb === undefined) return -1;

  // Same second and no distinguishing offset: keep offsets ascending if either exists.
  if (oa !== undefined && ob !== undefined && oa !== ob) return oa - ob;

  return indexA - indexB;
}

/** Stable chronological sort that preserves original indices for tie-breaking. */
export function sortRecordsChronologically(records: CDCRecord[]): CDCRecord[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => compareRecords(a.record, b.record, a.index, b.index))
    .map((entry) => entry.record);
}

export function offsetLabel(record: CDCRecord): string | undefined {
  const offset = recordOffset(record);
  if (offset === undefined) return undefined;
  return safeString(record.raw.SF_OFFSET_ID) || String(offset);
}
