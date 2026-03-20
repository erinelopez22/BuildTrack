using System.ComponentModel.DataAnnotations;

namespace BuildTrack.API.DTOs.Orders;

public class OrderDto
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string? OrderType { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    public string? SupplierContact { get; set; }
    public DateTime? ExpectedDeliveryDate { get; set; }
    public string? Notes { get; set; }
    public decimal? TotalAmount { get; set; }
    public Guid? ApprovedBy { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public Guid? RejectedBy { get; set; }
    public string? RejectedByName { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectionReason { get; set; }
    public Guid? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? OnTransitAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public List<OrderItemDto> Items { get; set; } = [];
}

public class OrderItemDto
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid SkuId { get; set; }
    public string? SkuCode { get; set; }
    public string? SkuName { get; set; }
    public string? Unit { get; set; }
    public Guid? QuotationItemId { get; set; }
    public decimal QuantityOrdered { get; set; }
    public decimal QuantityReceived { get; set; }
    public decimal? UnitPrice { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateOrderRequest
{
    [Required]
    public Guid ProjectId { get; set; }

    public string? OrderType { get; set; }
    public string? SupplierName { get; set; }
    public string? SupplierContact { get; set; }
    public DateTime? ExpectedDeliveryDate { get; set; }
    public string? Notes { get; set; }

    [Required, MinLength(1)]
    public List<CreateOrderItemRequest> Items { get; set; } = [];
}

public class CreateOrderItemRequest
{
    public Guid? SkuId { get; set; }

    // If SkuId is null, the service will find or create a SKU from MaterialName
    public string? MaterialName { get; set; }
    public string? Unit { get; set; }

    public Guid? QuotationItemId { get; set; }

    [Range(0.0001, double.MaxValue)]
    public decimal QuantityOrdered { get; set; }

    public decimal? UnitPrice { get; set; }
    public string? Notes { get; set; }
}

public class UpdateOrderRequest
{
    public string? SupplierName { get; set; }
    public string? SupplierContact { get; set; }
    public DateTime? ExpectedDeliveryDate { get; set; }
    public string? Notes { get; set; }
    public string? Status { get; set; }
}

public class ApproveOrderRequest
{
    public string? Notes { get; set; }
}

public class RejectOrderRequest
{
    [Required]
    public string Reason { get; set; } = string.Empty;
}

public class UpdateOrderStatusRequest
{
    [Required]
    public string Status { get; set; } = string.Empty;
    public string? Notes { get; set; }
}
