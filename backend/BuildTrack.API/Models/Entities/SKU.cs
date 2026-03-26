using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("SKUs")]
public class SKU
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string SkuCode { get; set; } = string.Empty;

    [Required, MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    [MaxLength(100)]
    public string? Category { get; set; }

    [MaxLength(50)]
    public string? UnitOfMeasure { get; set; }

    [MaxLength(100)]
    public string? Brand { get; set; }

    public string? Specifications { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal DefaultMinThreshold { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedBy { get; set; }

    public Guid? CompanyId { get; set; }

    // Navigation
    [ForeignKey(nameof(CompanyId))]
    public Company? Company { get; set; }
    public ICollection<ProjectInventory> ProjectInventories { get; set; } = [];
    public ICollection<OrderItem> OrderItems { get; set; } = [];
    public ICollection<InventoryTransaction> InventoryTransactions { get; set; } = [];
}
