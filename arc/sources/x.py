"""X / Twitter — Bearer token required. Stubs gracefully if absent."""
from __future__ import annotations

import requests

from arc.sources.base import Source, RawTrend
from arc.config import X_BEARER_TOKEN

_API_BASE = "https://api.twitter.com/2"


class XSource(Source):

    def fetch(self) -> list[RawTrend]:
        if not X_BEARER_TOKEN:
            print("[x] X_BEARER_TOKEN not set — skipping X source")
            return []

        query = self.handle or "AI tools"
        return self._search_recent(query)

    def _search_recent(self, query: str) -> list[RawTrend]:
        """Twitter v2 recent search — free tier allows 500k tweets/month."""
        params = {
            "query": f"{query} -is:retweet lang:en",
            "max_results": 20,
            "tweet.fields": "created_at,public_metrics,author_id",
        }
        headers = {"Authorization": f"Bearer {X_BEARER_TOKEN}"}

        try:
            res = requests.get(
                f"{_API_BASE}/tweets/search/recent",
                params=params,
                headers=headers,
                timeout=10,
            )
            if res.status_code == 403:
                print("[x] 403 — free tier doesn't include search. Skipping.")
                return []
            res.raise_for_status()
            data = res.json().get("data", [])
        except Exception as e:
            print(f"[x] fetch failed: {e}")
            return []

        results: list[RawTrend] = []
        for tweet in data:
            tid = tweet.get("id", "")
            text = tweet.get("text", "").strip()
            if not text:
                continue

            metrics = tweet.get("public_metrics", {})
            likes = metrics.get("like_count", 0)
            retweets = metrics.get("retweet_count", 0)
            velocity = float(likes + retweets * 2)   # simple engagement score

            results.append(RawTrend(
                external_id=f"x-{tid}",
                title=text[:200],
                url=f"https://x.com/i/web/status/{tid}",
                velocity=velocity,
                raw={
                    "source": "x",
                    "metrics": metrics,
                    "created_at": tweet.get("created_at", ""),
                },
            ))

        return results
