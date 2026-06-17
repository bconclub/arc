"""
STAGE 8a — Pull metrics for published posts.
Platform APIs stubbed — returns zeros until tokens land.
"""
from __future__ import annotations

from arc.config import IG_ACCESS_TOKEN, TIKTOK_TOKEN, LINKEDIN_TOKEN, YOUTUBE_OAUTH_TOKEN
from arc.db import get_posts_needing_metrics, insert_metrics


def pull_analytics() -> dict:
    posts = get_posts_needing_metrics()
    if not posts:
        return {"checked": 0, "updated": 0}

    updated = 0
    for post in posts:
        platform = post.get("platform", "")
        ext_id = post.get("external_post_id", "")

        metrics = _fetch_metrics(platform, ext_id)
        if metrics:
            insert_metrics(post["id"], **metrics)
            updated += 1

    return {"checked": len(posts), "updated": updated}


def _fetch_metrics(platform: str, external_id: str) -> dict | None:
    fetchers = {
        "instagram": _ig_metrics,
        "tiktok": _tiktok_metrics,
        "youtube": _yt_metrics,
        "linkedin": _li_metrics,
    }
    fn = fetchers.get(platform)
    if not fn:
        return None

    try:
        return fn(external_id)
    except NotImplementedError:
        return None
    except Exception as e:
        print(f"[analytics] {platform} metrics error: {e}")
        return None


def _ig_metrics(media_id: str) -> dict:
    if not IG_ACCESS_TOKEN:
        raise NotImplementedError
    # TODO: GET /{media-id}/insights?metric=impressions,reach,saved,comments_count,likes
    raise NotImplementedError


def _tiktok_metrics(video_id: str) -> dict:
    if not TIKTOK_TOKEN:
        raise NotImplementedError
    # TODO: TikTok Research API / Video Query
    raise NotImplementedError


def _yt_metrics(video_id: str) -> dict:
    if not YOUTUBE_OAUTH_TOKEN:
        raise NotImplementedError
    # TODO: YouTube Analytics API — views, likes, comments, shares
    raise NotImplementedError


def _li_metrics(post_id: str) -> dict:
    if not LINKEDIN_TOKEN:
        raise NotImplementedError
    # TODO: LinkedIn Organization Statistics API
    raise NotImplementedError
