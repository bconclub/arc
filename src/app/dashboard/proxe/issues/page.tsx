"use client";

import { AlertTriangle } from "lucide-react";
import { ProxeListView } from "@/components/proxe/ProxeListView";

export default function ProxeIssuesPage() {
  return (
    <ProxeListView
      kind="issue"
      title="PROXe Issues"
      icon={AlertTriangle}
      blurb="Issues reported from the PROXe dashboards land here."
      empty="No issues yet. When issues are reported from the dashboards, they appear here."
    />
  );
}
