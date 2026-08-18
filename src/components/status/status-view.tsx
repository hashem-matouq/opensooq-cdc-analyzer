"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  CircleDot,
  Filter,
  Search,
  Shuffle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Segmented,
  StatCard,
} from "@/components/shared/ui";
import { formatFieldValue, formatOperation } from "@/lib/formatting/formatters";
import {
  getListingStatusDefinition,
  isLiveStatus,
  LISTING_STATUS_DEFINITIONS,
} from "@/config/listing-statuses";
import { formatDuration } from "@/lib/insights/lifecycle";
import { useAppStore } from "@/lib/store";
import { cn, formatNumber } from "@/lib/utils";
import type { ListingStatusTrack } from "@/lib/insights/status-tracker";

type StatusFilter = "all" | "changed" | "multi" | string;
type SortMode = "changes" | "recent" | "listing";
type MatchMode = "ever" | "current";

export function StatusView() {
  const analysis = useAppStore((s) => s.analysis);
  const setSelectedRecord = useAppStore((s) => s.setSelectedRecord);
  const setFilters = useAppStore((s) => s.setFilters);
  const setView = useAppStore((s) => s.setView);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [matchMode, setMatchMode] = useState<MatchMode>("ever");
  const [sortMode, setSortMode] = useState<SortMode>("changes");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const tracker = analysis?.statusTracker;

  const filtered = useMemo(() => {
    if (!tracker) return [];
    let list = [...tracker.tracks];

    if (statusFilter === "changed") {
      list = list.filter((track) => track.changeCount > 0);
    } else if (statusFilter === "multi") {
      list = list.filter((track) => track.changeCount >= 3);
    } else if (statusFilter !== "all") {
      list = list.filter((track) =>
        matchMode === "current"
          ? (track.currentStatus ?? "unknown") === statusFilter
          : track.statusesSeen.includes(statusFilter),
      );
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (track) =>
          track.listingId.toLowerCase().includes(q) ||
          (track.title ?? "").toLowerCase().includes(q) ||
          track.currentLabel.toLowerCase().includes(q) ||
          track.points.some(
            (point) =>
              point.label.toLowerCase().includes(q) ||
              (point.status ?? "").toLowerCase().includes(q),
          ),
      );
    }

    list.sort((a, b) => {
      if (sortMode === "listing") {
        return a.listingId.localeCompare(b.listingId);
      }
      if (sortMode === "recent") {
        const ta = a.lastChanged ? new Date(a.lastChanged).getTime() : 0;
        const tb = b.lastChanged ? new Date(b.lastChanged).getTime() : 0;
        return tb - ta;
      }
      if (b.changeCount !== a.changeCount) return b.changeCount - a.changeCount;
      const ta = a.lastChanged ? new Date(a.lastChanged).getTime() : 0;
      const tb = b.lastChanged ? new Date(b.lastChanged).getTime() : 0;
      return tb - ta;
    });

    return list;
  }, [tracker, statusFilter, matchMode, query, sortMode]);

  if (!analysis || !tracker) return null;

  const logPoints = tracker.tracks.reduce(
    (total, track) => total + track.points.filter((point) => point.source === "log").length,
    0,
  );
  const statusNotes = analysis.warnings.filter((warning) =>
    /status|log history/i.test(warning),
  );

  const openRecordsForStatus = (statusKey: string) => {
    setFilters({ status: statusKey === "unknown" ? "all" : statusKey });
    setView("records");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tracking"
        title="Listing Status"
        subtitle="Track every listing’s current status and how it moved from start to end of this CDC file."
        action={
          <Segmented
            ariaLabel="Sort listings"
            value={sortMode}
            onChange={setSortMode}
            options={[
              { value: "changes", label: "Most changes" },
              { value: "recent", label: "Recently changed" },
              { value: "listing", label: "Listing ID" },
            ]}
          />
        }
      />

      {logPoints > 0 || statusNotes.length > 0 ? (
        <Card className="border-[var(--os-blue)]/40 bg-[var(--os-sky)]/40 p-4">
          <div className="text-sm text-[var(--os-navy)]">
            {logPoints > 0
              ? `${formatNumber(logPoints)} status entries were read from the log history table in this file.`
              : "Status extraction notes"}
          </div>
          {statusNotes.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[13px] text-[var(--os-muted)]">
              {statusNotes.map((note) => (
                <li key={note}>· {note}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Listings tracked"
          value={formatNumber(tracker.totalListings)}
          hint="Unique listing IDs in this file"
          icon={<CircleDot className="h-4 w-4" />}
          onClick={() => setStatusFilter("all")}
        />
        <StatCard
          label="Status changed"
          value={formatNumber(tracker.changedListings)}
          hint="Listings with at least one status change"
          tone="info"
          icon={<Shuffle className="h-4 w-4" />}
          onClick={() => setStatusFilter("changed")}
        />
        <StatCard
          label="Frequent changers"
          value={formatNumber(tracker.multiChangeListings)}
          hint="Changed status 3+ times"
          tone="warning"
          icon={<Filter className="h-4 w-4" />}
          onClick={() => setStatusFilter("multi")}
        />
        <StatCard
          label="Showing now"
          value={formatNumber(filtered.length)}
          hint="After search and status filters"
          tone="neutral"
        />
      </div>

      <Card>
        <CardHeader
          title="All listing statuses"
          subtitle={`${LISTING_STATUS_DEFINITIONS.length} supported labels. The big number is how many CDC events carried that status. "Now" is how many listings sit there currently, "Ever" is how many passed through it.`}
        />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tracker.buckets.map((bucket) => {
            const active = statusFilter === bucket.key;
            const definition = getListingStatusDefinition(bucket.key);
            const unused = bucket.recordCount === 0;
            return (
              <div
                key={bucket.key}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition",
                  active
                    ? "border-[var(--os-blue)] bg-[var(--os-sky)]"
                    : unused
                      ? "border-[var(--os-border)] bg-[var(--os-soft)]/50 opacity-70 hover:opacity-100"
                      : "border-[var(--os-border)] bg-white hover:border-[var(--os-border-strong)]",
                )}
              >
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(active ? "all" : bucket.key)}
                  className="block w-full text-left"
                >
                  <span className="flex items-start justify-between gap-2">
                    <Badge tone={bucket.tone} dot>
                      {bucket.label}
                    </Badge>
                    <span className="text-right leading-tight">
                      <span className="tabular block text-lg font-semibold text-[var(--os-navy)]">
                        {formatNumber(bucket.recordCount)}
                      </span>
                      <span className="block text-[11px] text-[var(--os-muted)]">
                        event{bucket.recordCount === 1 ? "" : "s"}
                      </span>
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--os-muted)]">
                    <span className="tabular">
                      Now {formatNumber(bucket.currentCount)} listing
                      {bucket.currentCount === 1 ? "" : "s"}
                    </span>
                    <span className="tabular">Ever {formatNumber(bucket.everCount)}</span>
                  </span>
                </button>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--os-muted)]">
                  <span className="font-mono">
                    STATUS={bucket.key === "unknown" ? "—" : bucket.key}
                  </span>
                  <button
                    type="button"
                    className="font-medium text-[var(--os-blue)] hover:underline"
                    onClick={() => openRecordsForStatus(bucket.key)}
                  >
                    Open records
                  </button>
                </div>
                {definition ? (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--os-muted)]">
                    {definition.description}
                  </p>
                ) : null}
              </div>
            );
          })}
          {tracker.buckets.length === 0 ? (
            <div className="text-sm text-[var(--os-muted)]">
              No STATUS values were found in this file.
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--os-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search listing ID, title, or status..."
              aria-label="Search listing status"
              className="w-full rounded-xl border border-[var(--os-border)] bg-[var(--os-soft)] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--os-blue)] focus:bg-white"
            />
          </label>
          <Segmented
            ariaLabel="Status focus"
            value={
              statusFilter === "changed" || statusFilter === "multi" || statusFilter === "all"
                ? statusFilter
                : "all"
            }
            onChange={(value) => setStatusFilter(value)}
            options={[
              { value: "all", label: "All" },
              { value: "changed", label: "Changed" },
              { value: "multi", label: "3+ changes" },
            ]}
          />
          {statusFilter !== "all" &&
          statusFilter !== "changed" &&
          statusFilter !== "multi" ? (
            <>
              <Badge tone="brand" dot>
                Filtered:{" "}
                {tracker.buckets.find((b) => b.key === statusFilter)?.label ?? statusFilter}
              </Badge>
              <Segmented
                ariaLabel="Match status by"
                value={matchMode}
                onChange={setMatchMode}
                options={[
                  { value: "ever", label: "Any point" },
                  { value: "current", label: "Current only" },
                ]}
              />
            </>
          ) : null}
          {statusFilter !== "all" || query ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStatusFilter("all");
                setQuery("");
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Shuffle className="h-6 w-6" />}
          title="No listings match"
          description="Try another status filter or clear the search."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setQuery("");
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--os-soft)]">
                <tr className="border-b border-[var(--os-border)]">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                    Listing
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                    Current status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                    Status journey
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                    Changes
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                    Last changed
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                    Track
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((track) => {
                  const open = expanded === track.listingId;
                  return (
                    <StatusTrackRows
                      key={track.listingId}
                      track={track}
                      open={open}
                      onToggle={() =>
                        setExpanded((current) =>
                          current === track.listingId ? null : track.listingId,
                        )
                      }
                      onOpenLatest={() =>
                        setSelectedRecord(track.recordUids[track.recordUids.length - 1])
                      }
                      onOpenTransition={(uid) => setSelectedRecord(uid)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusTrackRows({
  track,
  open,
  onToggle,
  onOpenLatest,
  onOpenTransition,
}: {
  track: ListingStatusTrack;
  open: boolean;
  onToggle: () => void;
  onOpenLatest: () => void;
  onOpenTransition: (uid: string) => void;
}) {
  return (
    <>
      <tr className="border-b border-[var(--os-border)] hover:bg-[var(--os-sky)]/30">
        <td className="px-4 py-3 align-top">
          <div className="font-semibold text-[var(--os-navy)]">#{track.listingId}</div>
          {track.title ? (
            <div className="mt-0.5 max-w-[260px] truncate text-[13px] text-[var(--os-muted)]">
              {track.title}
            </div>
          ) : null}
          {track.currentActive !== undefined ? (
            <div className="mt-1">
              <Badge tone={track.currentActive ? "success" : "neutral"}>
                {track.currentActive ? "Active flag: Yes" : "Active flag: No"}
              </Badge>
            </div>
          ) : null}
        </td>
        <td className="px-4 py-3 align-top">
          <Badge
            tone={
              track.severity === "potential_issue"
                ? "danger"
                : track.severity === "warning"
                  ? "warning"
                  : isLiveStatus(track.currentStatus)
                    ? "success"
                    : "brand"
            }
            dot
          >
            {track.currentLabel}
          </Badge>
          {track.currentStatus ? (
            <div className="mt-1 font-mono text-[11px] text-[var(--os-muted)]">
              STATUS={track.currentStatus}
            </div>
          ) : null}
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex max-w-[360px] flex-wrap items-center gap-1">
            {track.points.map((point, index) => (
              <span key={point.recordUid} className="inline-flex items-center gap-1">
                {index > 0 ? (
                  <ArrowRight className="h-3 w-3 text-[var(--os-muted)]" />
                ) : null}
                <span
                  title={`${point.label} (STATUS=${point.status ?? "—"})`}
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 font-mono text-[11px]",
                    point.changed
                      ? "border-[var(--os-blue)] bg-[var(--os-sky)] text-[var(--os-navy)]"
                      : "border-[var(--os-border)] bg-[var(--os-soft)] text-[var(--os-muted)]",
                  )}
                >
                  {point.status ?? "—"}
                </span>
              </span>
            ))}
          </div>
          <div className="mt-1 text-[12px] text-[var(--os-muted)]">
            {track.changeCount === 0
              ? "No status change in this file"
              : `${track.currentLabel} is the latest of ${track.distinctStatusCount} distinct statuses`}
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <span className="tabular font-semibold text-[var(--os-navy)]">{track.changeCount}</span>
          <div className="mt-0.5 text-[12px] text-[var(--os-muted)]">
            {track.points.length} status points
          </div>
        </td>
        <td className="px-4 py-3 align-top text-[13px] text-[var(--os-muted)]">
          {track.lastChanged
            ? formatFieldValue("SF_TIMESTAMP", track.lastChanged)
            : "—"}
        </td>
        <td className="px-4 py-3 align-top text-right">
          <div className="inline-flex flex-col items-end gap-1">
            <Button size="sm" variant="ghost" onClick={onToggle}>
              <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
              {open ? "Hide timeline" : "Status timeline"}
            </Button>
            <button
              className="text-[12px] font-medium text-[var(--os-blue)] hover:underline"
              onClick={onOpenLatest}
            >
              Open latest record
            </button>
          </div>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-[var(--os-border)] bg-[var(--os-soft)]/70">
          <td colSpan={6} className="px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-[var(--os-muted)]">
              <span className="font-semibold text-[var(--os-navy)]">
                Full status timeline · {track.points.length} records
              </span>
              <span>
                {track.changeCount} change{track.changeCount === 1 ? "" : "s"} ·{" "}
                {track.distinctStatusCount} distinct status
                {track.distinctStatusCount === 1 ? "" : "es"}
              </span>
              {track.matchedBy !== "id" ? (
                <Badge tone="warning">
                  Grouped by {track.matchedBy === "row" ? "row order" : "title / member"} — no
                  listing ID in these records
                </Badge>
              ) : null}
            </div>
            <ol className="timeline-rail space-y-2">
              {track.points.map((point) => (
                <li key={point.recordUid} className="relative pl-11">
                  <span
                    className={cn(
                      "absolute left-0 top-1.5 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-[var(--os-soft)]",
                      point.changed
                        ? "bg-[var(--os-sky)] text-[var(--os-blue)]"
                        : "bg-white text-[var(--os-muted)]",
                    )}
                  >
                    {point.changed ? (
                      <Shuffle className="h-4 w-4" />
                    ) : (
                      <CircleDot className="h-4 w-4" />
                    )}
                  </span>
                  <div className="rounded-xl border border-[var(--os-border)] bg-white px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-xs text-[var(--os-muted)]">
                        {point.position}.
                      </span>
                      <Badge tone={point.tone} dot>
                        {point.label}
                      </Badge>
                      <span className="font-mono text-[11px] text-[var(--os-muted)]">
                        STATUS={point.status ?? "—"}
                      </span>
                      {point.operation ? (
                        <span className="text-xs text-[var(--os-muted)]">
                          {formatOperation(point.operation)}
                        </span>
                      ) : null}
                      <span className="tabular text-xs text-[var(--os-muted)]">
                        {point.timestamp
                          ? formatFieldValue("SF_TIMESTAMP", point.timestamp)
                          : "no timestamp"}
                      </span>
                      {point.changed ? (
                        <Badge tone="brand">Changed</Badge>
                      ) : point.position === 1 ? (
                        <Badge tone="neutral">First seen</Badge>
                      ) : (
                        <Badge tone="neutral">Unchanged</Badge>
                      )}
                      {point.source === "log" ? (
                        <Badge tone="neutral">
                          Log history{point.logAction ? `: ${point.logAction}` : ""}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[13px] text-[var(--os-muted)]">
                      {point.changed
                        ? `Moved from ${point.previousLabel ?? "Unknown"} (${point.previousStatus ?? "—"}) to ${point.label} (${point.status ?? "—"})`
                        : point.position === 1
                          ? `Started at ${point.label} (${point.status ?? "—"})`
                          : `Still ${point.label} (${point.status ?? "—"})`}
                      {point.active !== undefined
                        ? ` · ACTIVE ${point.active ? "Yes" : "No"}`
                        : ""}
                      {point.gapFromPreviousMs && point.gapFromPreviousMs > 0
                        ? ` · ${formatDuration(point.gapFromPreviousMs)} after previous record`
                        : ""}
                    </div>
                    <button
                      className="mt-2 text-xs font-medium text-[var(--os-blue)] hover:underline"
                      onClick={() => onOpenTransition(point.recordUid)}
                    >
                      View this record
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </td>
        </tr>
      ) : null}
    </>
  );
}
