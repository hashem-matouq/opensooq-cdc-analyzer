"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Lock,
  ListTree,
  ShieldAlert,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/shared/ui";
import { useAppStore } from "@/lib/store";
import { cn, formatBytes } from "@/lib/utils";

const CAPABILITIES = [
  {
    icon: Sparkles,
    title: "Business language",
    text: "Technical columns become plain meaning: ACTIVE=1 reads as Active — Yes.",
  },
  {
    icon: ListTree,
    title: "Full lifecycle timeline",
    text: "Every listing is replayed from its first event to its last, with what changed.",
  },
  {
    icon: ShieldAlert,
    title: "QA anomaly detection",
    text: "Duplicate events, invalid combinations and suspicious sequences are flagged.",
  },
  {
    icon: Lock,
    title: "Stays on your machine",
    text: "Files are parsed in your browser. Nothing is sent to external services.",
  },
];

export function UploadView() {
  const processFile = useAppStore((s) => s.processFile);
  const error = useAppStore((s) => s.error);
  const errorId = useAppStore((s) => s.errorId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [picked, setPicked] = useState<File | null>(null);

  const onFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setPicked(file);
      await processFile(file);
    },
    [processFile],
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--os-border)] bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 md:px-6">
          <Image
            src="/opensooq-logo.png"
            alt="OpenSooq"
            width={230}
            height={104}
            priority
            className="h-9 w-auto"
          />
          <div className="border-l border-[var(--os-border)] pl-3">
            <div className="text-sm font-semibold leading-tight text-[var(--os-navy)]">
              CDC Data Analyzer
            </div>
            <div className="text-xs leading-tight text-[var(--os-muted)]">
              Made by Hashem Matouq
            </div>
          </div>
          <div className="ml-auto hidden sm:block">
            <Badge tone="success" dot>
              Local processing
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_460px]">
          <div className="animate-fade-up">
            <Badge tone="brand">CDC → Business information</Badge>
            <h1 className="font-display mt-4 text-[34px] font-bold leading-[1.15] text-[var(--os-navy)] md:text-[42px]">
              Understand what your CDC data actually means
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--os-muted)]">
              Upload a CDC export and get a readable story of every listing: what was created,
              what changed, who acted, and what looks wrong — without reading a single database
              column.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {CAPABILITIES.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--os-sky)] text-[var(--os-blue)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-[var(--os-navy)]">{item.title}</div>
                      <p className="mt-1 text-[13px] leading-relaxed text-[var(--os-muted)]">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-[var(--os-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[var(--os-green)]" />
                Unknown fields handled gracefully
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[var(--os-green)]" />
                Phone, email and IP masked by default
              </span>
            </div>
          </div>

          <Card className="animate-fade-up overflow-hidden">
            <div className="border-b border-[var(--os-border)] px-5 py-4">
              <h2 className="font-display text-base font-semibold text-[var(--os-navy)]">
                Upload CDC file
              </h2>
              <p className="mt-0.5 text-sm text-[var(--os-muted)]">
                PDF or CSV, multiple pages and large exports supported.
              </p>
            </div>

            <div className="p-5">
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload CDC PDF or CSV file"
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition",
                  dragOver
                    ? "border-[var(--os-blue)] bg-[var(--os-sky)]"
                    : "border-[var(--os-border-strong)] bg-[var(--os-soft)] hover:border-[var(--os-blue)] hover:bg-[var(--os-sky)]",
                )}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void onFile(e.dataTransfer.files?.[0]);
                }}
              >
                <span
                  className={cn(
                    "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[var(--os-blue)] shadow-sm",
                    dragOver && "animate-pulse-ring",
                  )}
                >
                  <UploadCloud className="h-7 w-7" />
                </span>
                <div className="text-base font-semibold text-[var(--os-navy)]">
                  Drop your file here
                </div>
                <p className="mt-1 text-sm text-[var(--os-muted)]">or click to browse</p>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-[var(--os-muted-strong)] shadow-sm">
                    <FileText className="h-3.5 w-3.5 text-[var(--os-danger)]" /> PDF
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-[var(--os-muted-strong)] shadow-sm">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--os-green)]" /> CSV
                  </span>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.csv,application/pdf,text/csv"
                  className="hidden"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
              </div>

              <Button className="mt-4 w-full" onClick={() => inputRef.current?.click()}>
                Choose file
              </Button>

              {picked && !error ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--os-soft)] px-3 py-2.5 text-sm">
                  <span className="truncate font-medium text-[var(--os-navy)]">{picked.name}</span>
                  <span className="shrink-0 text-xs text-[var(--os-muted)]">
                    {formatBytes(picked.size)}
                  </span>
                </div>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-[#f2c9c9] bg-[var(--os-danger-soft)] px-4 py-3"
                >
                  <div className="text-sm font-medium text-[var(--os-danger)]">{error}</div>
                  {errorId ? (
                    <div className="mt-1 font-mono text-xs text-[var(--os-muted)]">
                      Error ID: {errorId}
                    </div>
                  ) : null}
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => inputRef.current?.click()}
                  >
                    Try another file
                  </Button>
                </div>
              ) : null}

              <p className="mt-4 text-center text-xs leading-relaxed text-[var(--os-muted)]">
                Files never leave your browser. A sample file is available at{" "}
                <span className="font-mono">sample-data/sample-cdc.csv</span>.
              </p>
            </div>
          </Card>
        </div>

        <footer className="mt-12 border-t border-[var(--os-border)] pt-5 text-center text-xs text-[var(--os-muted)]">
          <span className="font-semibold text-[var(--os-blue)]">OpenSooq</span> CDC Data Analyzer ·
          Made by <span className="font-semibold text-[var(--os-navy)]">Hashem Matouq</span>
        </footer>
      </div>
    </div>
  );
}
