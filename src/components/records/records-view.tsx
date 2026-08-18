"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Columns3,
  Download,
  GitCompare,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, Segmented } from "@/components/shared/ui";
import { getFieldDefinition } from "@/config/field-definitions";
import { exportCsv, exportExcel, exportJson, exportPdfSummary } from "@/lib/export";
import { formatFieldValue, formatOperation, formatStatus } from "@/lib/formatting/formatters";
import { filterRecords, useAppStore } from "@/lib/store";
import { cn, formatNumber, safeString } from "@/lib/utils";
import type { CDCRecord, FilterState, ViewMode } from "@/types/cdc";

export function RecordsView() {
  const analysis = useAppStore((s) => s.analysis);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const showSensitive = useAppStore((s) => s.showSensitive);
  const visibleColumns = useAppStore((s) => s.visibleColumns);
  const setVisibleColumns = useAppStore((s) => s.setVisibleColumns);
  const setSelectedRecord = useAppStore((s) => s.setSelectedRecord);
  const setCompare = useAppStore((s) => s.setCompare);

  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [showColumns, setShowColumns] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(
    () => (analysis ? filterRecords(analysis.records, filters) : []),
    [analysis, filters],
  );

  const columns = useMemo<ColumnDef<CDCRecord>[]>(
    () =>
      visibleColumns.map((field) => {
        const def = getFieldDefinition(field);
        return {
          id: field,
          header: viewMode === "human" ? def.displayName : field,
          cell: ({ row }) => renderCell(field, row.original, viewMode, showSensitive),
        };
      }),
    [visibleColumns, viewMode, showSensitive],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination: { pageIndex: 0, pageSize } },
    initialState: { pagination: { pageSize } },
  });

  if (!analysis) return null;

  const options = buildFilterOptions(analysis.records);
  const activeFilterCount = countActiveFilters(filters);
  const exportBase = analysis.file.name.replace(/\.(pdf|csv)$/i, "");

  const toggleCompare = (uid: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(uid)) return prev.filter((id) => id !== uid);
      if (prev.length >= 2) return [prev[1], uid];
      return [...prev, uid];
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Data"
        title="Records"
        subtitle={`${formatNumber(filtered.length)} of ${formatNumber(analysis.records.length)} records match your current view.`}
        action={
          <>
            <Segmented
              ariaLabel="Data presentation"
              value={viewMode}
              onChange={(value: ViewMode) => setViewMode(value)}
              options={[
                { value: "human", label: "Human view" },
                { value: "raw", label: "Raw view" },
              ]}
            />
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="tabular rounded-md bg-[var(--os-blue)] px-1.5 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
            <Button variant="outline" onClick={() => setShowColumns((v) => !v)}>
              <Columns3 className="h-4 w-4" />
              Columns
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--os-muted)]" />
            <input
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              placeholder="Search any field: listing ID, title, member, phone, request ID..."
              aria-label="Search records"
              className="w-full rounded-xl border border-[var(--os-border)] bg-[var(--os-soft)] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--os-blue)] focus:bg-white"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--os-muted)]">Export</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportCsv(filtered, analysis.fieldsDetected, `${exportBase}-filtered`)}
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportExcel(filtered, analysis.fieldsDetected, `${exportBase}-filtered`)}
            >
              Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportJson(filtered, `${exportBase}-filtered`)}>
              JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportPdfSummary(buildSummaryLines(analysis.file.name, filtered), `${exportBase}`)
              }
            >
              Summary
            </Button>
          </div>
        </div>

        {showFilters ? (
          <div className="mt-4 grid gap-3 border-t border-[var(--os-border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Operation"
              value={filters.operation}
              onChange={(v) => setFilters({ operation: v })}
              options={["all", "insert", "update", "delete", "unknown"]}
            />
            <Select
              label="Status"
              value={filters.status}
              onChange={(v) => setFilters({ status: v })}
              options={[
                { value: "all", label: "all" },
                ...options.statuses.map((code) => ({
                  value: code,
                  label: `${formatStatus(code)} (${code})`,
                })),
              ]}
            />
            <Select
              label="Active"
              value={filters.active}
              onChange={(v) => setFilters({ active: v })}
              options={["all", "yes", "no"]}
            />
            <Select
              label="Country"
              value={filters.country}
              onChange={(v) => setFilters({ country: v })}
              options={["all", ...options.countries]}
            />
            <Select
              label="Language"
              value={filters.language}
              onChange={(v) => setFilters({ language: v })}
              options={["all", ...options.languages]}
            />
            <Select
              label="Violation"
              value={filters.violation}
              onChange={(v) => setFilters({ violation: v })}
              options={["all", "yes", "no"]}
            />
            <Select
              label="Featured"
              value={filters.featured}
              onChange={(v) => setFilters({ featured: v })}
              options={["all", "yes", "no"]}
            />
            <div className="grid grid-cols-2 gap-2">
              <DateInput
                label="From"
                value={filters.dateFrom}
                onChange={(v) => setFilters({ dateFrom: v })}
              />
              <DateInput
                label="To"
                value={filters.dateTo}
                onChange={(v) => setFilters({ dateTo: v })}
              />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </Button>
            </div>
          </div>
        ) : null}

        {showColumns ? (
          <div className="mt-4 border-t border-[var(--os-border)] pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--os-navy)]">
                Visible columns ({visibleColumns.length})
              </span>
              <Button size="sm" variant="ghost" onClick={() => setShowColumns(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid max-h-52 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
              {analysis.fieldsDetected.map((field) => {
                const checked = visibleColumns.includes(field);
                return (
                  <label
                    key={field}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-[var(--os-soft)]"
                  >
                    <input
                      type="checkbox"
                      className="accent-[var(--os-blue)]"
                      checked={checked}
                      onChange={() =>
                        setVisibleColumns(
                          checked
                            ? visibleColumns.filter((c) => c !== field)
                            : [...visibleColumns, field],
                        )
                      }
                    />
                    <span className="truncate">{getFieldDefinition(field).displayName}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No records found"
          description="Try changing your filters or search query."
          action={
            <Button variant="outline" onClick={resetFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-[var(--os-border)] bg-[var(--os-soft)]">
                    <th scope="col" className="w-10 px-3 py-3">
                      <span className="sr-only">Select</span>
                    </th>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--os-muted)]">
                      Open
                    </th>
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => {
                  const selected = compareSelection.includes(row.original.uid);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-[var(--os-border)] transition last:border-0 hover:bg-[var(--os-sky)]/40",
                        selected && "bg-[var(--os-sky)]/60",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="accent-[var(--os-blue)]"
                          aria-label={`Select record ${row.original.id ?? row.original.uid} to compare`}
                          checked={selected}
                          onChange={() => toggleCompare(row.original.uid)}
                        />
                      </td>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="max-w-[240px] truncate px-3 py-2.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right">
                        <button
                          className="text-[13px] font-medium text-[var(--os-blue)] hover:underline"
                          onClick={() => setSelectedRecord(row.original.uid)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--os-border)] px-4 py-3 text-sm">
            <div className="flex items-center gap-3 text-[var(--os-muted)]">
              <span>
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {Math.max(table.getPageCount(), 1)}
              </span>
              <label className="flex items-center gap-1.5">
                <span className="sr-only">Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-lg border border-[var(--os-border)] bg-white px-2 py-1 text-[13px]"
                >
                  {[25, 50, 100, 250].map((size) => (
                    <option key={size} value={size}>
                      {size} rows
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {compareSelection.length > 0 ? (
        <div className="sticky bottom-4 z-20 flex justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--os-border)] bg-white px-4 py-3 shadow-[var(--shadow-pop)]">
            <Badge tone="brand" dot>
              {compareSelection.length}/2 selected
            </Badge>
            <Button
              size="sm"
              disabled={compareSelection.length !== 2}
              onClick={() => setCompare(compareSelection[0], compareSelection[1])}
            >
              <GitCompare className="h-4 w-4" />
              Compare records
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCompareSelection([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function renderCell(
  field: string,
  record: CDCRecord,
  viewMode: ViewMode,
  showSensitive: boolean,
) {
  const value = record.raw[field];

  if (viewMode === "raw") {
    return <span className="font-mono text-[12px]">{safeString(value) || "—"}</span>;
  }

  if (field === "SF_OP") {
    const op = record.operation;
    const tone = op === "insert" ? "success" : op === "delete" ? "danger" : "brand";
    return <Badge tone={tone} dot>{formatOperation(value ?? op)}</Badge>;
  }

  if (field === "ACTIVE") {
    const active = record.status.active;
    if (active === undefined) return "—";
    return <Badge tone={active ? "success" : "neutral"}>{active ? "Yes" : "No"}</Badge>;
  }

  if (field === "VIOLATION") {
    const violation = record.status.violation;
    if (violation === undefined) return "—";
    return violation ? <Badge tone="danger">Detected</Badge> : <span className="text-[var(--os-muted)]">No</span>;
  }

  if (field === "ID") {
    return <span className="tabular font-medium text-[var(--os-navy)]">{safeString(value)}</span>;
  }

  return formatFieldValue(field, value, { showSensitive, currency: record.entity.currency });
}

type SelectOption = string | { value: string; label: string };

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--os-muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--os-border)] bg-white px-3 py-2 text-sm capitalize outline-none transition focus:border-[var(--os-blue)]"
      >
        {normalized.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--os-muted)]">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--os-border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--os-blue)]"
      />
    </label>
  );
}

function countActiveFilters(filters: FilterState): number {
  return Object.entries(filters).filter(([key, value]) => {
    if (key === "search") return false;
    if (key === "dateFrom" || key === "dateTo") return value !== "";
    return value !== "all";
  }).length;
}

function buildSummaryLines(fileName: string, records: CDCRecord[]): string[] {
  return [
    "OpenSooq CDC Summary",
    `File: ${fileName}`,
    `Filtered records: ${records.length}`,
    `Inserts: ${records.filter((r) => r.operation === "insert").length}`,
    `Updates: ${records.filter((r) => r.operation === "update").length}`,
    `Deletes: ${records.filter((r) => r.operation === "delete").length}`,
    `Violations: ${records.filter((r) => r.status.violation).length}`,
    `Active: ${records.filter((r) => r.status.active).length}`,
  ];
}

function buildFilterOptions(records: CDCRecord[]) {
  const statuses = new Set<string>();
  const countries = new Set<string>();
  const languages = new Set<string>();
  for (const record of records) {
    if (record.status.status !== undefined) statuses.add(String(record.status.status));
    if (record.entity.country) countries.add(record.entity.country.toUpperCase());
    if (record.entity.language) languages.add(record.entity.language);
  }
  return {
    statuses: Array.from(statuses).sort(),
    countries: Array.from(countries).sort(),
    languages: Array.from(languages).sort(),
  };
}
