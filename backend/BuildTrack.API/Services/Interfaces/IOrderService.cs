using BuildTrack.API.DTOs.Orders;

namespace BuildTrack.API.Services.Interfaces;

public interface IOrderService
{
    Task<List<OrderDto>> GetAllAsync(string? status, Guid? projectId, string? search, Guid currentUserId, Guid? companyId = null, bool isSuperAdmin = false);
    Task<OrderDto?> GetByIdAsync(Guid id);
    Task<(OrderDto? order, string? error)> CreateAsync(CreateOrderRequest request, Guid createdBy);
    Task<OrderDto?> UpdateAsync(Guid id, UpdateOrderRequest request, Guid updatedBy);
    Task<bool> DeleteAsync(Guid id, Guid deletedBy);
    Task<OrderDto?> SubmitForApprovalAsync(Guid id, Guid userId);
    Task<OrderDto?> ApproveAsync(Guid id, string? notes, Guid approvedBy);
    Task<OrderDto?> RejectAsync(Guid id, string reason, Guid rejectedBy);
    Task<OrderDto?> UpdateStatusAsync(Guid id, string status, string? notes, Guid userId);
}
