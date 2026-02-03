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
public class UserRolesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public UserRolesController(ApplicationDbContext db) => _db = db;

    private Guid? UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    private async Task<bool> IsAdminAsync() =>
        await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && (ur.Role == "admin" || ur.Role == "super_admin"));

    [HttpGet]
    public async Task<ActionResult<List<UserRoleResponse>>> GetUserRoles([FromQuery] Guid? userId, CancellationToken ct)
    {
        if (!await IsAdminAsync() && userId != UserId) return Forbid();
        var query = _db.UserRoles.AsNoTracking();
        if (userId.HasValue) query = query.Where(ur => ur.UserId == userId.Value);
        var list = await query.ToListAsync(ct);
        return Ok(list.Select(ur => new UserRoleResponse(ur.Id, ur.UserId, ur.Role, ur.CreatedAt)).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<UserRoleResponse>> AddRole([FromBody] CreateUserRoleRequest req, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var exists = await _db.UserRoles.AnyAsync(ur => ur.UserId == req.UserId && ur.Role == req.Role, ct);
        if (exists) return BadRequest(new { message = "User already has this role." });
        var ur = new UserRole
        {
            Id = Guid.NewGuid(),
            UserId = req.UserId,
            Role = req.Role,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = UserId
        };
        _db.UserRoles.Add(ur);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetUserRoles), new { userId = req.UserId }, new UserRoleResponse(ur.Id, ur.UserId, ur.Role, ur.CreatedAt));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> RemoveRole(Guid id, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var ur = await _db.UserRoles.FindAsync(new object[] { id }, ct);
        if (ur == null) return NotFound();
        _db.UserRoles.Remove(ur);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record UserRoleResponse(Guid Id, Guid UserId, string Role, DateTimeOffset CreatedAt);
public record CreateUserRoleRequest(Guid UserId, string Role);
