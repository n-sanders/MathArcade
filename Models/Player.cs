namespace MathArcade.Models;

public class Player
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string DeviceToken { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<HighScore> HighScores { get; set; } = new List<HighScore>();
    public ICollection<GameProgress> Progress { get; set; } = new List<GameProgress>();
}
