import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-text-muted" />
    </div>
  );
}
