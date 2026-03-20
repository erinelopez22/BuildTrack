using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("AuditLogs")]
public class AuditLog
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string TableName { get; set; } = string.Empty;

    public Guid? RecordId { get; set; }

    [Required, MaxLength(50)]
    public string Action { get; set; } = string.Empty; // INSERT, UPDATE, DELETE

    public string? OldValues { get; set; } // JSON

    public string? NewValues { get; set; } // JSON

    public Guid? UserId { get; set; }

    [MaxLength(50)]
    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(UserId))]
    public Profile? User { get; set; }
}
