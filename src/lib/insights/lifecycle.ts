import {
  formatFieldValue,
  formatStatus,
  humanizeAction,
  humanizeActor,
} from "@/lib/formatting/formatters";
import { safeString, toBooleanish, toNumberish } from "@/lib/utils";
import { compareRecords, recordTime } from "@/lib/insights/ordering";
import type {
  CDCRecord,
  EvidenceCategory,
  FieldChange,
  InsightSeverity,
  Lifecycle,
  LifecycleStep,
  StepKind,
} from "@/types/cdc";

const TRACKED_FIELDS = [
  "TITLE",
  "DESCRIPTION",
  "PRICE",
  "BASE_PRICE",
  "PRICE_CURRENCY",
  "STATUS",
  "ACTIVE",
  "IS_FEATURED",
  "IS_HIGHLIGHTED",
  "VIOLATION",
  "CATEGORIES_ID",
  "NEW_CAT_ID",
  "CITIES_ID",
  "COUNTRIES_ID",
  "LANG",
  "HAS_PRICE",
  "NUMBER_OF_TIMES_REPOSTED",
  "RECORD_EXPIRATION_DATE",
];

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return "instant";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ${hours % 24}h`;
  const months = Math.floor(days / 30);
  return `${months}mo ${days % 30}d`;
}

const timeOf = recordTime;

function sortRecords(records: CDCRecord[]): CDCRecord[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => compareRecords(a.record, b.record, a.index, b.index))
    .map((entry) => entry.record);
}

function diffRecords(previous: CDCRecord, current: CDCRecord): FieldChange[] {
  const changes: FieldChange[] = [];
  const fields = new Set([...TRACKED_FIELDS, ...Object.keys(current.raw)]);

  for (const field of fields) {
    if (!TRACKED_FIELDS.includes(field)) continue;
    const oldValue = previous.raw[field];
    const newValue = current.raw[field];
    if (safeString(oldValue) === safeString(newValue)) continue;
    changes.push({
      field,
      displayName: field.replace(/_/g, " "),
      oldValue,
      newValue,
      interpretation: describeChange(field, oldValue, newValue),
    });
  }

  return changes;
}

function describeChange(
  field: string,
  oldValue: unknown,
  newValue: unknown,
): string {
  const before = formatFieldValue(field, oldValue);
  const after = formatFieldValue(field, newValue);

  if (field === "PRICE" || field === "BASE_PRICE") {
    const oldNum = toNumberish(oldValue);
    const newNum = toNumberish(newValue);
    if (oldNum !== undefined && newNum !== undefined) {
      const diff = newNum - oldNum;
      const pct = oldNum !== 0 ? Math.round((diff / oldNum) * 100) : undefined;
      const direction = diff > 0 ? "increased" : "decreased";
      return `Price ${direction} from ${before} to ${after}${
        pct !== undefined ? ` (${diff > 0 ? "+" : ""}${pct}%)` : ""
      }.`;
    }
  }

  if (field === "TITLE") return "The listing title was changed.";
  if (field === "DESCRIPTION") return "The listing description was changed.";
  if (field === "STATUS") return `Status changed from ${before} to ${after}.`;
  if (field === "ACTIVE") return `Active changed from ${before} to ${after}.`;
  if (field === "VIOLATION") return `Violation flag changed from ${before} to ${after}.`;
  if (field === "IS_FEATURED") return `Featured changed from ${before} to ${after}.`;
  if (field === "CATEGORIES_ID" || field === "NEW_CAT_ID") {
    return `Category changed from ${before} to ${after}.`;
  }

  return `${field.replace(/_/g, " ")} changed from ${before} to ${after}.`;
}

interface DerivedEvent {
  kind: StepKind;
  title: string;
  detail: string;
  severity: InsightSeverity;
  category: EvidenceCategory;
  evidence: string[];
}

function derivedEvents(
  previous: CDCRecord | undefined,
  current: CDCRecord,
  changes: FieldChange[],
): DerivedEvent[] {
  const events: DerivedEvent[] = [];
  const changed = (field: string) => changes.find((c) => c.field === field);

  const activeChange = changed("ACTIVE");
  if (activeChange) {
    const nowActive = toBooleanish(activeChange.newValue);
    events.push({
      kind: nowActive ? "activated" : "deactivated",
      title: nowActive ? "Listing became active" : "Listing became inactive",
      detail: nowActive
        ? "The listing is now visible to buyers."
        : "The listing is no longer visible to buyers.",
      severity: nowActive ? "information" : "warning",
      category: "DERIVED",
      evidence: [`ACTIVE: ${safeString(activeChange.oldValue)} → ${safeString(activeChange.newValue)}`],
    });
  }

  const statusChange = changed("STATUS");
  if (statusChange) {
    events.push({
      kind: "status",
      title: "Status changed",
      detail: statusChange.interpretation,
      severity: "information",
      category: "FACT",
      evidence: [`STATUS: ${safeString(statusChange.oldValue)} → ${safeString(statusChange.newValue)}`],
    });
  }

  const priceChange = changed("PRICE");
  if (priceChange) {
    events.push({
      kind: "price",
      title: "Price changed",
      detail: priceChange.interpretation,
      severity: "information",
      category: "FACT",
      evidence: [`PRICE: ${safeString(priceChange.oldValue)} → ${safeString(priceChange.newValue)}`],
    });
  }

  const violationChange = changed("VIOLATION");
  if (violationChange) {
    const raised = toBooleanish(violationChange.newValue);
    events.push({
      kind: "violation",
      title: raised ? "Violation detected" : "Violation cleared",
      detail: raised
        ? "A violation flag was raised on this listing."
        : "The violation flag was removed.",
      severity: raised ? "potential_issue" : "information",
      category: "FACT",
      evidence: [`VIOLATION: ${safeString(violationChange.oldValue)} → ${safeString(violationChange.newValue)}`],
    });
  }

  const featuredChange = changed("IS_FEATURED");
  if (featuredChange) {
    const featured = toBooleanish(featuredChange.newValue);
    events.push({
      kind: "featured",
      title: featured ? "Listing featured" : "Listing unfeatured",
      detail: featured
        ? "The listing was promoted as featured."
        : "The featured promotion was removed.",
      severity: "information",
      category: "FACT",
      evidence: [`IS_FEATURED: ${safeString(featuredChange.newValue)}`],
    });
  }

  const categoryChange = changed("CATEGORIES_ID") ?? changed("NEW_CAT_ID");
  if (categoryChange) {
    events.push({
      kind: "category",
      title: "Category changed",
      detail: categoryChange.interpretation,
      severity: "information",
      category: "FACT",
      evidence: [`${categoryChange.field}: ${safeString(categoryChange.newValue)}`],
    });
  }

  const repostChange = changed("NUMBER_OF_TIMES_REPOSTED");
  if (repostChange) {
    const before = toNumberish(repostChange.oldValue) ?? 0;
    const after = toNumberish(repostChange.newValue) ?? 0;
    if (after > before) {
      events.push({
        kind: "reposted",
        title: "Listing reposted",
        detail: `Repost count went from ${before} to ${after}.`,
        severity: "information",
        category: "FACT",
        evidence: [`NUMBER_OF_TIMES_REPOSTED: ${before} → ${after}`],
      });
    }
  }

  const action = current.cdc.lastEditAction;
  const previousAction = previous?.cdc.lastEditAction;
  if (
    action &&
    typeof action === "object" &&
    !Array.isArray(action) &&
    JSON.stringify(action) !== JSON.stringify(previousAction ?? null)
  ) {
    const obj = action as Record<string, unknown>;
    const overlimit = toBooleanish(obj.is_overlimit);
    const parts: string[] = [];
    if (obj.actor_type) parts.push(`Actor: ${humanizeActor(safeString(obj.actor_type))}`);
    if (obj.rule_id) parts.push(`Rule ${safeString(obj.rule_id)}`);
    if (overlimit !== undefined) parts.push(`Over-limit: ${overlimit ? "Yes" : "No"}`);
    if (obj.live_count !== undefined) parts.push(`Live listings: ${safeString(obj.live_count)}`);

    events.push({
      kind: "rule",
      title: obj.action
        ? humanizeAction(safeString(obj.action))
        : "Rule engine action executed",
      detail: parts.join(" · ") || "A rule engine action was recorded on this listing.",
      severity: overlimit ? "warning" : "information",
      category: "INTERPRETATION",
      evidence: [`LAST_EDIT_ACTION = ${JSON.stringify(obj)}`],
    });
  }

  const expiration = current.cdc.recordExpirationDate;
  if (expiration) {
    const expiresAt = new Date(expiration).getTime();
    const eventAt = timeOf(current);
    if (!Number.isNaN(expiresAt) && eventAt !== undefined && expiresAt < eventAt) {
      events.push({
        kind: "expired",
        title: "Listing past expiration",
        detail: `Expiration date ${formatFieldValue("RECORD_EXPIRATION_DATE", expiration)} is earlier than this event.`,
        severity: "warning",
        category: "POTENTIAL_ISSUE",
        evidence: [`RECORD_EXPIRATION_DATE = ${expiration}`],
      });
    }
  }

  return events;
}

function baseStep(record: CDCRecord, isFirst: boolean): DerivedEvent {
  if (record.operation === "insert" || (isFirst && record.status.firstLive)) {
    return {
      kind: "created",
      title: "Listing created",
      detail: record.entity.title
        ? `"${record.entity.title}" entered the system.`
        : "A new listing record was inserted.",
      severity: "information",
      category: "FACT",
      evidence: [`SF_OP = ${safeString(record.raw.SF_OP ?? record.operation)}`],
    };
  }

  if (record.operation === "delete") {
    return {
      kind: "deleted",
      title: "Listing deleted",
      detail: "A delete operation was captured for this listing.",
      severity: "warning",
      category: "FACT",
      evidence: [`SF_OP = ${safeString(record.raw.SF_OP ?? record.operation)}`],
    };
  }

  if (record.operation === "update") {
    return {
      kind: "updated",
      title: "Listing updated",
      detail: "An update operation was captured for this listing.",
      severity: "information",
      category: "FACT",
      evidence: [`SF_OP = ${safeString(record.raw.SF_OP ?? record.operation)}`],
    };
  }

  return {
    kind: "event",
    title: isFirst ? "First CDC event captured" : "CDC event captured",
    detail: "The operation type could not be determined from this record.",
    severity: "information",
    category: "FACT",
    evidence: [`SF_OP = ${safeString(record.raw.SF_OP ?? "")}`],
  };
}

export function buildLifecycles(records: CDCRecord[]): Lifecycle[] {
  const byListing = new Map<string, CDCRecord[]>();
  for (const record of records) {
    const key = record.id ?? `unidentified-${record.uid}`;
    const list = byListing.get(key) ?? [];
    list.push(record);
    byListing.set(key, list);
  }

  const lifecycles: Lifecycle[] = [];

  for (const [listingId, list] of byListing) {
    const sorted = sortRecords(list);
    const steps: LifecycleStep[] = [];
    const startTime = timeOf(sorted[0]);
    let previousTime = startTime;

    sorted.forEach((record, index) => {
      const previous = index > 0 ? sorted[index - 1] : undefined;
      const changes = previous ? diffRecords(previous, record) : [];
      const current = timeOf(record);
      const statusCode =
        safeString(record.status.status ?? record.raw.STATUS).trim() || undefined;
      const statusLabel = formatStatus(statusCode);
      const gap =
        current !== undefined && previousTime !== undefined ? current - previousTime : undefined;
      const offset =
        current !== undefined && startTime !== undefined ? current - startTime : undefined;

      const events: DerivedEvent[] = [baseStep(record, index === 0)];
      events.push(...derivedEvents(previous, record, changes));

      events.forEach((event, eventIndex) => {
        steps.push({
          id: `${record.uid}-${event.kind}-${eventIndex}`,
          recordUid: record.uid,
          listingId,
          timestamp: record.timestamp,
          statusCode,
          statusLabel,
          offsetFromStartMs: offset,
          gapFromPreviousMs: eventIndex === 0 ? gap : 0,
          kind: event.kind,
          title: event.title,
          detail: event.detail,
          category: event.category,
          severity: event.severity,
          changes: eventIndex === 0 ? changes : [],
          evidence: event.evidence,
          operation: record.operation,
          isPrimary: eventIndex === 0,
        });
      });

      if (current !== undefined) previousTime = current;
    });

    const last = sorted[sorted.length - 1];
    const endTime = timeOf(last);
    const deleted = sorted.some((r) => r.operation === "delete");
    const violation = sorted.some((r) => r.status.violation === true);

    const severity: InsightSeverity = violation
      ? "potential_issue"
      : deleted || steps.some((s) => s.severity === "warning")
        ? "warning"
        : "information";

    lifecycles.push({
      listingId,
      title: last.entity.title || sorted.find((r) => r.entity.title)?.entity.title,
      steps,
      recordUids: sorted.map((r) => r.uid),
      start: sorted[0].timestamp,
      end: last.timestamp,
      durationMs:
        startTime !== undefined && endTime !== undefined ? endTime - startTime : undefined,
      totalEvents: steps.length,
      totalRecords: sorted.length,
      finalState: {
        active: last.status.active,
        status: safeString(last.status.status) || undefined,
        violation,
        deleted,
      },
      headline: buildHeadline(sorted, steps, deleted),
      severity,
    });
  }

  return lifecycles.sort((a, b) => {
    const ta = a.start ? new Date(a.start).getTime() : 0;
    const tb = b.start ? new Date(b.start).getTime() : 0;
    return ta - tb;
  });
}

function buildHeadline(records: CDCRecord[], steps: LifecycleStep[], deleted: boolean): string {
  const last = records[records.length - 1];
  const parts: string[] = [];

  parts.push(
    `${records.length} CDC ${records.length === 1 ? "record" : "records"} produced ${steps.length} ${
      steps.length === 1 ? "event" : "events"
    }`,
  );

  if (deleted) {
    parts.push("ending in deletion");
  } else if (last.status.active === true) {
    parts.push("currently active");
  } else if (last.status.active === false) {
    parts.push("currently inactive");
  }

  if (steps.some((s) => s.kind === "violation" && s.severity === "potential_issue")) {
    parts.push("with a violation flagged");
  }

  return `${parts.join(", ")}.`;
}

export function buildGlobalTimeline(lifecycles: Lifecycle[]): LifecycleStep[] {
  return lifecycles
    .flatMap((lifecycle) => lifecycle.steps)
    .sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      if (ta === tb) return a.id.localeCompare(b.id);
      return ta - tb;
    });
}

export function timelineSpan(steps: LifecycleStep[]) {
  const times = steps
    .map((step) => (step.timestamp ? new Date(step.timestamp).getTime() : NaN))
    .filter((value) => !Number.isNaN(value));

  if (times.length === 0) {
    return { start: undefined, end: undefined, durationMs: undefined };
  }

  const start = Math.min(...times);
  const end = Math.max(...times);
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    durationMs: end - start,
  };
}
