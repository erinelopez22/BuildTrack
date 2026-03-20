using System.ComponentModel.DataAnnotations;

namespace BuildTrack.API.DTOs.Auth;

public record LoginRequest(
    [Required] string LoginId,  // email or username
    [Required] string Password
);

public record RefreshTokenRequest([Required] string RefreshToken);

public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, MinLength(8)] string NewPassword
);

public class AuthResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserSessionDto User { get; set; } = null!;
}

public class UserSessionDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Username { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Phone { get; set; }
    public bool SmsOptIn { get; set; }
    public bool IsActive { get; set; }
    public List<string> Roles { get; set; } = [];
}
