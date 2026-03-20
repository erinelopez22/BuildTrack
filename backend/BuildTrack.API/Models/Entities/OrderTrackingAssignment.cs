using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("OrderTrackingAssignments")]
public class OrderTrackingAssignment
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrderId { get; set; }
    public Guid DriverUserId { get; set; }

    [MaxLength(100)]
    public string PlateNumber { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? TrackingReference { get; set; }

    public string? Notes { get; set; }

    [MaxLength(50)]
    public string TrackingStatus { get; set; } = "on_transit";

    public DateTime? ArrivedAt { get; set; }
    public string? HoldRemarks { get; set; }
    public DateTime? HeldAt { get; set; }
    public string? ResumeRemarks { get; set; }
    public DateTime? ResumedAt { get; set; }

    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // JSON-serialized evidence arrays
    public string? EvidenceJson { get; set; }
    public string? ReceiverEvidenceJson { get; set; }

    [ForeignKey(nameof(OrderId))]
    public Order Order { get; set; } = null!;

    [ForeignKey(nameof(DriverUserId))]
    public Profile Driver { get; set; } = null!;

    [ForeignKey(nameof(CreatedBy))]
    public Profile? Creator { get; set; }

    public ICollection<OrderTrackingMaterial> Materials { get; set; } = [];
}
