using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("OrderItems")]
public class OrderItem
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }
    public Guid SkuId { get; set; }
    public Guid? QuotationItemId { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal QuantityOrdered { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal QuantityReceived { get; set; } = 0;

    [Column(TypeName = "decimal(18,2)")]
    public decimal? UnitPrice { get; set; }

    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(OrderId))]
    public Order Order { get; set; } = null!;

    [ForeignKey(nameof(SkuId))]
    public SKU Sku { get; set; } = null!;

    [ForeignKey(nameof(QuotationItemId))]
    public QuotationItem? QuotationItem { get; set; }
}
