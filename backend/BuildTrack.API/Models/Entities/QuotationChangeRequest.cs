using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("QuotationChangeRequests")]
public class QuotationChangeRequest
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Guid? QuotationId { get; set; }

    [MaxLength(50)]
    public string? ChangeType { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "pending"; // pending, approved, rejected

    public Guid? RequestedBy { get; set; }
    public Guid? ReviewedBy { get; set; }

    [MaxLength(1000)]
    public string? ReviewRemarks { get; set; }

    public string? Payload { get; set; } // JSON

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(ProjectId))]
    public Project Project { get; set; } = null!;

    [ForeignKey(nameof(QuotationId))]
    public ProjectQuotation? Quotation { get; set; }

    [ForeignKey(nameof(RequestedBy))]
    public Profile? Requester { get; set; }

    [ForeignKey(nameof(ReviewedBy))]
    public Profile? Reviewer { get; set; }
}
