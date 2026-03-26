using BuildTrack.API.Data;
using BuildTrack.API.DTOs.Companies;
using BuildTrack.API.Models.Entities;
using BuildTrack.API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Services.Implementations;

public class CompanyService(AppDbContext db) : ICompanyService
{
    public async Task<List<CompanyDto>> GetAllAsync()
    {
        return await db.Companies
            .OrderBy(c => c.Name)
            .Select(c => new CompanyDto
            {
                Id = c.Id,
                Name = c.Name,
                Address = c.Address,
                Phone = c.Phone,
                Email = c.Email,
                IsActive = c.IsActive,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
                UserCount = c.Users.Count(u => u.IsActive)
            })
            .ToListAsync();
    }

    public async Task<List<CompanyListItem>> GetListAsync()
    {
        return await db.Companies
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new CompanyListItem { Id = c.Id, Name = c.Name })
            .ToListAsync();
    }

    public async Task<CompanyDto?> GetByIdAsync(Guid id)
    {
        return await db.Companies
            .Where(c => c.Id == id)
            .Select(c => new CompanyDto
            {
                Id = c.Id,
                Name = c.Name,
                Address = c.Address,
                Phone = c.Phone,
                Email = c.Email,
                IsActive = c.IsActive,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
                UserCount = c.Users.Count(u => u.IsActive)
            })
            .FirstOrDefaultAsync();
    }

    public async Task<(CompanyDto? company, string? error)> CreateAsync(CreateCompanyRequest request)
    {
        if (await db.Companies.AnyAsync(c => c.Name.ToLower() == request.Name.ToLower()))
            return (null, "Company name already exists.");

        var company = new Company
        {
            Name = request.Name,
            Address = request.Address,
            Phone = request.Phone,
            Email = request.Email
        };

        db.Companies.Add(company);
        await db.SaveChangesAsync();

        return (await GetByIdAsync(company.Id), null);
    }

    public async Task<CompanyDto?> UpdateAsync(Guid id, UpdateCompanyRequest request)
    {
        var company = await db.Companies.FindAsync(id);
        if (company == null) return null;

        if (request.Name != null) company.Name = request.Name;
        if (request.Address != null) company.Address = request.Address;
        if (request.Phone != null) company.Phone = request.Phone;
        if (request.Email != null) company.Email = request.Email;
        if (request.IsActive.HasValue) company.IsActive = request.IsActive.Value;
        company.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var company = await db.Companies.FindAsync(id);
        if (company == null) return false;

        // Soft-delete: deactivate instead of removing
        company.IsActive = false;
        company.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }
}
