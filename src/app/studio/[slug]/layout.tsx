import type { Metadata } from "next";

// What a shared link shows in WhatsApp / iMessage / Slack. It used to be the
// parent's fixed "Ideas board · BCON" title over ARC's site-wide "GTM Command
// Center" description; Z (6 Oct): the preview should say what the client does
// on the page, step by step. The brand name comes from the slug only, so a
// preview never reveals more than the link already carries.
const STEPS = "01 Idea · 02 Script · 03 Visual board · 04 Final reel";

function brandName(slug: string): string {
  return decodeURIComponent(slug || "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const name = brandName(params.slug);
  const title = name ? `${name} Brand Reels · BCON` : "Brand Reels · BCON";
  const description = `${STEPS}. Choose your reel idea, approve the script, review the visual board, then get your final reel.`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: "BCON Club", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default function StudioBrandLayout({ children }: { children: React.ReactNode }) {
  return children;
}
