namespace StockwellApi.Models;

public class DeliveryItem
{
    public Guid Id { get; set; }
    public Guid DeliveryId { get; set; }
    public Guid OrderItemId { get; set; }
    public int QuantityReceived { get; set; }
    public string Condition { get; set; } = "good";
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Delivery? Delivery { get; set; }
    public OrderItem? OrderItem { get; set; }
}
