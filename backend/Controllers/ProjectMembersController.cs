using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockwellApi.Data;
using StockwellApi.Models;

namespace StockwellApi.Controllers;

[ApiController]
[Route("api/projects/{projectId:guid}/members")]
[Authorize]
public class ProjectMembersController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public ProjectMembersController(ApplicationDbContext db) => _db = db;

    private Guid? UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    private async Task<bool> IsAdminAsync() =>
        await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && (ur.Role == "admin" || ur.Role == "super_admin"));

    private async Task<bool> HasProjectAccessAsync(Guid projectId) =>
        await IsAdminAsync() || await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == UserId);

    [HttpGet]
    public async Task<ActionResult<List<ProjectMemberResponse>>> GetMembers(Guid projectId, CancellationToken ct)
    {
        if (!await HasProjectAccessAsync(projectId)) return NotFound();
        var members = await _db.ProjectMembers
            .AsNoTracking()
            .Include(pm => pm.User)
            .Where(pm => pm.ProjectId == projectId)
            .ToListAsync(ct);
        return Ok(members.Select(pm => new ProjectMemberResponse(
            pm.Id, pm.ProjectId, pm.UserId, pm.Role, pm.CreatedAt,
            pm.User != null ? new MemberProfileSummary(pm.User.Id, pm.User.Email, pm.User.FullName) : null
        )).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<ProjectMemberResponse>> AddMember(Guid projectId, [FromBody] CreateProjectMemberRequest req, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var exists = await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == req.UserId, ct);
        if (exists) return BadRequest(new { message = "User is already a member." });
        var pm = new ProjectMember
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            UserId = req.UserId,
            Role = req.Role,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = UserId
        };
        _db.ProjectMembers.Add(pm);
        await _db.SaveChangesAsync(ct);
        var user = await _db.Profiles.AsNoTracking().FirstOrDefaultAsync(p => p.Id == req.UserId, ct);
        return CreatedAtAction(nameof(GetMembers), new { projectId }, new ProjectMemberResponse(pm.Id, pm.ProjectId, pm.UserId, pm.Role, pm.CreatedAt, user != null ? new MemberProfileSummary(user.Id, user.Email, user.FullName) : null));
    }

    [HttpPut("{memberId:guid}")]
    public async Task<ActionResult<ProjectMemberResponse>> UpdateMember(Guid projectId, Guid memberId, [FromBody] UpdateProjectMemberRequest req, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var pm = await _db.ProjectMembers.Include(pm => pm.User).FirstOrDefaultAsync(pm => pm.Id == memberId && pm.ProjectId == projectId, ct);
        if (pm == null) return NotFound();
        if (req.Role != null) pm.Role = req.Role;
        await _db.SaveChangesAsync(ct);
        return Ok(new ProjectMemberResponse(pm.Id, pm.ProjectId, pm.UserId, pm.Role, pm.CreatedAt, pm.User != null ? new MemberProfileSummary(pm.User.Id, pm.User.Email, pm.User.FullName) : null));
    }

    [HttpDelete("{memberId:guid}")]
    public async Task<ActionResult> RemoveMember(Guid projectId, Guid memberId, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var pm = await _db.ProjectMembers.FirstOrDefaultAsync(pm => pm.Id == memberId && pm.ProjectId == projectId, ct);
        if (pm == null) return NotFound();
        _db.ProjectMembers.Remove(pm);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record ProjectMemberResponse(Guid Id, Guid ProjectId, Guid UserId, string Role, DateTimeOffset CreatedAt, MemberProfileSummary? User);
public record MemberProfileSummary(Guid Id, string Email, string? FullName);
public record CreateProjectMemberRequest(Guid UserId, string Role);
public record UpdateProjectMemberRequest(string? Role);
