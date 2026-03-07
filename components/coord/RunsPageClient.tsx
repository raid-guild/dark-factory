"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/coord/StatusPill";
import { runStatusMeta } from "@/components/coord/status";
import { mockRuns } from "@/lib/coord/mock";
import type { WorkflowRun } from "@/lib/coord/types";

async function loadRuns(): Promise<{ items: WorkflowRun[]; source: "api" | "mock" }> {
  try {
    const response = await fetch("/api/v1/workflow-runs", { cache: "no-store" });
    if (!response.ok) return { items: mockRuns, source: "mock" };
    const data = (await response.json()) as { items?: WorkflowRun[] };
    if (!Array.isArray(data.items) || data.items.length === 0) return { items: mockRuns, source: "mock" };
    return { items: data.items, source: "api" };
  } catch {
    return { items: mockRuns, source: "mock" };
  }
}

export function RunsPageClient() {
  const [runs, setRuns] = useState<WorkflowRun[]>(mockRuns);
  const [source, setSource] = useState<"api" | "mock">("mock");

  useEffect(() => {
    loadRuns().then((result) => {
      setRuns(result.items);
      setSource(result.source);
    });
  }, []);

  const statusCounts = useMemo(() => {
    return runs.reduce<Record<string, number>>((acc, run) => {
      acc[run.status] = (acc[run.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [runs]);

  return (
    <main className="container-custom">
      <p className="type-label-sm">WORKFLOW RUNS</p>
      <h1 className="type-display-lg">Factory Queue</h1>
      <p className="type-body-md">
        {source === "api" ? "Live API data" : "Mock fallback data"} for workflow runs.
      </p>

      <section className="runs-summary">
        {Object.entries(statusCounts).map(([status, count]) => (
          <article key={status} className="summary-card">
            <p>{status.replace("_", " ")}</p>
            <strong>{count}</strong>
          </article>
        ))}
      </section>

      <section className="runs-list">
        {runs.map((run) => {
          const status = runStatusMeta[run.status];
          return (
            <Link className="run-card" href={`/runs/${run.id}`} key={run.id}>
              <div className="run-card-head">
                <h3>{run.id}</h3>
                <StatusPill className={status.className} label={status.label} />
              </div>
              <p>Template: {run.workflow_template_id}</p>
              <p>Started: {run.started_at ? new Date(run.started_at).toLocaleString() : "n/a"}</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
