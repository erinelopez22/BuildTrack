using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockwellApi.Data;
using StockwellApi.Models;

namespace StockwellApi.Controllers;

[ApiController]
[Route("api/projects/{projectId:guid}/quotation")]
[Authorize]
public class QuotationsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public QuotationsController(ApplicationDbContext db) => _db = db;

    private Guid? UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    private async Task<bool> IsAdminAsync() =>
        await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && (ur.Role == "admin" || ur.Role == "super_admin"));

    private async Task<bool> HasProjectAccessAsync(Guid projectId) =>
        await IsAdminAsync() || await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == UserId);

    [HttpGet]
    public async Task<ActionResult<QuotationResponse>> GetQuotation(Guid projectId, CancellationToken ct)
    {
        var qq = new ProjectQuotation();
        //qq.Id = "0";
        if (!await HasProjectAccessAsync(projectId)) return NotFound();
        var q = await _db.ProjectQuotations
            .AsNoTracking()
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.ProjectId == projectId, ct);
        if (q == null) return Ok(ToResponse(qq));
        return Ok(ToResponse(q));
    }

   

    [HttpHead]
    public async Task<IActionResult> HasQuotation(Guid projectId, CancellationToken ct)
    {
        if (!await HasProjectAccessAsync(projectId)) return NotFound();
        var exists = await _db.ProjectQuotations.AnyAsync(x => x.ProjectId == projectId, ct);
        return exists ? Ok() : NotFound();
    }

    [HttpPost]
    public async Task<ActionResult<QuotationResponse>> CreateOrUpdateQuotation(Guid projectId, [FromBody] UpsertQuotationRequest req, CancellationToken ct)
    {
        Console.WriteLine("CreateOrUpdateQuotation");
        Console.WriteLine(UserId);
        Console.WriteLine(projectId);
        Console.WriteLine(req);
        Console.WriteLine(req.Notes);
        Console.WriteLine(req.Items);
        Console.WriteLine(await HasProjectAccessAsync(projectId));
        Console.WriteLine(await IsAdminAsync());


        if (UserId == null) return Unauthorized();
        if (!await HasProjectAccessAsync(projectId)) return Forbid();
        var isPm = await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == UserId && pm.Role == "project_manager", ct);
        if (!await IsAdminAsync() && !isPm) return Forbid();

        var existing = await _db.ProjectQuotations.Include(x => x.Items).FirstOrDefaultAsync(x => x.ProjectId == projectId, ct);
        if (existing != null)
        {
            existing.Notes = req.Notes ?? existing.Notes;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            var incomingIds = req.Items?.Select(i => i.Id).Where(i => i.HasValue && i.Value != Guid.Empty).Select(i => i!.Value).ToHashSet() ?? new HashSet<Guid>();
            foreach (var item in existing.Items.ToList())
            {
                if (!incomingIds.Contains(item.Id))
                    _db.QuotationItems.Remove(item);
            }
            if (req.Items != null)
            {
                foreach (var it in req.Items)
                {
                    if (it.Id.HasValue && it.Id.Value != Guid.Empty)
                    {
                        var existingItem = existing.Items.FirstOrDefault(i => i.Id == it.Id);
                        if (existingItem != null)
                        {
                            existingItem.MaterialName = it.MaterialName ?? existingItem.MaterialName;
                            existingItem.Unit = it.Unit ?? existingItem.Unit;
                            existingItem.Quantity = it.Quantity;
                            existingItem.UpdatedAt = DateTimeOffset.UtcNow;
                        }
                        else
                            AddNewQuotationItem(existing, it);
                    }
                    else
                        AddNewQuotationItem(existing, it);
                }
            }
            await _db.SaveChangesAsync(ct);
            var updated = await _db.ProjectQuotations.Include(x => x.Items).FirstAsync(x => x.Id == existing.Id, ct);
            return Ok(ToResponse(updated));
        }

        var quotation = new ProjectQuotation
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            CreatedBy = UserId.Value,
            Notes = req.Notes,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        _db.ProjectQuotations.Add(quotation);
        await _db.SaveChangesAsync(ct);
        if (req.Items != null)
        {
            foreach (var it in req.Items)
            {
                _db.QuotationItems.Add(new QuotationItem
                {
                    Id = Guid.NewGuid(),
                    QuotationId = quotation.Id,
                    MaterialName = it.MaterialName ?? "",
                    Unit = it.Unit ?? "EA",
                    Quantity = it.Quantity,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow,
                });
            }
            await _db.SaveChangesAsync(ct);
        }
        var created = await _db.ProjectQuotations.Include(x => x.Items).FirstAsync(x => x.Id == quotation.Id, ct);
        return CreatedAtAction(nameof(GetQuotation), new { projectId }, ToResponse(created));
    }

    private void AddNewQuotationItem(ProjectQuotation quotation, QuotationItemRequest it)
    {
        _db.QuotationItems.Add(new QuotationItem
        {
            Id = Guid.NewGuid(),
            QuotationId = quotation.Id,
            MaterialName = it.MaterialName ?? "",
            Unit = it.Unit ?? "EA",
            Quantity = it.Quantity,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
    }

    [HttpDelete]
    public async Task<ActionResult> DeleteQuotation(Guid projectId, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();
        var q = await _db.ProjectQuotations.Include(x => x.Items).FirstOrDefaultAsync(x => x.ProjectId == projectId, ct);
        if (q == null) return NotFound();
        _db.QuotationItems.RemoveRange(q.Items);
        _db.ProjectQuotations.Remove(q);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static QuotationResponse ToResponse(ProjectQuotation q) => new(
        q.Id, q.ProjectId, q.CreatedBy, q.Notes, q.CreatedAt, q.UpdatedAt,
        q.Items?.Select(i => new QuotationItemResponse(i.Id, i.QuotationId, i.MaterialName, i.Unit, i.Quantity, i.CreatedAt, i.UpdatedAt)).ToList() ?? new List<QuotationItemResponse>()
    );
}

public record QuotationResponse(Guid Id, Guid ProjectId, Guid CreatedBy, string? Notes, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, List<QuotationItemResponse> Items);
public record QuotationItemResponse(Guid Id, Guid QuotationId, string MaterialName, string Unit, int Quantity, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public record UpsertQuotationRequest(string? Notes, List<QuotationItemRequest>? Items);
public record QuotationItemRequest(Guid? Id, string? MaterialName, string? Unit, int Quantity);
