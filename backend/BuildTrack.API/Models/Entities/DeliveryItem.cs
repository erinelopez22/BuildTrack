using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("DeliveryItems")]
public class DeliveryItem
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid DeliveryId { get; set; }
    public Guid OrderItemId { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal QuantityReceived { get; set; }

    [MaxLength(100)]
    public string? Condition { get; set; }

    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(DeliveryId))]
    public Delivery Delivery { get; set; } = null!;

    [ForeignKey(nameof(OrderItemId))]
    public OrderItem OrderItem { get; set; } = null!;
}
