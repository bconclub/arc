"""Music and sound effects from ElevenLabs (same calls as last night's audio.py scripts).

  python3 audio.py music --prompt "28 second ... instrumental, no vocals" --seconds 28 --out music.mp3
  python3 audio.py sfx   --prompt "One crisp loud finger snap, close" --seconds 0.5 --out snap.mp3

Reads ELEVENLABS_API_KEY from the environment. Skips work if --out already exists."""
import argparse, json, os, sys, urllib.request, urllib.error
from pathlib import Path

KEY = os.environ.get("ELEVENLABS_API_KEY")


def post(url, body, out):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    try:
        out.write_bytes(urllib.request.urlopen(req, timeout=300).read())
        print("saved:", out)
    except urllib.error.HTTPError as e:
        sys.exit(f"elevenlabs {e.code}: {e.read()[:300].decode(errors='replace')}")


def main():
    a = argparse.ArgumentParser()
    a.add_argument("kind", choices=["music", "sfx"])
    a.add_argument("--prompt", required=True)
    a.add_argument("--seconds", type=float, required=True)
    a.add_argument("--out", required=True)
    args = a.parse_args()
    if not KEY:
        sys.exit("ELEVENLABS_API_KEY not set")
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        print("exists:", out); return
    if args.kind == "music":
        post("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192",
             {"prompt": args.prompt, "music_length_ms": int(args.seconds * 1000), "force_instrumental": True}, out)
    else:
        post("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192",
             {"text": args.prompt, "duration_seconds": max(0.5, min(22, args.seconds)), "prompt_influence": 0.5}, out)


if __name__ == "__main__":
    main()
