"use client";

import { ShieldCheck } from "lucide-react";
import { ProxeListView } from "@/components/proxe/ProxeListView";

export default function ProxeBriefsPage() {
  return (
    <ProxeListView
      kind="brief"
      title="PROXe Briefs"
      icon={ShieldCheck}
      blurb="Daily conversation patterns across every brand, generated from the live dashboards."
      empty="No briefs yet. Once the daily generator runs, patterns land here every morning."
    />
  );
}
