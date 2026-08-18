"use client";

import { Activity, ArrowRight, ShieldAlert } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, EvidenceNote, PageHeader } from "@/components/shared/ui";
import { useAppStore } from "@/lib/store";
import type { InsightSeverity } from "@/types/cdc";

const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  information: "Information",
  warning: "Warning",
  potential_issue: "Potential issue",
};

const SEVERITY_TONE: Record<InsightSeverity, "brand" | "warning" | "danger"> = {
  information: "brand",
  warning: "warning",
  potential_issue: "danger",
};

export function InsightsView() {
  const analysis = useAppStore((s) => s.analysis);
  if (!analysis) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Analysis"
        title="Insights"
        subtitle="Deterministic observations calculated from this file. Nothing here is inferred or invented."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {analysis.insights.map((insight) => (
          <Card key={insight.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={SEVERITY_TONE[insight.severity]} dot>
                {SEVERITY_LABEL[insight.severity]}
              </Badge>
              <Badge tone="neutral">{insight.category}</Badge>
            </div>
            <h3 className="font-display mt-3 text-base font-semibold text-[var(--os-navy)]">
              {insight.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--os-muted)]">
              {insight.statement}
            </p>
            <EvidenceNote items={insight.evidence} />
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Change detection"
          subtitle="What actually changed for listings that appear more than once"
          icon={<Activity className="h-4 w-4" />}
        />
        {analysis.changeGroups.length === 0 ? (
          <div className="px-5 py-6 text-sm text-[var(--os-muted)]">
            Not enough data to determine this. Each listing appears only once in this file.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--os-border)]">
            {analysis.changeGroups.slice(0, 25).map((group) => (
              <li key={group.listingId} className="px-5 py-4">
                <div className="text-sm font-semibold text-[var(--os-navy)]">
                  Listing #{group.listingId}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {group.changes.map((change) => (
                    <li
                      key={change.field}
                      className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--os-muted)]"
                    >
                      <span className="font-mono text-[11px] uppercase text-[var(--os-muted-strong)]">
                        {change.field}
                      </span>
                      <span className="font-mono text-[12px]">{String(change.oldValue ?? "—")}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-mono text-[12px] font-medium text-[var(--os-navy)]">
                        {String(change.newValue ?? "—")}
                      </span>
                      <span>— {change.interpretation}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function QaView() {
  const analysis = useAppStore((s) => s.analysis);
  if (!analysis) return null;

  const issues = analysis.qaInsights.filter((i) => i.severity !== "information");
  const notes = analysis.qaInsights.filter((i) => i.severity === "information");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Quality"
        title="QA Analysis"
        subtitle="Anomalies are reported only when the data supports them, and are never labelled as bugs."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--os-muted)]">
            Findings needing review
          </div>
          <div className="tabular mt-1.5 text-2xl font-semibold text-[var(--os-navy)]">
            {issues.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--os-muted)]">
            Informational notes
          </div>
          <div className="tabular mt-1.5 text-2xl font-semibold text-[var(--os-navy)]">
            {notes.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--os-muted)]">
            Listings analysed
          </div>
          <div className="tabular mt-1.5 text-2xl font-semibold text-[var(--os-navy)]">
            {analysis.lifecycles.length}
          </div>
        </Card>
      </div>

      {analysis.qaInsights.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" />}
          title="No QA findings"
          description="No anomalies were detected in the uploaded data."
        />
      ) : (
        <div className="space-y-3">
          {[...issues, ...notes].map((insight) => (
            <Card key={insight.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={SEVERITY_TONE[insight.severity]} dot>
                  {SEVERITY_LABEL[insight.severity]}
                </Badge>
                <Badge tone="neutral">{insight.category}</Badge>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-[var(--os-navy)]">{insight.title}</h3>
              <p className="mt-1 text-sm text-[var(--os-muted)]">{insight.statement}</p>
              <EvidenceNote items={insight.evidence} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
