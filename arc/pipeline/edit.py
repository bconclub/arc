"""
STAGE 6 — ffmpeg brand pass: trim, 9:16 reframe, burn captions, brand overlay.
Requires: ffmpeg, faster-whisper, moviepy, Pillow installed on the VPS.
"""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

from arc.db import get_script_for_idea, get_ideas_by_status, insert_asset, get_edited_asset

# BCON brand colours (hex)
BRAND_ACCENT = "#FF3B30"
BRAND_BG = "#0A0A0A"
BRAND_TEXT = "#FFFFFF"

LOGO_PATH = os.getenv("BCON_LOGO_PATH", "")   # absolute path to logo PNG on VPS


def edit_video(raw_path: str, script: dict, output_path: str) -> bool:
    """
    Run the full brand edit pipeline on raw_path → output_path.
    Returns True if successful.
    """
    if not Path(raw_path).exists():
        print(f"[edit] raw file not found: {raw_path}")
        return False

    with tempfile.TemporaryDirectory() as tmp:
        reframed = os.path.join(tmp, "reframed.mp4")
        captioned = os.path.join(tmp, "captioned.mp4")

        # Step 1: reframe to 9:16 (1080x1920) with center crop
        ok = _reframe(raw_path, reframed)
        if not ok:
            return False

        # Step 2: burn captions (faster-whisper transcribe → .srt → ffmpeg subtitles)
        caption_src = reframed
        srt_path = _transcribe_to_srt(reframed, tmp)
        if srt_path:
            ok = _burn_subtitles(reframed, srt_path, captioned)
            if ok:
                caption_src = captioned

        # Step 3: brand overlay (logo + colour burn via ffmpeg drawtext/overlay)
        ok = _brand_overlay(caption_src, output_path)
        return ok


def run_edits() -> dict:
    """Edit all approved ideas that have a raw asset but no edited asset."""
    approved = get_ideas_by_status("approved")
    processed = 0
    edited = 0

    for idea in approved:
        script = get_script_for_idea(idea["id"])
        if not script:
            continue

        existing_edit = get_edited_asset(script["id"])
        if existing_edit:
            continue

        # Find raw asset
        from arc.db import db as get_db
        raw_res = get_db().table("assets").select("*").eq("script_id", script["id"]).eq("kind", "raw").limit(1).execute()
        raw_assets = raw_res.data or []
        if not raw_assets:
            continue

        raw_asset = raw_assets[0]
        raw_path = raw_asset.get("storage_path", "")
        if not raw_path or not Path(raw_path).exists():
            print(f"[edit] raw asset path not accessible: {raw_path}")
            continue

        output_path = raw_path.replace("_raw.", "_edited.").replace("/raw/", "/edited/")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        processed += 1
        print(f"[edit] editing idea {idea['id']}: {raw_path} → {output_path}")

        success = edit_video(raw_path, script, output_path)
        if success:
            insert_asset(script["id"], "edited", output_path)
            edited += 1
            print(f"[edit] done — {output_path}")
        else:
            print(f"[edit] failed for idea {idea['id']}")

    return {"processed": processed, "edited": edited}


# ── ffmpeg helpers ────────────────────────────────────────────────────────────

def _reframe(inp: str, out: str) -> bool:
    """Center-crop to 9:16 (1080×1920), re-encode H.264."""
    cmd = [
        "ffmpeg", "-y", "-i", inp,
        "-vf", "crop=ih*9/16:ih,scale=1080:1920,setsar=1",
        "-c:v", "libx264", "-crf", "23", "-preset", "fast",
        "-c:a", "aac", "-b:a", "128k",
        out,
    ]
    return _run(cmd, "reframe")


def _transcribe_to_srt(video_path: str, tmp_dir: str) -> str | None:
    """Use faster-whisper to transcribe audio → .srt subtitle file."""
    srt_path = os.path.join(tmp_dir, "captions.srt")
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("tiny", compute_type="int8")
        segments, _ = model.transcribe(video_path, word_timestamps=True)

        with open(srt_path, "w") as f:
            for i, seg in enumerate(segments, 1):
                f.write(f"{i}\n")
                f.write(f"{_srt_time(seg.start)} --> {_srt_time(seg.end)}\n")
                f.write(f"{seg.text.strip()}\n\n")

        return srt_path
    except ImportError:
        print("[edit] faster-whisper not installed — skipping captions")
        return None
    except Exception as e:
        print(f"[edit] transcription error: {e}")
        return None


def _burn_subtitles(inp: str, srt: str, out: str) -> bool:
    cmd = [
        "ffmpeg", "-y", "-i", inp,
        "-vf", f"subtitles={srt}:force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Outline=1'",
        "-c:v", "libx264", "-crf", "23", "-preset", "fast",
        "-c:a", "copy",
        out,
    ]
    return _run(cmd, "subtitles")


def _brand_overlay(inp: str, out: str) -> bool:
    """Burn BCON logo + bottom accent bar. Falls back to passthrough if logo missing."""
    if LOGO_PATH and Path(LOGO_PATH).exists():
        cmd = [
            "ffmpeg", "-y", "-i", inp, "-i", LOGO_PATH,
            "-filter_complex",
            "[1:v]scale=120:-1[logo];[0:v][logo]overlay=W-w-20:20,"
            "drawbox=y=ih-80:color=0xFF3B30@0.9:width=iw:height=80:t=fill",
            "-c:v", "libx264", "-crf", "23", "-preset", "fast",
            "-c:a", "copy",
            out,
        ]
    else:
        # No logo: just add accent bar at bottom
        cmd = [
            "ffmpeg", "-y", "-i", inp,
            "-vf", "drawbox=y=ih-80:color=0xFF3B30@0.9:width=iw:height=80:t=fill",
            "-c:v", "libx264", "-crf", "23", "-preset", "fast",
            "-c:a", "copy",
            out,
        ]
    return _run(cmd, "brand_overlay")


def _run(cmd: list[str], label: str) -> bool:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            print(f"[edit/{label}] ffmpeg error:\n{result.stderr[-500:]}")
            return False
        return True
    except FileNotFoundError:
        print(f"[edit/{label}] ffmpeg not found — install it on the VPS")
        return False
    except subprocess.TimeoutExpired:
        print(f"[edit/{label}] timed out")
        return False


def _srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"
