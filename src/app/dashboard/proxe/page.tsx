import { ShieldCheck } from "lucide-react";
import ProxeListView from "@/components/proxe/ProxeListView";

export default function ProxeBriefsPage() {
  return (
    <ProxeListView
      kind="brief"
      icon={ShieldCheck}
      title="PROXe Briefs"
      description="Daily conversation patterns across every brand, generated from the live dashboards."
      emptyMessage="No briefs yet. Once the daily generator runs, patterns land here every morning."
    />
  );
}
