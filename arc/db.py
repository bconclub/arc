"""Supabase client + typed helpers for every ARC table."""
from __future__ import annotations

import json
from typing import Any
from supabase import create_client, Client
from arc.config import SUPABASE_URL, SUPABASE_KEY

_client: Client | None = None


def db() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


# ── arc_sources ───────────────────────────────────────────────────────────────

def get_enabled_sources() -> list[dict]:
    res = db().table("arc_sources").select("*").eq("enabled", True).execute()
    return res.data or []


# ── trends ────────────────────────────────────────────────────────────────────

def upsert_trend(
    source_id: int,
    external_id: str,
    title: str,
    url: str,
    raw: dict,
    velocity: float = 0.0,
) -> dict | None:
    row = {
        "source_id": source_id,
        "external_id": external_id,
        "title": title,
        "url": url,
        "raw": raw,
        "velocity": velocity,
    }
    res = (
        db()
        .table("trends")
        .upsert(row, on_conflict="source_id,external_id", ignore_duplicates=True)
        .execute()
    )
    data = res.data or []
    return data[0] if data else None


def get_uneval_trends(limit: int = 50) -> list[dict]:
    """Trends that don't have a corresponding idea yet."""
    existing = db().table("ideas").select("trend_id").execute()
    seen_ids = {r["trend_id"] for r in (existing.data or [])}

    res = (
        db()
        .table("trends")
        .select("*")
        .order("pulled_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = res.data or []
    return [r for r in rows if r["id"] not in seen_ids]


# ── ideas ─────────────────────────────────────────────────────────────────────

def insert_idea(trend_id: int, fit_score: float, rationale: str, angle: str) -> dict:
    res = (
        db()
        .table("ideas")
        .insert({
            "trend_id": trend_id,
            "fit_score": fit_score,
            "rationale": rationale,
            "angle": angle,
            "status": "proposed",
        })
        .execute()
    )
    return (res.data or [{}])[0]


def get_ideas_by_status(status: str) -> list[dict]:
    res = (
        db()
        .table("ideas")
        .select("*, trends(*)")
        .eq("status", status)
        .order("fit_score", desc=True)
        .execute()
    )
    return res.data or []


def update_idea_status(idea_id: int, status: str) -> None:
    db().table("ideas").update({"status": status}).eq("id", idea_id).execute()


# ── scripts ───────────────────────────────────────────────────────────────────

def insert_script(
    idea_id: int,
    hook: str,
    body: str,
    on_screen_text: list,
    caption: str,
    hashtags: list[str],
    shot_list: list,
) -> dict:
    res = (
        db()
        .table("scripts")
        .insert({
            "idea_id": idea_id,
            "hook": hook,
            "body": body,
            "on_screen_text": on_screen_text,
            "caption": caption,
            "hashtags": hashtags,
            "shot_list": shot_list,
        })
        .execute()
    )
    return (res.data or [{}])[0]


def get_script_for_idea(idea_id: int) -> dict | None:
    res = db().table("scripts").select("*").eq("idea_id", idea_id).limit(1).execute()
    data = res.data or []
    return data[0] if data else None


# ── assets ────────────────────────────────────────────────────────────────────

def insert_asset(script_id: int, kind: str, storage_path: str, duration_s: float = 0) -> dict:
    res = (
        db()
        .table("assets")
        .insert({"script_id": script_id, "kind": kind, "storage_path": storage_path, "duration_s": duration_s})
        .execute()
    )
    return (res.data or [{}])[0]


def get_edited_asset(script_id: int) -> dict | None:
    res = db().table("assets").select("*").eq("script_id", script_id).eq("kind", "edited").limit(1).execute()
    data = res.data or []
    return data[0] if data else None


# ── posts ─────────────────────────────────────────────────────────────────────

def insert_post(asset_id: int, platform: str, scheduled_for: str | None = None) -> dict:
    res = (
        db()
        .table("posts")
        .insert({"asset_id": asset_id, "platform": platform, "status": "queued", "scheduled_for": scheduled_for})
        .execute()
    )
    return (res.data or [{}])[0]


def update_post(post_id: int, **kwargs: Any) -> None:
    db().table("posts").update(kwargs).eq("id", post_id).execute()


def get_published_posts(limit: int = 50) -> list[dict]:
    res = (
        db()
        .table("posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


def get_posts_needing_metrics() -> list[dict]:
    res = (
        db()
        .table("posts")
        .select("*")
        .eq("status", "published")
        .not_.is_("external_post_id", "null")
        .execute()
    )
    return res.data or []


# ── metrics ───────────────────────────────────────────────────────────────────

def insert_metrics(post_id: int, views: int, likes: int, comments: int,
                   shares: int, saves: int, follows: int, raw: dict) -> dict:
    res = (
        db()
        .table("metrics")
        .insert({
            "post_id": post_id,
            "views": views, "likes": likes, "comments": comments,
            "shares": shares, "saves": saves, "follows": follows,
            "raw": raw,
        })
        .execute()
    )
    return (res.data or [{}])[0]


# ── runs ──────────────────────────────────────────────────────────────────────

def start_run(stage: str = "full_loop") -> int:
    res = db().table("runs").insert({"stage": stage, "ok": None}).execute()
    return (res.data or [{}])[0]["id"]


def finish_run(run_id: int, summary: dict, ok: bool) -> None:
    from datetime import datetime, timezone
    db().table("runs").update({
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "ok": ok,
    }).eq("id", run_id).execute()


def get_recent_runs(limit: int = 10) -> list[dict]:
    res = db().table("runs").select("*").order("started_at", desc=True).limit(limit).execute()
    return res.data or []
