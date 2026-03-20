using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("OrderTrackingMaterials")]
public class OrderTrackingMaterial
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid AssignmentId { get; set; }
    public Guid OrderItemId { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal AssignedQuantity { get; set; }

    [ForeignKey(nameof(AssignmentId))]
    public OrderTrackingAssignment Assignment { get; set; } = null!;

    [ForeignKey(nameof(OrderItemId))]
    public OrderItem OrderItem { get; set; } = null!;
}
