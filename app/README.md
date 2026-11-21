# Dungeon Core

Run from the repository root in PowerShell.

```powershell
npm.cmd --prefix app ci
npm.cmd --prefix app run dev -- --open
```

Vite prints the local address. Open that address if your browser stays closed. The game starts in local mode when Firebase settings are absent. To force local play for a configured checkout, set `$env:VITE_LOCAL_ONLY = "true"` before starting Vite. Use `app/.env.example` for Firebase and emulator settings.

Start or resume Campaign from the Stronghold. Swift has endless waves and a separate guided practice run. Builds save to your browser as you edit. The planning board can still run battles if the graphics renderer fails.

```powershell
npm.cmd --prefix app run build
npm.cmd exec --prefix app -- vitest run --root app
```
