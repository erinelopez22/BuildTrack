using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("Orders")]
public class Order
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }

    [Required, MaxLength(100)]
    public string OrderNumber { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? OrderType { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "draft";

    [MaxLength(256)]
    public string? SupplierName { get; set; }

    [MaxLength(256)]
    public string? SupplierContact { get; set; }

    public DateTime? ExpectedDeliveryDate { get; set; }

    public string? Notes { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? TotalAmount { get; set; }

    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovedByName { get; set; }

    public Guid? RejectedBy { get; set; }
    public DateTime? RejectedAt { get; set; }

    [MaxLength(1000)]
    public string? RejectionReason { get; set; }

    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? OnTransitAt { get; set; }
    public DateTime? DeliveredAt { get; set; }

    // Navigation
    [ForeignKey(nameof(ProjectId))]
    public Project Project { get; set; } = null!;

    [ForeignKey(nameof(ApprovedBy))]
    public Profile? Approver { get; set; }

    [ForeignKey(nameof(RejectedBy))]
    public Profile? Rejector { get; set; }

    [ForeignKey(nameof(CreatedBy))]
    public Profile? Creator { get; set; }

    public ICollection<OrderItem> Items { get; set; } = [];
    public ICollection<Delivery> Deliveries { get; set; } = [];
}
