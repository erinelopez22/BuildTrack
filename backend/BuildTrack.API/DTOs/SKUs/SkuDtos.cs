using System.ComponentModel.DataAnnotations;

namespace BuildTrack.API.DTOs.SKUs;

public class SkuDto
{
    public Guid Id { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? UnitOfMeasure { get; set; }
    public string? Brand { get; set; }
    public string? Specifications { get; set; }
    public decimal DefaultMinThreshold { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateSkuRequest
{
    [Required, MinLength(1)]
    public string SkuCode { get; set; } = string.Empty;

    [Required, MinLength(2)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? UnitOfMeasure { get; set; }
    public string? Brand { get; set; }
    public string? Specifications { get; set; }
    public decimal DefaultMinThreshold { get; set; } = 0;
    public bool IsActive { get; set; } = true;
}

public class UpdateSkuRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? UnitOfMeasure { get; set; }
    public string? Brand { get; set; }
    public string? Specifications { get; set; }
    public decimal? DefaultMinThreshold { get; set; }
    public bool? IsActive { get; set; }
}
