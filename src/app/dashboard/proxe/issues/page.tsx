"use client";

import { AlertTriangle } from "lucide-react";

export default function ProxeIssuesPage() {
  return (
    <div className="max-w-dashboard mx-auto px-5 py-6">
      <div className="flex items-center gap-3 mb-1">
        <AlertTriangle className="w-5 h-5 text-text-muted" />
        <h1 className="text-xl font-bold text-text">PROXe Issues</h1>
      </div>
      <p className="text-sm text-text-muted mb-6">
        Issues reported from the PROXe dashboards land here.
      </p>
      <div className="border border-border rounded-card p-8 text-center">
        <p className="text-text-muted text-sm">
          Wiring in progress — this feeds from the PROXe issue-reports pipeline (the Obsidian
          issues vault). Same ingest path as Briefs, <code className="px-1 rounded bg-surface-hover">kind=issue</code>.
        </p>
      </div>
    </div>
  );
}
