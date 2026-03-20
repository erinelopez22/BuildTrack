using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("InventoryTransactions")]
public class InventoryTransaction
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Guid SkuId { get; set; }

    [Required, MaxLength(50)]
    public string TransactionType { get; set; } = string.Empty; // stock_in, stock_out, transfer_in, transfer_out, adjustment, receiving

    [Column(TypeName = "decimal(18,4)")]
    public decimal Quantity { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal QuantityBefore { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal QuantityAfter { get; set; }

    [MaxLength(50)]
    public string? ReferenceType { get; set; }

    public Guid? ReferenceId { get; set; }

    public Guid? TransferProjectId { get; set; }

    public string? Notes { get; set; }

    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(ProjectId))]
    public Project Project { get; set; } = null!;

    [ForeignKey(nameof(SkuId))]
    public SKU Sku { get; set; } = null!;

    [ForeignKey(nameof(CreatedBy))]
    public Profile? Creator { get; set; }
}
