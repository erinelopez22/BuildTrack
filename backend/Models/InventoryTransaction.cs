namespace StockwellApi.Models;

public class InventoryTransaction
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid SkuId { get; set; }
    public string TransactionType { get; set; } = string.Empty; // transaction_type
    public int Quantity { get; set; }
    public int QuantityBefore { get; set; }
    public int QuantityAfter { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public Guid? TransferProjectId { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }

    public Project? Project { get; set; }
    public Sku? Sku { get; set; }
    public Profile? Creator { get; set; }
}
