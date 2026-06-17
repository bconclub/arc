"""STAGE 1 — Pull from all enabled sources, normalise, dedupe into trends table."""
from __future__ import annotations

from arc.db import db, get_enabled_sources, upsert_trend
from arc.sources.base import Source
from arc.sources.producthunt import ProductHuntSource
from arc.sources.reddit import RedditSource
from arc.sources.youtube import YouTubeSource
from arc.sources.x import XSource

_SOURCE_MAP: dict[str, type[Source]] = {
    "producthunt": ProductHuntSource,
    "reddit": RedditSource,
    "youtube": YouTubeSource,
    "x": XSource,
}


def aggregate() -> dict:
    """
    Pull from all enabled arc_sources.
    Returns summary: {pulled, saved, skipped_sources}.
    """
    sources = get_enabled_sources()
    if not sources:
        print("[aggregate] no enabled sources found")
        return {"pulled": 0, "saved": 0, "skipped_sources": 0}

    total_pulled = 0
    total_saved = 0
    skipped = 0

    for row in sources:
        kind = row["kind"]
        cls = _SOURCE_MAP.get(kind)
        if not cls:
            print(f"[aggregate] unknown source kind: {kind} — skipping")
            skipped += 1
            continue

        source = cls(row)
        print(f"[aggregate] fetching {kind}/{row.get('handle') or 'default'} ...")

        try:
            trends = source.fetch()
        except Exception as e:
            print(f"[aggregate] {kind} fetch error: {e}")
            skipped += 1
            continue

        total_pulled += len(trends)

        for t in trends:
            result = upsert_trend(
                source_id=row["id"],
                external_id=t.external_id,
                title=t.title,
                url=t.url,
                raw=t.raw,
                velocity=t.velocity,
            )
            if result:
                total_saved += 1

    summary = {"pulled": total_pulled, "saved": total_saved, "skipped_sources": skipped}
    print(f"[aggregate] done — {summary}")
    return summary
