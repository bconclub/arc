import { AlertTriangle } from "lucide-react";
import ProxeListView from "@/components/proxe/ProxeListView";

export default function ProxeIssuesPage() {
  return (
    <ProxeListView
      kind="issue"
      icon={AlertTriangle}
      title="PROXe Issues"
      description="Issues reported from the PROXe dashboards land here."
      emptyMessage="No issues yet. When issues are reported from the dashboards, they'll appear here."
    />
  );
}
