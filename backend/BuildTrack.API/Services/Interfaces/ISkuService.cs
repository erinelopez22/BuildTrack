using BuildTrack.API.DTOs.SKUs;

namespace BuildTrack.API.Services.Interfaces;

public interface ISkuService
{
    Task<List<SkuDto>> GetAllAsync(string? search, bool? isActive, string? category, string? sortBy, string? sortOrder, Guid? companyId = null, bool isSuperAdmin = false);
    Task<SkuDto?> GetByIdAsync(Guid id);
    Task<(SkuDto? sku, string? error)> CreateAsync(CreateSkuRequest request, Guid createdBy, Guid? companyId = null);
    Task<SkuDto?> UpdateAsync(Guid id, UpdateSkuRequest request);
    Task<bool> DeleteAsync(Guid id);
    Task<int> SeedConstructionMaterialsAsync(Guid createdBy, Guid? companyId = null);
}
