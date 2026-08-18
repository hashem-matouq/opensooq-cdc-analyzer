import Papa from "papaparse";
import { recordsFromRows } from "@/lib/normalization/normalize";
import type { CDCRecord } from "@/types/cdc";

export interface CsvParseResult {
  records: CDCRecord[];
  fields: string[];
  warnings: string[];
}

export function parseCsvText(text: string): CsvParseResult {
  const warnings: string[] = [];
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    warnings.push(
      ...parsed.errors.slice(0, 5).map((err) => `CSV parse note: ${err.message}`),
    );
  }

  const rows = (parsed.data ?? []).filter((row) =>
    Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== ""),
  );

  if (rows.length === 0) {
    throw new Error("NO_CDC_DATA");
  }

  const records = recordsFromRows(rows);
  const fields = Array.from(
    new Set(records.flatMap((r) => Object.keys(r.raw))),
  ).sort();

  return { records, fields, warnings };
}

export async function parseCsvFile(file: File): Promise<CsvParseResult> {
  const text = await file.text();
  return parseCsvText(text);
}
