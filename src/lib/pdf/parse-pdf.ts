import { recordsFromRows } from "@/lib/normalization/normalize";
import { logHistoryRows, parseLogHistory } from "@/lib/pdf/log-history";
import { normalizeKey, safeString } from "@/lib/utils";
import type { CDCRecord } from "@/types/cdc";

export interface PdfParseResult {
  records: CDCRecord[];
  fields: string[];
  pageCount: number;
  warnings: string[];
  scannedLikely: boolean;
}

const CDC_HINTS = [
  "SF_OP",
  "SF_TIMESTAMP",
  "ACTIVE",
  "MEMBERS_ID",
  "CATEGORIES_ID",
  "REQUEST_ID",
  "LAST_EDIT_ACTION",
  "VIOLATION",
  "IS_FEATURED",
];

function looksLikeHeader(line: string): boolean {
  const upper = line.toUpperCase();
  const hits = CDC_HINTS.filter((hint) => upper.includes(hint)).length;
  if (hits >= 2) return true;
  const parts = splitRow(line);
  return parts.length >= 5 && parts.filter((p) => /^[A-Z0-9_]+$/.test(p)).length >= 4;
}

function splitRow(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((p) => p.trim()).filter(Boolean);
  }
  if (line.includes("|")) {
    return line.split("|").map((p) => p.trim()).filter(Boolean);
  }
  // CSV-like in PDF text
  if ((line.match(/,/g) || []).length >= 4) {
    return line.split(",").map((p) => p.trim().replace(/^"|"$/g, "")).filter((p) => p !== "");
  }
  // Multi-space columns
  return line.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
}

function parseKeyValueBlocks(text: string): Record<string, unknown>[] {
  const blocks = text.split(/\n{2,}/);
  const rows: Record<string, unknown>[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const row: Record<string, unknown> = {};

    for (const line of lines) {
      const match = line.match(/^([A-Za-z0-9_]+)\s*[:=]\s*(.+)$/);
      if (match) {
        row[normalizeKey(match[1])] = match[2].trim();
      }
    }

    if (Object.keys(row).length >= 3) {
      rows.push(row);
    }
  }

  return rows;
}

function parseDelimitedTables(text: string): Record<string, unknown>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: Record<string, unknown>[] = [];
  let headers: string[] | null = null;

  for (const line of lines) {
    if (!headers && looksLikeHeader(line)) {
      headers = splitRow(line).map((h) => normalizeKey(h));
      continue;
    }

    if (!headers) continue;

    const values = splitRow(line);
    if (values.length < Math.max(3, Math.floor(headers.length * 0.4))) continue;

    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      row[header] = values[index] ?? "";
    });

    if (Object.values(row).some((v) => safeString(v))) {
      rows.push(row);
    }
  }

  return rows;
}

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
}

const ROW_TOLERANCE = 3;
const COLUMN_GAP = 6;

/**
 * pdf.js returns loose text fragments. Grouping them by baseline and inserting a
 * tab wherever a horizontal gap appears rebuilds the visual rows and columns,
 * without which no table in the document can be parsed.
 */
export function layoutTextItems(items: PdfTextItem[]): string {
  if (items.length === 0) return "";

  const rows: { y: number; items: PdfTextItem[] }[] = [];

  for (const item of [...items].sort((a, b) => b.y - a.y)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= ROW_TOLERANCE);
    if (row) {
      row.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  return rows
    .map((row) => {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      let line = "";
      let cursor: number | undefined;

      for (const item of sorted) {
        const text = item.text.replace(/\s+/g, " ").trim();
        if (!text) continue;
        if (cursor !== undefined) {
          line += item.x - cursor > COLUMN_GAP ? "\t" : " ";
        }
        line += text;
        cursor = item.x + item.width;
      }

      return line.trim();
    })
    .filter(Boolean)
    .join("\n");
}

export function extractRecordsFromPdfText(text: string, pageCount: number): PdfParseResult {
  const warnings: string[] = [];
  const trimmed = text.trim();
  const scannedLikely = trimmed.length < 40 * Math.max(pageCount, 1);

  if (scannedLikely) {
    return {
      records: [],
      fields: [],
      pageCount,
      warnings: [
        "This PDF appears to be scanned. OCR is required to extract the data.",
      ],
      scannedLikely: true,
    };
  }

  const log = parseLogHistory(trimmed);
  const cdcText =
    log.consumedLines.length > 0
      ? trimmed
          .split(/\r?\n/)
          .filter((line) => !log.consumedLines.includes(line.trim()))
          .join("\n")
      : trimmed;

  let rows = parseDelimitedTables(cdcText);
  if (rows.length === 0) {
    rows = parseKeyValueBlocks(cdcText);
  }

  if (rows.length === 0 && log.events.length === 0) {
    // Fallback: try to find JSON-like objects
    const jsonMatches = trimmed.match(/\{[^{}]+\}/g) ?? [];
    for (const chunk of jsonMatches) {
      try {
        const obj = JSON.parse(chunk) as Record<string, unknown>;
        if (Object.keys(obj).length >= 3) rows.push(obj);
      } catch {
        // ignore
      }
    }
  }

  const cdcRecords = recordsFromRows(rows);

  const fallbackListingId = cdcRecords.find((record) => record.id)?.id;
  const statusRows = logHistoryRows(log, fallbackListingId);
  const logRecords = recordsFromRows(statusRows).map((record, index) => ({
    ...record,
    uid: `log-${index}-${record.uid}`,
  }));

  const records = [...cdcRecords, ...logRecords];

  if (records.length === 0) {
    throw new Error("NO_CDC_DATA");
  }

  const hintHits = rows.some((row) =>
    Object.keys(row).some((key) => CDC_HINTS.includes(key.toUpperCase())),
  );
  if (!hintHits && logRecords.length === 0) {
    warnings.push(
      "CDC-like fields were not confidently detected. Records were extracted best-effort.",
    );
  }

  if (logRecords.length > 0) {
    warnings.push(
      `${logRecords.length} status entries were read from the log history table and added to the status timeline.`,
    );
  }
  if (log.unresolvedStatusRows > 0) {
    warnings.push(
      `${log.unresolvedStatusRows} log rows changed the status but did not name the new value (their Diff is not in the PDF text), so they are not counted as status points.`,
    );
  }
  if (logRecords.length > 0 && !log.listingId && !fallbackListingId) {
    warnings.push(
      "No listing ID was found in this PDF, so log-history statuses were grouped by listing title.",
    );
  }

  const fields = Array.from(new Set(records.flatMap((r) => Object.keys(r.raw)))).sort();

  return { records, fields, pageCount, warnings, scannedLikely: false };
}

export async function parsePdfFile(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<PdfParseResult> {
  const pdfjs = await import("pdfjs-dist");

  // Use local worker from the package
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = doc.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= pageCount; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      layoutTextItems(
        content.items.flatMap((item) =>
          "str" in item && item.str
            ? [
                {
                  text: item.str,
                  x: item.transform[4] as number,
                  y: item.transform[5] as number,
                  width: (item.width as number) ?? 0,
                },
              ]
            : [],
        ),
      ),
    );
    onProgress?.(i / pageCount);
  }

  return extractRecordsFromPdfText(pages.join("\n\n"), pageCount);
}
