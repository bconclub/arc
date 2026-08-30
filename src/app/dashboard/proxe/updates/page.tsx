import { Rocket } from "lucide-react";
import ProxeListView from "@/components/proxe/ProxeListView";

export default function ProxeUpdatesPage() {
  return (
    <ProxeListView
      kind="update"
      icon={Rocket}
      title="PROXe Updates"
      description="Product updates and release notes shipped across the PROXe brands."
      emptyMessage="No updates yet. When product updates are published, they'll appear here."
    />
  );
}
