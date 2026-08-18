"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  CheckCircle2,
  FilePlus2,
  Layers,
  PenLine,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader, StatCard } from "@/components/shared/ui";
import { formatDuration } from "@/lib/insights/lifecycle";
import { useAppStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils";

const CHART_COLORS = ["#1177c7", "#2fa457", "#c9860b", "#d0403f", "#0d2f4f", "#64758a"];

export function DashboardView() {
  const analysis = useAppStore((s) => s.analysis);
  const setFilters = useAppStore((s) => s.setFilters);
  const setView = useAppStore((s) => s.setView);
  const setSelectedRecord = useAppStore((s) => s.setSelectedRecord);

  if (!analysis) return null;

  const { stats, span } = analysis;
  const qaIssues = analysis.qaInsights.filter((i) => i.severity !== "information");

  const goToRecords = (patch: Parameters<typeof setFilters>[0]) => {
    setFilters(patch);
    setView("records");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="What happened in this CDC export"
        subtitle={
          span.start && span.end
            ? `Activity from ${formatDateTime(span.start)} to ${formatDateTime(span.end)} · ${
                span.durationMs !== undefined ? formatDuration(span.durationMs) : "unknown"
              } of history.`
            : "Timestamps were not detected in this file."
        }
        action={
          <Button variant="outline" onClick={() => setView("timeline")}>
            View full timeline
            <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total records"
          value={formatNumber(stats.totalRecords)}
          hint={`${formatNumber(analysis.lifecycles.length)} unique listings`}
          icon={<Layers className="h-4 w-4" />}
          onClick={() => goToRecords({ operation: "all" })}
        />
        <StatCard
          label="New records"
          value={formatNumber(stats.newRecords)}
          hint="Insert operations"
          tone="info"
          icon={<FilePlus2 className="h-4 w-4" />}
          onClick={() => goToRecords({ operation: "insert" })}
        />
        <StatCard
          label="Updated records"
          value={formatNumber(stats.updatedRecords)}
          hint="Update operations"
          tone="neutral"
          icon={<PenLine className="h-4 w-4" />}
          onClick={() => goToRecords({ operation: "update" })}
        />
        <StatCard
          label="Deleted records"
          value={formatNumber(stats.deletedRecords)}
          hint="Delete operations"
          tone="warning"
          icon={<Trash2 className="h-4 w-4" />}
          onClick={() => goToRecords({ operation: "delete" })}
        />
        <StatCard
          label="Violations"
          value={formatNumber(stats.errorsOrViolations)}
          hint="Records flagged with a violation"
          tone="danger"
          icon={<ShieldAlert className="h-4 w-4" />}
          onClick={() => goToRecords({ violation: "yes" })}
        />
        <StatCard
          label="Active records"
          value={formatNumber(stats.activeRecords)}
          hint="Currently active listings"
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
          onClick={() => goToRecords({ active: "yes" })}
        />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-[var(--os-navy)]">
              Listing status tracker
            </h3>
            <p className="mt-1 text-sm text-[var(--os-muted)]">
              {formatNumber(analysis.statusTracker.changedListings)} listings changed status ·{" "}
              {formatNumber(analysis.statusTracker.multiChangeListings)} changed 3+ times
            </p>
          </div>
          <Button variant="outline" onClick={() => setView("status")}>
            Track listing status
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {analysis.statusTracker.buckets
            .filter((bucket) => bucket.recordCount > 0)
            .sort((a, b) => b.recordCount - a.recordCount)
            .slice(0, 8)
            .map((bucket) => (
              <button
                key={bucket.key}
                onClick={() => setView("status")}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--os-border)] bg-[var(--os-soft)] px-3 py-2 text-sm transition hover:border-[var(--os-blue)] hover:bg-[var(--os-sky)]"
              >
                <Badge tone={bucket.tone} dot>
                  {bucket.label}
                </Badge>
                <span className="tabular font-semibold text-[var(--os-navy)]">
                  {formatNumber(bucket.recordCount)}
                </span>
                <span className="tabular text-xs text-[var(--os-muted)]">
                  events · {formatNumber(bucket.currentCount)} now
                </span>
              </button>
            ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="What should I know?"
            subtitle="Observations calculated from this file only"
            icon={<TriangleAlert className="h-4 w-4" />}
          />
          <ul className="divide-y divide-[var(--os-border)]">
            {analysis.insights.map((insight) => (
              <li key={insight.id} className="px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <Badge tone={insight.severity === "warning" ? "warning" : "brand"} dot>
                    {insight.category}
                  </Badge>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--os-navy)]">{insight.title}</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--os-muted)]">
                      {insight.statement}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Important events"
            subtitle="Rule actions, violations and deletions"
            icon={<ShieldAlert className="h-4 w-4" />}
            action={
              <Button size="sm" variant="ghost" onClick={() => setView("timeline")}>
                Timeline
              </Button>
            }
          />
          <ul className="divide-y divide-[var(--os-border)]">
            {analysis.importantEvents.slice(0, 5).map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--os-navy)]">{event.title}</div>
                  <p className="mt-0.5 text-[13px] text-[var(--os-muted)]">{event.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(event.details).map(([key, value]) => (
                      <Badge key={key} tone="neutral">
                        {key}: {value}
                      </Badge>
                    ))}
                  </div>
                </div>
                <button
                  className="shrink-0 text-[13px] font-medium text-[var(--os-blue)] hover:underline"
                  onClick={() => setSelectedRecord(event.recordUid)}
                >
                  View
                </button>
              </li>
            ))}
            {analysis.importantEvents.length === 0 ? (
              <li className="px-5 py-6 text-sm text-[var(--os-muted)]">
                No rule-engine actions, violations or deletions were found.
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      {qaIssues.length > 0 ? (
        <Card className="border-[#f0d5aa] bg-[var(--os-warning-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[var(--os-warning)]">
                <TriangleAlert className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-[var(--os-navy)]">
                  {formatNumber(qaIssues.length)} QA{" "}
                  {qaIssues.length === 1 ? "finding needs" : "findings need"} review
                </div>
                <p className="mt-0.5 text-[13px] text-[var(--os-muted-strong)]">
                  {qaIssues[0].statement}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setView("qa")}>
              Open QA analysis
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="CDC operations" subtitle="Click a slice to filter records">
          {analysis.charts.operations.length === 0 ? (
            <NoData />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analysis.charts.operations}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={55}
                  outerRadius={88}
                  paddingAngle={2}
                  onClick={(_, index) => {
                    const item = analysis.charts.operations[index];
                    if (item) goToRecords({ operation: item.key });
                  }}
                >
                  {analysis.charts.operations.map((entry, index) => (
                    <Cell key={entry.key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Records by country" subtitle="Based on posting IP country">
          {analysis.charts.country.length === 0 ? (
            <NoData />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.charts.country.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                <XAxis type="number" allowDecimals={false} tick={axisTick} />
                <YAxis type="category" dataKey="label" width={110} tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f8fb" }} />
                <Bar dataKey="value" fill="#1177c7" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Activity by hour" subtitle="When events were captured">
          {analysis.charts.activityByHour.every((d) => d.value === 0) ? (
            <NoData />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.charts.activityByHour}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="key" tick={axisTick} interval={2} />
                <YAxis allowDecimals={false} tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f8fb" }} />
                <Bar dataKey="value" fill="#2fa457" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Records over time" subtitle="Daily event volume">
          {analysis.charts.overTime.length === 0 ? (
            <NoData />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analysis.charts.overTime}>
                <defs>
                  <linearGradient id="volume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1177c7" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1177c7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="label" tick={axisTick} />
                <YAxis allowDecimals={false} tick={axisTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#1177c7"
                  strokeWidth={2}
                  fill="url(#volume)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {analysis.warnings.length > 0 ? (
        <Card className="p-5">
          <div className="text-sm font-semibold text-[var(--os-navy)]">Processing notes</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-[var(--os-muted)]">
            {analysis.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

const axisTick = { fill: "#64758a", fontSize: 12 };

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e9f1",
  boxShadow: "0 12px 32px rgba(16,38,60,0.12)",
  fontSize: 13,
};

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="h-[260px] p-4">{children}</div>
    </Card>
  );
}

function NoData() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-[var(--os-muted)]">
      Not enough data to determine this.
    </div>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
