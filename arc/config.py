import os
from pathlib import Path
from dotenv import load_dotenv

# Load from repo root .env.local (shared with Next.js)
_root = Path(__file__).parent.parent
for _f in [".env.local", ".env"]:
    _p = _root / _f
    if _p.exists():
        load_dotenv(_p)
        break

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

APPROVAL_GATE = os.getenv("APPROVAL_GATE", "human")   # human | auto
VIDEO_MODE = os.getenv("VIDEO_MODE", "film")            # film | ai

# Source API keys — optional; stages stub gracefully when absent
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_SECRET = os.getenv("REDDIT_SECRET", "")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "arc-agent/0.1")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
PRODUCTHUNT_TOKEN = os.getenv("PRODUCTHUNT_TOKEN", "")
X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN", "")

# Publish keys — optional in v0.1
IG_ACCESS_TOKEN = os.getenv("IG_ACCESS_TOKEN", "")
TIKTOK_TOKEN = os.getenv("TIKTOK_TOKEN", "")
LINKEDIN_TOKEN = os.getenv("LINKEDIN_TOKEN", "")
YOUTUBE_OAUTH_TOKEN = os.getenv("YOUTUBE_OAUTH_TOKEN", "")
