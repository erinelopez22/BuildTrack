using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("ProjectMembers")]
public class ProjectMember
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Guid UserId { get; set; }

    [MaxLength(50)]
    public string? Role { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedBy { get; set; }

    // Navigation
    [ForeignKey(nameof(ProjectId))]
    public Project Project { get; set; } = null!;

    [ForeignKey(nameof(UserId))]
    public Profile User { get; set; } = null!;
}
