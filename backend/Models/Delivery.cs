namespace StockwellApi.Models;

public class Delivery
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string DeliveryNumber { get; set; } = string.Empty;
    public DateTime? DeliveryDate { get; set; }
    public DateTimeOffset? ReceivedDate { get; set; }
    public string? Carrier { get; set; }
    public string? TrackingNumber { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid? ReceivedBy { get; set; }

    public Order? Order { get; set; }
    public ICollection<DeliveryItem> Items { get; set; } = new List<DeliveryItem>();
}
