#!/usr/bin/env bash
# Cron wrapper — keeps the working directory correct and sources .env.local.
# This is what crontab calls.
set -e
cd "$(dirname "$0")/.."

# Load env vars from .env.local if present
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

python -m arc.cli run
