"""STAGE 2 — Score each new trend against BCON profile, insert top ideas."""
from __future__ import annotations

import math

from arc.brand import BCON
from arc.db import get_uneval_trends, insert_idea
from arc.llm import call_json

_MIN_FIT_SCORE = 40   # below this, don't create an idea
_TOP_N = 5            # only surface the top N per run to keep dashboard clean

_SYSTEM = f"""You are the content strategist for BCON Club.

BCON profile:
- Positioning: {BCON['positioning']}
- Winning format: {BCON['winning_format']}
- Voice: {BCON['voice']}
- ICP: {BCON['icp']}

Fit signals (what makes a trend worth actioning):
{chr(10).join(f"  + {s}" for s in BCON['fit_signals'])}

Anti-signals (automatic disqualifiers):
{chr(10).join(f"  - {s}" for s in BCON['anti_signals'])}

You will receive a trend (title + url + source metadata).
Return JSON with exactly these keys:
{{
  "fit_score": <0-100 integer>,
  "rationale": "<1-2 sentence explanation>",
  "angle": "<specific tutorial angle BCON should take, e.g. 'How to use X to do Y in 20 seconds'>"
}}

Be harsh. Most trends should score under 40. A score above 70 means we post today.
"""


def evaluate(limit: int = 30) -> dict:
    """
    Score up to `limit` unevaluated trends.
    Rank by fit_score * log(velocity + 1), insert top _TOP_N as proposed ideas.
    Returns summary: {evaluated, ideas_created}.
    """
    trends = get_uneval_trends(limit=limit)
    if not trends:
        print("[evaluate] no new trends to evaluate")
        return {"evaluated": 0, "ideas_created": 0}

    print(f"[evaluate] scoring {len(trends)} trends ...")
    scored: list[dict] = []

    for trend in trends:
        try:
            result = call_json(
                system=_SYSTEM,
                user=f"Title: {trend['title']}\nURL: {trend['url']}\nSource: {trend['raw']}",
                max_tokens=512,
            )
            fit_score = float(result.get("fit_score", 0))
            rationale = str(result.get("rationale", ""))
            angle = str(result.get("angle", ""))
        except Exception as e:
            print(f"[evaluate] LLM error for trend {trend['id']}: {e}")
            continue

        velocity = float(trend.get("velocity") or 0)
        rank = fit_score * math.log(velocity + 1)

        scored.append({
            "trend": trend,
            "fit_score": fit_score,
            "rationale": rationale,
            "angle": angle,
            "rank": rank,
        })

    # Filter and rank
    qualified = [s for s in scored if s["fit_score"] >= _MIN_FIT_SCORE]
    qualified.sort(key=lambda x: x["rank"], reverse=True)
    top = qualified[:_TOP_N]

    ideas_created = 0
    for item in top:
        try:
            insert_idea(
                trend_id=item["trend"]["id"],
                fit_score=item["fit_score"],
                rationale=item["rationale"],
                angle=item["angle"],
            )
            ideas_created += 1
            print(f"[evaluate] idea created — score={item['fit_score']} — {item['trend']['title'][:60]}")
        except Exception as e:
            print(f"[evaluate] insert_idea error: {e}")

    summary = {"evaluated": len(scored), "ideas_created": ideas_created}
    print(f"[evaluate] done — {summary}")
    return summary
