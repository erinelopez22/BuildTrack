using BuildTrack.API.Data;
using BuildTrack.API.DTOs.SKUs;
using BuildTrack.API.Models.Entities;
using BuildTrack.API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Services.Implementations;

public class SkuService(AppDbContext db) : ISkuService
{
    public async Task<List<SkuDto>> GetAllAsync(
        string? search, bool? isActive, string? category, string? sortBy, string? sortOrder)
    {
        var query = db.SKUs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s =>
                s.Name.Contains(search) ||
                s.SkuCode.Contains(search) ||
                (s.Category != null && s.Category.Contains(search)));

        if (isActive.HasValue)
            query = query.Where(s => s.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(s => s.Category == category);

        query = (sortBy?.ToLower(), sortOrder?.ToLower()) switch
        {
            ("sku_code", "desc") => query.OrderByDescending(s => s.SkuCode),
            ("sku_code", _) => query.OrderBy(s => s.SkuCode),
            ("created_at", "desc") => query.OrderByDescending(s => s.CreatedAt),
            ("created_at", _) => query.OrderBy(s => s.CreatedAt),
            (_, "desc") => query.OrderByDescending(s => s.Name),
            _ => query.OrderBy(s => s.Name)
        };

        var skus = await query.ToListAsync();
        return skus.Select(Map).ToList();
    }

    public async Task<SkuDto?> GetByIdAsync(Guid id)
    {
        var sku = await db.SKUs.FindAsync(id);
        return sku == null ? null : Map(sku);
    }

    public async Task<(SkuDto? sku, string? error)> CreateAsync(CreateSkuRequest request, Guid createdBy)
    {
        if (await db.SKUs.AnyAsync(s => s.SkuCode.ToLower() == request.SkuCode.ToLower()))
            return (null, "SKU code already exists.");

        var sku = new SKU
        {
            SkuCode = request.SkuCode,
            Name = request.Name,
            Description = request.Description,
            Category = request.Category,
            UnitOfMeasure = request.UnitOfMeasure,
            Brand = request.Brand,
            Specifications = request.Specifications,
            DefaultMinThreshold = request.DefaultMinThreshold,
            IsActive = request.IsActive,
            CreatedBy = createdBy
        };
        db.SKUs.Add(sku);
        await db.SaveChangesAsync();
        return (Map(sku), null);
    }

    public async Task<SkuDto?> UpdateAsync(Guid id, UpdateSkuRequest request)
    {
        var sku = await db.SKUs.FindAsync(id);
        if (sku == null) return null;

        if (request.Name != null) sku.Name = request.Name;
        if (request.Description != null) sku.Description = request.Description;
        if (request.Category != null) sku.Category = request.Category;
        if (request.UnitOfMeasure != null) sku.UnitOfMeasure = request.UnitOfMeasure;
        if (request.Brand != null) sku.Brand = request.Brand;
        if (request.Specifications != null) sku.Specifications = request.Specifications;
        if (request.DefaultMinThreshold.HasValue) sku.DefaultMinThreshold = request.DefaultMinThreshold.Value;
        if (request.IsActive.HasValue) sku.IsActive = request.IsActive.Value;
        sku.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Map(sku);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var sku = await db.SKUs.FindAsync(id);
        if (sku == null) return false;
        // Soft-delete
        sku.IsActive = false;
        sku.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    private static SkuDto Map(SKU s) => new()
    {
        Id = s.Id,
        SkuCode = s.SkuCode,
        Name = s.Name,
        Description = s.Description,
        Category = s.Category,
        UnitOfMeasure = s.UnitOfMeasure,
        Brand = s.Brand,
        Specifications = s.Specifications,
        DefaultMinThreshold = s.DefaultMinThreshold,
        IsActive = s.IsActive,
        CreatedAt = s.CreatedAt,
        UpdatedAt = s.UpdatedAt
    };
}
