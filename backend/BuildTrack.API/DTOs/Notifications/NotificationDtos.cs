namespace BuildTrack.API.DTOs.Notifications;

public class NotificationDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Message { get; set; }
    public string? Type { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateNotificationRequest
{
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Message { get; set; }
    public string? Type { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
}

public class DashboardStatsDto
{
    public int ActiveProjects { get; set; }
    public int PendingOrders { get; set; }
    public int StockItems { get; set; }
    public int TotalUsers { get; set; }
    public int TotalAssets { get; set; }
    public int PendingQuotationRequests { get; set; }
    public int PendingBorrowReturnRequests { get; set; }
    public List<OrderStatusCountDto> OrdersByStatus { get; set; } = [];
    public List<RecentOrderDto> RecentOrders { get; set; } = [];
}

public class OrderStatusCountDto
{
    public string Status { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class RecentOrderDto
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? ProjectName { get; set; }
    public string? SupplierName { get; set; }
    public DateTime CreatedAt { get; set; }
}
