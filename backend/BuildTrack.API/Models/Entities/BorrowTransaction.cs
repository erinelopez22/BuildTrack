using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("BorrowTransactions")]
public class BorrowTransaction
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid AssetId { get; set; }
    public Guid? ProjectId { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal BorrowedQty { get; set; }

    public Guid? BorrowedBy { get; set; }
    public DateTime BorrowedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpectedReturnDate { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal ReturnedQty { get; set; } = 0;

    public DateTime? ReturnedAt { get; set; }

    [MaxLength(1000)]
    public string? ReturnRemarks { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "Borrowed"; // Borrowed, Partially Returned, Returned

    [MaxLength(50)]
    public string? RequestType { get; set; } // "borrow" or "return"

    [MaxLength(50)]
    public string ApprovalStatus { get; set; } = "approved"; // pending, approved, rejected

    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }

    [MaxLength(1000)]
    public string? RejectionRemarks { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(AssetId))]
    public CompanyAsset Asset { get; set; } = null!;

    [ForeignKey(nameof(ProjectId))]
    public Project? Project { get; set; }

    [ForeignKey(nameof(BorrowedBy))]
    public Profile? Borrower { get; set; }

    [ForeignKey(nameof(ApprovedBy))]
    public Profile? Approver { get; set; }
}
