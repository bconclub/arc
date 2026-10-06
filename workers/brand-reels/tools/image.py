"""Stills for brand reels: OpenAI image generation, optionally from reference images.

  python3 image.py --prompt "..." --out still.png
  python3 image.py --prompt "..." --ref frame.jpg --ref logo.png --out still.png   # edit / restyle from refs
  Options: --size 1024x1536 (9:16-ish, default) | 1536x1024 | 1024x1024
           --quality high|medium|low (default high)
           --model (default $OPENAI_IMAGE_MODEL or gpt-image-1)

Replaces last night's ChatGPT-in-the-browser step so the Mac can run unattended.
Reads OPENAI_API_KEY from the environment (the worker loads workers/brand-reels/.env)."""
import argparse, base64, json, mimetypes, os, sys, urllib.request, urllib.error, uuid
from pathlib import Path

KEY = os.environ.get("OPENAI_API_KEY")


def post_json(url, body):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=300))


def post_multipart(url, fields, files):
    b = uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    for k, p in files:
        mime = mimetypes.guess_type(p.name)[0] or "image/png"
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{p.name}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + p.read_bytes() + b"\r\n")
    parts.append(f"--{b}--\r\n".encode())
    req = urllib.request.Request(url, b"".join(parts), {"Authorization": f"Bearer {KEY}", "Content-Type": f"multipart/form-data; boundary={b}"})
    return json.load(urllib.request.urlopen(req, timeout=300))


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--prompt", required=True)
    a.add_argument("--ref", action="append", default=[])
    a.add_argument("--out", required=True)
    a.add_argument("--size", default="1024x1536")
    a.add_argument("--quality", default="high")
    a.add_argument("--model", default=os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1"))
    args = a.parse_args()
    if not KEY:
        sys.exit("OPENAI_API_KEY not set")
    try:
        if args.ref:
            r = post_multipart("https://api.openai.com/v1/images/edits",
                               {"model": args.model, "prompt": args.prompt, "size": args.size, "quality": args.quality},
                               [("image[]", Path(p)) for p in args.ref])
        else:
            r = post_json("https://api.openai.com/v1/images/generations",
                          {"model": args.model, "prompt": args.prompt, "size": args.size, "quality": args.quality, "n": 1})
    except urllib.error.HTTPError as e:
        sys.exit(f"image API {e.code}: {e.read()[:400].decode(errors='replace')}")
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(r["data"][0]["b64_json"]))
    print("saved:", out)


if __name__ == "__main__":
    main()
