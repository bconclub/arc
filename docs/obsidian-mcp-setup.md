# Obsidian ↔ ARC: knowledge sync + MCP

ARC/Supabase is the **master** for GTM knowledge (the `gtm_areas` table, edited
in the Strategy → GTM board). Obsidian is a **synced copy** you can read/write in.
Two moving parts:

1. **Sync script** (`scripts/gtm-sync.mjs`) — moves data both ways.
2. **MCP plugin** — lets Claude Code (me) read/write the vault directly.

---

## 1. Sync script (no plugin needed)

Set your vault path in `.env.local`:

```
ARC_VAULT_DIR=C:\Users\user\Documents\ARC-Vault
```

Then:

```bash
node scripts/gtm-sync.mjs export   # Supabase → <vault>/GTM/<slug>.md  (mirror out)
node scripts/gtm-sync.mjs import   # <vault>/GTM/*.md → Supabase        (write back)
```

- `export` writes one note per GTM area with frontmatter (`status`, `slug`) and a
  `## Where we stand` section.
- `import` reads the `## Where we stand` section + `status` back into Supabase.
- Master is Supabase — after editing in Obsidian, run `import` to push changes in;
  after editing in the ARC web app, run `export` to refresh the vault mirror.

---

## 2. MCP plugin (obsidian-claude-code-mcp) — your side

This connects the vault to Claude Code so I can author/maintain notes directly.
It runs **inside your Obsidian app**, so it only works when Obsidian is open.

**In Obsidian:**
1. Install **BRAT** (Community Plugins → browse → "Obsidian42 - BRAT") and enable it.
2. BRAT → "Add beta plugin" → paste `https://github.com/iansinnott/obsidian-claude-code-mcp`.
3. Enable **Claude Code MCP** in Community Plugins. Note the port it prints
   (default is usually `22360`) and whether it exposes stdio or HTTP/SSE.

**In an interactive terminal** (this non-interactive session can't do it):
```bash
# HTTP/SSE transport (check the plugin's settings for the exact URL):
claude mcp add --transport sse obsidian http://127.0.0.1:22360/sse
# then, inside `claude`:
/mcp        # confirm "obsidian" shows connected
```

Once connected, I can read/write vault notes. Keep Supabase as master: I edit the
markdown, then `node scripts/gtm-sync.mjs import` folds changes into ARC.

> The MCP grounds **me** in the vault. It does **not** ground the deployed ARC web
> app — the app is grounded via the `gtm_areas` table in Supabase. The sync script
> is the bridge between the two.

---

## 3. Next step (not built yet)

Wire GTM context into the content engine: the idea/write prompts should pull the
`gtm_areas` summaries so every generated idea/post/proposal is grounded on where
we stand. Tracked as a follow-up.
