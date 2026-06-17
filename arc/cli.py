"""
CLI entry point. Usage:
  python -m arc.cli run                   # full loop (respects APPROVAL_GATE)
  python -m arc.cli run --dry             # dry run (no DB writes)
  python -m arc.cli stage aggregate       # run one stage
  python -m arc.cli stage evaluate
  python -m arc.cli stage script
  python -m arc.cli stage edit
  python -m arc.cli stage schedule
  python -m arc.cli report                # print daily report
  python -m arc.cli upload <idea_id> <path>  # register raw video upload
"""
from __future__ import annotations

import sys


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return

    cmd = args[0]

    if cmd == "run":
        from arc.orchestrator import run_loop
        dry = "--dry" in args
        summary = run_loop(dry_run=dry)
        _print_summary(summary)

    elif cmd == "stage":
        if len(args) < 2:
            print("Usage: arc stage <name>")
            sys.exit(1)
        stage = args[1]
        from arc.orchestrator import run_loop
        summary = run_loop(stages=[stage])
        _print_summary(summary)

    elif cmd == "report":
        from arc.pipeline.report import build_report
        period = args[1] if len(args) > 1 else "daily"
        report = build_report(period)
        import json
        print(json.dumps(report, indent=2, default=str))

    elif cmd == "upload":
        if len(args) < 3:
            print("Usage: arc upload <idea_id> <file_path>")
            sys.exit(1)
        _handle_upload(int(args[1]), args[2])

    elif cmd == "ideas":
        from arc.db import get_ideas_by_status
        status = args[1] if len(args) > 1 else "proposed"
        ideas = get_ideas_by_status(status)
        for idea in ideas:
            trend = idea.get("trends") or {}
            print(f"[{idea['id']}] score={idea['fit_score']} status={idea['status']}")
            print(f"  trend: {trend.get('title', '')[:80]}")
            print(f"  angle: {idea.get('angle', '')[:80]}")
            print()

    elif cmd == "approve":
        if len(args) < 2:
            print("Usage: arc approve <idea_id>")
            sys.exit(1)
        from arc.db import update_idea_status
        update_idea_status(int(args[1]), "approved")
        print(f"Idea {args[1]} approved.")

    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


def _handle_upload(idea_id: int, file_path: str) -> None:
    from pathlib import Path
    from arc.db import get_script_for_idea, insert_asset
    from arc.db import db as get_db

    ideas_res = get_db().table("ideas").select("*").eq("id", idea_id).limit(1).execute()
    if not ideas_res.data:
        print(f"Idea {idea_id} not found.")
        sys.exit(1)

    script = get_script_for_idea(idea_id)
    if not script:
        print(f"No script for idea {idea_id}. Run `arc stage script` first.")
        sys.exit(1)

    if not Path(file_path).exists():
        print(f"File not found: {file_path}")
        sys.exit(1)

    asset = insert_asset(script["id"], "raw", file_path)
    print(f"Raw asset registered: id={asset.get('id')} path={file_path}")
    print("Now run `arc stage edit` to process it.")


def _print_summary(summary: dict) -> None:
    import json
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
