"""
The loop. Cron wakes this. The agent decides if there's anything worth doing.
Phase 1: stops after evaluate, surfaces proposed ideas to dashboard.
         Script→publish only runs for ideas Z has approved.
Phase 2: flip APPROVAL_GATE=auto to self-approve top idea.
"""
from __future__ import annotations

from arc.config import APPROVAL_GATE
from arc.db import start_run, finish_run, get_ideas_by_status
from arc.pipeline.aggregate import aggregate
from arc.pipeline.evaluate import evaluate
from arc.pipeline.script import generate_scripts
from arc.pipeline.generate import generate_videos
from arc.pipeline.edit import run_edits
from arc.pipeline.schedule import queue_and_publish
from arc.pipeline.analytics import pull_analytics
from arc.pipeline.report import build_report


def run_loop(stages: list[str] | None = None, dry_run: bool = False) -> dict:
    """
    Full orchestration loop.
    stages: if provided, only run these stages (e.g. ['aggregate', 'evaluate'])
    dry_run: log what would happen, don't write to DB
    """
    run_id = None if dry_run else start_run("full_loop" if not stages else "+".join(stages))
    summary: dict = {}
    ok = True

    try:
        def should_run(stage: str) -> bool:
            return stages is None or stage in stages

        # STAGE 1 — always pull new trends
        if should_run("aggregate"):
            summary["aggregate"] = aggregate() if not dry_run else {"dry": True}

        # STAGE 2 — always evaluate new trends
        if should_run("evaluate"):
            summary["evaluate"] = evaluate() if not dry_run else {"dry": True}

        # Phase 1 gate: stop here if human approval required
        if APPROVAL_GATE == "human" and not stages:
            proposed = [] if dry_run else get_ideas_by_status("proposed")
            summary["gate"] = f"APPROVAL_GATE=human — {len(proposed)} ideas awaiting review"
            print(f"[orchestrator] {summary['gate']}")
            print("[orchestrator] Review at /dashboard/arc — approve to continue pipeline.")
            if not dry_run:
                finish_run(run_id, summary, ok=True)
            return summary

        # Phase 2 / manual override: auto-approve top idea
        if APPROVAL_GATE == "auto" and should_run("evaluate"):
            _auto_approve_top()

        # STAGE 3+4 — script approved ideas
        if should_run("script"):
            summary["script"] = generate_scripts() if not dry_run else {"dry": True}

        # STAGE 5 — video generation / film brief
        if should_run("generate"):
            summary["generate"] = generate_videos() if not dry_run else {"dry": True}

        # STAGE 6 — edit
        if should_run("edit"):
            summary["edit"] = run_edits() if not dry_run else {"dry": True}

        # STAGE 7 — schedule + publish
        if should_run("schedule"):
            summary["schedule"] = queue_and_publish() if not dry_run else {"dry": True}

        # STAGE 8 — analytics + report
        if should_run("analytics"):
            summary["analytics"] = pull_analytics() if not dry_run else {"dry": True}

        if should_run("report"):
            summary["report"] = build_report("daily") if not dry_run else {"dry": True}

    except Exception as e:
        print(f"[orchestrator] ERROR: {e}")
        summary["error"] = str(e)
        ok = False

    if not dry_run and run_id is not None:
        finish_run(run_id, summary, ok=ok)
    print(f"[orchestrator] run {run_id} finished — ok={ok}")
    return summary


def _auto_approve_top() -> None:
    """Phase 2: auto-approve the top proposed idea by fit_score."""
    from arc.db import update_idea_status
    proposed = get_ideas_by_status("proposed")
    if not proposed:
        return
    top = proposed[0]   # already sorted by fit_score desc from db helper
    update_idea_status(top["id"], "approved")
    print(f"[orchestrator] auto-approved idea {top['id']} (fit={top['fit_score']})")
