using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("RefreshTokens")]
public class RefreshToken
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    [Required]
    public string Token { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsRevoked { get; set; } = false;

    // Navigation
    [ForeignKey(nameof(UserId))]
    public Profile User { get; set; } = null!;
}
