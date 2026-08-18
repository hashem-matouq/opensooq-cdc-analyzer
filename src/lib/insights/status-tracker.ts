import { formatStatus } from "@/lib/formatting/formatters";
import {
  isProblemStatus,
  LISTING_STATUS_DEFINITIONS,
  listingStatusTone,
} from "@/config/listing-statuses";
import { compareRecords, recordTime } from "@/lib/insights/ordering";
import { safeString } from "@/lib/utils";
import type {
  CDCRecord,
  InsightSeverity,
  ListingStatusTrack,
  StatusBucket,
  StatusPoint,
  StatusTrackerResult,
  StatusTransition,
} from "@/types/cdc";

export type {
  ListingStatusTrack,
  StatusBucket,
  StatusPoint,
  StatusTrackerResult,
  StatusTransition,
};

export const MULTI_CHANGE_THRESHOLD = 3;

function statusKey(record: CDCRecord): string | undefined {
  const raw = safeString(record.status.status ?? record.raw.STATUS).trim();
  return raw || undefined;
}

const timeOf = recordTime;

/**
 * Records that carry no ID must still be grouped, otherwise every event looks
 * like a separate listing and its status history collapses to zero changes.
 */
function identityOf(record: CDCRecord, index: number) {
  if (record.id) {
    return { key: `id:${record.id}`, label: record.id, matchedBy: "id" as const };
  }

  const title = record.entity.title?.trim();
  const memberId = record.user.memberId?.trim();
  if (title || memberId) {
    return {
      key: `alt:${memberId ?? ""}|${title ?? ""}`,
      label: title ? `${title.slice(0, 40)}` : `Member ${memberId}`,
      matchedBy: "title-member" as const,
    };
  }

  return { key: `row:${index}`, label: `Row ${index + 1}`, matchedBy: "row" as const };
}

export function buildStatusTracker(records: CDCRecord[]): StatusTrackerResult {
  const groups = new Map<
    string,
    { label: string; matchedBy: ListingStatusTrack["matchedBy"]; entries: { record: CDCRecord; index: number }[] }
  >();

  records.forEach((record, index) => {
    const identity = identityOf(record, index);
    const group = groups.get(identity.key) ?? {
      label: identity.label,
      matchedBy: identity.matchedBy,
      entries: [],
    };
    group.entries.push({ record, index });
    groups.set(identity.key, group);
  });

  const tracks: ListingStatusTrack[] = [];
  const currentCounts = new Map<string, number>();
  const everCounts = new Map<string, number>();
  const recordCounts = new Map<string, number>();
  let statusRecords = 0;
  let unknownStatusRecords = 0;

  for (const group of groups.values()) {
    // Chronological where timestamps exist; original file order otherwise.
    const sorted = [...group.entries].sort((a, b) =>
      compareRecords(a.record, b.record, a.index, b.index),
    );

    const points: StatusPoint[] = [];
    const transitions: StatusTransition[] = [];
    const seen = new Set<string>();

    let previousStatus: string | undefined;
    let previousTime: number | undefined;

    sorted.forEach((entry, position) => {
      const record = entry.record;
      const status = statusKey(record);
      const bucketKey = status ?? "unknown";
      const current = timeOf(record);

      recordCounts.set(bucketKey, (recordCounts.get(bucketKey) ?? 0) + 1);
      if (status) statusRecords += 1;
      else unknownStatusRecords += 1;
      seen.add(bucketKey);

      const changed = position > 0 && status !== previousStatus;

      points.push({
        position: position + 1,
        recordUid: record.uid,
        status,
        label: status ? formatStatus(status) : "Unknown",
        tone: status ? listingStatusTone(status) : "neutral",
        timestamp: record.timestamp,
        operation: record.operation,
        active: record.status.active,
        changed,
        previousStatus: position > 0 ? previousStatus : undefined,
        previousLabel:
          position > 0 && previousStatus ? formatStatus(previousStatus) : undefined,
        gapFromPreviousMs:
          current !== undefined && previousTime !== undefined ? current - previousTime : undefined,
        source: safeString(record.raw.SOURCE).toUpperCase() === "LOG_HISTORY" ? "log" : "cdc",
        logAction: safeString(record.raw.LOG_ACTION) || undefined,
      });

      if (changed) {
        transitions.push({
          from: previousStatus,
          fromLabel: previousStatus ? formatStatus(previousStatus) : "Unknown",
          to: status,
          toLabel: status ? formatStatus(status) : "Unknown",
          timestamp: record.timestamp,
          recordUid: record.uid,
          activeBefore: sorted[position - 1].record.status.active,
          activeAfter: record.status.active,
        });
      }

      previousStatus = status;
      if (current !== undefined) previousTime = current;
    });

    for (const key of seen) {
      everCounts.set(key, (everCounts.get(key) ?? 0) + 1);
    }

    const last = sorted[sorted.length - 1].record;
    const first = sorted[0].record;
    const currentStatus = statusKey(last);
    const currentBucket = currentStatus ?? "unknown";
    currentCounts.set(currentBucket, (currentCounts.get(currentBucket) ?? 0) + 1);

    const lastTransition = transitions[transitions.length - 1];

    let severity: InsightSeverity = "information";
    if (transitions.length >= MULTI_CHANGE_THRESHOLD || isProblemStatus(currentStatus)) {
      severity = "warning";
    }
    if (
      (last.status.active === true && isProblemStatus(currentStatus)) ||
      (last.status.featured === true && last.status.active === false)
    ) {
      severity = "potential_issue";
    }

    tracks.push({
      listingId: group.label,
      matchedBy: group.matchedBy,
      title: last.entity.title || sorted.find((e) => e.record.entity.title)?.record.entity.title,
      currentStatus,
      currentLabel: currentStatus ? formatStatus(currentStatus) : "Unknown",
      currentTone: currentStatus ? listingStatusTone(currentStatus) : "neutral",
      previousStatus: lastTransition?.from,
      previousLabel: lastTransition?.from ? formatStatus(lastTransition.from) : undefined,
      currentActive: last.status.active,
      changeCount: transitions.length,
      distinctStatusCount: seen.size,
      statusesSeen: Array.from(seen),
      points,
      transitions,
      firstSeen: first.timestamp,
      lastChanged: lastTransition?.timestamp ?? last.timestamp,
      severity,
      recordUids: sorted.map((e) => e.record.uid),
    });
  }

  const knownCodes = LISTING_STATUS_DEFINITIONS.map((definition) => definition.code);
  const allKeys = Array.from(
    new Set([
      ...knownCodes,
      ...recordCounts.keys(),
      ...currentCounts.keys(),
      ...everCounts.keys(),
    ]),
  );

  const buckets: StatusBucket[] = allKeys.map((key) => ({
    key,
    label: key === "unknown" ? "Unknown" : formatStatus(key),
    tone: key === "unknown" ? "neutral" : listingStatusTone(key),
    currentCount: currentCounts.get(key) ?? 0,
    everCount: everCounts.get(key) ?? 0,
    recordCount: recordCounts.get(key) ?? 0,
  }));

  buckets.sort((a, b) => {
    const ia = knownCodes.indexOf(a.key);
    const ib = knownCodes.indexOf(b.key);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.key.localeCompare(b.key);
  });

  tracks.sort((a, b) => {
    if (b.changeCount !== a.changeCount) return b.changeCount - a.changeCount;
    const ta = a.lastChanged ? new Date(a.lastChanged).getTime() : 0;
    const tb = b.lastChanged ? new Date(b.lastChanged).getTime() : 0;
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });

  return {
    buckets,
    tracks,
    totalListings: tracks.length,
    changedListings: tracks.filter((t) => t.changeCount > 0).length,
    multiChangeListings: tracks.filter((t) => t.changeCount >= MULTI_CHANGE_THRESHOLD).length,
    statusRecords,
    unknownStatusRecords,
  };
}
