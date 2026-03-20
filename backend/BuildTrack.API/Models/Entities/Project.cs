using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("Projects")]
public class Project
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Code { get; set; }

    [MaxLength(500)]
    public string? Location { get; set; }

    public string? Description { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "active";

    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }

    public Guid? ProjectManagerId { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? EstimatedCost { get; set; }

    public bool IsHidden { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedBy { get; set; }

    // Navigation
    [ForeignKey(nameof(ProjectManagerId))]
    public Profile? ProjectManager { get; set; }

    public ICollection<ProjectMember> Members { get; set; } = [];
    public ICollection<Order> Orders { get; set; } = [];
    public ICollection<ProjectInventory> Inventory { get; set; } = [];
    public ICollection<ProjectQuotation> Quotations { get; set; } = [];
}
