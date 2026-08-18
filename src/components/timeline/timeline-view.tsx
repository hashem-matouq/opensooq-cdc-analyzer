"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  FolderTree,
  Gavel,
  PauseCircle,
  PenLine,
  Plus,
  RefreshCw,
  ShieldAlert,
  Shuffle,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, Segmented } from "@/components/shared/ui";
import { formatDuration } from "@/lib/insights/lifecycle";
import { listingStatusTone } from "@/config/listing-statuses";
import { useAppStore } from "@/lib/store";
import { cn, formatNumber } from "@/lib/utils";
import type { InsightSeverity, Lifecycle, LifecycleStep, StepKind } from "@/types/cdc";

const PAGE_SIZE = 120;

const KIND_META: Record<
  StepKind,
  { icon: React.ComponentType<{ className?: string }>; label: string; tone: "brand" | "success" | "warning" | "danger" | "neutral" }
> = {
  created: { icon: Plus, label: "Created", tone: "brand" },
  activated: { icon: CheckCircle2, label: "Activated", tone: "success" },
  deactivated: { icon: PauseCircle, label: "Deactivated", tone: "warning" },
  updated: { icon: PenLine, label: "Updated", tone: "neutral" },
  price: { icon: Tag, label: "Price", tone: "brand" },
  status: { icon: Shuffle, label: "Status", tone: "brand" },
  violation: { icon: ShieldAlert, label: "Violation", tone: "danger" },
  rule: { icon: Gavel, label: "Rule engine", tone: "warning" },
  featured: { icon: Star, label: "Featured", tone: "brand" },
  category: { icon: FolderTree, label: "Category", tone: "neutral" },
  reposted: { icon: RefreshCw, label: "Repost", tone: "neutral" },
  expired: { icon: CalendarClock, label: "Expiry", tone: "warning" },
  deleted: { icon: Trash2, label: "Deleted", tone: "danger" },
  event: { icon: CircleDot, label: "Event", tone: "neutral" },
};

const SEVERITY_TONE: Record<InsightSeverity, "brand" | "warning" | "danger"> = {
  information: "brand",
  warning: "warning",
  potential_issue: "danger",
};

export function TimelineView() {
  const analysis = useAppStore((s) => s.analysis);
  const [mode, setMode] = useState<"all" | "listing">("all");
  const [kindFilter, setKindFilter] = useState<"all" | "key" | "issues">("key");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const steps = useMemo(() => {
    if (!analysis) return [];
    return analysis.globalTimeline.filter((step) => matches(step, kindFilter, query));
  }, [analysis, kindFilter, query]);

  const lifecycles = useMemo(() => {
    if (!analysis) return [];
    if (!query.trim()) return analysis.lifecycles;
    const q = query.trim().toLowerCase();
    return analysis.lifecycles.filter(
      (lifecycle) =>
        lifecycle.listingId.toLowerCase().includes(q) ||
        (lifecycle.title ?? "").toLowerCase().includes(q),
    );
  }, [analysis, query]);

  if (!analysis) return null;

  const span = analysis.span;
  const grouped = groupByDay(steps.slice(0, visible));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Full history"
        title="Event Timeline"
        subtitle="Every CDC event from the first record to the last, replayed as a readable sequence."
        action={
          <Segmented
            ariaLabel="Timeline mode"
            value={mode}
            onChange={(value) => {
              setMode(value);
              setVisible(PAGE_SIZE);
            }}
            options={[
              { value: "all", label: "All activity" },
              { value: "listing", label: "By listing" },
            ]}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SpanCard
          label="Timeline starts"
          value={span.start ? formatDateTime(span.start) : "Unknown"}
          hint="First captured event"
        />
        <SpanCard
          label="Timeline ends"
          value={span.end ? formatDateTime(span.end) : "Unknown"}
          hint="Last captured event"
        />
        <SpanCard
          label="Total span"
          value={span.durationMs !== undefined ? formatDuration(span.durationMs) : "—"}
          hint="Beginning to end"
        />
        <SpanCard
          label="Events"
          value={formatNumber(analysis.globalTimeline.length)}
          hint={`Across ${formatNumber(analysis.lifecycles.length)} listings`}
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Filter by listing ID or title..."
            aria-label="Filter timeline"
            className="min-w-[220px] flex-1 rounded-xl border border-[var(--os-border)] bg-[var(--os-soft)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--os-blue)] focus:bg-white"
          />
          {mode === "all" ? (
            <Segmented
              ariaLabel="Event detail level"
              value={kindFilter}
              onChange={(value) => {
                setKindFilter(value);
                setVisible(PAGE_SIZE);
              }}
              options={[
                { value: "key", label: "Key events" },
                { value: "all", label: "Everything" },
                { value: "issues", label: "Issues only" },
              ]}
            />
          ) : null}
        </div>
      </Card>

      {mode === "all" ? (
        steps.length === 0 ? (
          <EmptyState
            icon={<Clock3 className="h-6 w-6" />}
            title="No events match this view"
            description="Try switching to Everything, or clear the listing filter."
          />
        ) : (
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-[var(--os-muted)]">
                Showing {formatNumber(Math.min(visible, steps.length))} of{" "}
                {formatNumber(steps.length)} events
              </span>
              {visible < steps.length ? (
                <Button size="sm" variant="ghost" onClick={() => setVisible(steps.length)}>
                  <ArrowDownToLine className="h-4 w-4" />
                  Jump to end
                </Button>
              ) : (
                <Badge tone="success" dot>
                  Complete history shown
                </Badge>
              )}
            </div>

            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.day}>
                  <div className="sticky top-16 z-10 -mx-5 mb-3 bg-white/95 px-5 py-1.5 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--os-navy)]">
                        {group.label}
                      </span>
                      <span className="tabular text-xs text-[var(--os-muted)]">
                        {formatNumber(group.steps.length)} events
                      </span>
                    </div>
                  </div>
                  <ol className="timeline-rail space-y-1">
                    {group.steps.map((step) => (
                      <StepRow key={step.id} step={step} showListing />
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            {visible < steps.length ? (
              <div className="mt-5 flex justify-center">
                <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Load {formatNumber(Math.min(PAGE_SIZE, steps.length - visible))} more events
                </Button>
              </div>
            ) : null}
          </Card>
        )
      ) : lifecycles.length === 0 ? (
        <EmptyState
          icon={<Clock3 className="h-6 w-6" />}
          title="No listings match"
          description="Try a different listing ID or title."
        />
      ) : (
        <div className="space-y-4">
          {lifecycles.slice(0, visible).map((lifecycle) => (
            <LifecycleCard key={lifecycle.listingId} lifecycle={lifecycle} />
          ))}
          {visible < lifecycles.length ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Load more listings
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SpanCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--os-muted)]">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-[var(--os-navy)]">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--os-muted)]">{hint}</div>
    </Card>
  );
}

function LifecycleCard({ lifecycle }: { lifecycle: Lifecycle }) {
  const [open, setOpen] = useState(false);
  const setSelectedRecord = useAppStore((s) => s.setSelectedRecord);
  const preview = lifecycle.steps.filter((s) => s.isPrimary || s.severity !== "information");
  const shown = open ? lifecycle.steps : preview.slice(0, 4);

  return (
    <Card interactive>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--os-border)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-[var(--os-navy)]">
              Listing #{lifecycle.listingId}
            </h3>
            <Badge tone={SEVERITY_TONE[lifecycle.severity]} dot>
              {lifecycle.finalState.deleted
                ? "Deleted"
                : lifecycle.finalState.active === true
                  ? "Active"
                  : lifecycle.finalState.active === false
                    ? "Inactive"
                    : "State unknown"}
            </Badge>
            {lifecycle.finalState.violation ? <Badge tone="danger">Violation</Badge> : null}
          </div>
          {lifecycle.title ? (
            <p className="mt-1 truncate text-sm text-[var(--os-muted)]">{lifecycle.title}</p>
          ) : null}
          <p className="mt-1.5 text-[13px] text-[var(--os-muted)]">{lifecycle.headline}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <div className="tabular text-sm font-semibold text-[var(--os-navy)]">
            {lifecycle.durationMs !== undefined ? formatDuration(lifecycle.durationMs) : "—"}
          </div>
          <div className="text-xs text-[var(--os-muted)]">start → end</div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--os-muted)]">
          <span>
            Began{" "}
            <span className="font-medium text-[var(--os-navy)]">
              {lifecycle.start ? formatDateTime(lifecycle.start) : "Unknown"}
            </span>
          </span>
          <span>
            Ended{" "}
            <span className="font-medium text-[var(--os-navy)]">
              {lifecycle.end ? formatDateTime(lifecycle.end) : "Unknown"}
            </span>
          </span>
          <span>
            <span className="tabular font-medium text-[var(--os-navy)]">
              {lifecycle.totalRecords}
            </span>{" "}
            CDC records
          </span>
        </div>

        <ol className="timeline-rail space-y-1">
          {shown.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </ol>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {lifecycle.steps.length > shown.length || open ? (
            <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
              <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
              {open
                ? "Collapse journey"
                : `Show full journey (${lifecycle.steps.length} events)`}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedRecord(lifecycle.recordUids[lifecycle.recordUids.length - 1])}
          >
            Open latest record
          </Button>
        </div>
      </div>
    </Card>
  );
}

function StepRow({ step, showListing = false }: { step: LifecycleStep; showListing?: boolean }) {
  const [open, setOpen] = useState(false);
  const setSelectedRecord = useAppStore((s) => s.setSelectedRecord);
  const meta = KIND_META[step.kind];
  const Icon = meta.icon;
  const hasDetail = step.changes.length > 0 || step.evidence.length > 0;

  const iconTone = {
    brand: "bg-[var(--os-sky)] text-[var(--os-blue)]",
    success: "bg-[var(--os-green-soft)] text-[var(--os-green)]",
    warning: "bg-[var(--os-warning-soft)] text-[var(--os-warning)]",
    danger: "bg-[var(--os-danger-soft)] text-[var(--os-danger)]",
    neutral: "bg-[var(--os-soft)] text-[var(--os-muted-strong)]",
  }[meta.tone];

  return (
    <li className="relative pl-11">
      <span
        className={cn(
          "absolute left-0 top-2 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white",
          iconTone,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="rounded-xl px-3 py-2 transition hover:bg-[var(--os-soft)]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-[var(--os-navy)]">{step.title}</span>
          {showListing ? (
            <span className="tabular text-xs text-[var(--os-muted)]">#{step.listingId}</span>
          ) : null}
          <span className="tabular text-xs text-[var(--os-muted)]">
            {step.timestamp ? formatTime(step.timestamp) : "no timestamp"}
          </span>
          <Badge tone={listingStatusTone(step.statusCode)} dot>
            Status: {step.statusLabel}
            {step.statusCode ? ` (${step.statusCode})` : ""}
          </Badge>
          {step.gapFromPreviousMs && step.gapFromPreviousMs > 0 ? (
            <span className="tabular text-xs text-[var(--os-muted)]">
              +{formatDuration(step.gapFromPreviousMs)}
            </span>
          ) : null}
          <Badge tone={step.category === "POTENTIAL_ISSUE" ? "danger" : "neutral"}>
            {step.category}
          </Badge>
        </div>

        <p className="mt-1 text-[13px] leading-relaxed text-[var(--os-muted)]">{step.detail}</p>

        {step.changes.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {step.changes.slice(0, open ? step.changes.length : 3).map((change) => (
              <span
                key={change.field}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--os-soft)] px-2 py-1 font-mono text-[11px] text-[var(--os-muted-strong)]"
              >
                {change.field}
              </span>
            ))}
            {!open && step.changes.length > 3 ? (
              <span className="text-[11px] text-[var(--os-muted)]">
                +{step.changes.length - 3} more
              </span>
            ) : null}
          </div>
        ) : null}

        {open ? (
          <div className="mt-2 space-y-2">
            {step.changes.map((change) => (
              <div
                key={change.field}
                className="rounded-lg border border-[var(--os-border)] bg-white px-3 py-2"
              >
                <div className="text-xs font-semibold text-[var(--os-navy)]">
                  {change.displayName}
                </div>
                <div className="mt-1 text-[13px] text-[var(--os-muted)]">
                  {change.interpretation}
                </div>
              </div>
            ))}
            {step.evidence.length > 0 ? (
              <div className="rounded-lg bg-[var(--os-soft)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--os-muted)]">
                {step.evidence.join("  ·  ")}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-1.5 flex flex-wrap gap-3">
          {hasDetail ? (
            <button
              className="text-xs font-medium text-[var(--os-blue)] hover:underline"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              {open ? "Hide details" : "Why am I seeing this?"}
            </button>
          ) : null}
          <button
            className="text-xs font-medium text-[var(--os-muted)] hover:text-[var(--os-blue)] hover:underline"
            onClick={() => setSelectedRecord(step.recordUid)}
          >
            View record
          </button>
        </div>
      </div>
    </li>
  );
}

function matches(step: LifecycleStep, kindFilter: "all" | "key" | "issues", query: string): boolean {
  if (kindFilter === "issues" && step.severity === "information") return false;
  if (kindFilter === "key" && !step.isPrimary && step.severity === "information") {
    const keyKinds: StepKind[] = ["created", "activated", "deactivated", "deleted", "violation", "rule", "price", "status"];
    if (!keyKinds.includes(step.kind)) return false;
  }

  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    step.listingId.toLowerCase().includes(q) ||
    step.title.toLowerCase().includes(q) ||
    step.detail.toLowerCase().includes(q)
  );
}

function groupByDay(steps: LifecycleStep[]) {
  const groups = new Map<string, LifecycleStep[]>();
  for (const step of steps) {
    const day = step.timestamp ? step.timestamp.slice(0, 10) : "unknown";
    const list = groups.get(day) ?? [];
    list.push(step);
    groups.set(day, list);
  }

  return Array.from(groups.entries()).map(([day, list]) => ({
    day,
    label: day === "unknown" ? "Events without a timestamp" : formatDay(day),
    steps: list,
  }));
}

function formatDay(day: string): string {
  const date = new Date(day);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
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
