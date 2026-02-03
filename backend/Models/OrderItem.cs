namespace StockwellApi.Models;

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid SkuId { get; set; }
    public int QuantityOrdered { get; set; }
    public int QuantityReceived { get; set; }
    public decimal? UnitPrice { get; set; }
    public string? Notes { get; set; }
    public Guid? QuotationItemId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Order? Order { get; set; }
    public Sku? Sku { get; set; }
}
