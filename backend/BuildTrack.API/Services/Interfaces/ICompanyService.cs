using BuildTrack.API.DTOs.Companies;

namespace BuildTrack.API.Services.Interfaces;

public interface ICompanyService
{
    Task<List<CompanyDto>> GetAllAsync();
    Task<List<CompanyListItem>> GetListAsync();
    Task<CompanyDto?> GetByIdAsync(Guid id);
    Task<(CompanyDto? company, string? error)> CreateAsync(CreateCompanyRequest request);
    Task<CompanyDto?> UpdateAsync(Guid id, UpdateCompanyRequest request);
    Task<bool> DeleteAsync(Guid id);
}
