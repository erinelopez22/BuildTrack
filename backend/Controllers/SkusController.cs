using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockwellApi.Data;
using StockwellApi.Models;

namespace StockwellApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SkusController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public SkusController(ApplicationDbContext db) => _db = db;

    private Guid? UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    private async Task<bool> IsAdminAsync() =>
        await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && (ur.Role == "admin" || ur.Role == "super_admin"));

    [HttpGet]
    public async Task<ActionResult<List<SkuResponse>>> GetSkus([FromQuery] bool? isActive, CancellationToken ct)
    {
        var query = _db.Skus.AsNoTracking();
        if (isActive.HasValue) query = query.Where(s => s.IsActive == isActive.Value);
        var list = await query.OrderBy(s => s.Name).ToListAsync(ct);
        return Ok(list.Select(ToResponse).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SkuResponse>> GetSku(Guid id, CancellationToken ct)
    {
        var s = await _db.Skus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s == null) return NotFound();
        return Ok(ToResponse(s));
    }

    [HttpPost]
    public async Task<ActionResult<SkuResponse>> CreateSku([FromBody] CreateSkuRequest req, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();

        var skuCode = req.SkuCode;
        if (string.IsNullOrWhiteSpace(skuCode))
            skuCode = $"SKU-{(await _db.Skus.CountAsync(ct) + 1):D6}";

        var s = new Sku
        {
            Id = Guid.NewGuid(),
            SkuCode = skuCode,
            Name = req.Name,
            Description = req.Description,
            Category = req.Category,
            UnitOfMeasure = req.UnitOfMeasure ?? "EA",
            Brand = req.Brand,
            Specifications = req.Specifications,
            DefaultMinThreshold = req.DefaultMinThreshold ?? 10,
            IsActive = req.IsActive ?? true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            CreatedBy = UserId
        };
        _db.Skus.Add(s);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetSku), new { id = s.Id }, ToResponse(s));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SkuResponse>> UpdateSku(Guid id, [FromBody] UpdateSkuRequest req, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var s = await _db.Skus.FindAsync(new object[] { id }, ct);
        if (s == null) return NotFound();
        if (req.Name != null) s.Name = req.Name;
        if (req.Description != null) s.Description = req.Description;
        if (req.Category != null) s.Category = req.Category;
        if (req.UnitOfMeasure != null) s.UnitOfMeasure = req.UnitOfMeasure;
        if (req.Brand != null) s.Brand = req.Brand;
        if (req.Specifications != null) s.Specifications = req.Specifications;
        if (req.DefaultMinThreshold.HasValue) s.DefaultMinThreshold = req.DefaultMinThreshold.Value;
        if (req.IsActive.HasValue) s.IsActive = req.IsActive.Value;
        s.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToResponse(s));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> DeleteSku(Guid id, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var s = await _db.Skus.FindAsync(new object[] { id }, ct);
        if (s == null) return NotFound();
        _db.Skus.Remove(s);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static SkuResponse ToResponse(Sku s) => new(
        s.Id, s.SkuCode, s.Name, s.Description, s.Category, s.UnitOfMeasure, s.Brand, s.Specifications,
        s.DefaultMinThreshold, s.IsActive, s.CreatedAt, s.UpdatedAt, s.CreatedBy
    );
}

public record SkuResponse(Guid Id, string SkuCode, string Name, string? Description, string? Category, string UnitOfMeasure,
    string? Brand, string? Specifications, int DefaultMinThreshold, bool IsActive, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, Guid? CreatedBy);

public record CreateSkuRequest(string? SkuCode, string Name, string? Description, string? Category, string? UnitOfMeasure, string? Brand, string? Specifications, int? DefaultMinThreshold, bool? IsActive);
public record UpdateSkuRequest(string? Name, string? Description, string? Category, string? UnitOfMeasure, string? Brand, string? Specifications, int? DefaultMinThreshold, bool? IsActive);
