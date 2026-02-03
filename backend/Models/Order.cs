namespace StockwellApi.Models;

public class Order
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string OrderType { get; set; } = "PO";
    public string Status { get; set; } = "draft"; // order_status
    public string? SupplierName { get; set; }
    public string? SupplierContact { get; set; }
    public DateTime? ExpectedDeliveryDate { get; set; }
    public string? Notes { get; set; }
    public decimal? TotalAmount { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public Guid? RejectedBy { get; set; }
    public DateTimeOffset? RejectedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid CreatedBy { get; set; }

    public Project? Project { get; set; }
    public Profile? Creator { get; set; }
    public Profile? Approver { get; set; }
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}
