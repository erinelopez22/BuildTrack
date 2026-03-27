using System.ComponentModel.DataAnnotations;

namespace BuildTrack.API.DTOs.Quotations;

public class ProjectQuotationDto
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public Guid? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public string? Notes { get; set; }
    public string? Category { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<QuotationItemDto> Items { get; set; } = [];
}

public class QuotationItemDto
{
    public Guid Id { get; set; }
    public Guid QuotationId { get; set; }
    public string MaterialName { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public decimal Quantity { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateQuotationRequest
{
    [Required]
    public Guid ProjectId { get; set; }

    public string? Notes { get; set; }
    public string? Category { get; set; } = "initial";

    [Required, MinLength(1)]
    public List<CreateQuotationItemRequest> Items { get; set; } = [];
}

public class CreateQuotationItemRequest
{
    [Required, MinLength(1)]
    public string MaterialName { get; set; } = string.Empty;

    public string? Unit { get; set; }

    [Range(0.0001, double.MaxValue)]
    public decimal Quantity { get; set; }
}

public class UpdateQuotationItemRequest
{
    public string? MaterialName { get; set; }
    public string? Unit { get; set; }
    public decimal? Quantity { get; set; }
}

public class QuotationChangeRequestDto
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public Guid? QuotationId { get; set; }
    public string? ChangeType { get; set; }
    public string Status { get; set; } = string.Empty;
    public Guid? RequestedBy { get; set; }
    public string? RequestedByName { get; set; }
    public Guid? ReviewedBy { get; set; }
    public string? ReviewedByName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewRemarks { get; set; }
    public string? Payload { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateChangeRequestRequest
{
    [Required]
    public Guid ProjectId { get; set; }

    public Guid? QuotationId { get; set; }
    public string? ChangeType { get; set; }
    public string? Payload { get; set; }
}

public class ReviewChangeRequestRequest
{
    [Required]
    public string Status { get; set; } = string.Empty; // approved or rejected
    public string? ReviewRemarks { get; set; }
}
