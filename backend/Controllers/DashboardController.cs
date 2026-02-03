using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockwellApi.Data;

namespace StockwellApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public DashboardController(ApplicationDbContext db) => _db = db;

    private Guid? UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    private async Task<bool> IsAdminAsync() =>
        await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && (ur.Role == "admin" || ur.Role == "super_admin"));

    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsResponse>> GetStats(CancellationToken ct)
    {
        var activeProjects = await _db.Projects.CountAsync(p => p.Status == "active", ct);
        var totalSkus = await _db.Skus.CountAsync(s => s.IsActive, ct);
        var activeOrders = await _db.Orders
            .Where(o => new[] { "for_approval", "approved", "submitted", "delivered", "preparing", "in_transit", "on_hold" }.Contains(o.Status))
            .Join(_db.Projects.Where(p => p.Status == "active"), o => o.ProjectId, p => p.Id, (o, p) => o)
            .CountAsync(ct);
        var activeMembers = 0;
        if (await IsAdminAsync())
            activeMembers = await _db.Profiles.CountAsync(p => p.IsActive, ct);

        return Ok(new DashboardStatsResponse(activeProjects, totalSkus, activeOrders, activeMembers));
    }

    [HttpGet("recent-orders")]
    public async Task<ActionResult<List<RecentOrderResponse>>> GetRecentOrders([FromQuery] int limit = 10, CancellationToken ct=default)
    {
        var orders = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Project)
            .OrderByDescending(o => o.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);

        var result = new List<RecentOrderResponse>();
        foreach (var o in orders)
        {
            if (UserId == null) break;
            var hasAccess = await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && (ur.Role == "admin" || ur.Role == "super_admin"), ct)
                || await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == o.ProjectId && pm.UserId == UserId, ct);
            if (!hasAccess) continue;
            result.Add(new RecentOrderResponse(
                o.Id, o.OrderNumber, o.Project?.Name, o.Status, o.SupplierName, o.TotalAmount, o.CreatedAt
            ));
        }
        return Ok(result);
    }
}

public record DashboardStatsResponse(int ActiveProjects, int TotalSkus, int ActiveOrders, int ActiveMembers);
public record RecentOrderResponse(Guid Id, string OrderNumber, string? ProjectName, string Status, string? SupplierName, decimal? TotalAmount, DateTimeOffset CreatedAt);
