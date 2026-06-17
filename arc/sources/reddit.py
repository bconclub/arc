"""Reddit — uses PRAW if keys present, falls back to public JSON API."""
from __future__ import annotations

import time
from datetime import datetime, timezone

import requests

from arc.sources.base import Source, RawTrend
from arc.config import REDDIT_CLIENT_ID, REDDIT_SECRET, REDDIT_USER_AGENT

_HEADERS = {"User-Agent": REDDIT_USER_AGENT or "arc-agent/0.1"}


class RedditSource(Source):

    def fetch(self) -> list[RawTrend]:
        subreddit = self.handle or "marketing"
        limit = self.config.get("limit", 25)
        sort = self.config.get("sort", "hot")  # hot | rising | top

        if REDDIT_CLIENT_ID and REDDIT_SECRET:
            return self._fetch_oauth(subreddit, sort, limit)
        return self._fetch_public(subreddit, sort, limit)

    def _fetch_public(self, subreddit: str, sort: str, limit: int) -> list[RawTrend]:
        url = f"https://www.reddit.com/r/{subreddit}/{sort}.json?limit={limit}"
        try:
            res = requests.get(url, headers=_HEADERS, timeout=10)
            res.raise_for_status()
            posts = res.json().get("data", {}).get("children", [])
        except Exception as e:
            print(f"[reddit/{subreddit}] fetch failed: {e}")
            return []

        return _parse_posts(posts)

    def _fetch_oauth(self, subreddit: str, sort: str, limit: int) -> list[RawTrend]:
        """OAuth app-only auth for higher rate limits."""
        try:
            token_res = requests.post(
                "https://www.reddit.com/api/v1/access_token",
                data={"grant_type": "client_credentials"},
                auth=(REDDIT_CLIENT_ID, REDDIT_SECRET),
                headers=_HEADERS,
                timeout=10,
            )
            token_res.raise_for_status()
            token = token_res.json().get("access_token", "")

            headers = {**_HEADERS, "Authorization": f"bearer {token}"}
            url = f"https://oauth.reddit.com/r/{subreddit}/{sort}?limit={limit}"
            res = requests.get(url, headers=headers, timeout=10)
            res.raise_for_status()
            posts = res.json().get("data", {}).get("children", [])
        except Exception as e:
            print(f"[reddit/{subreddit}] oauth fetch failed, falling back to public: {e}")
            return self._fetch_public(subreddit, sort, limit)

        return _parse_posts(posts)


def _parse_posts(children: list) -> list[RawTrend]:
    results: list[RawTrend] = []
    now = time.time()

    for child in children:
        post = child.get("data", {})
        post_id = post.get("id", "")
        title = post.get("title", "").strip()
        url = post.get("url") or f"https://reddit.com{post.get('permalink', '')}"
        if not title or not post_id:
            continue

        created_utc = post.get("created_utc", now)
        age_hrs = max(0.01, (now - created_utc) / 3600)
        upvotes = post.get("score", 0)
        velocity = upvotes / age_hrs   # upvotes per hour

        results.append(RawTrend(
            external_id=f"reddit-{post_id}",
            title=title,
            url=url,
            velocity=velocity,
            raw={
                "source": "reddit",
                "subreddit": post.get("subreddit", ""),
                "score": upvotes,
                "num_comments": post.get("num_comments", 0),
                "selftext": post.get("selftext", "")[:300],
                "flair": post.get("link_flair_text", ""),
                "age_hrs": round(age_hrs, 2),
            },
        ))

    return results
