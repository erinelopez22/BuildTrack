using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("CompanyAssets")]
public class CompanyAsset
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(256)]
    public string AssetName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? AssetType { get; set; } // Material, Tool, Equipment

    [MaxLength(100)]
    public string? AssetCode { get; set; }

    [MaxLength(50)]
    public string? Unit { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal TotalQuantity { get; set; } = 0;

    [MaxLength(50)]
    public string? Condition { get; set; } // Available, Maintenance, Retired

    public string? Notes { get; set; }

    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<BorrowTransaction> BorrowTransactions { get; set; } = [];
}
