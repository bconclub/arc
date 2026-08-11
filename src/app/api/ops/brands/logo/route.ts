import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const API = "https://api.github.com";

/** Google returns a generic grey globe (~700 bytes) with HTTP 200 when a site has
 *  no favicon, so status alone can't be trusted — size is the only tell. */
const GENERIC_FAVICON_MAX_BYTES = 1000;

const LOGO_DIRS = ["", "public", "public/images", "public/img", "public/assets", "assets", "brand", "static"];
const LOGO_RE = /^(logo|icon|favicon|mark|brand|apple-touch-icon)[\w.-]*\.(svg|png|jpe?g|webp)$/i;

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "arc-dashboard",
  };
}

type Candidate = { url: string; source: string; label: string };

/** Looks for a logo file in the usual places inside a repo. */
async function fromRepo(repo: string, token: string): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const dir of LOGO_DIRS) {
    try {
      const res = await fetch(`${API}/repos/${repo}/contents/${dir}`, {
        headers: ghHeaders(token),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const items = (await res.json()) as { name?: string; type?: string; download_url?: string }[];
      if (!Array.isArray(items)) continue;
      for (const f of items) {
        if (f.type !== "file" || !f.name || !f.download_url) continue;
        if (!LOGO_RE.test(f.name)) continue;
        out.push({ url: f.download_url, source: "repo", label: `${repo}/${dir ? dir + "/" : ""}${f.name}` });
      }
    } catch {
      // one unreadable directory shouldn't abort the search
    }
  }
  // Prefer svg, then png, and shorter names ("logo.svg" over "logo-dark-alt.png").
  return out.sort((a, b) => {
    const score = (c: Candidate) => (/\.svg$/i.test(c.url) ? 0 : /\.png$/i.test(c.url) ? 1 : 2);
    return score(a) - score(b) || a.label.length - b.label.length;
  });
}

/** Site favicon, but only when it's a real one rather than the grey placeholder. */
async function fromFavicon(domain: string): Promise<Candidate | null> {
  const host = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!host) return null;
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  try {
    const res = await fetch(url, { redirect: "follow", cache: "no-store" });
    if (!res.ok) return null;
    const bytes = (await res.arrayBuffer()).byteLength;
    if (bytes <= GENERIC_FAVICON_MAX_BYTES) return null;   // generic globe
    return { url, source: "favicon", label: `${host} favicon (${bytes}b)` };
  } catch {
    return null;
  }
}

/**
 * POST { brandId, apply?: boolean }
 *
 * Finds logo candidates for a brand — first inside any linked GitHub repo, then
 * the site favicon — and with `apply` writes the best one to brands.logo_url.
 * Resolving once and storing the result keeps the generic-globe check on the
 * server, where the response body can actually be measured.
 */
export async function POST(req: NextRequest) {
  const { brandId, apply = true } = await req.json();
  if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

  const { data: brand, error } = await supabaseAdmin
    .from("brands")
    .select("id,name,domains,github_repos")
    .eq("id", brandId)
    .single();
  if (error || !brand) return NextResponse.json({ error: error?.message ?? "brand not found" }, { status: 404 });

  const repos = (brand.github_repos as string[] | null) ?? [];
  const domains = (brand.domains as string[] | null) ?? [];
  const token = process.env.GITHUB_TOKEN;

  const candidates: Candidate[] = [];
  if (token) {
    for (const repo of repos) {
      candidates.push(...(await fromRepo(repo, token)));
    }
  }
  for (const d of domains) {
    const fav = await fromFavicon(d);
    if (fav) candidates.push(fav);
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      candidates: [],
      applied: null,
      detail: repos.length === 0 && domains.length === 0
        ? "No repo or domain linked to this brand yet."
        : "Nothing found — no logo file in the repo, and the site has no real favicon.",
    });
  }

  const best = candidates[0];
  if (apply) {
    await supabaseAdmin
      .from("brands")
      .update({ logo_url: best.url, updated_at: new Date().toISOString() })
      .eq("id", brandId);
  }

  return NextResponse.json({ candidates, applied: apply ? best : null });
}
