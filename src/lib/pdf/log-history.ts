import { getListingStatusDefinition } from "@/config/listing-statuses";

export interface LogHistoryEvent {
  name?: string;
  isModerator?: boolean;
  action: string;
  actionOn?: string;
  timestamp?: string;
  statusCode?: string;
  statusLabel?: string;
}

export interface LogHistoryResult {
  events: LogHistoryEvent[];
  /** Rows that clearly touched the status but whose new value could not be resolved. */
  unresolvedStatusRows: number;
  /** Lines already consumed here, so the CDC table parser does not reuse them. */
  consumedLines: string[];
  listingId?: string;
  title?: string;
}

const DATE_PATTERNS = [
  /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/,
  /\d{4}\/\d{2}\/\d{2}[ T]\d{2}:\d{2}(:\d{2})?/,
  /\d{2}\/\d{2}\/\d{4}[ T]\d{2}:\d{2}(:\d{2})?/,
  /\d{4}-\d{2}-\d{2}/,
];

const IGNORED_CELLS = new Set(["view", "diff", "show", "details", "-", "—", "•"]);

function splitCells(line: string): string[] {
  const parts = line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function matchDate(value: string): string | undefined {
  for (const pattern of DATE_PATTERNS) {
    const found = value.match(pattern);
    if (found) return found[0];
  }
  return undefined;
}

export function normalizeLogTimestamp(value: string): string | undefined {
  const raw = matchDate(value);
  if (!raw) return undefined;

  let candidate = raw.replace(" ", "T");
  const dmy = candidate.match(/^(\d{2})\/(\d{2})\/(\d{4})(T.*)?$/);
  if (dmy) {
    candidate = `${dmy[3]}-${dmy[2]}-${dmy[1]}${dmy[4] ?? ""}`;
  }
  candidate = candidate.replace(/^(\d{4})\/(\d{2})\/(\d{2})/, "$1-$2-$3");

  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function isHeaderLine(line: string): boolean {
  const cells = splitCells(line).map((cell) => cell.toLowerCase());
  const joined = cells.join(" ");
  return (
    joined.includes("action") &&
    (joined.includes("action on") || joined.includes("action_on") || joined.includes("date"))
  );
}

function isSectionBreak(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /^(member|post|listing|payment|order|comment|price|package)\b.*information$/.test(lower) ||
    lower.startsWith("member information") ||
    lower.startsWith("post information")
  );
}

/**
 * Rows arrive as Name | Is Moderator | Action | Action On | Diff | Date, but icon
 * columns render as empty text, so cells are matched from the right where the
 * layout is stable.
 */
function parseRow(line: string): LogHistoryEvent | undefined {
  const cells = splitCells(line).filter((cell) => !IGNORED_CELLS.has(cell.toLowerCase()));
  if (cells.length < 2) return undefined;

  const lastCell = cells[cells.length - 1];
  const timestamp = normalizeLogTimestamp(lastCell);
  if (!timestamp) return undefined;

  let rest = cells.slice(0, -1);
  // A date split across two cells leaves a bare date in front of the time.
  if (rest.length > 0 && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rest[rest.length - 1])) {
    rest = rest.slice(0, -1);
  }
  if (rest.length === 0) return undefined;

  const actionOn = rest.length >= 2 ? rest[rest.length - 1] : undefined;
  const action = rest.length >= 2 ? rest[rest.length - 2] : rest[rest.length - 1];
  const nameCells = rest.slice(0, Math.max(0, rest.length - 2));
  const name = nameCells
    .join(" ")
    .replace(/[^\p{L}\p{N}\s#_/.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const definition = getListingStatusDefinition(action);

  return {
    name: name || undefined,
    action,
    actionOn,
    timestamp,
    statusCode: definition?.code,
    statusLabel: definition?.label,
  };
}

/** Single-line fallback for PDFs whose columns collapse into running text. */
function parseLooseRow(line: string): LogHistoryEvent | undefined {
  const timestamp = normalizeLogTimestamp(line);
  if (!timestamp) return undefined;

  const body = line
    .replace(matchDate(line) ?? "", " ")
    .replace(/\bview\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!body) return undefined;

  const actionOnMatch = body.match(/\b([a-z][a-z0-9_]{2,})\s*$/);
  const actionOn = actionOnMatch?.[1];
  const head = actionOn ? body.slice(0, body.length - actionOn.length).trim() : body;

  // Longest known status label wins so "Pending Payment" beats "Pending".
  let best: { code: string; label: string; index: number } | undefined;
  for (const words of [3, 2, 1]) {
    const tokens = head.split(" ");
    for (let i = 0; i + words <= tokens.length; i += 1) {
      const phrase = tokens.slice(i, i + words).join(" ");
      const definition = getListingStatusDefinition(phrase);
      if (definition) {
        best = { code: definition.code, label: definition.label, index: i };
        break;
      }
    }
    if (best) break;
  }

  return {
    action: best?.label ?? head,
    actionOn,
    timestamp,
    statusCode: best?.code,
    statusLabel: best?.label,
  };
}

export function detectListingId(text: string): string | undefined {
  const fromUrl = text.match(/\/post\/(\d{4,})/);
  if (fromUrl) return fromUrl[1];
  const labelled = text.match(/\b(?:post|listing)\s*(?:id)?\s*[#:]?\s*(\d{6,})\b/i);
  if (labelled) return labelled[1];
  return undefined;
}

export function parseLogHistory(text: string): LogHistoryResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const events: LogHistoryEvent[] = [];
  const consumedLines: string[] = [];
  let unresolvedStatusRows = 0;
  let inTable = false;
  let misses = 0;

  for (const line of lines) {
    if (isHeaderLine(line)) {
      inTable = true;
      misses = 0;
      consumedLines.push(line);
      continue;
    }
    if (!inTable) continue;
    if (isSectionBreak(line)) {
      inTable = false;
      continue;
    }

    const event = parseRow(line) ?? parseLooseRow(line);
    if (!event) {
      misses += 1;
      // Tolerate page breaks and repeated headers, but stop at a real new section.
      if (misses > 6) inTable = false;
      continue;
    }

    misses = 0;
    consumedLines.push(line);
    const touchesStatus = (event.actionOn ?? "").toLowerCase().includes("status");
    if (event.statusCode) {
      events.push(event);
    } else if (touchesStatus) {
      unresolvedStatusRows += 1;
      events.push(event);
    }
  }

  const title = events.find((event) => event.name)?.name;

  return {
    events,
    unresolvedStatusRows,
    consumedLines,
    listingId: detectListingId(text),
    title,
  };
}

export function logHistoryRows(
  result: LogHistoryResult,
  fallbackListingId?: string,
): Record<string, unknown>[] {
  const listingId = result.listingId ?? fallbackListingId;

  return result.events
    .filter((event) => event.statusCode)
    .map((event, index) => ({
      ID: listingId ?? "",
      TITLE: event.name ?? result.title ?? "",
      STATUS: event.statusCode ?? "",
      SF_OP: "update",
      SF_TIMESTAMP: event.timestamp ?? "",
      REQUEST_ID: `log-${index + 1}`,
      LOG_ACTION: event.action,
      LOG_ACTION_ON: event.actionOn ?? "status",
      SOURCE: "LOG_HISTORY",
    }));
}
