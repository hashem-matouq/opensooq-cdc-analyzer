"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/shared/ui";
import { getFieldDefinition } from "@/config/field-definitions";
import { formatFieldValue } from "@/lib/formatting/formatters";
import { useAppStore } from "@/lib/store";
import { cn, formatNumber, safeString } from "@/lib/utils";

export function RawDataView() {
  const analysis = useAppStore((s) => s.analysis);
  const [rows, setRows] = useState(100);

  if (!analysis) return null;

  const fields = analysis.fieldsDetected;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Source"
        title="Raw Data"
        subtitle={`${formatNumber(analysis.records.length)} rows and ${formatNumber(fields.length)} fields exactly as extracted from ${analysis.file.name}.`}
      />

      <Card className="overflow-hidden">
        <div className="max-h-[65vh] overflow-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-[var(--os-soft)]">
              <tr className="border-b border-[var(--os-border)]">
                {fields.map((field) => (
                  <th
                    key={field}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] font-semibold uppercase text-[var(--os-muted)]"
                  >
                    {field}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.records.slice(0, rows).map((record, index) => (
                <tr
                  key={record.uid}
                  className={cn(
                    "border-b border-[var(--os-border)]",
                    index % 2 === 1 && "bg-[var(--os-soft)]/60",
                  )}
                >
                  {fields.map((field) => (
                    <td
                      key={field}
                      className="max-w-[220px] truncate px-3 py-2 font-mono text-[var(--os-muted-strong)]"
                      title={safeString(record.raw[field])}
                    >
                      {safeString(record.raw[field]) || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--os-border)] px-4 py-3 text-sm text-[var(--os-muted)]">
          <span>
            Showing {formatNumber(Math.min(rows, analysis.records.length))} of{" "}
            {formatNumber(analysis.records.length)} rows
          </span>
          {rows < analysis.records.length ? (
            <Button size="sm" variant="outline" onClick={() => setRows((r) => r + 200)}>
              Load more rows
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export function CompareView() {
  const analysis = useAppStore((s) => s.analysis);
  const compareA = useAppStore((s) => s.compareA);
  const compareB = useAppStore((s) => s.compareB);
  const setView = useAppStore((s) => s.setView);
  const showSensitive = useAppStore((s) => s.showSensitive);
  const [onlyChanged, setOnlyChanged] = useState(true);

  const left = useMemo(() => analysis?.records.find((r) => r.uid === compareA), [analysis, compareA]);
  const right = useMemo(() => analysis?.records.find((r) => r.uid === compareB), [analysis, compareB]);

  if (!analysis || !left || !right) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-[var(--os-muted)]">
          Select two records in the Records table to compare them.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => setView("records")}>
          Back to records
        </Button>
      </Card>
    );
  }

  const fields = Array.from(new Set([...Object.keys(left.raw), ...Object.keys(right.raw)])).sort();
  const changedFields = fields.filter(
    (field) => safeString(left.raw[field]) !== safeString(right.raw[field]),
  );
  const shown = onlyChanged ? changedFields : fields;

  return (
    <div className="space-y-4">
      <button
        onClick={() => setView("records")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--os-muted)] transition hover:text-[var(--os-blue)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to records
      </button>

      <PageHeader
        eyebrow="Comparison"
        title="Compare records"
        subtitle={`${changedFields.length} of ${fields.length} fields differ between these two CDC records.`}
        action={
          <Button variant="outline" onClick={() => setOnlyChanged((v) => !v)}>
            {onlyChanged ? "Show all fields" : "Show only changes"}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader
          title={`Listing #${left.id ?? "?"} · ${left.uid === right.uid ? "same record" : `vs #${right.id ?? "?"}`}`}
          subtitle="Left column is the earlier selection, right column is the later selection."
        />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--os-soft)]">
              <tr className="border-b border-[var(--os-border)]">
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                  Field
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                  Old
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                  New
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((field) => {
                const a = left.raw[field];
                const b = right.raw[field];
                const changed = safeString(a) !== safeString(b);
                return (
                  <tr
                    key={field}
                    className={cn(
                      "border-b border-[var(--os-border)] last:border-0",
                      changed && "bg-[var(--os-warning-soft)]/60",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--os-navy)]">
                        {getFieldDefinition(field).displayName}
                      </div>
                      <div className="font-mono text-[11px] text-[var(--os-muted)]">{field}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--os-muted-strong)]">
                      {formatFieldValue(field, a, { showSensitive })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          changed ? "font-semibold text-[var(--os-warning)]" : "text-[var(--os-muted-strong)]",
                        )}
                      >
                        {formatFieldValue(field, b, { showSensitive })}
                      </span>
                      {changed ? (
                        <span className="ml-2 align-middle">
                          <Badge tone="warning">changed</Badge>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-sm text-[var(--os-muted)]">
                    These two records are identical across all extracted fields.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
