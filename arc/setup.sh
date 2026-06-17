#!/usr/bin/env bash
# Run once on the VPS to bootstrap the ARC agent.
# Usage: cd /path/to/ARC && bash arc/setup.sh

set -e

echo "=== ARC Agent — VPS Setup ==="

# 1. Python deps
echo "[1/4] Installing Python dependencies..."
pip install -r requirements.txt

# 2. Env check
echo "[2/4] Checking environment variables..."
required=(
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY
)
missing=0
for var in "${required[@]}"; do
  if [ -z "${!var}" ]; then
    echo "  MISSING: $var"
    missing=1
  else
    echo "  OK: $var"
  fi
done
if [ "$missing" -eq 1 ]; then
  echo ""
  echo "Set missing vars in .env.local then re-run."
  exit 1
fi

# 3. Dry run to confirm the agent starts
echo "[3/4] Dry-run test..."
python -m arc.cli run --dry

# 4. Crontab setup
echo "[4/4] Adding cron job (daily at 07:00 IST = 01:30 UTC)..."
REPO_DIR="$(pwd)"
CRON_CMD="30 1 * * * cd $REPO_DIR && python -m arc.cli run >> $REPO_DIR/arc/agent.log 2>&1"

# Check if cron already exists
if crontab -l 2>/dev/null | grep -q "arc.cli run"; then
  echo "  Cron already set — skipping."
else
  (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
  echo "  Cron added: $CRON_CMD"
fi

echo ""
echo "=== Done ==="
echo "Run manually: python -m arc.cli run"
echo "See logs:     tail -f arc/agent.log"
echo "Review:       https://arc-liard-two.vercel.app/dashboard/arc"
