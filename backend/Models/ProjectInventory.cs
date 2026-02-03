namespace StockwellApi.Models;

public class ProjectInventory
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid SkuId { get; set; }
    public int OnHand { get; set; }
    public int Reserved { get; set; }
    public int? MinThreshold { get; set; }
    public string? LocationInSite { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Project? Project { get; set; }
    public Sku? Sku { get; set; }
}
