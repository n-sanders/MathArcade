# AGENTS.md

## Cursor Cloud specific instructions

MathArcade is a single ASP.NET Core 9 (C#) app: one process serves both the `/api/*`
endpoints and the static frontend in `wwwroot/`. Persistence is embedded SQLite — there is
no separate database, cache, or auth service to start. See `README.md` for architecture,
the API table, and configuration.

### Environment
- The .NET 9 SDK is preinstalled at `~/.dotnet` and symlinked to `/usr/local/bin/dotnet`,
  so `dotnet` is available in any shell. The startup update script runs `dotnet restore`.

### Run / build / test
- Run (dev): `dotnet run` from the repo root. Listens on `http://localhost:5080`
  (from `Properties/launchSettings.json`, `ASPNETCORE_ENVIRONMENT=Development`). This is the
  full product — do not use the Docker/production path for local development.
- Build (also the compile/lint gate): `dotnet build`. There is **no automated test suite**
  (no test project), so a clean `dotnet build` is the primary correctness check for backend changes.
- The SQLite file at `./data/matharcade.db` is created automatically on startup via EF
  `EnsureCreated()` (no migrations). Deleting that file resets all players/scores/progress.

### Gotchas
- Frontend is vanilla HTML/JS/CSS with **no build step**; edits under `wwwroot/` are served
  directly (`Cache-Control: no-cache`), but a running `dotnet run` does not hot-reload C#
  changes — restart it (or use `dotnet watch run`) after editing `Program.cs`/`Models/`.
- Admin endpoints require the `X-Admin-Key` header matching `Admin:MagicWord` (default
  `change-me`).
- Ignore `docker-compose.yml` for local dev: it attaches to an external Docker network
  `web-core_default` (homelab reverse proxy) and fails unless that network exists.
