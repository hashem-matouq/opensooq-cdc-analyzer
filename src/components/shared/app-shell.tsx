"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Activity,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  ListTree,
  Rows3,
  Search,
  ShieldAlert,
  Shuffle,
  Table2,
  Upload,
} from "lucide-react";
import { Badge, Button } from "@/components/shared/ui";
import { useAppStore } from "@/lib/store";
import { cn, formatBytes, formatNumber } from "@/lib/utils";
import type { AppView } from "@/types/cdc";

interface NavItem {
  id: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  tone?: "danger" | "warning";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const view = useAppStore((s) => s.view);
  const analysis = useAppStore((s) => s.analysis);
  const setView = useAppStore((s) => s.setView);
  const clearData = useAppStore((s) => s.clearData);
  const showSensitive = useAppStore((s) => s.showSensitive);
  const setShowSensitive = useAppStore((s) => s.setShowSensitive);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const [query, setQuery] = useState(filters.search);

  useEffect(() => {
    setQuery(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== filters.search) setFilters({ search: query });
    }, 200);
    return () => clearTimeout(timer);
  }, [query, filters.search, setFilters]);

  if (!analysis || view === "upload" || view === "processing") {
    return <>{children}</>;
  }

  const qaIssues = analysis.qaInsights.filter((i) => i.severity !== "information").length;

  const nav: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "records", label: "Records", icon: Rows3, count: analysis.records.length },
    { id: "timeline", label: "Timeline", icon: ListTree, count: analysis.globalTimeline.length },
    {
      id: "status",
      label: "Listing Status",
      icon: Shuffle,
      count: analysis.statusTracker.changedListings,
      tone: analysis.statusTracker.multiChangeListings > 0 ? "warning" : undefined,
    },
    { id: "insights", label: "Insights", icon: Activity, count: analysis.insights.length },
    {
      id: "qa",
      label: "QA Analysis",
      icon: ShieldAlert,
      count: qaIssues,
      tone: qaIssues > 0 ? "danger" : undefined,
    },
    { id: "raw", label: "Raw Data", icon: Table2 },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--os-border)] bg-white">
        <div className="flex h-16 items-center gap-4 px-4 md:px-6">
          <button
            onClick={() => setView("dashboard")}
            className="flex shrink-0 items-center gap-3"
            aria-label="Go to dashboard"
          >
            <Image
              src="/opensooq-logo.png"
              alt="OpenSooq"
              width={230}
              height={104}
              priority
              className="h-9 w-auto"
            />
            <span className="hidden text-left border-l border-[var(--os-border)] pl-3 sm:block">
              <span className="block text-sm font-semibold leading-tight text-[var(--os-navy)]">
                CDC Analyzer
              </span>
              <span className="block text-xs leading-tight text-[var(--os-muted)]">
                Listing data, in plain language
              </span>
            </span>
          </button>

          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--os-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setView("records")}
              placeholder="Search listing ID, title, member, request ID..."
              aria-label="Search CDC data"
              className="w-full rounded-xl border border-[var(--os-border)] bg-[var(--os-soft)] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--os-blue)] focus:bg-white"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-[var(--os-border)] bg-[var(--os-soft)] px-3 py-2 lg:flex">
              <FileText className="h-4 w-4 text-[var(--os-blue)]" />
              <span className="max-w-[180px] truncate text-sm font-medium text-[var(--os-navy)]">
                {analysis.file.name}
              </span>
              <span className="text-xs text-[var(--os-muted)]">
                {formatBytes(analysis.file.size)}
                {analysis.file.pageCount ? ` · ${analysis.file.pageCount}p` : ""}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSensitive(!showSensitive)}
              aria-pressed={showSensitive}
              title={showSensitive ? "Hide sensitive data" : "Show sensitive data"}
            >
              {showSensitive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="hidden sm:inline">{showSensitive ? "Visible" : "Masked"}</span>
            </Button>

            <Button variant="outline" size="sm" onClick={() => setView("records")}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            <Button size="sm" onClick={clearData}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload New</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[236px_1fr]">
        <aside className="border-b border-[var(--os-border)] bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
          <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-col" aria-label="Sections">
            {nav.map((item) => {
              const Icon = item.icon;
              const active =
                view === item.id ||
                (item.id === "records" && (view === "record-detail" || view === "compare"));
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition lg:w-full",
                    active
                      ? "bg-[var(--os-sky)] text-[var(--os-blue-dark)]"
                      : "text-[var(--os-muted-strong)] hover:bg-[var(--os-soft)]",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-[var(--os-blue)]" : "text-[var(--os-muted)]",
                    )}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.count !== undefined && item.count > 0 ? (
                    <span
                      className={cn(
                        "tabular rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                        item.tone === "danger"
                          ? "bg-[var(--os-danger-soft)] text-[var(--os-danger)]"
                          : active
                            ? "bg-white text-[var(--os-blue-dark)]"
                            : "bg-[var(--os-soft)] text-[var(--os-muted)]",
                      )}
                    >
                      {formatNumber(item.count)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="hidden px-3 pb-4 lg:block">
            <div className="rounded-xl border border-[var(--os-border)] bg-[var(--os-soft)] p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                <Clock3 className="h-3.5 w-3.5" />
                Coverage
              </div>
              <div className="mt-2 space-y-1 text-xs text-[var(--os-muted)]">
                <div className="flex justify-between gap-2">
                  <span>Records</span>
                  <span className="tabular font-medium text-[var(--os-navy)]">
                    {formatNumber(analysis.records.length)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Listings</span>
                  <span className="tabular font-medium text-[var(--os-navy)]">
                    {formatNumber(analysis.lifecycles.length)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Fields</span>
                  <span className="tabular font-medium text-[var(--os-navy)]">
                    {formatNumber(analysis.fieldsDetected.length)}
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <Badge tone={analysis.file.type === "pdf" ? "brand" : "success"} dot>
                  {analysis.file.type.toUpperCase()} source
                </Badge>
              </div>
            </div>

            <p className="mt-3 px-1 text-center text-[11px] leading-relaxed text-[var(--os-muted)]">
              Made by{" "}
              <span className="font-semibold text-[var(--os-navy)]">Hashem Matouq</span>
            </p>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
          <footer className="mx-auto mt-8 max-w-[1400px] border-t border-[var(--os-border)] pt-4 text-center text-xs text-[var(--os-muted)]">
            <span className="font-semibold text-[var(--os-blue)]">OpenSooq</span> CDC Analyzer ·
            Made by <span className="font-semibold text-[var(--os-navy)]">Hashem Matouq</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
