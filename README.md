# MathArcade

Self-hosted math practice site for kids. ASP.NET Core 9 serves the API and static games; SQLite stores players, high scores, and progress.

## Run with Docker

```bash
docker compose up --build
```

Open http://localhost:8080

Player data lives in the `matharcade-data` Docker volume (`/data/matharcade.db` inside the container).

## Run locally

```bash
dotnet run
```

Uses `./data/matharcade.db` by default.
