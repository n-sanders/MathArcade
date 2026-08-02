namespace MathArcade.Models;

public class GameProgress
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public string GameId { get; set; } = string.Empty;
    public int DifficultyLevel { get; set; } = 1;
    public string StatsJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Player Player { get; set; } = null!;
}
