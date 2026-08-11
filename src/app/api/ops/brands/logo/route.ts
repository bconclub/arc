import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";

/** Google returns a generic grey globe (~700 bytes) with HTTP 200 when a site has
 *  no favicon, so status alone can't be trusted, size is the only tell. */
const GENERIC_FAVICON_MAX_BYTES = 1000;

const IMG_RE = /\.(svg|png|jpe?g|webp|ico)$/i;

/**
 * A brand mark can be named anything. `ISIVIS-Icon.png` and `Maison-ISIVIS.png`
 * are both marks, so the word is matched anywhere in the filename rather than
 * anchored to the start, an earlier `^(logo|icon|…)` pattern rejected both.
 */
const MARK_NAME_RE = /(logo|icon|favicon|mark|brand|apple-touch|symbol|monogram|wordmark)/i;

/** A file inside `…/logo/` is a logo whatever it happens to be called. */
const MARK_DIR_RE = /(^|\/)(logos?|brand(ing)?|icons?|favicons?|marks?|identity)(\/|$)/i;

/** Photography and page furniture that live alongside real marks. */
const REJECT_RE =
  /(hero|cover|banner|press|collection|community|screenshot|gallery|team|people|photo|product|fit.?guide|og[-_]?image|placeholder|thumb)/i;

/** Wide lockups look wrong cropped into a square avatar, so they lose to the icon. */
const WIDE_RE = /(landscape|horizontal|wide|full|lockup|wordmark|text)/i;

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "arc-dashboard",
  };
}

type Candidate = {
  url: string;
  source: "repo" | "favicon";
  label: string;
  /** Raw URLs on a private repo 403 in the browser, surfaced, not silently dropped. */
  needsAuth?: boolean;
};

/** Ranks marks for a small square avatar: square icon first, then format, then path length. */
function score(path: string): number {
  const name = path.split("/").pop() ?? path;
  const shape = /(icon|favicon|apple-touch|symbol|monogram|mark)/i.test(name)
    ? 0
    : /(logo|brand)/i.test(name)
      ? 1
      : 2;
  const wide = WIDE_RE.test(name) ? 2 : 0;
  const format = /\.svg$/i.test(name)
    ? 0
    : /\.png$/i.test(name)
      ? 1
      : /\.ico$/i.test(name)
        ? 2
        : /\.webp$/i.test(name)
          ? 3
          : 4;
  return shape * 10 + wide * 4 + format;
}

/**
 * Finds mark candidates anywhere in a repo.
 *
 * Uses the git tree rather than walking a fixed list of directories: the earlier
 * version listed `public/images` but never descended into it, so a repo keeping
 * its marks in `public/images/logo/` looked empty. One recursive call also costs
 * less than eight directory listings.
 */
async function fromRepo(repo: string, token: string): Promise<Candidate[]> {
  const metaRes = await fetch(`${API}/repos/${repo}`, { headers: ghHeaders(token), cache: "no-store" });
  if (!metaRes.ok) return [];
  const meta = (await metaRes.json()) as { default_branch?: string; private?: boolean };
  const branch = meta.default_branch ?? "main";   // not always "main", this repo is on "master"

  const treeRes = await fetch(`${API}/repos/${repo}/git/trees/${branch}?recursive=1`, {
    headers: ghHeaders(token),
    cache: "no-store",
  });
  if (!treeRes.ok) return [];
  const tree = (await treeRes.json()) as {
    tree?: { path?: string; type?: string }[];
    truncated?: boolean;
  };
  if (!Array.isArray(tree.tree)) return [];

  const hits = tree.tree
    .filter((n) => n.type === "blob" && n.path)
    .map((n) => n.path as string)
    .filter((p) => IMG_RE.test(p) && !REJECT_RE.test(p))
    .filter((p) => MARK_NAME_RE.test(p.split("/").pop() ?? "") || MARK_DIR_RE.test(p))
    .sort((a, b) => score(a) - score(b) || a.length - b.length);

  return hits.map((p) => ({
    // Path segments can contain spaces ("Cover desktop.webp"), so encode them.
    url: `${RAW}/${repo}/${branch}/${p.split("/").map(encodeURIComponent).join("/")}`,
    source: "repo" as const,
    label: `${repo}/${p}`,
    needsAuth: meta.private === true,
  }));
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
 * Finds logo candidates for a brand, first inside any linked GitHub repo, then
 * the site favicon, and with `apply` writes the best one to brands.logo_url.
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
      try {
        candidates.push(...(await fromRepo(repo, token)));
      } catch {
        // one unreadable repo shouldn't abort the search
      }
    }
  }
  for (const d of domains) {
    const fav = await fromFavicon(d);
    if (fav) candidates.push(fav);
  }

  // A private-repo raw URL 403s when the browser loads it, so it is only ever a
  // last resort behind anything that will actually render.
  candidates.sort((a, b) => Number(a.needsAuth ?? false) - Number(b.needsAuth ?? false));

  if (candidates.length === 0) {
    // "No logo in the repo" is a lie when the repo was never searched. Say which.
    const detail =
      repos.length > 0 && !token
        ? "GITHUB_TOKEN is not set on the server, so the linked repo was never searched. Add it and try again."
        : repos.length === 0 && domains.length === 0
          ? "No repo or domain linked to this brand yet."
          : "Nothing found, no logo file in the repo, and the site has no real favicon.";
    return NextResponse.json({ candidates: [], applied: null, detail });
  }

  const best = candidates[0];
  if (apply) {
    await supabaseAdmin
      .from("brands")
      .update({ logo_url: best.url, updated_at: new Date().toISOString() })
      .eq("id", brandId);
  }

  return NextResponse.json({
    candidates,
    applied: apply ? best : null,
    detail: best.needsAuth
      ? `Using ${best.label}, but that repo is private, the raw URL will not load in a browser.`
      : undefined,
  });
}
