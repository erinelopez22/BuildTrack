using BuildTrack.API.DTOs.Assets;
using BuildTrack.API.DTOs.Inventory;
using BuildTrack.API.DTOs.Notifications;
using BuildTrack.API.DTOs.Quotations;
using BuildTrack.API.DTOs.Tracking;

namespace BuildTrack.API.Services.Interfaces;

public interface IInventoryService
{
    Task<List<ProjectInventoryDto>> GetAllAsync(Guid? projectId);
    Task<List<InventoryTransactionDto>> GetTransactionsAsync(Guid? projectId, Guid? skuId, int limit);
    Task<(InventoryTransactionDto? txn, string? error)> CreateTransactionAsync(
        CreateInventoryTransactionRequest request, Guid userId);
}

public interface ICompanyAssetService
{
    Task<List<CompanyAssetDto>> GetAllAsync(string? search, string? assetType);
    Task<CompanyAssetDto?> GetByIdAsync(Guid id);
    Task<CompanyAssetDto> CreateAsync(CreateCompanyAssetRequest request, Guid createdBy);
    Task<CompanyAssetDto?> UpdateAsync(Guid id, UpdateCompanyAssetRequest request);
    Task<bool> DeleteAsync(Guid id);
    Task<List<BorrowTransactionDto>> GetBorrowsAsync(Guid assetId);
    Task<List<BorrowTransactionDto>> GetAllBorrowsAsync(Guid? projectId);
    Task<(BorrowTransactionDto? txn, string? error)> BorrowAsync(BorrowAssetRequest request, Guid userId);
    Task<(BorrowTransactionDto? txn, string? error)> ReturnAsync(Guid txnId, ReturnAssetRequest request, Guid userId);
}

public interface IQuotationService
{
    Task<List<ProjectQuotationDto>> GetAllAsync(Guid? projectId);
    Task<ProjectQuotationDto?> GetByIdAsync(Guid id);
    Task<ProjectQuotationDto> CreateAsync(CreateQuotationRequest request, Guid createdBy);
    Task<bool> DeleteAsync(Guid id);
    Task<QuotationItemDto?> UpdateItemAsync(Guid quotationId, Guid itemId, UpdateQuotationItemRequest request);
    Task<List<QuotationChangeRequestDto>> GetChangeRequestsAsync(Guid? projectId, string? status);
    Task<QuotationChangeRequestDto> CreateChangeRequestAsync(CreateChangeRequestRequest request, Guid userId);
    Task<QuotationChangeRequestDto?> ReviewChangeRequestAsync(Guid id, ReviewChangeRequestRequest request, Guid reviewedBy);
}

public interface INotificationService
{
    Task<List<NotificationDto>> GetForUserAsync(Guid userId, bool unreadOnly);
    Task CreateAsync(CreateNotificationRequest request);
    Task MarkReadAsync(Guid id, Guid userId);
    Task MarkAllReadAsync(Guid userId);
    Task DeleteAsync(Guid id, Guid userId);
}

public interface IDashboardService
{
    Task<DashboardStatsDto> GetStatsAsync(Guid userId);
}

public interface IAuditLogService
{
    Task LogAsync(string tableName, Guid? recordId, string action,
        string? oldValues, string? newValues, Guid? userId);
    Task<List<object>> GetLogsAsync(string? tableName, Guid? recordId, Guid? userId, int limit);
}

public interface IJwtService
{
    string GenerateAccessToken(Guid userId, string email, IEnumerable<string> roles);
    string GenerateRefreshToken();
    Guid? ValidateAccessToken(string token);
}

public interface ITrackingService
{
    Task<List<TrackingAssignmentDto>> GetAssignmentsAsync(Guid orderId);
    Task<List<TrackingAssignmentDto>> SaveAssignmentsAsync(Guid orderId, SaveTrackingRequest request, Guid userId);
    Task<TrackingAssignmentDto?> MarkArrivedAsync(Guid assignmentId, Guid userId);
    Task<TrackingAssignmentDto?> HoldDriverAsync(Guid assignmentId, string? remarks, Guid userId);
    Task<TrackingAssignmentDto?> ResumeDriverAsync(Guid assignmentId, string? remarks, Guid userId);
    Task<TrackingAssignmentDto?> SaveRemarksAsync(Guid assignmentId, string? remarks);
    Task<TrackingAssignmentDto?> SaveReceiverEvidenceAsync(Guid assignmentId, List<TrackingEvidenceItem> evidence);
}
