import { create } from "zustand";
import { analyzeRecords } from "@/lib/insights/engine";
import { parseCsvFile } from "@/lib/parser/csv";
import { parsePdfFile } from "@/lib/pdf/parse-pdf";
import { createErrorId, formatBytes } from "@/lib/utils";
import type {
  AnalysisResult,
  AppView,
  CDCRecord,
  FilterState,
  ProcessingStep,
  ViewMode,
} from "@/types/cdc";

const defaultFilters: FilterState = {
  search: "",
  operation: "all",
  status: "all",
  active: "all",
  country: "all",
  language: "all",
  violation: "all",
  featured: "all",
  dateFrom: "",
  dateTo: "",
};

const initialSteps: ProcessingStep[] = [
  { id: "read", label: "Reading file", status: "pending" },
  { id: "extract", label: "Extracting records", status: "pending" },
  { id: "detect", label: "Detecting CDC operations", status: "pending" },
  { id: "map", label: "Mapping fields", status: "pending" },
  { id: "insights", label: "Generating insights", status: "pending" },
  { id: "dashboard", label: "Preparing dashboard", status: "pending" },
];

interface AppState {
  view: AppView;
  processingSteps: ProcessingStep[];
  progress: number;
  error: string | null;
  errorId: string | null;
  analysis: AnalysisResult | null;
  filters: FilterState;
  viewMode: ViewMode;
  showSensitive: boolean;
  selectedRecordUid: string | null;
  compareA: string | null;
  compareB: string | null;
  visibleColumns: string[];
  setView: (view: AppView) => void;
  setFilters: (patch: Partial<FilterState>) => void;
  resetFilters: () => void;
  setViewMode: (mode: ViewMode) => void;
  setShowSensitive: (value: boolean) => void;
  setSelectedRecord: (uid: string | null) => void;
  setCompare: (a: string | null, b: string | null) => void;
  setVisibleColumns: (cols: string[]) => void;
  clearData: () => void;
  processFile: (file: File) => Promise<void>;
}

function updateStep(
  steps: ProcessingStep[],
  id: string,
  status: ProcessingStep["status"],
): ProcessingStep[] {
  return steps.map((step) => (step.id === id ? { ...step, status } : step));
}

export const useAppStore = create<AppState>((set, get) => ({
  view: "upload",
  processingSteps: initialSteps,
  progress: 0,
  error: null,
  errorId: null,
  analysis: null,
  filters: defaultFilters,
  viewMode: "human",
  showSensitive: false,
  selectedRecordUid: null,
  compareA: null,
  compareB: null,
  visibleColumns: [
    "ID",
    "TITLE",
    "SF_OP",
    "STATUS",
    "ACTIVE",
    "PRICE",
    "PRICE_CURRENCY",
    "POST_INSERT_IP_COUNTRY",
    "VIOLATION",
    "SF_TIMESTAMP",
  ],
  setView: (view) => set({ view }),
  setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
  resetFilters: () => set({ filters: defaultFilters }),
  setViewMode: (viewMode) => set({ viewMode }),
  setShowSensitive: (showSensitive) => set({ showSensitive }),
  setSelectedRecord: (selectedRecordUid) =>
    set({
      selectedRecordUid,
      view: selectedRecordUid ? "record-detail" : "records",
    }),
  setCompare: (compareA, compareB) => set({ compareA, compareB, view: "compare" }),
  setVisibleColumns: (visibleColumns) => set({ visibleColumns }),
  clearData: () =>
    set({
      view: "upload",
      analysis: null,
      error: null,
      errorId: null,
      progress: 0,
      processingSteps: initialSteps,
      selectedRecordUid: null,
      compareA: null,
      compareB: null,
      filters: defaultFilters,
    }),
  processFile: async (file: File) => {
    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
    const isCsv =
      lower.endsWith(".csv") ||
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel";

    if (!isPdf && !isCsv) {
      set({
        view: "upload",
        error: "Please upload a CDC PDF or CSV file.",
        errorId: createErrorId(),
      });
      return;
    }

    set({
      view: "processing",
      error: null,
      errorId: null,
      progress: 5,
      processingSteps: initialSteps.map((s) => ({ ...s, status: "pending" })),
    });

    try {
      let steps = updateStep(get().processingSteps, "read", "active");
      set({ processingSteps: steps, progress: 10 });

      let records: CDCRecord[] = [];
      let fields: string[] = [];
      let warnings: string[] = [];
      let pageCount: number | undefined;

      if (isCsv) {
        const result = await parseCsvFile(file);
        records = result.records;
        fields = result.fields;
        warnings = result.warnings;
        steps = updateStep(steps, "read", "done");
        steps = updateStep(steps, "extract", "done");
        set({ processingSteps: steps, progress: 45 });
      } else {
        const result = await parsePdfFile(file, (ratio) => {
          set({ progress: 10 + Math.round(ratio * 30) });
        });
        if (result.scannedLikely) {
          throw new Error("SCANNED_PDF");
        }
        records = result.records;
        fields = result.fields;
        warnings = result.warnings;
        pageCount = result.pageCount;
        steps = updateStep(steps, "read", "done");
        steps = updateStep(steps, "extract", "done");
        set({ processingSteps: steps, progress: 45 });
      }

      steps = updateStep(steps, "detect", "active");
      set({ processingSteps: steps, progress: 55 });
      await wait(120);
      steps = updateStep(steps, "detect", "done");
      steps = updateStep(steps, "map", "active");
      set({ processingSteps: steps, progress: 70 });
      await wait(120);

      steps = updateStep(steps, "map", "done");
      steps = updateStep(steps, "insights", "active");
      set({ processingSteps: steps, progress: 85 });

      const analysis = analyzeRecords(
        records,
        {
          name: file.name,
          size: file.size,
          type: isPdf ? "pdf" : "csv",
          pageCount,
          uploadedAt: new Date().toISOString(),
        },
        fields,
        warnings,
      );

      steps = updateStep(steps, "insights", "done");
      steps = updateStep(steps, "dashboard", "done");
      set({
        processingSteps: steps,
        progress: 100,
        analysis,
        view: "dashboard",
      });

      // Touch formatBytes to keep meta helpers available in UI layer imports if needed
      void formatBytes(file.size);
    } catch (error) {
      console.error("CDC processing failed", error);
      const message =
        error instanceof Error && error.message === "SCANNED_PDF"
          ? "This PDF appears to be scanned. OCR is required to extract the data."
          : error instanceof Error && error.message === "NO_CDC_DATA"
            ? "We couldn't understand this file. The file may not contain readable CDC data."
            : "Something went wrong while processing the CDC file.";

      set({
        view: "upload",
        error: message,
        errorId: createErrorId(),
        progress: 0,
        processingSteps: initialSteps,
      });
    }
  },
}));

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function filterRecords(records: CDCRecord[], filters: FilterState): CDCRecord[] {
  const search = filters.search.trim().toLowerCase();

  return records.filter((record) => {
    if (filters.operation !== "all" && record.operation !== filters.operation) return false;

    if (filters.status !== "all") {
      if (String(record.status.status ?? "") !== filters.status) return false;
    }

    if (filters.active !== "all") {
      const want = filters.active === "yes";
      if (record.status.active !== want) return false;
    }

    if (filters.country !== "all") {
      const country = (
        record.entity.country ||
        record.cdc.postInsertIpCountry ||
        ""
      ).toUpperCase();
      if (country !== filters.country.toUpperCase()) return false;
    }

    if (filters.language !== "all") {
      if ((record.entity.language || "").toLowerCase() !== filters.language.toLowerCase()) {
        return false;
      }
    }

    if (filters.violation !== "all") {
      const want = filters.violation === "yes";
      if (record.status.violation !== want) return false;
    }

    if (filters.featured !== "all") {
      const want = filters.featured === "yes";
      if (record.status.featured !== want) return false;
    }

    if (filters.dateFrom || filters.dateTo) {
      if (!record.timestamp) return false;
      const ts = new Date(record.timestamp).getTime();
      if (Number.isNaN(ts)) return false;
      if (filters.dateFrom && ts < new Date(filters.dateFrom).getTime()) return false;
      if (filters.dateTo && ts > new Date(filters.dateTo).getTime() + 86_400_000) return false;
    }

    if (search) {
      const haystack = [
        record.id,
        record.user.memberId,
        record.entity.title,
        record.entity.phone,
        record.cdc.requestId,
        record.operation,
        record.status.status,
        record.entity.category,
        record.entity.country,
        ...Object.entries(record.raw).flatMap(([k, v]) => [k, String(v ?? "")]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}
