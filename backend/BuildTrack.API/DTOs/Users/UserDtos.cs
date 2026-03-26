using System.ComponentModel.DataAnnotations;

namespace BuildTrack.API.DTOs.Users;

public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Username { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public bool SmsOptIn { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public List<string> Roles { get; set; } = [];
    public Guid? CompanyId { get; set; }
    public string? CompanyName { get; set; }
}

public class CreateUserRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(8)]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string FullName { get; set; } = string.Empty;

    public string? Username { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public bool SmsOptIn { get; set; } = false;
    public string? Role { get; set; }
    public Guid? CompanyId { get; set; }
}

public class UpdateUserRequest
{
    public string? FullName { get; set; }
    public string? Username { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? AvatarUrl { get; set; }
    public bool? SmsOptIn { get; set; }
    public bool? IsActive { get; set; }
    public Guid? CompanyId { get; set; }
}

public class AssignRoleRequest
{
    [Required]
    public string Role { get; set; } = string.Empty;
}
