using MathArcade.Models;
using Microsoft.EntityFrameworkCore;

namespace MathArcade.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Player> Players => Set<Player>();
    public DbSet<HighScore> HighScores => Set<HighScore>();
    public DbSet<GameProgress> GameProgress => Set<GameProgress>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Player>(e =>
        {
            e.HasIndex(p => p.DeviceToken).IsUnique();
            e.Property(p => p.Name).HasMaxLength(64).IsRequired();
            e.Property(p => p.DeviceToken).HasMaxLength(64).IsRequired();
        });

        modelBuilder.Entity<HighScore>(e =>
        {
            e.HasIndex(h => new { h.PlayerId, h.GameId }).IsUnique();
            e.Property(h => h.GameId).HasMaxLength(32).IsRequired();
            e.HasOne(h => h.Player)
                .WithMany(p => p.HighScores)
                .HasForeignKey(h => h.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GameProgress>(e =>
        {
            e.HasIndex(g => new { g.PlayerId, g.GameId }).IsUnique();
            e.Property(g => g.GameId).HasMaxLength(32).IsRequired();
            e.HasOne(g => g.Player)
                .WithMany(p => p.Progress)
                .HasForeignKey(g => g.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
