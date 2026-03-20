using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BuildTrack.API.Models.Entities;

[Table("ProjectQuotations")]
public class ProjectQuotation
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Guid? CreatedBy { get; set; }

    public string? Notes { get; set; }

    [MaxLength(50)]
    public string? Category { get; set; } // initial, additional

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey(nameof(ProjectId))]
    public Project Project { get; set; } = null!;

    [ForeignKey(nameof(CreatedBy))]
    public Profile? Creator { get; set; }

    public ICollection<QuotationItem> Items { get; set; } = [];
    public ICollection<QuotationChangeRequest> ChangeRequests { get; set; } = [];
}
