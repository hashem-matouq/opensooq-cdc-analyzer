"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  Clock3,
  Info,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, KeyValue, PageHeader, Segmented } from "@/components/shared/ui";
import { CATEGORY_ORDER, getFieldDefinition } from "@/config/field-definitions";
import { explainRecord } from "@/lib/insights/engine";
import { formatDuration } from "@/lib/insights/lifecycle";
import { listingStatusTone } from "@/config/listing-statuses";
import {
  formatFieldValue,
  formatJsonAction,
  formatOperation,
  formatStatus,
} from "@/lib/formatting/formatters";
import { useAppStore } from "@/lib/store";
import { cn, safeString } from "@/lib/utils";
import type { ViewMode } from "@/types/cdc";

export function RecordDetailView() {
  const analysis = useAppStore((s) => s.analysis);
  const selectedRecordUid = useAppStore((s) => s.selectedRecordUid);
  const setSelectedRecord = useAppStore((s) => s.setSelectedRecord);
  const setView = useAppStore((s) => s.setView);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const showSensitive = useAppStore((s) => s.showSensitive);

  const [explainOpen, setExplainOpen] = useState(true);
  const [fieldHelp, setFieldHelp] = useState<string | null>(null);
  const [techOpen, setTechOpen] = useState(false);

  const record = useMemo(
    () => analysis?.records.find((r) => r.uid === selectedRecordUid),
    [analysis, selectedRecordUid],
  );

  const lifecycle = useMemo(
    () => analysis?.lifecycles.find((l) => l.recordUids.includes(selectedRecordUid ?? "")),
    [analysis, selectedRecordUid],
  );

  if (!analysis || !record) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-[var(--os-muted)]">This record is no longer available.</p>
        <Button className="mt-4" variant="outline" onClick={() => setView("records")}>
          Back to records
        </Button>
      </Card>
    );
  }

  const grouped = groupFields(Object.keys(record.raw));
  const explanation = explainRecord(record);
  const action = record.cdc.lastEditAction;
  const actionDetails =
    action && typeof action === "object" ? formatJsonAction(action) : null;

  return (
    <div className="space-y-4">
      <button
        onClick={() => setSelectedRecord(null)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--os-muted)] transition hover:text-[var(--os-blue)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to records
      </button>

      <PageHeader
        eyebrow={`CDC ${formatOperation(record.operation)}`}
        title={`Listing #${record.id ?? "unknown"}`}
        subtitle={record.entity.title || "No title captured on this record."}
        action={
          <Segmented
            ariaLabel="Data presentation"
            value={viewMode}
            onChange={(value: ViewMode) => setViewMode(value)}
            options={[
              { value: "human", label: "Human view" },
              { value: "raw", label: "Raw view" },
            ]}
          />
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone={record.operation === "delete" ? "danger" : record.operation === "insert" ? "success" : "brand"} dot>
          {formatOperation(record.operation)}
        </Badge>
        {record.status.status !== undefined ? (
          <Badge tone={listingStatusTone(record.status.status)} dot>
            Listing status: {formatStatus(record.status.status)} ({String(record.status.status)})
          </Badge>
        ) : null}
        {record.status.active !== undefined ? (
          <Badge tone={record.status.active ? "success" : "neutral"}>
            {record.status.active ? "Active" : "Inactive"}
          </Badge>
        ) : null}
        {record.status.featured ? <Badge tone="brand">Featured</Badge> : null}
        {record.status.violation ? <Badge tone="danger">Violation detected</Badge> : null}
        {record.status.firstLive ? <Badge tone="neutral">First time live</Badge> : null}
        {record.timestamp ? (
          <Badge tone="neutral">{formatFieldValue("SF_TIMESTAMP", record.timestamp)}</Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader
          title="Explain this record"
          subtitle="Plain-language summary built only from values present in this record"
          icon={<Sparkles className="h-4 w-4" />}
          action={
            <Button size="sm" variant="ghost" onClick={() => setExplainOpen((v) => !v)}>
              <ChevronDown className={cn("h-4 w-4 transition", explainOpen && "rotate-180")} />
              {explainOpen ? "Hide" : "Show"}
            </Button>
          }
        />
        {explainOpen ? (
          <div className="px-5 py-4">
            <ul className="space-y-1.5">
              {explanation.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-[var(--os-muted-strong)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--os-blue)]" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl bg-[var(--os-soft)] px-3 py-2.5">
              <div className="text-xs font-semibold text-[var(--os-navy)]">Why am I seeing this?</div>
              <div className="mt-1 font-mono text-[11px] leading-relaxed text-[var(--os-muted)]">
                SF_OP = {safeString(record.raw.SF_OP ?? record.operation)}
                {action && typeof action === "object" && "action" in (action as object)
                  ? ` · LAST_EDIT_ACTION.action = ${safeString((action as Record<string, unknown>).action)}`
                  : ""}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {lifecycle ? (
        <Card>
          <CardHeader
            title="Listing journey"
            subtitle={lifecycle.headline}
            icon={<Clock3 className="h-4 w-4" />}
            action={
              <Button size="sm" variant="ghost" onClick={() => setView("timeline")}>
                Full timeline
              </Button>
            }
          />
          <div className="px-5 py-4">
            <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--os-muted)]">
              <span>
                Began{" "}
                <span className="font-medium text-[var(--os-navy)]">
                  {lifecycle.start ? formatFieldValue("SF_TIMESTAMP", lifecycle.start) : "Unknown"}
                </span>
              </span>
              <span>
                Ended{" "}
                <span className="font-medium text-[var(--os-navy)]">
                  {lifecycle.end ? formatFieldValue("SF_TIMESTAMP", lifecycle.end) : "Unknown"}
                </span>
              </span>
              <span>
                Span{" "}
                <span className="font-medium text-[var(--os-navy)]">
                  {lifecycle.durationMs !== undefined ? formatDuration(lifecycle.durationMs) : "—"}
                </span>
              </span>
            </div>
            <ol className="timeline-rail space-y-2">
              {lifecycle.steps.map((step) => (
                <li key={step.id} className="relative pl-11">
                  <span
                    className={cn(
                      "absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ring-4 ring-white",
                      step.recordUid === record.uid
                        ? "bg-[var(--os-blue)] text-white"
                        : "bg-[var(--os-soft)] text-[var(--os-muted)]",
                    )}
                  >
                    {step.recordUid === record.uid ? "•" : ""}
                  </span>
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2",
                      step.recordUid === record.uid && "bg-[var(--os-sky)]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--os-navy)]">{step.title}</span>
                      <Badge tone={listingStatusTone(step.statusCode)} dot>
                        Status: {step.statusLabel}
                        {step.statusCode ? ` (${step.statusCode})` : ""}
                      </Badge>
                      <span className="tabular text-xs text-[var(--os-muted)]">
                        {step.timestamp ? formatFieldValue("SF_TIMESTAMP", step.timestamp) : "no timestamp"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-[var(--os-muted)]">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      ) : null}

      {viewMode === "raw" ? (
        <Card>
          <CardHeader title="Raw CDC fields" subtitle="Exactly as extracted from the file" />
          <div className="grid gap-2 p-5 md:grid-cols-2">
            {Object.entries(record.raw).map(([field, value]) => (
              <div key={field} className="rounded-xl border border-[var(--os-border)] px-3 py-2">
                <div className="font-mono text-[11px] uppercase text-[var(--os-muted)]">{field}</div>
                <div className="mt-1 break-words font-mono text-[12px] text-[var(--os-navy)]">
                  {safeString(value) || "—"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <>
          {CATEGORY_ORDER.filter(
            (category) => category !== "Technical Information" && grouped[category]?.length,
          ).map((category) => (
            <Card key={category}>
              <CardHeader title={category} />
              <div className="grid gap-2 p-5 md:grid-cols-2 xl:grid-cols-3">
                {grouped[category].map((field) => (
                  <KeyValue
                    key={field}
                    label={getFieldDefinition(field).displayName}
                    value={formatFieldValue(field, record.raw[field], {
                      showSensitive,
                      currency: record.entity.currency,
                    })}
                    help={
                      <button
                        aria-label={`Explain ${field}`}
                        onClick={() => setFieldHelp(field)}
                        className="text-[var(--os-muted)] transition hover:text-[var(--os-blue)]"
                      >
                        <CircleHelp className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                ))}
              </div>
            </Card>
          ))}

          {actionDetails && typeof actionDetails === "object" ? (
            <Card>
              <CardHeader
                title="Last edit action"
                subtitle="Structured JSON translated into readable values"
                icon={<Info className="h-4 w-4" />}
              />
              <div className="grid gap-2 p-5 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(actionDetails).map(([label, value]) => (
                  <KeyValue key={label} label={label} value={value} />
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <button
              className="flex w-full items-center justify-between px-5 py-4 text-left"
              onClick={() => setTechOpen((v) => !v)}
              aria-expanded={techOpen}
            >
              <span>
                <span className="font-display block text-base font-semibold text-[var(--os-navy)]">
                  Technical details
                </span>
                <span className="text-sm text-[var(--os-muted)]">
                  {(grouped["Technical Information"] || []).length} lower-priority fields
                </span>
              </span>
              <ChevronDown className={cn("h-4 w-4 transition", techOpen && "rotate-180")} />
            </button>
            {techOpen ? (
              <div className="grid gap-2 border-t border-[var(--os-border)] p-5 md:grid-cols-2 xl:grid-cols-3">
                {(grouped["Technical Information"] || []).map((field) => (
                  <KeyValue
                    key={field}
                    label={getFieldDefinition(field).displayName}
                    value={formatFieldValue(field, record.raw[field], { showSensitive })}
                    help={
                      <button
                        aria-label={`Explain ${field}`}
                        onClick={() => setFieldHelp(field)}
                        className="text-[var(--os-muted)] transition hover:text-[var(--os-blue)]"
                      >
                        <CircleHelp className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                ))}
              </div>
            ) : null}
          </Card>
        </>
      )}

      {fieldHelp ? (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4 md:right-6 md:left-auto md:bottom-6 md:w-[380px] md:p-0">
          <Card className="border-[var(--os-blue)] p-5 shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-3">
              <div className="font-mono text-[11px] uppercase tracking-wide text-[var(--os-muted)]">
                {getFieldDefinition(fieldHelp).fieldName}
              </div>
              <button
                onClick={() => setFieldHelp(null)}
                aria-label="Close field explanation"
                className="text-[var(--os-muted)] hover:text-[var(--os-navy)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="font-display mt-1 text-base font-semibold text-[var(--os-navy)]">
              What does this mean?
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--os-muted)]">
              {getFieldDefinition(fieldHelp).description}
            </p>
            <div className="mt-3 space-y-2">
              <KeyValue label="Raw value" value={safeString(record.raw[fieldHelp]) || "—"} />
              <KeyValue
                label="Meaning"
                value={formatFieldValue(fieldHelp, record.raw[fieldHelp], {
                  showSensitive,
                  currency: record.entity.currency,
                })}
              />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function groupFields(fields: string[]) {
  const grouped: Record<string, string[]> = {};
  for (const field of fields) {
    const category = getFieldDefinition(field).category;
    grouped[category] = grouped[category] || [];
    grouped[category].push(field);
  }
  return grouped;
}
