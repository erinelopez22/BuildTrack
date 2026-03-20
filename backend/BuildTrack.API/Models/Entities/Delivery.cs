using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("Deliveries")]
public class Delivery
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }

    [MaxLength(100)]
    public string? DeliveryNumber { get; set; }

    public DateTime? DeliveryDate { get; set; }
    public DateTime? ReceivedDate { get; set; }

    [MaxLength(100)]
    public string? Carrier { get; set; }

    [MaxLength(200)]
    public string? TrackingNumber { get; set; }

    public string? Notes { get; set; }
    public Guid? ReceivedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(OrderId))]
    public Order Order { get; set; } = null!;

    [ForeignKey(nameof(ReceivedBy))]
    public Profile? Receiver { get; set; }

    public ICollection<DeliveryItem> Items { get; set; } = [];
}
