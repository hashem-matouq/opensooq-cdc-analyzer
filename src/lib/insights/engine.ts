import {
  formatCountry,
  formatOperation,
  formatStatus,
  humanizeAction,
} from "@/lib/formatting/formatters";
import { buildGlobalTimeline, buildLifecycles, timelineSpan } from "@/lib/insights/lifecycle";
import { isKnownStatus, isProblemStatus } from "@/config/listing-statuses";
import { safeString, toBooleanish } from "@/lib/utils";
import type {
  AnalysisResult,
  CDCRecord,
  ChartDatum,
  DashboardStats,
  FieldChange,
  ImportantEvent,
  InsightItem,
  ListingChangeGroup,
  SourceFileMeta,
  TimelineEvent,
} from "@/types/cdc";
import { buildStatusTracker } from "@/lib/insights/status-tracker";
import type { StatusTrackerResult } from "@/types/cdc";

function countBy(records: CDCRecord[], getter: (r: CDCRecord) => string | undefined): ChartDatum[] {
  const map = new Map<string, number>();
  for (const record of records) {
    const key = getter(record) || "Unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, value]) => ({ key, label: key, value }))
    .sort((a, b) => b.value - a.value);
}

export function computeStats(records: CDCRecord[]): DashboardStats {
  return {
    totalRecords: records.length,
    newRecords: records.filter((r) => r.operation === "insert").length,
    updatedRecords: records.filter((r) => r.operation === "update").length,
    deletedRecords: records.filter((r) => r.operation === "delete").length,
    errorsOrViolations: records.filter((r) => r.status.violation === true).length,
    activeRecords: records.filter((r) => r.status.active === true).length,
    unknownOperations: records.filter((r) => r.operation === "unknown").length,
  };
}

export function buildTimeline(records: CDCRecord[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const record of records) {
    const opLabel =
      record.operation === "insert"
        ? "Listing created"
        : record.operation === "update"
          ? "Listing updated"
          : record.operation === "delete"
            ? "Listing deleted"
            : "CDC event recorded";

    events.push({
      id: `${record.uid}-op`,
      recordUid: record.uid,
      listingId: record.id,
      timestamp: record.timestamp,
      title: opLabel,
      description: record.entity.title
        ? `Listing ${record.id ?? ""} — ${record.entity.title}`
        : `Listing ${record.id ?? "unknown"}`,
      category: "FACT",
      severity: "information",
      evidence: [`SF_OP = ${safeString(record.raw.SF_OP || record.operation)}`],
    });

    if (record.status.active === true) {
      events.push({
        id: `${record.uid}-active`,
        recordUid: record.uid,
        listingId: record.id,
        timestamp: record.timestamp,
        title: "Listing became active",
        description: `ACTIVE = Yes`,
        category: "DERIVED",
        severity: "information",
        evidence: [`ACTIVE = ${safeString(record.raw.ACTIVE)}`],
      });
    }

    if (record.status.violation === true) {
      events.push({
        id: `${record.uid}-violation`,
        recordUid: record.uid,
        listingId: record.id,
        timestamp: record.timestamp,
        title: "Listing violated",
        description: "A violation flag was detected on this record.",
        category: "FACT",
        severity: "potential_issue",
        evidence: [`VIOLATION = ${safeString(record.raw.VIOLATION)}`],
      });
    }

    const action = record.cdc.lastEditAction;
    if (action && typeof action === "object" && !Array.isArray(action)) {
      const obj = action as Record<string, unknown>;
      const actionName = safeString(obj.action);
      events.push({
        id: `${record.uid}-action`,
        recordUid: record.uid,
        listingId: record.id,
        timestamp: record.timestamp,
        title: actionName ? humanizeAction(actionName) : "Rule engine action executed",
        description: [
          obj.actor_type ? `Actor: ${safeString(obj.actor_type)}` : null,
          obj.rule_id ? `Rule: ${safeString(obj.rule_id)}` : null,
          obj.is_overlimit !== undefined
            ? `Over-limit: ${toBooleanish(obj.is_overlimit) ? "Yes" : "No"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        category: "INTERPRETATION",
        severity: toBooleanish(obj.is_overlimit) ? "warning" : "information",
        evidence: [`LAST_EDIT_ACTION = ${JSON.stringify(obj)}`],
      });
    }
  }

  return events.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });
}

export function detectImportantEvents(records: CDCRecord[]): ImportantEvent[] {
  const events: ImportantEvent[] = [];

  for (const record of records) {
    const action = record.cdc.lastEditAction;
    if (action && typeof action === "object" && !Array.isArray(action)) {
      const obj = action as Record<string, unknown>;
      if (obj.action || obj.rule_id || obj.is_overlimit !== undefined) {
        events.push({
          id: `${record.uid}-important-action`,
          recordUid: record.uid,
          listingId: record.id,
          title: `Listing #${record.id ?? "unknown"}`,
          summary: obj.action
            ? humanizeAction(safeString(obj.action))
            : "Rule engine action detected.",
          details: {
            ...(obj.is_overlimit !== undefined
              ? { Reason: toBooleanish(obj.is_overlimit) ? "Over-limit" : "Rule action" }
              : {}),
            ...(obj.rule_id !== undefined ? { "Rule ID": safeString(obj.rule_id) } : {}),
            Operation: formatOperation(record.operation),
          },
          severity: toBooleanish(obj.is_overlimit) ? "warning" : "information",
          evidence: [`LAST_EDIT_ACTION.action = ${safeString(obj.action)}`],
        });
      }
    }

    if (record.status.violation === true) {
      events.push({
        id: `${record.uid}-important-violation`,
        recordUid: record.uid,
        listingId: record.id,
        title: `Listing #${record.id ?? "unknown"}`,
        summary: "Violation-related event detected.",
        details: {
          Operation: formatOperation(record.operation),
          Violation: "Detected",
        },
        severity: "potential_issue",
        evidence: [`VIOLATION = ${safeString(record.raw.VIOLATION)}`],
      });
    }

    if (record.operation === "delete") {
      events.push({
        id: `${record.uid}-important-delete`,
        recordUid: record.uid,
        listingId: record.id,
        title: `Listing #${record.id ?? "unknown"}`,
        summary: "Listing deleted.",
        details: { Operation: "Deleted" },
        severity: "warning",
        evidence: [`SF_OP = ${safeString(record.raw.SF_OP)}`],
      });
    }
  }

  return events.slice(0, 100);
}

export function buildSmartInsights(records: CDCRecord[], stats: DashboardStats): InsightItem[] {
  if (records.length === 0) {
    return [
      {
        id: "empty",
        title: "Insufficient data",
        statement: "Not enough data to determine this.",
        severity: "information",
        category: "DERIVED",
        evidence: [],
      },
    ];
  }

  const insights: InsightItem[] = [];

  const opDominant =
    stats.updatedRecords >= stats.newRecords && stats.updatedRecords >= stats.deletedRecords
      ? "updates"
      : stats.newRecords >= stats.deletedRecords
        ? "new listings"
        : "deletes";

  insights.push({
    id: "op-mix",
    title: "Activity mix",
    statement: `Most records are ${opDominant} rather than other operations.`,
    severity: "information",
    category: "DERIVED",
    evidence: [
      `insert=${stats.newRecords}`,
      `update=${stats.updatedRecords}`,
      `delete=${stats.deletedRecords}`,
    ],
  });

  if (stats.errorsOrViolations > 0) {
    insights.push({
      id: "violations",
      title: "Violations",
      statement: `${stats.errorsOrViolations} records contain violations.`,
      severity: "warning",
      category: "FACT",
      evidence: ["VIOLATION = true/1"],
    });
  }

  const countries = countBy(records, (r) =>
    r.entity.country ? formatCountry(r.entity.country) : undefined,
  );
  if (countries[0] && countries[0].key !== "Unknown") {
    insights.push({
      id: "country",
      title: "Top country",
      statement: `Most records are from ${countries[0].label}.`,
      severity: "information",
      category: "DERIVED",
      evidence: [`${countries[0].label}=${countries[0].value}`],
    });
  } else {
    insights.push({
      id: "country-missing",
      title: "Top country",
      statement: "Not enough data to determine this.",
      severity: "information",
      category: "DERIVED",
      evidence: [],
    });
  }

  const hours = new Map<number, number>();
  for (const record of records) {
    if (!record.timestamp) continue;
    const date = new Date(record.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    hours.set(date.getHours(), (hours.get(date.getHours()) ?? 0) + 1);
  }

  if (hours.size > 0) {
    const topHour = Array.from(hours.entries()).sort((a, b) => b[1] - a[1])[0];
    const start = topHour[0];
    const end = (start + 2) % 24;
    insights.push({
      id: "peak-hour",
      title: "Peak activity",
      statement: `The largest activity occurred between ${formatHour(start)} and ${formatHour(end)}.`,
      severity: "information",
      category: "DERIVED",
      evidence: [`hour=${start} count=${topHour[1]}`],
    });
  } else {
    insights.push({
      id: "peak-hour-missing",
      title: "Peak activity",
      statement: "Not enough data to determine this.",
      severity: "information",
      category: "DERIVED",
      evidence: [],
    });
  }

  return insights;
}

function formatHour(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function buildQaInsights(
  records: CDCRecord[],
  tracker: StatusTrackerResult = buildStatusTracker(records),
): InsightItem[] {
  const insights: InsightItem[] = [];
  const byListing = new Map<string, CDCRecord[]>();

  for (const record of records) {
    if (!record.id) continue;
    const list = byListing.get(record.id) ?? [];
    list.push(record);
    byListing.set(record.id, list);
  }

  let duplicateCount = 0;

  // Status counts come from the tracker so QA and the Listing Status view agree.
  for (const track of tracker.tracks) {
    if (track.changeCount < 2) continue;
    insights.push({
      id: `status-${track.listingId}`,
      title: "Multiple status changes",
      statement: `Listing #${track.listingId} changed status ${track.changeCount} times: ${track.points
        .map((point) => `${point.label} (${point.status ?? "—"})`)
        .join(" → ")}.`,
      severity: track.changeCount >= 3 ? "potential_issue" : "warning",
      category: "POTENTIAL_ISSUE",
      evidence: track.points.map(
        (point) =>
          `STATUS=${point.status ?? "—"}${point.timestamp ? ` @ ${point.timestamp}` : ""}`,
      ),
    });
  }

  for (const [listingId, list] of byListing) {
    if (list.length > 1) {
      const ops = list.map((r) => r.operation).join(",");
      if (list.length > 3) {
        duplicateCount += 1;
      }

      const sorted = [...list].sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return ta - tb;
      });

      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i - 1].operation === "delete" && sorted[i].operation === "update") {
          insights.push({
            id: `suspicious-${listingId}-${i}`,
            title: "Suspicious operations",
            statement: `Listing #${listingId} updated immediately after deletion.`,
            severity: "potential_issue",
            category: "POTENTIAL_ISSUE",
            evidence: [`ops=${ops}`],
          });
        }
      }
    }
  }

  if (duplicateCount > 0) {
    insights.push({
      id: "duplicates",
      title: "Duplicate records",
      statement: `${duplicateCount} listings have repeated CDC events that may need review.`,
      severity: "information",
      category: "DERIVED",
      evidence: ["Grouped by ID with length > 3"],
    });
  }

  const activeNoPrice = records.filter(
    (r) => r.status.active === true && (r.status.hasPrice === false || r.entity.price === undefined),
  ).length;
  if (activeNoPrice > 0) {
    insights.push({
      id: "missing-price",
      title: "Missing important fields",
      statement: `${activeNoPrice} active listings have no price.`,
      severity: "warning",
      category: "POTENTIAL_ISSUE",
      evidence: ["ACTIVE=1 and HAS_PRICE=0/PRICE missing"],
    });
  }

  const invalidActiveProblem = records.filter(
    (r) => r.status.active === true && isProblemStatus(r.status.status),
  ).length;
  if (invalidActiveProblem > 0) {
    insights.push({
      id: "invalid-active-problem",
      title: "Invalid combinations",
      statement: `${invalidActiveProblem} records are Active=Yes but STATUS is Blocked or Expired.`,
      severity: "potential_issue",
      category: "POTENTIAL_ISSUE",
      evidence: ["ACTIVE=1 with STATUS blocked/expired (103/200)"],
    });
  }

  const featuredInactive = records.filter(
    (r) => r.status.featured === true && r.status.active === false,
  ).length;
  if (featuredInactive > 0) {
    insights.push({
      id: "featured-inactive",
      title: "Invalid combinations",
      statement: `${featuredInactive} records are Featured=Yes but Active=No.`,
      severity: "potential_issue",
      category: "POTENTIAL_ISSUE",
      evidence: ["IS_FEATURED=1 and ACTIVE=0"],
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "qa-none",
      title: "QA scan complete",
      statement: "No strong anomalies were detected from the uploaded data.",
      severity: "information",
      category: "DERIVED",
      evidence: [`records=${records.length}`],
    });
  }

  return insights.slice(0, 50);
}

const TRACKED_CHANGE_FIELDS = [
  "TITLE",
  "PRICE",
  "STATUS",
  "ACTIVE",
  "IS_FEATURED",
  "VIOLATION",
  "CATEGORIES_ID",
  "LANG",
  "PRICE_CURRENCY",
];

export function detectChanges(records: CDCRecord[]): ListingChangeGroup[] {
  const byListing = new Map<string, CDCRecord[]>();
  for (const record of records) {
    if (!record.id) continue;
    const list = byListing.get(record.id) ?? [];
    list.push(record);
    byListing.set(record.id, list);
  }

  const groups: ListingChangeGroup[] = [];

  for (const [listingId, list] of byListing) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });

    const changes: FieldChange[] = [];
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    for (const field of TRACKED_CHANGE_FIELDS) {
      const oldValue = first.raw[field];
      const newValue = last.raw[field];
      if (safeString(oldValue) === safeString(newValue)) continue;
      changes.push({
        field,
        displayName: field.replace(/_/g, " "),
        oldValue,
        newValue,
        interpretation: interpretChange(field, oldValue, newValue),
      });
    }

    if (changes.length === 0) continue;

    groups.push({
      listingId,
      recordUids: sorted.map((r) => r.uid),
      changes,
      summary: changes.map((c) => c.interpretation),
    });
  }

  return groups.slice(0, 200);
}

function interpretChange(field: string, oldValue: unknown, newValue: unknown): string {
  if (field === "PRICE") {
    const oldNum = Number(oldValue);
    const newNum = Number(newValue);
    if (Number.isFinite(oldNum) && Number.isFinite(newNum)) {
      if (newNum > oldNum) return `The listing price increased from ${oldNum} to ${newNum}.`;
      if (newNum < oldNum) return `The listing price decreased from ${oldNum} to ${newNum}.`;
    }
    return "The listing price was changed.";
  }
  if (field === "TITLE") return "The listing title was changed.";
  if (field === "STATUS") return "The listing status changed.";
  if (field === "ACTIVE") return "The listing active flag changed.";
  if (field === "CATEGORIES_ID") return "The listing category was changed.";
  if (field === "VIOLATION") return "The violation flag changed.";
  return `The field ${field} changed from ${safeString(oldValue)} to ${safeString(newValue)}.`;
}

function bucketByDay(records: CDCRecord[], predicate?: (r: CDCRecord) => boolean): ChartDatum[] {
  const map = new Map<string, number>();
  for (const record of records) {
    if (predicate && !predicate(record)) continue;
    if (!record.timestamp) continue;
    const date = new Date(record.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ key, label: key, value }));
}

function activityByHour(records: CDCRecord[]): ChartDatum[] {
  const map = new Map<number, number>();
  for (let i = 0; i < 24; i += 1) map.set(i, 0);
  for (const record of records) {
    if (!record.timestamp) continue;
    const date = new Date(record.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    map.set(date.getHours(), (map.get(date.getHours()) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([hour, value]) => ({
    key: String(hour),
    label: formatHour(hour),
    value,
  }));
}

export function buildCharts(records: CDCRecord[]) {
  return {
    operations: [
      { key: "insert", label: "Insert", value: records.filter((r) => r.operation === "insert").length },
      { key: "update", label: "Update", value: records.filter((r) => r.operation === "update").length },
      { key: "delete", label: "Delete", value: records.filter((r) => r.operation === "delete").length },
    ].filter((d) => d.value > 0),
    status: countBy(records, (r) => safeString(r.status.status) || undefined).map((datum) => ({
      ...datum,
      label: formatStatus(datum.key),
    })),
    country: countBy(records, (r) =>
      r.entity.country ? formatCountry(r.entity.country) : undefined,
    ),
    language: countBy(records, (r) => r.entity.language || undefined),
    overTime: bucketByDay(records),
    violationsOverTime: bucketByDay(records, (r) => r.status.violation === true),
    activityByHour: activityByHour(records),
  };
}

export function analyzeRecords(
  records: CDCRecord[],
  file: SourceFileMeta,
  fieldsDetected: string[],
  warnings: string[] = [],
): AnalysisResult {
  const stats = computeStats(records);
  const lifecycles = buildLifecycles(records);
  const globalTimeline = buildGlobalTimeline(lifecycles);
  const statusTracker = buildStatusTracker(records);

  const allWarnings = [...warnings];
  const unmappedCodes = Array.from(
    new Set(
      records
        .map((record) => safeString(record.status.status ?? record.raw.STATUS).trim())
        .filter((code) => code && !isKnownStatus(code)),
    ),
  );
  if (unmappedCodes.length > 0) {
    allWarnings.push(
      `Unrecognized status code${unmappedCodes.length > 1 ? "s" : ""} ${unmappedCodes
        .sort()
        .join(", ")} — shown as "Status <code>". Add ${
        unmappedCodes.length > 1 ? "them" : "it"
      } to the status dictionary to see a business label.`,
    );
  }

  return {
    file,
    records,
    fieldsDetected,
    stats,
    insights: buildSmartInsights(records, stats),
    qaInsights: buildQaInsights(records, statusTracker),
    importantEvents: detectImportantEvents(records),
    timeline: buildTimeline(records),
    lifecycles,
    globalTimeline,
    span: timelineSpan(globalTimeline),
    changeGroups: detectChanges(records),
    statusTracker,
    charts: buildCharts(records),
    warnings: allWarnings,
  };
}

export function explainRecord(record: CDCRecord): string[] {
  const lines: string[] = [];
  const op =
    record.operation === "insert"
      ? "a new listing"
      : record.operation === "update"
        ? "an update to listing"
        : record.operation === "delete"
          ? "a deletion of listing"
          : "a CDC event for listing";

  lines.push(
    `This record represents ${op}${record.id ? ` #${record.id}` : ""}.`,
  );

  if (record.entity.title) {
    lines.push(`Title: ${record.entity.title}.`);
  }
  if (record.entity.category || record.entity.categoryId) {
    lines.push(
      `The listing is related to category ${record.entity.category ?? record.entity.categoryId}.`,
    );
  }
  if (record.status.active !== undefined) {
    lines.push(
      record.status.active
        ? "The listing is currently active."
        : "The listing is currently inactive.",
    );
  }
  if (record.status.hasPrice === true || record.entity.price !== undefined) {
    lines.push("The listing has a price.");
  }
  if (record.status.featured === true) {
    lines.push("The listing is featured.");
  }
  if (record.status.violation === true) {
    lines.push("A violation was detected.");
  }
  if (record.timestamp) {
    lines.push(`The CDC event was generated on ${new Date(record.timestamp).toLocaleString()}.`);
  }

  const action = record.cdc.lastEditAction;
  if (action && typeof action === "object" && !Array.isArray(action)) {
    const obj = action as Record<string, unknown>;
    if (obj.action) {
      lines.push(
        `${humanizeAction(safeString(obj.action))} was recorded${
          obj.actor_type ? ` by the ${safeString(obj.actor_type)}` : ""
        }.`,
      );
    }
    if (toBooleanish(obj.is_overlimit)) {
      lines.push("An over-limit condition was also detected.");
    }
  }

  return lines;
}
