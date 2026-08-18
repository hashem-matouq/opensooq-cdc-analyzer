import * as XLSX from "xlsx";
import type { CDCRecord } from "@/types/cdc";
import { formatFieldValue } from "@/lib/formatting/formatters";

export function exportJson(records: CDCRecord[], filename: string) {
  downloadBlob(
    new Blob([JSON.stringify(records.map((r) => r.raw), null, 2)], {
      type: "application/json",
    }),
    `${filename}.json`,
  );
}

export function exportCsv(records: CDCRecord[], fields: string[], filename: string) {
  const header = fields.join(",");
  const lines = records.map((record) =>
    fields
      .map((field) => csvEscape(String(record.raw[field] ?? "")))
      .join(","),
  );
  downloadBlob(new Blob([[header, ...lines].join("\n")], { type: "text/csv" }), `${filename}.csv`);
}

export function exportExcel(records: CDCRecord[], fields: string[], filename: string) {
  const rows = records.map((record) => {
    const row: Record<string, unknown> = {};
    for (const field of fields) {
      row[field] = record.raw[field] ?? "";
    }
    return row;
  });
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "CDC");
  XLSX.writeFile(book, `${filename}.xlsx`);
}

export function exportPdfSummary(
  summaryLines: string[],
  filename: string,
) {
  const content = summaryLines.join("\n");
  downloadBlob(new Blob([content], { type: "text/plain" }), `${filename}-summary.txt`);
}

export function buildHumanRows(records: CDCRecord[], fields: string[]) {
  return records.map((record) => {
    const row: Record<string, string> = {};
    for (const field of fields) {
      row[field] = formatFieldValue(field, record.raw[field], {
        currency: record.entity.currency,
      });
    }
    return row;
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
