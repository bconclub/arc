"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Globe, Loader2 } from "lucide-react";

type Preview = {
  ok?: boolean;
  status?: number;
  url?: string;
  host?: string;
  title?: string | null;
  image?: string | null;
  description?: string | null;
  reason?: string;
};

/**
 * The brand's live site: is it up, and what does it look like right now.
 *
 * The picture is the site's own og:image, so it is whatever its owner publishes
 * for link previews rather than a screenshot bought from a third party. When
 * the site publishes none, the card says so instead of showing a placeholder
 * that would imply the site looks like nothing.
 */
export function SitePreview({ website }: { website: string }) {
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`/api/ops/site-preview?url=${encodeURIComponent(website)}`)
      .then((r) => r.json())
      .then((d) => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setData({ ok: false, reason: "The check itself failed." }); setLoading(false); } });
    return () => { live = false; };
  }, [website]);

  const host = data?.host ?? website.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  const href = data?.url ?? (/^https?:\/\//.test(website) ? website : `https://${website}`);
  const up = data?.ok === true;

  return (
    <section className="overflow-hidden rounded-card border border-[var(--border)] bg-surface">
      {data?.image && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image}
          alt=""
          onError={() => setImgFailed(true)}
          className="h-32 w-full border-b border-[var(--border)] object-cover"
        />
      ) : (
        <div className="flex h-16 items-center justify-center border-b border-[var(--border)] bg-[var(--surface-hover)]">
          <Globe size={20} className="text-text-muted" />
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${loading ? "bg-text-muted" : up ? "bg-accent-green" : "bg-accent-red"}`}
          />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text">{host}</span>
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 text-text-muted transition-colors hover:text-text"
            aria-label={`Open ${host}`}
          >
            <ExternalLink size={13} />
          </a>
        </div>

        <p className="mt-1 text-[11px] leading-snug text-text-muted">
          {loading ? (
            <span className="flex items-center gap-1.5"><Loader2 size={10} className="animate-spin" /> Checking.</span>
          ) : up ? (
            // The title is what the site calls itself, which is more use than
            // repeating the domain that is already on the line above.
            data?.title || "Live, no title published"
          ) : (
            <span className="text-accent-red">
              {data?.reason ?? `Site returned ${data?.status ?? "an error"}`}
            </span>
          )}
        </p>

        {up && data?.description && (
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-text-muted opacity-80">{data.description}</p>
        )}
        {up && !data?.image && (
          <p className="mt-1.5 text-[10.5px] text-text-muted opacity-70">No preview image published by the site.</p>
        )}
      </div>
    </section>
  );
}
