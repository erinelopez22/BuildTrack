using System.ComponentModel.DataAnnotations;

namespace BuildTrack.API.DTOs.Projects;

public class ProjectDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = "active";
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public Guid? ProjectManagerId { get; set; }
    public string? ProjectManagerName { get; set; }
    public decimal? EstimatedCost { get; set; }
    public bool IsHidden { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public int MemberCount { get; set; }
}

public class CreateProjectRequest
{
    [Required, MinLength(2)]
    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = "active";
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public Guid? ProjectManagerId { get; set; }
    public decimal? EstimatedCost { get; set; }
    public bool IsHidden { get; set; } = false;
}

public class UpdateProjectRequest
{
    public string? Name { get; set; }
    public string? Code { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public Guid? ProjectManagerId { get; set; }
    public decimal? EstimatedCost { get; set; }
    public bool? IsHidden { get; set; }
}

public class ProjectMemberDto
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid UserId { get; set; }
    public string? Role { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? UserFullName { get; set; }
    public string? UserEmail { get; set; }
    public string? UserUsername { get; set; }
    public string? UserAvatarUrl { get; set; }
}

public class AddProjectMemberRequest
{
    [Required]
    public Guid UserId { get; set; }
    public string? Role { get; set; }
}

public class ProjectProgressDto
{
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public bool HasQuotation { get; set; }
    public List<MaterialProgressDto> Materials { get; set; } = [];
    public double OverallProgress { get; set; }
}

public class MaterialProgressDto
{
    public Guid QuotationItemId { get; set; }
    public string MaterialName { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public decimal TotalQuantity { get; set; }
    public decimal ReceivedQuantity { get; set; }
    public double ProgressPercent { get; set; }
}
