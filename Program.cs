using MathArcade.Data;
using MathArcade.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Data Source=./data/matharcade.db";

var dbPath = connectionString.Replace("Data Source=", "", StringComparison.OrdinalIgnoreCase).Trim();
var dbDir = Path.GetDirectoryName(dbPath);
if (!string.IsNullOrEmpty(dbDir))
{
    Directory.CreateDirectory(dbDir);
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.CacheControl = "no-cache";
    }
});

app.MapPost("/api/players", async (PlayerRequest request, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.DeviceToken) || string.IsNullOrWhiteSpace(request.Name))
    {
        return Results.BadRequest(new { error = "Name and deviceToken are required." });
    }

    var name = request.Name.Trim();
    if (name.Length > 64) name = name[..64];

    var player = await db.Players.FirstOrDefaultAsync(p => p.DeviceToken == request.DeviceToken);
    if (player is null)
    {
        player = new Player
        {
            Name = name,
            DeviceToken = request.DeviceToken.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        db.Players.Add(player);
    }
    else
    {
        player.Name = name;
    }

    await db.SaveChangesAsync();
    return Results.Ok(ToPlayerDto(player));
});

app.MapGet("/api/players/by-token/{deviceToken}", async (string deviceToken, AppDbContext db) =>
{
    var player = await db.Players.FirstOrDefaultAsync(p => p.DeviceToken == deviceToken);
    return player is null ? Results.NotFound() : Results.Ok(ToPlayerDto(player));
});

app.MapGet("/api/scores/{gameId}", async (string gameId, AppDbContext db, int limit = 10) =>
{
    limit = Math.Clamp(limit, 1, 50);
    var scores = await db.HighScores
        .AsNoTracking()
        .Where(h => h.GameId == gameId)
        .OrderByDescending(h => h.Score)
        .ThenBy(h => h.AchievedAt)
        .Take(limit)
        .Select(h => new
        {
            h.Score,
            h.AchievedAt,
            PlayerName = h.Player.Name
        })
        .ToListAsync();

    return Results.Ok(scores);
});

app.MapPost("/api/scores", async (ScoreRequest request, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.DeviceToken) || string.IsNullOrWhiteSpace(request.GameId))
    {
        return Results.BadRequest(new { error = "deviceToken and gameId are required." });
    }

    if (request.Score < 0)
    {
        return Results.BadRequest(new { error = "Score must be non-negative." });
    }

    var player = await db.Players.FirstOrDefaultAsync(p => p.DeviceToken == request.DeviceToken);
    if (player is null)
    {
        return Results.NotFound(new { error = "Player not found. Register first." });
    }

    var gameId = request.GameId.Trim().ToLowerInvariant();
    var existing = await db.HighScores
        .FirstOrDefaultAsync(h => h.PlayerId == player.Id && h.GameId == gameId);

    var isNewHigh = false;
    if (existing is null)
    {
        existing = new HighScore
        {
            PlayerId = player.Id,
            GameId = gameId,
            Score = request.Score,
            AchievedAt = DateTime.UtcNow
        };
        db.HighScores.Add(existing);
        isNewHigh = true;
    }
    else if (request.Score > existing.Score)
    {
        existing.Score = request.Score;
        existing.AchievedAt = DateTime.UtcNow;
        isNewHigh = true;
    }

    await db.SaveChangesAsync();

    return Results.Ok(new
    {
        highScore = existing.Score,
        submitted = request.Score,
        isNewHigh
    });
});

app.MapGet("/api/progress", async (string deviceToken, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(deviceToken))
    {
        return Results.BadRequest(new { error = "deviceToken is required." });
    }

    var player = await db.Players.AsNoTracking()
        .FirstOrDefaultAsync(p => p.DeviceToken == deviceToken);
    if (player is null)
    {
        return Results.Ok(Array.Empty<object>());
    }

    var rows = await db.GameProgress
        .AsNoTracking()
        .Where(g => g.PlayerId == player.Id)
        .ToListAsync();

    return Results.Ok(rows.Select(g => new
    {
        gameId = g.GameId,
        difficultyLevel = g.DifficultyLevel,
        statsJson = g.StatsJson,
        // SQLite returns Unspecified Kind; these values are always written as UTC.
        updatedAt = DateTime.SpecifyKind(g.UpdatedAt, DateTimeKind.Utc),
        exists = true
    }));
});

app.MapGet("/api/progress/{gameId}", async (string gameId, string deviceToken, AppDbContext db) =>
{
    var player = await db.Players.FirstOrDefaultAsync(p => p.DeviceToken == deviceToken);
    if (player is null)
    {
        return Results.Ok(new
        {
            gameId,
            difficultyLevel = 1,
            statsJson = "{}",
            exists = false
        });
    }

    var normalizedGameId = gameId.Trim().ToLowerInvariant();
    var progress = await db.GameProgress
        .AsNoTracking()
        .FirstOrDefaultAsync(g => g.PlayerId == player.Id && g.GameId == normalizedGameId);

    if (progress is null)
    {
        return Results.Ok(new
        {
            gameId = normalizedGameId,
            difficultyLevel = 1,
            statsJson = "{}",
            exists = false
        });
    }

    return Results.Ok(new
    {
        gameId = progress.GameId,
        difficultyLevel = progress.DifficultyLevel,
        statsJson = progress.StatsJson,
        updatedAt = DateTime.SpecifyKind(progress.UpdatedAt, DateTimeKind.Utc),
        exists = true
    });
});

app.MapPut("/api/progress/{gameId}", async (string gameId, ProgressRequest request, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.DeviceToken))
    {
        return Results.BadRequest(new { error = "deviceToken is required." });
    }

    var player = await db.Players.FirstOrDefaultAsync(p => p.DeviceToken == request.DeviceToken);
    if (player is null)
    {
        return Results.NotFound(new { error = "Player not found. Register first." });
    }

    var normalizedGameId = gameId.Trim().ToLowerInvariant();
    var progress = await db.GameProgress
        .FirstOrDefaultAsync(g => g.PlayerId == player.Id && g.GameId == normalizedGameId);

    var level = Math.Clamp(request.DifficultyLevel, 1, 20);
    var stats = string.IsNullOrWhiteSpace(request.StatsJson) ? "{}" : request.StatsJson;

    if (progress is null)
    {
        progress = new GameProgress
        {
            PlayerId = player.Id,
            GameId = normalizedGameId,
            DifficultyLevel = level,
            StatsJson = stats,
            UpdatedAt = DateTime.UtcNow
        };
        db.GameProgress.Add(progress);
    }
    else
    {
        progress.DifficultyLevel = level;
        progress.StatsJson = stats;
        progress.UpdatedAt = DateTime.UtcNow;
    }

    await db.SaveChangesAsync();

    return Results.Ok(new
    {
        gameId = progress.GameId,
        difficultyLevel = progress.DifficultyLevel,
        statsJson = progress.StatsJson,
        updatedAt = DateTime.SpecifyKind(progress.UpdatedAt, DateTimeKind.Utc)
    });
});

app.MapFallbackToFile("index.html");

app.Run();

static object ToPlayerDto(Player player) => new
{
    player.Id,
    player.Name,
    player.DeviceToken,
    player.CreatedAt
};

record PlayerRequest(string Name, string DeviceToken);
record ScoreRequest(string DeviceToken, string GameId, int Score);
record ProgressRequest(string DeviceToken, int DifficultyLevel, string? StatsJson);
