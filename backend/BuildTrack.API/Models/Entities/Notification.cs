using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("Notifications")]
public class Notification
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    [Required, MaxLength(256)]
    public string Title { get; set; } = string.Empty;

    public string? Message { get; set; }

    [MaxLength(50)]
    public string? Type { get; set; }

    [MaxLength(50)]
    public string? ReferenceType { get; set; }

    public Guid? ReferenceId { get; set; }

    public bool IsRead { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(UserId))]
    public Profile User { get; set; } = null!;
}
