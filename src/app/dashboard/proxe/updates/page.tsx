"use client";

import { Rocket } from "lucide-react";
import { ProxeListView } from "@/components/proxe/ProxeListView";

export default function ProxeUpdatesPage() {
  return (
    <ProxeListView
      kind="update"
      title="PROXe Updates"
      icon={Rocket}
      blurb="Product updates and release notes shipped across the PROXe brands."
      empty="No updates yet. When product updates are published, they appear here."
    />
  );
}
