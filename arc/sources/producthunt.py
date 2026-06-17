"""Product Hunt — RSS feed (no key required for basic feed)."""
from __future__ import annotations

import hashlib
import time
from datetime import datetime, timezone

import feedparser

from arc.sources.base import Source, RawTrend
from arc.config import PRODUCTHUNT_TOKEN

FEED_URL = "https://www.producthunt.com/feed"


class ProductHuntSource(Source):

    def fetch(self) -> list[RawTrend]:
        try:
            feed = feedparser.parse(FEED_URL)
            if feed.bozo:
                print(f"[producthunt] feed parse warning: {feed.bozo_exception}")
        except Exception as e:
            print(f"[producthunt] fetch failed: {e}")
            return []

        max_items = self.config.get("max_items", 20)
        results: list[RawTrend] = []

        for entry in feed.entries[:max_items]:
            link = entry.get("link", "")
            title = entry.get("title", "").strip()
            if not title or not link:
                continue

            # Stable ID: last path segment or hash of URL
            ext_id = link.rstrip("/").rsplit("/", 1)[-1] or hashlib.md5(link.encode()).hexdigest()[:12]

            pub = entry.get("published", "")
            age_hrs = _age_hours(pub)
            # velocity proxy: PH upvotes aren't in RSS; use recency as proxy
            velocity = max(0.0, 100.0 - age_hrs * 2)

            results.append(RawTrend(
                external_id=f"ph-{ext_id}",
                title=title,
                url=link,
                velocity=velocity,
                raw={
                    "source": "producthunt",
                    "published": pub,
                    "summary": entry.get("summary", "")[:500],
                    "tags": [t.get("term", "") for t in entry.get("tags", [])],
                },
            ))

        return results


def _age_hours(pub_str: str) -> float:
    """Parse an RFC 2822 / ISO date string and return hours since publish."""
    if not pub_str:
        return 48.0
    try:
        import email.utils
        ts = email.utils.parsedate_to_datetime(pub_str)
        delta = datetime.now(timezone.utc) - ts.astimezone(timezone.utc)
        return delta.total_seconds() / 3600
    except Exception:
        return 48.0
