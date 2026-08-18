"use client";

import { AppShell } from "@/components/shared/app-shell";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { InsightsView, QaView } from "@/components/insights/insights-view";
import { CompareView, RawDataView } from "@/components/records/compare-raw-view";
import { RecordDetailView } from "@/components/records/record-detail-view";
import { RecordsView } from "@/components/records/records-view";
import { StatusView } from "@/components/status/status-view";
import { TimelineView } from "@/components/timeline/timeline-view";
import { ProcessingView } from "@/components/upload/processing-view";
import { UploadView } from "@/components/upload/upload-view";
import { useAppStore } from "@/lib/store";

export function AppRoot() {
  const view = useAppStore((s) => s.view);

  let content = <UploadView />;
  if (view === "processing") content = <ProcessingView />;
  if (view === "dashboard") content = <DashboardView />;
  if (view === "records") content = <RecordsView />;
  if (view === "record-detail") content = <RecordDetailView />;
  if (view === "timeline") content = <TimelineView />;
  if (view === "status") content = <StatusView />;
  if (view === "insights") content = <InsightsView />;
  if (view === "qa") content = <QaView />;
  if (view === "raw") content = <RawDataView />;
  if (view === "compare") content = <CompareView />;

  return <AppShell>{content}</AppShell>;
}
