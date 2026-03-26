using System.ComponentModel.DataAnnotations;

namespace BuildTrack.API.DTOs.Companies;

public class CompanyDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int UserCount { get; set; }
}

public class CompanyListItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class CreateCompanyRequest
{
    [Required, MinLength(2)]
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
}

public class UpdateCompanyRequest
{
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool? IsActive { get; set; }
}
