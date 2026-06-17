"""YouTube — YouTube Data API v3 if key present, else RSS channel feeds."""
from __future__ import annotations

import time
from datetime import datetime, timezone

import feedparser
import requests

from arc.sources.base import Source, RawTrend
from arc.config import YOUTUBE_API_KEY

_YT_API = "https://www.googleapis.com/youtube/v3"

# Fallback: curated channel RSS feeds (no API key needed)
# Format: (channel_id, label)
_CHANNEL_RSS = [
    ("UCVHFbw7woebKtRljqxHK0mg", "Y Combinator"),
    ("UCnUYZLuoy1rq1aVMwx4aTzw", "Graham Stephan"),
    ("UCcefcZRL2oaA_uBNeo5UOWg", "YC Startup School"),
]


class YouTubeSource(Source):

    def fetch(self) -> list[RawTrend]:
        if YOUTUBE_API_KEY:
            return self._fetch_api()
        return self._fetch_rss()

    def _fetch_api(self) -> list[RawTrend]:
        """Pull trending videos from YouTube Data API (requires key)."""
        region = self.config.get("region", "IN")
        max_results = self.config.get("max_results", 20)

        params = {
            "part": "snippet,statistics",
            "chart": "mostPopular",
            "regionCode": region,
            "videoCategoryId": "28",  # Science & Technology
            "maxResults": max_results,
            "key": YOUTUBE_API_KEY,
        }
        try:
            res = requests.get(f"{_YT_API}/videos", params=params, timeout=10)
            res.raise_for_status()
            items = res.json().get("items", [])
        except Exception as e:
            print(f"[youtube] API fetch failed: {e}")
            return self._fetch_rss()

        results: list[RawTrend] = []
        now = time.time()

        for item in items:
            vid_id = item.get("id", "")
            snippet = item.get("snippet", {})
            stats = item.get("statistics", {})
            title = snippet.get("title", "").strip()
            if not title:
                continue

            published = snippet.get("publishedAt", "")
            age_hrs = _age_hours_iso(published)
            views = int(stats.get("viewCount", 0))
            velocity = views / max(age_hrs, 0.01)

            results.append(RawTrend(
                external_id=f"yt-{vid_id}",
                title=title,
                url=f"https://www.youtube.com/watch?v={vid_id}",
                velocity=velocity,
                raw={
                    "source": "youtube",
                    "channel": snippet.get("channelTitle", ""),
                    "views": views,
                    "likes": int(stats.get("likeCount", 0)),
                    "published": published,
                    "description": snippet.get("description", "")[:300],
                    "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                },
            ))

        return results

    def _fetch_rss(self) -> list[RawTrend]:
        """Fallback: parse channel RSS feeds."""
        results: list[RawTrend] = []

        for channel_id, label in _CHANNEL_RSS:
            url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
            try:
                feed = feedparser.parse(url)
                for entry in feed.entries[:5]:
                    vid_id = entry.get("yt_videoid", "") or entry.get("id", "").rsplit(":", 1)[-1]
                    title = entry.get("title", "").strip()
                    link = entry.get("link", f"https://www.youtube.com/watch?v={vid_id}")
                    if not title:
                        continue

                    pub = entry.get("published", "")
                    age_hrs = _age_hours_iso(pub)
                    velocity = max(0.0, 50.0 - age_hrs)

                    results.append(RawTrend(
                        external_id=f"yt-{vid_id}",
                        title=title,
                        url=link,
                        velocity=velocity,
                        raw={"source": "youtube_rss", "channel": label, "published": pub},
                    ))
            except Exception as e:
                print(f"[youtube] RSS fetch for {label} failed: {e}")

        return results


def _age_hours_iso(iso: str) -> float:
    if not iso:
        return 48.0
    try:
        from datetime import datetime, timezone
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).total_seconds() / 3600
    except Exception:
        return 48.0
