using BuildTrack.API.DTOs.SKUs;

namespace BuildTrack.API.Services.Interfaces;

public interface ISkuService
{
    Task<List<SkuDto>> GetAllAsync(string? search, bool? isActive, string? category, string? sortBy, string? sortOrder);
    Task<SkuDto?> GetByIdAsync(Guid id);
    Task<(SkuDto? sku, string? error)> CreateAsync(CreateSkuRequest request, Guid createdBy);
    Task<SkuDto?> UpdateAsync(Guid id, UpdateSkuRequest request);
    Task<bool> DeleteAsync(Guid id);
}
