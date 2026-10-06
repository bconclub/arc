#!/usr/bin/env bash
# Brand Reels worker: one-time setup on the Mac editor.
#   cd ARC/workers/brand-reels && ./install.sh
# Safe to re-run (updates the skill and restarts the service).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="club.bcon.brand-reels"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "1/5 tools"
command -v brew >/dev/null || { echo "Install Homebrew first: https://brew.sh"; exit 1; }
for b in ffmpeg node python3 gallery-dl; do command -v "$b" >/dev/null || brew install "$b"; done
python3 -m pip install --user --upgrade --quiet yt-dlp faster-whisper || python3 -m pip install --user --upgrade --quiet --break-system-packages yt-dlp faster-whisper

echo "2/5 skill -> ~/.claude/skills/brand-reel"
mkdir -p "$HOME/.claude/skills"
rm -rf "$HOME/.claude/skills/brand-reel"
cp -R "$HERE/skill/brand-reel" "$HOME/.claude/skills/brand-reel"
sed -i '' "s#__WORKER__#$HERE/worker.mjs#g" "$HOME/.claude/skills/brand-reel/SKILL.md"
rm -rf "$HOME/.claude/skills/arc-studio"
cp -R "$HERE/skill/arc-studio" "$HOME/.claude/skills/arc-studio"
sed -i '' "s#__STUDIO__#$HERE/studio.mjs#g" "$HOME/.claude/skills/arc-studio/SKILL.md"

echo "3/5 config"
[ -f "$HERE/.env" ] || { cp "$HERE/.env.example" "$HERE/.env"; chmod 600 "$HERE/.env"; echo "   created .env: fill in the keys, then re-run ./install.sh"; exit 0; }

echo "4/5 doctor"
node "$HERE/worker.mjs" doctor || { echo "Fix the MISS lines above (edit .env), then re-run."; exit 1; }

echo "5/5 launchd service (starts at login, restarts if it dies, keeps the Mac awake while running)"
NODE="$(command -v node)"
CLAUDE_DIR="$(dirname "$(command -v claude || echo /usr/local/bin/claude)")"
mkdir -p "$HOME/Library/Logs"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>/usr/bin/caffeinate</string><string>-i</string>
    <string>$NODE</string><string>$HERE/worker.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$HERE</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$CLAUDE_DIR:$(dirname "$NODE"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$HOME/Library/Python/3.13/bin:$HOME/Library/Python/3.12/bin</string>
    <key>HOME</key><string>$HOME</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/brand-reels.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/brand-reels.log</string>
</dict></plist>
EOF
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Running. Log: tail -f ~/Library/Logs/brand-reels.log"
echo "ARC > Brand Reels should show '$(grep -E '^AGENT_NAME=' "$HERE/.env" | cut -d= -f2 || echo mac-editor) · idle' within a minute."
