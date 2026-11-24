# ROBLOXXX 🎮

AI-driven Roblox game studio pipeline: game code lives in this repo as
Rojo-structured Luau source, gets built into a place, and playtested in
Roblox Studio.

## Quick start

- **New here?** Open [`SETUP.md`](SETUP.md) — one-time 10-minute setup.
- **Just want to see it run in 2 minutes?** Use
  [`install/INSTALL_COMMAND_BAR.lua`](install/INSTALL_COMMAND_BAR.lua)
  (copy → Studio Command Bar → Enter → Play).

## Layout

```
default.project.json   Rojo project map
src/shared/            Shared modules (GameConfig)
src/server/            Server scripts
src/client/            Client scripts (UI)
install/               Zero-install command-bar installer
SETUP.md               Full setup + workflow guide
```

## Daily workflow

1. AI pushes new game code to this repo.
2. `git pull`
3. `rojo build default.project.json -o build/game.rbxlx`
4. Open `build/game.rbxlx` in Roblox Studio → **Play**.
5. Send bugs/screenshots back → repeat.
