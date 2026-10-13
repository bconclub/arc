import { ImageResponse } from "next/og";
import { brandBySlug, db, signPaths } from "@/lib/studio";

// The picture WhatsApp / iMessage / Slack show for a client's link. It used to
// fall back to ARC's own app icon; Z (13 Oct): the preview should be the brand's.
// Their logo and name on their colours, with the first idea's storyboard beside
// it. Only for a board whose share link is switched on, and only what the client
// will see anyway (hidden items never appear).
export const alt = "Your brand reel ideas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

type Brand = { id: string; name: string; palette: string[] | null; logo_path: string | null; share_enabled: boolean };

export default async function Image({ params }: { params: { slug: string } }) {
  const brand = (await brandBySlug(params.slug)) as Brand | null;
  const live = brand?.share_enabled ? brand : null;

  let logo: string | null = null, board: string | null = null;
  if (live) {
    const { data: ideas } = await db.from("studio_items").select("id")
      .eq("brand_id", live.id).eq("kind", "idea").eq("hidden", false).order("position", { ascending: true }).limit(1);
    const first = ideas?.[0]?.id as string | undefined;
    const { data: imgs } = first
      ? await db.from("studio_items").select("image_path").eq("parent_id", first).eq("kind", "image").eq("hidden", false)
        .order("created_at", { ascending: false }).limit(1)
      : { data: [] };
    const urls = await signPaths([live.logo_path, imgs?.[0]?.image_path], undefined, 600);
    logo = live.logo_path ? urls.get(live.logo_path) ?? null : null;
    board = imgs?.[0]?.image_path ? urls.get(imgs[0].image_path) ?? null : null;
  }

  const dark = live?.palette?.[0] || "#111111";
  const accent = live?.palette?.[2] || live?.palette?.[1] || "#CBFA0A";
  const name = live?.name || "Brand Reels";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: dark, color: "#fff" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" width={120} height={120} style={{ borderRadius: 20, objectFit: "contain", background: "#F2EBDD" }} />
            )}
            <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>{name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontSize: 48, fontWeight: 700, lineHeight: 1.1 }}>Your reel ideas are ready</div>
            <div style={{ display: "flex", fontSize: 28, color: accent }}>Swipe through them and pick your favourites</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.6)" }}>BCON Club · Brand Reels</div>
        </div>
        {board && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={board} alt="" width={532} height={630} style={{ objectFit: "cover" }} />
        )}
      </div>
    ),
    size,
  );
}
