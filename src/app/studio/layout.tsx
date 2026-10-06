import type { Metadata } from "next";

// Client boards are opened from private links: keep them out of search engines.
export const metadata: Metadata = {
  title: "Ideas board · BCON",
  robots: { index: false, follow: false },
};

export default function StudioShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
