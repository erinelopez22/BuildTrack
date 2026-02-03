using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockwellApi.Data;

namespace StockwellApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfilesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public ProfilesController(ApplicationDbContext db) => _db = db;

    private Guid? UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    private async Task<bool> IsAdminAsync() =>
        await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && (ur.Role == "admin" || ur.Role == "super_admin"));

    [HttpGet]
    public async Task<ActionResult<List<ProfileResponse>>> GetProfiles([FromQuery] bool? isActive, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var query = _db.Profiles.AsNoTracking();
        if (isActive.HasValue) query = query.Where(p => p.IsActive == isActive.Value);
        var list = await query.OrderBy(p => p.FullName).ToListAsync(ct);
        var roles = await _db.UserRoles.AsNoTracking().Where(ur => list.Select(x => x.Id).Contains(ur.UserId)).ToListAsync(ct);
        var result = list.Select(p => new ProfileResponse(
            p.Id, p.Email, p.FullName, p.Phone, p.AvatarUrl, p.IsActive,
            roles.Where(r => r.UserId == p.Id).Select(r => r.Role).ToList(),
            p.CreatedAt, p.UpdatedAt
        )).ToList();
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProfileResponse>> GetProfile(Guid id, CancellationToken ct)
    {
        if (id != UserId && !await IsAdminAsync()) return Forbid();
        var p = await _db.Profiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p == null) return NotFound();
        var roles = await _db.UserRoles.AsNoTracking().Where(ur => ur.UserId == id).Select(ur => ur.Role).ToListAsync(ct);
        return Ok(new ProfileResponse(p.Id, p.Email, p.FullName, p.Phone, p.AvatarUrl, p.IsActive, roles, p.CreatedAt, p.UpdatedAt));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProfileResponse>> UpdateProfile(Guid id, [FromBody] UpdateProfileRequest req, CancellationToken ct)
    {
        if (id != UserId && !await IsAdminAsync()) return Forbid();
        var p = await _db.Profiles.FindAsync(new object[] { id }, ct);
        if (p == null) return NotFound();
        if (req.FullName != null) p.FullName = req.FullName;
        if (req.Phone != null) p.Phone = req.Phone;
        if (req.AvatarUrl != null) p.AvatarUrl = req.AvatarUrl;
        if (req.IsActive.HasValue && await IsAdminAsync()) p.IsActive = req.IsActive.Value;
        p.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        var roles = await _db.UserRoles.AsNoTracking().Where(ur => ur.UserId == id).Select(ur => ur.Role).ToListAsync(ct);
        return Ok(new ProfileResponse(p.Id, p.Email, p.FullName, p.Phone, p.AvatarUrl, p.IsActive, roles, p.CreatedAt, p.UpdatedAt));
    }
}
public partial record ProfileResponse(
    Guid Id,
    string Email,
    string? FullName,
    string? Phone,
    string? AvatarUrl,
    bool IsActive,
    List<string> Roles,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);
//public record ProfileResponse(Guid Id, string Email, string? FullName, string? Phone, string? AvatarUrl, bool IsActive, List<string> Roles, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public record UpdateProfileRequest(string? FullName, string? Phone, string? AvatarUrl, bool? IsActive);
