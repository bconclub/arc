"use client";

import { Rocket } from "lucide-react";

export default function ProxeUpdatesPage() {
  return (
    <div className="max-w-dashboard mx-auto px-5 py-6">
      <div className="flex items-center gap-3 mb-1">
        <Rocket className="w-5 h-5 text-text-muted" />
        <h1 className="text-xl font-bold text-text">PROXe Updates</h1>
      </div>
      <p className="text-sm text-text-muted mb-6">
        Product updates and release notes shipped across the PROXe brands.
      </p>
      <div className="border border-border rounded-card p-8 text-center">
        <p className="text-text-muted text-sm">
          Wiring in progress — feeds from the PROXe product-updates stream, same ingest path as
          Briefs with <code className="px-1 rounded bg-surface-hover">kind=update</code>.
        </p>
      </div>
    </div>
  );
}
