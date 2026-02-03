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
public class ProjectsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public ProjectsController(ApplicationDbContext db) => _db = db;

    private Guid? UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    private async Task<bool> IsAdminAsync() =>
        await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && (ur.Role == "admin" || ur.Role == "super_admin"));

    private async Task<bool> HasProjectAccessAsync(Guid projectId)
    {
        if (UserId == null) return false;
        if (await IsAdminAsync()) return true;
        return await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == UserId);
    }

    [HttpGet]
    public async Task<ActionResult<List<ProjectResponse>>> GetProjects([FromQuery] string? status, CancellationToken ct)
    {
        var isSuperAdmin = await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && ur.Role == "super_admin", ct);
        var query = _db.Projects.AsNoTracking();
        if (!string.IsNullOrEmpty(status) && status != "all")
            query = query.Where(p => p.Status == status);
        if (!isSuperAdmin)
            query = query.Where(p => p.Status != "deleted");
        var list = await query.OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
        var result = new List<ProjectResponse>();
        foreach (var p in list)
        {
            if (!await HasProjectAccessAsync(p.Id)) continue;
            result.Add(ToResponse(p));
        }
        return Ok(result);
    }

    //[HttpPost]
    //public async Task<ActionResult<List<ProjectResponse>>> GetProjects2([FromQuery] string? status, CancellationToken ct)
    //{
    //    var isSuperAdmin = await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && ur.Role == "super_admin", ct);
    //    var query = _db.Projects.AsNoTracking();
    //    if (!string.IsNullOrEmpty(status) && status != "all")
    //        query = query.Where(p => p.Status == status);
    //    if (!isSuperAdmin)
    //        query = query.Where(p => p.Status != "deleted");
    //    var list = await query.OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
    //    var result = new List<ProjectResponse>();
    //    foreach (var p in list)
    //    {
    //        if (!await HasProjectAccessAsync(p.Id)) continue;
    //        result.Add(ToResponse(p));
    //    }
    //    return Ok(result);
    //}

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectResponse>> GetProject(Guid id, CancellationToken ct)
    {
        if (!await HasProjectAccessAsync(id)) return NotFound();
        var p = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p == null) return NotFound();
        return Ok(ToResponse(p));
    }

    [HttpPost]
    public async Task<ActionResult<ProjectResponse>> CreateProject([FromBody] CreateProjectRequest req, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var p = new Project
        {
            Id = Guid.NewGuid(),
            Name = req.Name,
            Code = req.Code,
            Location = req.Location,
            Description = req.Description,
            Status = req.Status ?? "active",
            StartDate = req.StartDate,
            EndDate = req.EndDate,
            ProjectManagerId = req.ProjectManagerId,
            EstimatedCost = req.EstimatedCost,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            CreatedBy = UserId
        };
        _db.Projects.Add(p);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetProject), new { id = p.Id }, ToResponse(p));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectResponse>> UpdateProject(Guid id, [FromBody] UpdateProjectRequest req, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var p = await _db.Projects.FindAsync(new object[] { id }, ct);
        if (p == null) return NotFound();
        p.Name = req.Name ?? p.Name;
        p.Code = req.Code ?? p.Code;
        p.Location = req.Location ?? p.Location;
        p.Description = req.Description ?? p.Description;
        p.Status = req.Status ?? p.Status;
        p.StartDate = req.StartDate ?? p.StartDate;
        p.EndDate = req.EndDate ?? p.EndDate;
        p.ProjectManagerId = req.ProjectManagerId ?? p.ProjectManagerId;
        p.EstimatedCost = req.EstimatedCost ?? p.EstimatedCost;
        p.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToResponse(p));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> DeleteProject(Guid id, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var p = await _db.Projects.FindAsync(new object[] { id }, ct);
        if (p == null) return NotFound();
        _db.Projects.Remove(p);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static ProjectResponse ToResponse(Project p) => new(
        p.Id, p.Name, p.Code, p.Location, p.Description, p.Status, p.StartDate, p.EndDate,
        p.ProjectManagerId, p.EstimatedCost, p.CreatedAt, p.UpdatedAt, p.CreatedBy
    );
}

public record ProjectResponse(Guid Id, string Name, string? Code, string? Location, string? Description, string Status,
    DateTime? StartDate, DateTime? EndDate, Guid? ProjectManagerId, decimal? EstimatedCost,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, Guid? CreatedBy);

public record CreateProjectRequest(string Name, string? Code, string? Location, string? Description, string? Status,
    DateTime? StartDate, DateTime? EndDate, Guid? ProjectManagerId, decimal? EstimatedCost);

public record UpdateProjectRequest(string? Name, string? Code, string? Location, string? Description, string? Status,
    DateTime? StartDate, DateTime? EndDate, Guid? ProjectManagerId, decimal? EstimatedCost);
