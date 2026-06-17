"""
STAGE 5 — Video generation.
VIDEO_MODE=film (default): emit brief to dashboard, wait for Z to upload raw file.
VIDEO_MODE=ai: stub adapter interface — wire a real provider here later.
"""
from __future__ import annotations

import os

from arc.config import VIDEO_MODE
from arc.db import get_script_for_idea, insert_asset, get_ideas_by_status


def produce_video(script: dict, idea_id: int) -> dict | None:
    """
    Dispatch to the correct adapter based on VIDEO_MODE.
    Returns asset row dict or None if not ready.
    """
    if VIDEO_MODE == "film":
        return _film_mode(script, idea_id)
    elif VIDEO_MODE == "ai":
        return _ai_mode(script, idea_id)
    else:
        print(f"[generate] unknown VIDEO_MODE={VIDEO_MODE}")
        return None


def generate_videos() -> dict:
    """Run generate for all approved ideas that have a script but no raw asset."""
    from arc.db import db as get_db

    approved = get_ideas_by_status("approved")
    if not approved:
        return {"processed": 0, "assets_created": 0}

    processed = 0
    assets_created = 0

    for idea in approved:
        script = get_script_for_idea(idea["id"])
        if not script:
            continue

        # Check if raw asset already exists
        existing = get_db().table("assets").select("id").eq("script_id", script["id"]).eq("kind", "raw").execute()
        if existing.data:
            continue

        processed += 1
        asset = produce_video(script, idea["id"])
        if asset:
            assets_created += 1

    return {"processed": processed, "assets_created": assets_created}


# ── film mode ─────────────────────────────────────────────────────────────────

def _film_mode(script: dict, idea_id: int) -> dict | None:
    """
    Print the filming brief to stdout (dashboard surfaces this).
    No asset is created here — asset is created when Z uploads the raw file.
    """
    brief = _build_brief(script)
    print(f"\n{'='*60}")
    print(f"[generate/film] FILMING BRIEF — idea {idea_id}")
    print(brief)
    print("="*60)
    print("[generate/film] Upload the raw file to register it as an asset.")
    return None   # asset created externally via CLI or dashboard upload


def _build_brief(script: dict) -> str:
    shot_list = script.get("shot_list") or []
    shots_text = "\n".join(
        f"  Shot {s.get('shot', i+1)} ({s.get('duration_s', '?')}s): {s.get('description', '')}"
        for i, s in enumerate(shot_list)
    )
    return f"""
HOOK (0–3s):
  {script.get('hook', '')}

BODY (how-to beats):
  {script.get('body', '')}

ON-SCREEN TEXT:
  {script.get('on_screen_text', [])}

SHOT LIST:
{shots_text}

CAPTION:
  {script.get('caption', '')}

HASHTAGS:
  {' '.join(f'#{h}' for h in (script.get('hashtags') or []))}
""".strip()


# ── AI mode stub ──────────────────────────────────────────────────────────────

def _ai_mode(script: dict, idea_id: int) -> dict | None:
    """
    Stub: wire a real provider (Synthesia / Kling / Runway) here.
    Interface contract: must return an asset dict with storage_path set.
    """
    print(f"[generate/ai] stub — provider not wired yet for idea {idea_id}")
    print("[generate/ai] Set VIDEO_MODE=film or wire a provider in _ai_mode().")
    # Example integration point:
    # response = synthesia_client.create_video(script=script["body"], ...)
    # path = download_and_store(response.video_url)
    # return insert_asset(script["id"], "raw", path, duration_s=...)
    return None
