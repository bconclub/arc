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
  // The invite comes first; the steps follow. The picture is opengraph-image.tsx (the brand's own).
  const description = `Your reel ideas are ready. Swipe through them and pick your favourites. ${STEPS}.`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: "BCON Club", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function StudioBrandLayout({ children }: { children: React.ReactNode }) {
  return children;
}
