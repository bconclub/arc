"""
STAGE 7 — Queue edited assets and publish per platform.
Publish APIs are stubbed if tokens are absent — posts stay 'queued' until keys land.
"""
from __future__ import annotations

from datetime import datetime, timezone

from arc.brand import BCON
from arc.config import IG_ACCESS_TOKEN, TIKTOK_TOKEN, LINKEDIN_TOKEN, YOUTUBE_OAUTH_TOKEN
from arc.db import (
    get_ideas_by_status, get_script_for_idea, get_edited_asset,
    insert_post, update_post,
)


def queue_and_publish() -> dict:
    """
    For each approved idea with an edited asset:
      - create a post row per platform (if not already queued)
      - attempt to publish; stub if key missing
    """
    approved = get_ideas_by_status("approved")
    queued = 0
    published = 0

    for idea in approved:
        script = get_script_for_idea(idea["id"])
        if not script:
            continue

        asset = get_edited_asset(script["id"])
        if not asset:
            continue

        for platform in BCON["platforms"]:
            post = _queue_post(asset["id"], platform)
            queued += 1

            result = _publish(post, platform, script, asset)
            if result:
                published += 1

    return {"queued": queued, "published": published}


def _queue_post(asset_id: int, platform: str) -> dict:
    """Insert a queued post row (idempotent: check if already exists first)."""
    from arc.db import db as get_db
    existing = (
        get_db()
        .table("posts")
        .select("*")
        .eq("asset_id", asset_id)
        .eq("platform", platform)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    return insert_post(asset_id, platform)


def _publish(post: dict, platform: str, script: dict, asset: dict) -> bool:
    """Dispatch to platform publisher. Returns True if published or stubbed-ok."""
    caption = script.get("caption", "")
    hashtags = " ".join(f"#{h}" for h in (script.get("hashtags") or []))
    full_caption = f"{caption}\n\n{hashtags}".strip()
    video_path = asset.get("storage_path", "")

    publishers = {
        "instagram": _publish_instagram,
        "tiktok": _publish_tiktok,
        "youtube": _publish_youtube,
        "linkedin": _publish_linkedin,
    }

    fn = publishers.get(platform)
    if not fn:
        return False

    try:
        ext_id = fn(video_path, full_caption, script)
        now = datetime.now(timezone.utc).isoformat()
        update_post(post["id"], status="published", external_post_id=ext_id, published_at=now)
        print(f"[schedule] published to {platform} — post {post['id']}")
        return True
    except NotImplementedError:
        print(f"[schedule] {platform} API key absent — post {post['id']} stays queued")
        return False
    except Exception as e:
        update_post(post["id"], status="failed", error=str(e))
        print(f"[schedule] {platform} publish failed: {e}")
        return False


# ── platform publishers ───────────────────────────────────────────────────────

def _publish_instagram(video_path: str, caption: str, script: dict) -> str:
    if not IG_ACCESS_TOKEN:
        raise NotImplementedError("IG_ACCESS_TOKEN not set")
    # TODO: Instagram Graph API — Reels upload flow:
    # 1. POST /me/media (upload container)
    # 2. POST /me/media_publish
    raise NotImplementedError("Instagram publish not wired yet")


def _publish_tiktok(video_path: str, caption: str, script: dict) -> str:
    if not TIKTOK_TOKEN:
        raise NotImplementedError("TIKTOK_TOKEN not set")
    # TODO: TikTok Content Posting API
    raise NotImplementedError("TikTok publish not wired yet")


def _publish_youtube(video_path: str, caption: str, script: dict) -> str:
    if not YOUTUBE_OAUTH_TOKEN:
        raise NotImplementedError("YOUTUBE_OAUTH_TOKEN not set")
    # TODO: YouTube Data API v3 — videos.insert (multipart upload)
    raise NotImplementedError("YouTube publish not wired yet")


def _publish_linkedin(video_path: str, caption: str, script: dict) -> str:
    if not LINKEDIN_TOKEN:
        raise NotImplementedError("LINKEDIN_TOKEN not set")
    # TODO: LinkedIn Video Share API
    raise NotImplementedError("LinkedIn publish not wired yet")
