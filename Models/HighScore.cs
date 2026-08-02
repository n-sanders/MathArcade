namespace MathArcade.Models;

public class HighScore
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public string GameId { get; set; } = string.Empty;
    public int Score { get; set; }
    public DateTime AchievedAt { get; set; } = DateTime.UtcNow;

    public Player Player { get; set; } = null!;
}
