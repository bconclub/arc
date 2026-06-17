"""STAGE 3+4 — Generate script + captions + hashtags + shot list for approved ideas."""
from __future__ import annotations

from arc.brand import BCON
from arc.db import get_ideas_by_status, get_script_for_idea, insert_script, update_idea_status
from arc.llm import call_json

_MIN_LEN, _MAX_LEN = BCON["video_len_s"]

_SYSTEM = f"""You are the head scriptwriter for BCON Club, an AI-native marketing brand.

Brand voice: {BCON['voice']}
Format: {BCON['winning_format']}
Video length: {_MIN_LEN}–{_MAX_LEN} seconds
ICP: {BCON['icp']}

Hook patterns that work for BCON:
{chr(10).join(f"  - {p}" for p in BCON['hook_patterns'])}

You will receive a trend + approved tutorial angle.

Return JSON with exactly these keys:
{{
  "hook": "<first 3 seconds — one punchy sentence that stops the scroll>",
  "body": "<the how-to beats — numbered steps, each 1 sentence, total body fits {_MIN_LEN}-{_MAX_LEN}s when spoken>",
  "on_screen_text": [
    {{"t": 0, "text": "<text overlay at 0s>"}},
    {{"t": 5, "text": "<text overlay at 5s>"}}
  ],
  "caption": "<Instagram/TikTok/LinkedIn caption, 80–150 words, ends with a CTA>",
  "hashtags": ["<tag1>", "<tag2>", "<tag3>", "...up to 10 tags>"],
  "shot_list": [
    {{"shot": 1, "description": "<what to film>", "duration_s": 5}},
    {{"shot": 2, "description": "<what to film>", "duration_s": 8}}
  ]
}}

Shot list should cover the full {_MIN_LEN}–{_MAX_LEN}s. Be specific — what's on screen, what Z says.
Hashtags: mix niche (#AItools, #MarketingHacks) with broad (#reels, #entrepreneur).
Caption ends with exactly one CTA (DM DEMO / Comment LEADS / Save this / etc).
"""


def generate_scripts() -> dict:
    """
    Generate scripts for all 'approved' ideas that don't have a script yet.
    Returns summary: {processed, scripts_created}.
    """
    approved = get_ideas_by_status("approved")
    if not approved:
        print("[script] no approved ideas")
        return {"processed": 0, "scripts_created": 0}

    processed = 0
    created = 0

    for idea in approved:
        # Skip if script already exists
        existing = get_script_for_idea(idea["id"])
        if existing:
            print(f"[script] idea {idea['id']} already has a script — skipping")
            continue

        trend = idea.get("trends") or {}
        angle = idea.get("angle", "")
        title = trend.get("title", "unknown trend")

        print(f"[script] generating for idea {idea['id']}: {title[:60]} ...")
        processed += 1

        try:
            result = call_json(
                system=_SYSTEM,
                user=f"Trend: {title}\nURL: {trend.get('url', '')}\nApproved angle: {angle}",
                max_tokens=1500,
            )
        except Exception as e:
            print(f"[script] LLM error for idea {idea['id']}: {e}")
            continue

        try:
            insert_script(
                idea_id=idea["id"],
                hook=result.get("hook", ""),
                body=result.get("body", ""),
                on_screen_text=result.get("on_screen_text", []),
                caption=result.get("caption", ""),
                hashtags=result.get("hashtags", []),
                shot_list=result.get("shot_list", []),
            )
            created += 1
            print(f"[script] script created for idea {idea['id']}")
        except Exception as e:
            print(f"[script] insert error for idea {idea['id']}: {e}")

    summary = {"processed": processed, "scripts_created": created}
    print(f"[script] done — {summary}")
    return summary
