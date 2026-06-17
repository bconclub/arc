"""STAGE 8b — Daily/weekly digest: what posted, top performer, fit-score vs engagement."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from arc.db import db, get_recent_runs


def build_report(period: str = "daily") -> dict:
    """
    Build a report dict for the given period (daily | weekly).
    Saved to dashboard. Returns the report dict.
    """
    now = datetime.now(timezone.utc)
    if period == "weekly":
        since = now - timedelta(days=7)
    else:
        since = now - timedelta(days=1)

    since_iso = since.isoformat()

    # Posts in period
    posts_res = (
        db()
        .table("posts")
        .select("*, assets(script_id, scripts(idea_id, ideas(fit_score, angle, trends(title))))")
        .eq("status", "published")
        .gte("published_at", since_iso)
        .execute()
    )
    posts = posts_res.data or []

    # Metrics for those posts
    post_ids = [p["id"] for p in posts]
    metrics_res = db().table("metrics").select("*").in_("post_id", post_ids).execute() if post_ids else type("R", (), {"data": []})()
    metrics = metrics_res.data or []

    # Aggregate per post
    metrics_by_post: dict[int, dict] = {}
    for m in metrics:
        pid = m["post_id"]
        existing = metrics_by_post.get(pid, {})
        # Take the latest snapshot (highest views)
        if m.get("views", 0) >= existing.get("views", 0):
            metrics_by_post[pid] = m

    enriched = []
    for post in posts:
        m = metrics_by_post.get(post["id"], {})
        score = (m.get("likes", 0) * 2 + m.get("comments", 0) * 3 +
                 m.get("saves", 0) * 4 + m.get("shares", 0) * 5)
        enriched.append({
            "post_id": post["id"],
            "platform": post["platform"],
            "views": m.get("views", 0),
            "engagement_score": score,
            "fit_score": _dig(post, "assets", "scripts", "ideas", "fit_score"),
            "angle": _dig(post, "assets", "scripts", "ideas", "angle"),
            "trend_title": _dig(post, "assets", "scripts", "ideas", "trends", "title"),
        })

    enriched.sort(key=lambda x: x["engagement_score"], reverse=True)
    top = enriched[0] if enriched else None

    # Recent runs
    runs = get_recent_runs(5)

    report = {
        "period": period,
        "generated_at": now.isoformat(),
        "posts_published": len(posts),
        "top_performer": top,
        "all_posts": enriched,
        "recent_runs": [
            {"stage": r["stage"], "ok": r["ok"], "started_at": r["started_at"]}
            for r in runs
        ],
    }

    print(f"[report] {period} — {len(posts)} posts, top: {top}")
    return report


def _dig(obj: dict, *keys: str):
    """Safely traverse nested dicts."""
    for k in keys:
        if not isinstance(obj, dict):
            return None
        obj = obj.get(k)
    return obj
