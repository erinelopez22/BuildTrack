using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("UserRoles")]
public class UserRole
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    [Required, MaxLength(50)]
    public string Role { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedBy { get; set; }

    // Navigation
    [ForeignKey(nameof(UserId))]
    public Profile User { get; set; } = null!;
}
