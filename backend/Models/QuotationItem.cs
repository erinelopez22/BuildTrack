namespace StockwellApi.Models;

public class QuotationItem
{
    public Guid Id { get; set; }
    public Guid QuotationId { get; set; }
    public string MaterialName { get; set; } = string.Empty;
    public string Unit { get; set; } = "EA";
    public int Quantity { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ProjectQuotation? Quotation { get; set; }
}
