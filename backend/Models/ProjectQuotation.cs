namespace StockwellApi.Models;

public class ProjectQuotation
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CreatedBy { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Project? Project { get; set; }
    public ICollection<QuotationItem> Items { get; set; } = new List<QuotationItem>();
}
