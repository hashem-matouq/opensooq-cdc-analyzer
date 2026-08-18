"use client";

import { Check, LoaderCircle } from "lucide-react";
import { Card } from "@/components/shared/ui";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ProcessingView() {
  const steps = useAppStore((s) => s.processingSteps);
  const progress = useAppStore((s) => s.progress);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="animate-fade-up w-full max-w-lg p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--os-blue)] text-sm font-bold text-white">
            OS
          </span>
          <div>
            <h1 className="font-display text-lg font-semibold text-[var(--os-navy)]">
              Analyzing CDC data
            </h1>
            <p className="text-sm text-[var(--os-muted)]">Processing locally in your browser</p>
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--os-navy)]">Progress</span>
            <span className="tabular text-[var(--os-muted)]">{progress}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--os-soft)]"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--os-blue)] to-[var(--os-green)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ul className="mt-7 space-y-1">
          {steps.map((step) => (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                step.status === "active" && "bg-[var(--os-sky)]",
              )}
            >
              <StepIcon status={step.status} />
              <span
                className={cn(
                  step.status === "pending" && "text-[var(--os-muted)]",
                  step.status === "active" && "font-medium text-[var(--os-blue-dark)]",
                  step.status === "done" && "text-[var(--os-navy)]",
                )}
              >
                {step.label}
              </span>
              {step.status === "done" ? (
                <span className="ml-auto text-xs text-[var(--os-green)]">Done</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function StepIcon({ status }: { status: "pending" | "active" | "done" | "error" }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--os-green-soft)] text-[var(--os-green)]">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[var(--os-blue)]">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--os-soft)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--os-border-strong)]" />
    </span>
  );
}
