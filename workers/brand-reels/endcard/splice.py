"""Trim a reel at <cut> seconds and append a BCON end card (audio faded at the join).
python splice.py <reel.mp4> <cut|end> <card.mp4> <out.mp4>"""
import subprocess, sys
reel, cut, card, out = sys.argv[1:5]
if cut == "end":
    cut = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", reel], capture_output=True, text=True).stdout.strip()
c = float(cut)
fc = (f"[0:v]trim=0:{c},setpts=PTS-STARTPTS,fps=30,format=yuv420p[v0];[0:a]atrim=0:{c},asetpts=PTS-STARTPTS,afade=t=out:st={c-0.2}:d=0.2,aresample=48000[a0];"
      f"[1:v]fps=30,format=yuv420p,setpts=PTS-STARTPTS[v1];[1:a]aresample=48000,asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", reel, "-i", card, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-colorspace", "bt709", "-color_primaries", "bt709",
                "-color_trc", "bt709", "-color_range", "tv", "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", out], check=True)
print("spliced", out)
