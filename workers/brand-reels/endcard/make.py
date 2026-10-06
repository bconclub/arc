"""Render a BCON end card: python make.py <slug> "<line html>" "<cta>" [dur]
-> cards/BCON_EndCard_<slug>_v01.mp4 (with an impact hit)"""
import shutil, subprocess, sys
from pathlib import Path
R = Path(__file__).parent; slug, line, cta = sys.argv[1:4]; dur = sys.argv[4] if len(sys.argv) > 4 else "1.8"
(R / "index.html").write_text((R / "card.tpl").read_text(encoding="utf-8").replace("__LINE__", line).replace("__CTA__", cta).replace("__DUR__", dur), encoding="utf-8", newline="\n")
f = R / "_f"; shutil.rmtree(f, ignore_errors=True)
subprocess.run("npx --yes hyperframes@0.8.80 render --format png-sequence -o _f -w 2 --quiet", shell=True, cwd=R, check=True, capture_output=True)
(R / "cards").mkdir(exist_ok=True); out = R / "cards" / f"BCON_EndCard_{slug}_v01.mp4"
sfx = R / "assets" / "impact.mp3"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", str(f / "frame_%06d.png"), "-i", str(sfx),
    "-filter_complex", f"[1:a]volume=-6dB,apad=whole_dur={dur},atrim=0:{dur},afade=t=out:st={float(dur)-0.4}:d=0.4[a]", "-map", "0:v", "-map", "[a]",
    "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int+bitexact,format=yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709",
    "-color_trc", "bt709", "-color_range", "tv", "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-r", "30", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", str(out)], check=True)
shutil.rmtree(f, ignore_errors=True); print("card", out.name)
