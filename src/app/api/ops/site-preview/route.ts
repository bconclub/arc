import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Is the brand's site up, and what does it look like?
 *
 * The imagery comes from the site's own og:image rather than a screenshot
 * service, so there is no third party in the path and nothing to pay for. It is
 * the picture the site itself publishes for link previews, which is the picture
 * its owner chose.
 *
 * Only the brand's stored website is ever passed here, but this still refuses
 * private and loopback addresses: a server that will fetch any URL on request
 * can be pointed at things on its own network.
 */

const BLOCKED_HOST = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|::1$|0\.0\.0\.0$|\[)/i;
// 172.16.0.0/12, which is not expressible as a simple prefix.
const BLOCKED_172 = /^172\.(1[6-9]|2\d|3[01])\./;

function pick(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "No url given." }, { status: 400 });

  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return NextResponse.json({ ok: false, reason: "That is not a valid address." });
  }
  if (!/^https?:$/.test(target.protocol) || BLOCKED_HOST.test(target.hostname) || BLOCKED_172.test(target.hostname)) {
    return NextResponse.json({ ok: false, reason: "That address is not allowed." });
  }

  // A dead site should report as dead in a couple of seconds, not hang the card.
  const stop = AbortSignal.timeout(8000);

  try {
    const res = await fetch(target.toString(), {
      signal: stop,
      redirect: "follow",
      headers: { "User-Agent": "ARC/1.0 (+site status check)", Accept: "text/html,*/*" },
    });

    // Only the head of the document is needed, and some sites are very large.
    const html = (await res.text()).slice(0, 200_000);

    const title =
      pick(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<title[^>]*>([^<]+)<\/title>/i,
      ]);
    let image = pick(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ]);
    // og:image is often a path rather than an absolute URL.
    if (image) { try { image = new URL(image, res.url || target).toString(); } catch { image = null; } }

    const description = pick(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    ]);

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      url: res.url || target.toString(),
      host: target.hostname.replace(/^www\./, ""),
      title, image, description,
    });
  } catch (e) {
    // A site that refuses to answer is a fact worth showing, not an error page.
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return NextResponse.json({
      ok: false,
      host: target.hostname.replace(/^www\./, ""),
      url: target.toString(),
      reason: timedOut ? "The site did not respond within 8 seconds." : "The site could not be reached.",
    });
  }
}
