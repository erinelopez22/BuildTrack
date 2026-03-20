using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("QuotationItems")]
public class QuotationItem
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid QuotationId { get; set; }

    [Required, MaxLength(256)]
    public string MaterialName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Unit { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal Quantity { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(QuotationId))]
    public ProjectQuotation Quotation { get; set; } = null!;

    public ICollection<OrderItem> OrderItems { get; set; } = [];
}
