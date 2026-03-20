using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("ProjectInventory")]
public class ProjectInventory
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Guid SkuId { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal OnHand { get; set; } = 0;

    [Column(TypeName = "decimal(18,4)")]
    public decimal Reserved { get; set; } = 0;

    [Column(TypeName = "decimal(18,4)")]
    public decimal MinThreshold { get; set; } = 0;

    [MaxLength(200)]
    public string? LocationInSite { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(ProjectId))]
    public Project Project { get; set; } = null!;

    [ForeignKey(nameof(SkuId))]
    public SKU Sku { get; set; } = null!;
}
