import type { StatusTone } from "@/config/listing-statuses";

export type EvidenceCategory = "FACT" | "DERIVED" | "INTERPRETATION" | "POTENTIAL_ISSUE";

export type InsightSeverity = "information" | "warning" | "potential_issue";

export type CDCOperation = "insert" | "update" | "delete" | "unknown";

export interface FieldDefinition {
  fieldName: string;
  displayName: string;
  description: string;
  category: string;
  dataType: "string" | "number" | "boolean" | "enum" | "date" | "json" | "currency" | "country" | "language" | "unknown";
  formatter?: string;
  sensitive?: boolean;
}

export interface CDCRecord {
  uid: string;
  id?: string;
  operation?: CDCOperation;
  timestamp?: string;
  entity: {
    title?: string;
    description?: string;
    price?: number;
    currency?: string;
    category?: string;
    categoryId?: string;
    cityId?: string;
    country?: string;
    countryId?: string;
    language?: string;
    phone?: string;
    email?: string;
  };
  status: {
    active?: boolean;
    status?: string | number;
    featured?: boolean;
    highlighted?: boolean;
    violation?: boolean;
    firstLive?: boolean;
    hasPrice?: boolean;
  };
  user: {
    memberId?: string;
  };
  cdc: {
    requestId?: string;
    lastEditAction?: unknown;
    recordInsertDate?: string;
    recordUpdateDate?: string;
    recordExpirationDate?: string;
    postInsertIpCountry?: string;
    postUpdateIpCountry?: string;
    numberOfTimesReposted?: number;
    postSource?: string;
    postType?: string;
  };
  raw: Record<string, unknown>;
}

export interface TimelineEvent {
  id: string;
  recordUid: string;
  listingId?: string;
  timestamp?: string;
  title: string;
  description: string;
  category: EvidenceCategory;
  severity: InsightSeverity;
  evidence: string[];
}

export interface ImportantEvent {
  id: string;
  recordUid: string;
  listingId?: string;
  title: string;
  summary: string;
  details: Record<string, string>;
  severity: InsightSeverity;
  evidence: string[];
}

export interface InsightItem {
  id: string;
  title: string;
  statement: string;
  severity: InsightSeverity;
  category: EvidenceCategory;
  evidence: string[];
}

export type StepKind =
  | "created"
  | "activated"
  | "deactivated"
  | "updated"
  | "price"
  | "status"
  | "violation"
  | "rule"
  | "featured"
  | "category"
  | "reposted"
  | "expired"
  | "deleted"
  | "event";

export interface LifecycleStep {
  id: string;
  recordUid: string;
  listingId: string;
  timestamp?: string;
  statusCode?: string;
  statusLabel: string;
  offsetFromStartMs?: number;
  gapFromPreviousMs?: number;
  kind: StepKind;
  title: string;
  detail: string;
  category: EvidenceCategory;
  severity: InsightSeverity;
  changes: FieldChange[];
  evidence: string[];
  operation?: CDCOperation;
  isPrimary: boolean;
}

export interface Lifecycle {
  listingId: string;
  title?: string;
  steps: LifecycleStep[];
  recordUids: string[];
  start?: string;
  end?: string;
  durationMs?: number;
  totalEvents: number;
  totalRecords: number;
  finalState: {
    active?: boolean;
    status?: string;
    violation: boolean;
    deleted: boolean;
  };
  headline: string;
  severity: InsightSeverity;
}

export interface FieldChange {
  field: string;
  displayName: string;
  oldValue: unknown;
  newValue: unknown;
  interpretation: string;
}

export interface ListingChangeGroup {
  listingId: string;
  recordUids: string[];
  changes: FieldChange[];
  summary: string[];
}

/** One entry per CDC record: the complete status history, not just the changes. */
export interface StatusPoint {
  position: number;
  recordUid: string;
  status?: string;
  label: string;
  tone: StatusTone;
  timestamp?: string;
  operation?: CDCOperation;
  active?: boolean;
  changed: boolean;
  previousStatus?: string;
  previousLabel?: string;
  gapFromPreviousMs?: number;
  source: "cdc" | "log";
  logAction?: string;
}

export interface StatusTransition {
  from?: string;
  fromLabel: string;
  to?: string;
  toLabel: string;
  timestamp?: string;
  recordUid: string;
  activeBefore?: boolean;
  activeAfter?: boolean;
}

export interface ListingStatusTrack {
  listingId: string;
  matchedBy: "id" | "title-member" | "row";
  title?: string;
  currentStatus?: string;
  currentLabel: string;
  currentTone: StatusTone;
  previousStatus?: string;
  previousLabel?: string;
  currentActive?: boolean;
  changeCount: number;
  distinctStatusCount: number;
  statusesSeen: string[];
  points: StatusPoint[];
  transitions: StatusTransition[];
  firstSeen?: string;
  lastChanged?: string;
  severity: InsightSeverity;
  recordUids: string[];
}

export interface StatusBucket {
  key: string;
  label: string;
  tone: StatusTone;
  /** Listings whose latest record carries this status. */
  currentCount: number;
  /** Listings that held this status at any point in the file. */
  everCount: number;
  /** CDC records carrying this status. */
  recordCount: number;
}

export interface StatusTrackerResult {
  buckets: StatusBucket[];
  tracks: ListingStatusTrack[];
  totalListings: number;
  changedListings: number;
  multiChangeListings: number;
  statusRecords: number;
  unknownStatusRecords: number;
}

export interface DashboardStats {
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  deletedRecords: number;
  errorsOrViolations: number;
  activeRecords: number;
  unknownOperations: number;
}

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
}

export interface ProcessingStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

export interface SourceFileMeta {
  name: string;
  size: number;
  type: "pdf" | "csv";
  pageCount?: number;
  uploadedAt: string;
}

export interface AnalysisResult {
  file: SourceFileMeta;
  records: CDCRecord[];
  fieldsDetected: string[];
  stats: DashboardStats;
  insights: InsightItem[];
  qaInsights: InsightItem[];
  importantEvents: ImportantEvent[];
  timeline: TimelineEvent[];
  lifecycles: Lifecycle[];
  globalTimeline: LifecycleStep[];
  span: { start?: string; end?: string; durationMs?: number };
  changeGroups: ListingChangeGroup[];
  statusTracker: StatusTrackerResult;
  charts: {
    operations: ChartDatum[];
    status: ChartDatum[];
    country: ChartDatum[];
    language: ChartDatum[];
    overTime: ChartDatum[];
    violationsOverTime: ChartDatum[];
    activityByHour: ChartDatum[];
  };
  warnings: string[];
}

export interface FilterState {
  search: string;
  operation: string;
  status: string;
  active: string;
  country: string;
  language: string;
  violation: string;
  featured: string;
  dateFrom: string;
  dateTo: string;
}

export type ViewMode = "human" | "raw";
export type AppView =
  | "upload"
  | "processing"
  | "dashboard"
  | "records"
  | "timeline"
  | "status"
  | "insights"
  | "qa"
  | "raw"
  | "compare"
  | "record-detail";
