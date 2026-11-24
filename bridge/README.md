# 🌉 ROBLOXXX Studio Relay

This bridge lets the AI agent send live commands to **your** Roblox Studio
through a Supabase relay table — the only channel that actually works from a
cloud sandbox (Arena has no Roblox connector, Studio's MCP is localhost-only,
and my network is locked to code-hosting sites).

```
┌─────────────┐   SQL (secure connector)   ┌──────────────┐   outbound HTTPS poll   ┌──────────────────────────────┐
│  AI agent   │ ─────────────────────────► │   Supabase   │ ◄────────────────────── │  relay.js  on YOUR PC        │
│  (cloud)    │ ◄───────────────────────── │  studio_…    │ ──────────────────────► │  spawns official mcp.bat     │
└─────────────┘        results             └──────────────┘        commands         │  (127.0.0.1, your machine)   │
                                                                                    └──────────────────────────────┘
```

## Security facts

- **Opens zero ports.** Your PC only makes *outbound* HTTPS calls to your own
  Supabase project. Nothing listens on your machine. No tunnels. No ngrok.
- Spawns exactly the official Roblox command you already had:
  `cmd.exe /c cd /d %LOCALAPPDATA%\Roblox && .\mcp.bat`
- Prints **every executed command** to your console — full visibility.
- **Zero npm dependencies.** Only Node.js 18+ required. Nothing else installs.
- `bridge/.env` is git-ignored — your keys never get committed.

## One-time setup

```powershell
cd ROBLOXXX\bridge
copy .env.example .env     :: then edit .env and paste the 3 values the AI gave you
node relay.js --selftest   :: PASS = protocol layer works (no Studio needed)
node relay.js --diagnose   :: PASS = Supabase + official MCP both reachable
node relay.js              :: RUN — leave this window open while we work
```

Keep `node relay.js` running in a terminal while you ask the AI for Studio
actions; commands appear in that terminal as they execute.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `MCP server exited before answering` | Open Roblox Studio with a place loaded; Assistant → … → Settings → MCP Servers → Enable |
| `HTTP 401` from Supabase | `.env` key/URL mismatch — re-copy the values |
| `HTTP 404 / relation does not exist` | Relay table not created yet — ask the AI to run setup |
| Poll errors every 3s | Internet issue or paused Supabase project (must be Active) |
| Commands don't appear | Check the row status via the AI; look for `error` messages here |
