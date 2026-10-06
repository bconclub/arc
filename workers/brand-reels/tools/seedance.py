"""Seedance (BytePlus Ark) generator: submit -> poll -> download.

Usage:
  python seedance.py --prompt "..." --out clip.mp4
  python seedance.py --prompt "..." --first frame1.png --last frame2.png --out clip.mp4
  Options: --resolution 480p|720p|1080p (default 480p for drafts, 1080p for finals)
           --duration 3..12 seconds (default 4)
           --ratio 9:16 (default)
           --model (default seedance-1-5-pro-251215)
"""
import argparse, base64, json, mimetypes, sys, time, urllib.request
from pathlib import Path

BASE = "https://ark.ap-southeast.bytepluses.com/api/v3"
import os
KEY = os.environ.get("ARK_API_KEY") or (Path(__file__).parent / "ark.key").read_text().strip()


def api(path, payload=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode() if payload else None,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST" if payload else "GET",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def img_part(path, role):
    p = Path(path)
    mime = mimetypes.guess_type(p.name)[0] or "image/png"
    b64 = base64.b64encode(p.read_bytes()).decode()
    return {"type": "image_url", "role": role,
            "image_url": {"url": f"data:{mime};base64,{b64}"}}


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--prompt", required=True)
    a.add_argument("--first")
    a.add_argument("--last")
    a.add_argument("--out", default="seedance_out.mp4")
    a.add_argument("--resolution", default="480p")
    a.add_argument("--duration", default="4")
    a.add_argument("--ratio", default="9:16")
    a.add_argument("--model", default="seedance-1-5-pro-251215")
    args = a.parse_args()

    text = (f"{args.prompt} --resolution {args.resolution} "
            f"--duration {args.duration} --ratio {args.ratio} --watermark false")
    content = [{"type": "text", "text": text}]
    if args.first:
        content.append(img_part(args.first, "first_frame"))
    if args.last:
        content.append(img_part(args.last, "last_frame"))

    task = api("/contents/generations/tasks", {"model": args.model, "content": content})
    tid = task.get("id")
    if not tid:
        print("SUBMIT FAILED:", json.dumps(task, indent=2)); sys.exit(1)
    print("task:", tid)

    while True:
        time.sleep(8)
        st = api(f"/contents/generations/tasks/{tid}")
        status = st.get("status")
        print("status:", status)
        if status == "succeeded":
            url = st["content"]["video_url"]
            urllib.request.urlretrieve(url, args.out)
            print("saved:", args.out)
            usage = st.get("usage", {})
            print("usage:", json.dumps(usage))
            break
        if status in ("failed", "cancelled"):
            print("FAILED:", json.dumps(st, indent=2)); sys.exit(1)


if __name__ == "__main__":
    main()
