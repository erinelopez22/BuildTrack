using BuildTrack.API.Data;
using BuildTrack.API.DTOs.Projects;
using BuildTrack.API.Models.Entities;
using BuildTrack.API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Services.Implementations;

public class ProjectService(AppDbContext db) : IProjectService
{
    public async Task<List<ProjectDto>> GetAllAsync(
        bool includeHidden, string? status, string? search, Guid currentUserId,
        Guid? companyId = null, bool isSuperAdmin = false)
    {
        var query = db.Projects
            .Include(p => p.ProjectManager)
            .Include(p => p.Members)
            .AsQueryable();

        // Company scoping
        if (!isSuperAdmin && companyId.HasValue)
            query = query.Where(p => p.CompanyId == companyId.Value);

        if (!includeHidden)
            query = query.Where(p => !p.IsHidden);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.Status == status);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p =>
                p.Name.Contains(search) ||
                (p.Code != null && p.Code.Contains(search)) ||
                (p.Location != null && p.Location.Contains(search)));

        // Exclude deleted
        query = query.Where(p => p.Status != "deleted");

        var projects = await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
        return projects.Select(Map).ToList();
    }

    public async Task<ProjectDto?> GetByIdAsync(Guid id)
    {
        var project = await db.Projects
            .Include(p => p.ProjectManager)
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == id);
        return project == null ? null : Map(project);
    }

    public async Task<ProjectDto> CreateAsync(CreateProjectRequest request, Guid createdBy, Guid? companyId = null)
    {
        var project = new Project
        {
            Name = request.Name,
            Code = request.Code,
            Location = request.Location,
            Description = request.Description,
            Status = request.Status,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            ProjectManagerId = request.ProjectManagerId,
            EstimatedCost = request.EstimatedCost,
            IsHidden = request.IsHidden,
            CompanyId = companyId,
            CreatedBy = createdBy
        };
        db.Projects.Add(project);

        // Auto-add creator as a member
        db.ProjectMembers.Add(new ProjectMember
        {
            ProjectId = project.Id,
            UserId = createdBy,
            Role = "project_manager",
            CreatedBy = createdBy
        });

        await db.SaveChangesAsync();
        await db.Entry(project).Reference(p => p.ProjectManager).LoadAsync();
        await db.Entry(project).Collection(p => p.Members).LoadAsync();
        return Map(project);
    }

    public async Task<ProjectDto?> UpdateAsync(Guid id, UpdateProjectRequest request, Guid updatedBy)
    {
        var project = await db.Projects
            .Include(p => p.ProjectManager)
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (project == null) return null;

        if (request.Name != null) project.Name = request.Name;
        if (request.Code != null) project.Code = request.Code;
        if (request.Location != null) project.Location = request.Location;
        if (request.Description != null) project.Description = request.Description;
        if (request.Status != null) project.Status = request.Status;
        if (request.StartDate.HasValue) project.StartDate = request.StartDate;
        if (request.EndDate.HasValue) project.EndDate = request.EndDate;
        if (request.ProjectManagerId.HasValue) project.ProjectManagerId = request.ProjectManagerId;
        if (request.EstimatedCost.HasValue) project.EstimatedCost = request.EstimatedCost;
        if (request.IsHidden.HasValue) project.IsHidden = request.IsHidden.Value;
        project.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Map(project);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var project = await db.Projects.FindAsync(id);
        if (project == null) return false;
        project.Status = "deleted";
        project.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<ProjectMemberDto>> GetMembersAsync(Guid projectId)
    {
        var members = await db.ProjectMembers
            .Include(pm => pm.User)
            .Where(pm => pm.ProjectId == projectId)
            .ToListAsync();
        return members.Select(MapMember).ToList();
    }

    public async Task<ProjectMemberDto> AddMemberAsync(Guid projectId, AddProjectMemberRequest request, Guid addedBy)
    {
        var existing = await db.ProjectMembers
            .FirstOrDefaultAsync(pm => pm.ProjectId == projectId && pm.UserId == request.UserId);

        if (existing != null)
        {
            existing.Role = request.Role;
            await db.SaveChangesAsync();
            await db.Entry(existing).Reference(pm => pm.User).LoadAsync();
            return MapMember(existing);
        }

        var member = new ProjectMember
        {
            ProjectId = projectId,
            UserId = request.UserId,
            Role = request.Role,
            CreatedBy = addedBy
        };
        db.ProjectMembers.Add(member);
        await db.SaveChangesAsync();
        await db.Entry(member).Reference(pm => pm.User).LoadAsync();
        return MapMember(member);
    }

    public async Task<bool> RemoveMemberAsync(Guid projectId, Guid userId)
    {
        var member = await db.ProjectMembers
            .FirstOrDefaultAsync(pm => pm.ProjectId == projectId && pm.UserId == userId);
        if (member == null) return false;
        db.ProjectMembers.Remove(member);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<ProjectProgressDto> GetProgressAsync(Guid projectId)
    {
        var project = await db.Projects.FindAsync(projectId);
        var quotation = await db.ProjectQuotations
            .Include(pq => pq.Items)
            .FirstOrDefaultAsync(pq => pq.ProjectId == projectId && pq.Category == "initial");

        if (quotation == null)
            return new ProjectProgressDto
            {
                ProjectId = projectId,
                ProjectName = project?.Name ?? "",
                HasQuotation = false,
                Materials = [],
                OverallProgress = 0
            };

        // Get delivered/closed order IDs for this project
        var deliveredOrderIds = await db.Orders
            .Where(o => o.ProjectId == projectId &&
                (o.Status == "delivered" || o.Status == "fully_received" ||
                 o.Status == "partially_received" || o.Status == "closed"))
            .Select(o => o.Id)
            .ToListAsync();

        // Get all delivered order items for this project (with SKU for name-based matching)
        var deliveredItems = await db.OrderItems
            .Include(oi => oi.Sku)
            .Where(oi => deliveredOrderIds.Contains(oi.OrderId))
            .ToListAsync();

        var materials = quotation.Items.Select(item =>
        {
            // Match by FK first; fall back to SKU name match for manually created orders
            var matched = deliveredItems.Where(oi =>
                (oi.QuotationItemId.HasValue && oi.QuotationItemId.Value == item.Id) ||
                (!oi.QuotationItemId.HasValue &&
                 string.Equals(oi.Sku?.Name, item.MaterialName, StringComparison.OrdinalIgnoreCase)));
            var received = matched.Sum(oi => oi.QuantityOrdered);
            var progress = item.Quantity > 0 ? Math.Min(100.0, (double)received / (double)item.Quantity * 100) : 0;
            return new MaterialProgressDto
            {
                QuotationItemId = item.Id,
                MaterialName = item.MaterialName,
                Unit = item.Unit,
                TotalQuantity = item.Quantity,
                ReceivedQuantity = received,
                ProgressPercent = Math.Round(progress, 1)
            };
        }).ToList();

        var totalQuoted = materials.Sum(m => m.TotalQuantity);
        var totalReceived = materials.Sum(m => m.ReceivedQuantity);
        var overall = totalQuoted > 0
            ? Math.Round((double)totalReceived / (double)totalQuoted * 100, 1)
            : 0;

        return new ProjectProgressDto
        {
            ProjectId = projectId,
            ProjectName = project?.Name ?? "",
            HasQuotation = true,
            Materials = materials,
            OverallProgress = overall
        };
    }

    public async Task<List<object>> GetActivityAsync(Guid projectId, int limit)
    {
        // Collect all record IDs associated with this project
        var orderIds = await db.Orders
            .Where(o => o.ProjectId == projectId)
            .Select(o => (Guid?)o.Id)
            .ToListAsync();

        var quotationIds = await db.ProjectQuotations
            .Where(q => q.ProjectId == projectId)
            .Select(q => (Guid?)q.Id)
            .ToListAsync();

        var projectIdStr = projectId.ToString();
        var relatedIds = orderIds.Concat(quotationIds).Append((Guid?)projectId).ToHashSet();

        var logs = await db.AuditLogs
            .Include(al => al.User)
            .Where(al =>
                // Match by RecordId being one of the project's related entities
                relatedIds.Contains(al.RecordId) ||
                // Or match by projectId string appearing anywhere in NewValues
                (al.NewValues != null && al.NewValues.Contains(projectIdStr)))
            .OrderByDescending(al => al.CreatedAt)
            .Take(limit)
            .Select(al => (object)new
            {
                al.Id,
                al.TableName,
                al.Action,
                al.CreatedAt,
                UserName = al.User != null ? al.User.FullName : "System",
                al.NewValues
            })
            .ToListAsync();
        return logs;
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private static ProjectDto Map(Project p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Code = p.Code,
        Location = p.Location,
        Description = p.Description,
        Status = p.Status,
        StartDate = p.StartDate,
        EndDate = p.EndDate,
        ProjectManagerId = p.ProjectManagerId,
        ProjectManagerName = p.ProjectManager?.FullName,
        EstimatedCost = p.EstimatedCost,
        IsHidden = p.IsHidden,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
        CreatedBy = p.CreatedBy,
        MemberCount = p.Members.Count
    };

    private static ProjectMemberDto MapMember(ProjectMember pm) => new()
    {
        Id = pm.Id,
        ProjectId = pm.ProjectId,
        UserId = pm.UserId,
        Role = pm.Role,
        CreatedAt = pm.CreatedAt,
        UserFullName = pm.User?.FullName,
        UserEmail = pm.User?.Email,
        UserUsername = pm.User?.Username,
        UserAvatarUrl = pm.User?.AvatarUrl
    };
}
